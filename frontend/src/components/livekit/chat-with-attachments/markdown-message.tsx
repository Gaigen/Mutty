import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { COLLAPSE_CHARS, COLLAPSE_LINES } from './constants';

function PreWithCopy({ children }: { children?: React.ReactNode }) {
  const preRef = React.useRef<HTMLPreElement>(null);
  const [copied, setCopied] = React.useState(false);

  const copy = () => {
    const text = preRef.current?.textContent ?? '';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <div className="chat-code-block-wrapper">
      <pre ref={preRef}>{children}</pre>
      <button type="button" className="chat-code-copy" onClick={copy}>
        {copied ? '✓' : 'copy'}
      </button>
    </div>
  );
}

export function MarkdownMessage({ content }: { content: string }) {
  const [expanded, setExpanded] = React.useState(false);

  const lines = content.split('\n');
  const isLong = content.length > COLLAPSE_CHARS || lines.length > COLLAPSE_LINES;

  return (
    <div className="chat-markdown">
      <div
        className={
          isLong && !expanded
            ? 'chat-markdown-body chat-markdown-collapsed'
            : 'chat-markdown-body'
        }
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={{
            pre: ({ children }) => <PreWithCopy>{children}</PreWithCopy>,
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
          {expanded
            ? '↑ Show less'
            : lines.length > COLLAPSE_LINES
            ? `↓ +${lines.length - COLLAPSE_LINES} lines`
            : `↓ +${content.length - COLLAPSE_CHARS} chars`}
        </button>
      )}
    </div>
  );
}
