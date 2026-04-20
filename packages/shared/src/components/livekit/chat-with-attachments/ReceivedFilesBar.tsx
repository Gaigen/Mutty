import * as React from 'react';
import { getFileIcon, formatFileSize, isImage, isVideo, isAudio } from '../../../lib/file-transfer';
import type { ReceivedFile } from '../../../hooks/useImageAttachments';

interface ReceivedFilesBarProps {
  files: ReceivedFile[];
  onDownload: (blob: Blob, name: string) => void;
  onRemove: (id: string) => void;
  onOpenFullscreen: (src: string) => void;
}

function FileCard({
  file,
  onDownload,
  onRemove,
  onOpenFullscreen,
}: {
  file: ReceivedFile;
  onDownload: (blob: Blob, name: string) => void;
  onRemove: (id: string) => void;
  onOpenFullscreen: (src: string) => void;
}) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isImage(file.mimeType) || isVideo(file.mimeType) || isAudio(file.mimeType)) {
      const url = URL.createObjectURL(file.blob);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file.blob, file.mimeType]);

  return (
    <div
      style={{
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(file.id)}
        aria-label="Remove"
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid rgba(255,255,255,0.3)',
          color: 'white',
          fontSize: 11,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          zIndex: 2,
        }}
      >
        ×
      </button>

      {/* Image preview */}
      {isImage(file.mimeType) && objectUrl && (
        <img
          src={objectUrl}
          alt={file.name}
          onClick={() => onOpenFullscreen(objectUrl)}
          style={{
            display: 'block',
            width: '100%',
            maxHeight: 200,
            objectFit: 'cover',
            cursor: 'pointer',
          }}
          title="Click to enlarge"
        />
      )}

      {/* Video preview */}
      {isVideo(file.mimeType) && objectUrl && (
        <video
          src={objectUrl}
          controls
          style={{
            display: 'block',
            width: '100%',
            maxHeight: 200,
          }}
        />
      )}

      {/* Audio player */}
      {isAudio(file.mimeType) && objectUrl && (
        <audio
          src={objectUrl}
          controls
          style={{
            display: 'block',
            width: '100%',
            height: 36,
            padding: '4px 8px',
          }}
        />
      )}

      {/* File info + download */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0 }}>
          {getFileIcon(file.mimeType)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {file.name}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
            {formatFileSize(file.size)} · from {file.from}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDownload(file.blob, file.name)}
          style={{
            padding: '3px 10px',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 11,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          ⬇ Save
        </button>
      </div>
    </div>
  );
}

export function ReceivedFilesBar({
  files,
  onDownload,
  onRemove,
  onOpenFullscreen,
}: ReceivedFilesBarProps) {
  if (files.length === 0) return null;

  return (
    <div
      style={{
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        maxHeight: 320,
        overflowY: 'auto',
      }}
    >
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 }}>
        Received files ({files.length})
      </div>
      {files.map((f) => (
        <FileCard
          key={f.id}
          file={f}
          onDownload={onDownload}
          onRemove={onRemove}
          onOpenFullscreen={onOpenFullscreen}
        />
      ))}
    </div>
  );
}
