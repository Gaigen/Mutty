import { FileThumbnail } from './file-thumbnail';
import { getFileIcon, formatFileSize } from '../../../lib/file-transfer';
import type { PendingFile } from '../../../hooks/useImageAttachments';

interface ChatFilePreviewProps {
  files: PendingFile[];
  isSendingFiles: boolean;
  sentCount: number;
  onRemove: (idx: number) => void;
}

export function ChatFilePreview({
  files,
  isSendingFiles,
  sentCount,
  onRemove,
}: ChatFilePreviewProps) {
  if (files.length === 0) return null;

  return (
    <div
      style={{
        padding: '6px 8px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        position: 'relative',
      }}
    >
      {files.map((pf, i) => {
        const isSent = isSendingFiles && i < sentCount;
        const isFile = pf.kind === 'file';

        return (
          <div
            key={i}
            style={{
              opacity: isSent ? 0.3 : 1,
              transition: 'opacity 0.2s ease',
              pointerEvents: isSendingFiles ? 'none' : 'auto',
              position: 'relative',
            }}
          >
            {isFile ? (
              // Non-image file: show icon + name + size
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.12)',
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.85)',
                  maxWidth: 200,
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>
                  {getFileIcon(pf.file.type)}
                </span>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {pf.file.name}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0, fontSize: 10 }}>
                  {formatFileSize(pf.file.size)}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                  aria-label="Remove"
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white',
                    fontSize: 10,
                    lineHeight: 1,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              // Image file: show thumbnail (backward compatible)
              <FileThumbnail file={pf.file} onRemove={() => onRemove(i)} />
            )}
          </div>
        );
      })}

      {isSendingFiles && sentCount < files.length && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          backdropFilter: 'blur(2px)',
          zIndex: 2,
        }}>
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>
            Sending {sentCount + 1}/{files.length}…
          </span>
        </div>
      )}
    </div>
  );
}
