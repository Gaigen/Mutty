import { getDomain } from './helpers';
import { useLinkBrowser } from '../../../../hooks/useLinkBrowser';

export function GenericPreview({ url }: { url: string }) {
  const domain = getDomain(url);
  const displayUrl = url.length > 100 ? url.slice(0, 100) + '\u2026' : url;
  const { open, openInBrowser } = useLinkBrowser();

  return (
    <a
      href={url}
      className="link-preview-generic"
      onClick={(e) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          openInBrowser(url);
        } else {
          open(url);
        }
      }}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          openInBrowser(url);
        }
      }}
      style={{ cursor: 'pointer' }}
      title={`${url}\nClick to preview / Ctrl+Click to open in browser`}
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
