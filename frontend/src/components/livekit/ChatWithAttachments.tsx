/**
 * Chat с поддержкой отправки картинок через DataURL в теле сообщения.
 * Полностью обходит байт-стримы (которые ненадёжны в dev-среде),
 * используя только текстовый стрим — который гарантированно работает.
 *
 * Возможности: drag&drop, Ctrl+V paste, thumbnail-превью, автоскролл,
 *              textarea, markdown-рендеринг, код-блоки с copy, collapsible.
 *
 * Реализация: `chat-with-attachments/`
 */
export { ChatWithAttachments } from './chat-with-attachments';
export type { ChatWithAttachmentsProps } from './chat-with-attachments';
