import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const COLLAPSE_HEIGHT = 120; // px

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = React.useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const code = String(children).replace(/\n$/, '');

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  if (match) {
    // Fenced code block with language — syntax highlighted
    return (
      <div className="chat-code-block-wrapper" style={{ position: 'relative' }}>
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
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

  // Inline code or code without language
  return (
    <code className={className} style={{
      background: 'rgba(255,255,255,0.08)',
      padding: '1px 5px',
      borderRadius: 3,
      fontSize: '0.9em',
    }}>
      {children}
    </code>
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
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={{
            code: ({ className, children }) => (
              <CodeBlock className={className}>{children}</CodeBlock>
            ),
            a: ({ children, href }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
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
