/**
 * Chat with image attachment support via DataURL in message body.
 * Bypasses byte streams (unreliable in dev), using only text stream.
 *
 * Features: drag&drop, Ctrl+V paste, thumbnail preview, autoscroll,
 *           textarea, markdown rendering, code blocks with copy, collapsible.
 *
 * Implementation: `chat-with-attachments/`
 */
export { ChatWithAttachments } from './chat-with-attachments';
export type { ChatWithAttachmentsProps } from './chat-with-attachments';
