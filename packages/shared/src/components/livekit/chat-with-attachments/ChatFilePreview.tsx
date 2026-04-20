import { FileThumbnail } from './file-thumbnail';
import { getFileIcon, formatFileSize } from '../../../lib/file-transfer';
import type { PendingFile } from '../../../hooks/useImageAttachments';
import type { TransferStatus } from '../../../hooks/useImageAttachments';

interface ChatFilePreviewProps {
  files: PendingFile[];
  isSendingFiles: boolean;
  sentCount: number;
  activeTransfers: TransferStatus[];
  onRemove: (idx: number) => void;
}

export function ChatFilePreview({
  files,
  isSendingFiles,
  sentCount,
  activeTransfers,
  onRemove,
}: ChatFilePreviewProps) {
  if (files.length === 0 && activeTransfers.length === 0) return null;

  return (
    <div
      style={{
        padding: '6px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Pending files to send */}
      {files.map((pf, i) => {
        const isSent = isSendingFiles && i < sentCount;
        return (
          <div
            key={`pending-${i}`}
            style={{
              opacity: isSent ? 0.3 : 1,
              transition: 'opacity 0.2s ease',
              pointerEvents: isSendingFiles ? 'none' : 'auto',
            }}
          >
            <PendingFileRow file={pf} onRemove={() => onRemove(i)} />
          </div>
        );
      })}

      {/* Active transfers — render ALL (even completed) to prevent layout shift */}
      {activeTransfers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {activeTransfers.map((t) => (
            <TransferProgressBar key={t.fileId} transfer={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function PendingFileRow({ file, onRemove }: { file: PendingFile; onRemove: () => void }) {
  const isImage = file.kind === 'image';

  if (isImage) {
    return <FileThumbnail file={file.file} onRemove={onRemove} />;
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 8px', background: 'rgba(255,255,255,0.06)',
      borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)',
      fontSize: 12, color: 'rgba(255,255,255,0.85)', maxWidth: 220,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>
        {getFileIcon(file.file.type)}
      </span>
      <span style={{
        overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap', flex: 1, minWidth: 0,
      }}>
        {file.file.name}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0, fontSize: 10 }}>
        {formatFileSize(file.file.size)}
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        aria-label="Remove"
        style={{
          width: 16, height: 16, borderRadius: '50%',
          background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)',
          color: 'white', fontSize: 10, lineHeight: 1, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

function TransferProgressBar({ transfer }: { transfer: TransferStatus }) {
  const pct = Math.round(transfer.progress * 100);
  const dir = transfer.direction === 'sending' ? '↑' : '↓';
  const isDone = transfer.status !== 'active';

  return (
    <div
      style={{
        // Fixed height container — layout never shifts
        height: 40,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '4px 8px',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.08)',
        opacity: isDone ? 0 : 1,
        transition: 'opacity 0.4s ease',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4,
      }}>
        <span>{dir}</span>
        <span style={{
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {transfer.fileName}
        </span>
        <span style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {isDone ? '✓' : `${pct}%`}
        </span>
      </div>
      <div style={{
        height: 3, borderRadius: 2,
        background: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 2,
          background: transfer.direction === 'sending'
            ? 'rgba(59,130,246,0.8)'
            : 'rgba(34,197,94,0.8)',
          transition: 'width 0.15s ease',
        }} />
      </div>
    </div>
  );
}
