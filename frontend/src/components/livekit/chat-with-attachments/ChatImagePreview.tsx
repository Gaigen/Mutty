import { FileThumbnail } from './file-thumbnail';

interface ChatImagePreviewProps {
  files: File[];
  isSendingImages: boolean;
  sentCount: number;
  onRemove: (idx: number) => void;
}

export function ChatImagePreview({ files, isSendingImages, sentCount, onRemove }: ChatImagePreviewProps) {
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
      {files.map((f, i) => {
        const isSent = isSendingImages && i < sentCount;
        return (
          <div
            key={i}
            style={{
              opacity: isSent ? 0.3 : 1,
              transition: 'opacity 0.2s ease',
              pointerEvents: isSendingImages ? 'none' : 'auto',
            }}
          >
            <FileThumbnail file={f} onRemove={() => onRemove(i)} />
          </div>
        );
      })}
      {isSendingImages && sentCount < files.length && (
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
