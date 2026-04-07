import * as React from 'react';
import type { ReceivedChatMessage } from '@livekit/components-react';

/**
 * Manages chat scroll position, auto-scroll on new messages,
 * "N new" badge when scrolled up, and scroll-to-bottom action.
 */
export function useChatScroll(messages: ReceivedChatMessage[]) {
  const ulRef = React.useRef<HTMLUListElement>(null);
  const atBottomRef = React.useRef(true);
  const [atBottom, setAtBottom] = React.useState(true);
  const [newMsgCount, setNewMsgCount] = React.useState(0);

  const scrollToBottom = React.useCallback(() => {
    ulRef.current?.scrollTo({ top: ulRef.current.scrollHeight, behavior: 'smooth' });
    setNewMsgCount(0);
    atBottomRef.current = true;
    setAtBottom(true);
  }, []);

  const handleScroll = React.useCallback(() => {
    const ul = ulRef.current;
    if (!ul) return;
    const isAtBottom = ul.scrollHeight - ul.scrollTop - ul.clientHeight < 64;
    atBottomRef.current = isAtBottom;
    setAtBottom(isAtBottom);
    if (isAtBottom) setNewMsgCount(0);
  }, []);

  // Auto-scroll on new messages (if user was already at bottom)
  React.useEffect(() => {
    if (atBottomRef.current) {
      ulRef.current?.scrollTo({ top: ulRef.current.scrollHeight });
      setNewMsgCount(0);
    } else {
      setNewMsgCount((n) => n + 1);
    }
  }, [messages]);

  return { ulRef, atBottom, newMsgCount, scrollToBottom, handleScroll };
}
