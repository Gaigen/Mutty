import { getDomain } from './helpers';

export function GenericPreview({ url }: { url: string }) {
  const domain = getDomain(url);
  const displayUrl = url.length > 100 ? url.slice(0, 100) + '\u2026' : url;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="link-preview-generic"
    >
      <div className="lp-generic-icon">
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
          alt=""
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
      <div className="lp-generic-body">
        <span className="lp-generic-domain">{domain}</span>
        <span className="lp-generic-url">{displayUrl}</span>
      </div>
    </a>
  );
}
