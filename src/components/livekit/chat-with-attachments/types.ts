import type { MessageFormatter } from '@livekit/components-react';
import type { HTMLAttributes } from 'react';

export interface ChatMessageRow {
  id?: string;
  message: string;
  timestamp?: number;
  editTimestamp?: number;
  from?: { isLocal?: boolean; name?: string; identity?: string };
}

export interface ChatWithAttachmentsProps extends HTMLAttributes<HTMLDivElement> {
  messageFormatter?: MessageFormatter;
  enableAttachments?: boolean;
  onClose?: () => void;
}
