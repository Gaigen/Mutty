import * as React from 'react';
import DOMPurify from 'dompurify';
import { extractTwitterInfo } from './helpers';

interface OEmbedData {
  html: string;
  url: string;
  author_name: string;
  author_url: string;
}

let twitterScriptAdded = false;

function ensureTwitterScript() {
  if (twitterScriptAdded) return;
  twitterScriptAdded = true;
  const script = document.createElement('script');
  script.src = 'https://platform.twitter.com/widgets.js';
  script.async = true;
  document.body.appendChild(script);
}

export function TwitterPreview({ url }: { url: string }) {
  const [data, setData] = React.useState<OEmbedData | null>(null);
  const [error, setError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const twitterUrl = url.replace('x.com', 'twitter.com');
    fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(twitterUrl)}&omit_script=true`)
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(d => {
        setData(d);
        ensureTwitterScript();
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [url]);

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--mutty-fg-3)' }}>Loading tweet...</div>;
  }

  if (error || !data) {
    return <TwitterCardFallback url={url} />;
  }

  return (
    <div
      className="link-preview-twitter"
      style={{ padding: 8 }}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.html) }}
    />
  );
}

function TwitterCardFallback({ url }: { url: string }) {
  const info = extractTwitterInfo(url);
  if (!info) {
    return <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="link-preview-twitter-card"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 14px',
        textDecoration: 'none', color: 'inherit',
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#1d9bf0', flexShrink: 0 }}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>@{info.username}</div>
        <div style={{ fontSize: 12, color: 'var(--mutty-fg-3)' }}>View on X</div>
      </div>
    </a>
  );
}
