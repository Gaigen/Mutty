import * as React from 'react';
import type { ReceivedChatMessage } from '@livekit/components-react';
import { useMaybeLayoutContext } from '@livekit/components-react';

/**
 * Updates the LiveKit layout context unread message badge.
 */
export function useUnreadMessages(chatMessages: ReceivedChatMessage[]) {
  const lastReadMsgAt = React.useRef(0);
  const layoutContext = useMaybeLayoutContext();

  React.useEffect(() => {
    if (!layoutContext || chatMessages.length === 0) return;
    const widget = layoutContext.widget;
    const widgetState = widget.state as { showChat?: boolean; unreadMessages?: number };

    // Chat is open — mark all as read
    if (widgetState?.showChat) {
      lastReadMsgAt.current = chatMessages[chatMessages.length - 1]?.timestamp ?? 0;
      // Reset badge to 0
      if (widgetState?.unreadMessages && widgetState.unreadMessages > 0) {
        widget.dispatch?.({ msg: 'unread_msg', count: 0 });
      }
      return;
    }

    // Chat is closed — count unread
    const unread = chatMessages.filter(
      (msg) => !lastReadMsgAt.current || (msg.timestamp ?? 0) > lastReadMsgAt.current,
    ).length;
    if (unread > 0 && widgetState?.unreadMessages !== unread) {
      widget.dispatch?.({ msg: 'unread_msg', count: unread });
    }
  }, [chatMessages, layoutContext?.widget]);
}
