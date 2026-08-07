import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import hljs from 'highlight.js';
import { useLinkBrowser } from '../../../hooks/useLinkBrowser';

const COLLAPSE_HEIGHT = 120; // px

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      background: 'var(--mutty-code-bg)',
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

// react-markdown v10: code inside <pre> = block, outside = inline.
// We detect block by checking if the code element has a className (language-xxx)
// OR is wrapped in <pre> (fenced code block without language).
// We use a context flag set by the `pre` component to reliably distinguish.
const CodeBlockContext = React.createContext(false);

export function MarkdownMessage({ content }: { content: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const [isLong, setIsLong] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const linkBrowser = useLinkBrowser();

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
 pre: ({ children }) => (
 <CodeBlockContext.Provider value={true}>{children}</CodeBlockContext.Provider>
 ),
 code: ({ className, children }) => {
 // Блочный код = fenced code block (внутри <pre>, флаг через контекст)
 // ИЛИ имеет className "language-xxx"
 const isInPre = React.useContext(CodeBlockContext);
 const isBlock = !!className || isInPre;
 
 if (isBlock) {
 return <CodeBlock className={className}>{children}</CodeBlock>;
 }
 return <InlineCode>{children}</InlineCode>;
 },
            a: ({ children, href }) => (
              <a
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  if (!href) return;
                  // Ctrl/Cmd+Click → open iframe preview
                  if (e.ctrlKey || e.metaKey) {
                    linkBrowser.open(href);
                  } else {
                    linkBrowser.openInBrowser(href);
                  }
                }}
                onMouseDown={(e) => {
                  // Middle-click → open in browser directly
                  if (e.button === 1) {
                    e.preventDefault();
                    if (href) linkBrowser.openInBrowser(href);
                  }
                }}
                style={{ cursor: 'pointer' }}
                title={`${href}\nClick to open in browser / Ctrl+Click to preview`}
              >
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
