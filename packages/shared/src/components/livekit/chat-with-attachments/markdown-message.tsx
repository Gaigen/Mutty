import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import hljs from 'highlight.js';

const COLLAPSE_HEIGHT = 120; // px

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      background: 'rgba(255,255,255,0.08)',
      padding: '1px 5px',
      borderRadius: 3,
      fontSize: '0.9em',
    }}>
      {children}
    </code>
  );
}

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = React.useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const code = String(children).replace(/\n$/, '');

  // Auto-detect language if not specified
  const detectedLang = React.useMemo(() => {
    if (match?.[1]) return match[1];
    if (code.length < 5) return 'text';
    const result = hljs.highlightAuto(code);
    console.log('[hljs] detected:', result.language, 'relevance:', result.relevance, 'code:', code.slice(0, 40));
    // Only use detection if confidence is reasonable
    if (result.language && result.relevance >= 3) {
      return result.language;
    }
    return 'text';
  }, [code, match]);

  const copy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }).catch(() => {});
    }
  };

  return (
    <div className="chat-code-block-wrapper" style={{ position: 'relative' }}>
      <SyntaxHighlighter
        style={oneDark}
        language={detectedLang}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: 6,
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        {code}
      </SyntaxHighlighter>
      <button type="button" className="chat-code-copy" onClick={copy}>
        {copied ? '✓' : 'copy'}
      </button>
    </div>
  );
}

export function MarkdownMessage({ content }: { content: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const [isLong, setIsLong] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const check = () => {
      if (el.scrollHeight > COLLAPSE_HEIGHT) setIsLong(true);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [content]);

  return (
    <div className="chat-markdown">
      <div
        ref={contentRef}
        className={
          isLong && !expanded
            ? 'chat-markdown-body chat-markdown-collapsed'
            : 'chat-markdown-body'
        }
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            pre: ({ children }) => <>{children}</>,
            code: ({ className, children, node }) => {
              // Блочный код — всегда имеет className "language-xxx"
              // ИЛИ находится внутри <pre> (фenced без языка)
              const isBlock = !!className || node?.position?.start.line !== node?.position?.end.line;
              
              if (isBlock) {
                return <CodeBlock className={className}>{children}</CodeBlock>;
              }
              return <InlineCode>{children}</InlineCode>;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      {isLong && (
        <button
          type="button"
          className="chat-expand-btn"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? '↑ Show less' : '↓ Show more'}
        </button>
      )}
    </div>
  );
}
