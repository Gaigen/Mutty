import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import hljs from 'highlight.js/lib/core';

// Register common languages for auto-detection
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import sql from 'highlight.js/lib/languages/sql';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import dockerfile from 'highlight.js/lib/languages/dockerfile';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('css', css);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('php', php);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('dockerfile', dockerfile);

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
