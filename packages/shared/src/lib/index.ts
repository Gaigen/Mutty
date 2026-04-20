// Agent control
export { AGENT_CONTROL_TOPIC, QUALITY_OPTIONS, DEFAULT_STATUS, parseStatusFromAttributes, sendControlCommand } from './agent-control';
export type { AgentState, Mode, Quality, AgentStatus } from './agent-control';

// Avatar utils
export { getAvatarColor, getInitials } from './avatar-utils';

// Chat constants
export { MAX_IMAGE_BYTES, ACCEPT_IMAGES, MAX_TEXT_LEN, IMG_PREFIX, COLLAPSE_CHARS, COLLAPSE_LINES } from './chat-constants';

// Notifications
export { initNotifyChat, requestNotificationPermission, sendChatNotification } from './notify-chat';

// Sound
export { playChatNotificationSound } from './play-chat-notification';

// Stream stats
export { PING_HISTORY_SIZE, computeBitrate } from './stream-stats';

// File transfer protocol
export {
  FILE_TRANSFER_TOPIC,
  CHUNK_SIZE,
  MAX_FILE_BYTES,
  ACCEPT_ALL_FILES,
  FileMsgType,
  generateTransferId,
  encodeWireMessage,
  decodeWireMessage,
  sha256Blob,
  splitFileIntoChunks,
  assembleChunks,
  formatFileSize,
  getFileIcon,
  isImage,
  isVideo,
  isAudio,
} from './file-transfer';
export type { FileMeta, FileChunk, FileDone, FileCancel, FileWireMessage, TransferProgress } from './file-transfer';

// Utils
export { cn } from './utils';
