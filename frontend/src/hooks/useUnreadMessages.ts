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
    if (
      widgetState?.showChat &&
      chatMessages.length > 0 &&
      lastReadMsgAt.current !== chatMessages[chatMessages.length - 1]?.timestamp
    ) {
      lastReadMsgAt.current = chatMessages[chatMessages.length - 1]?.timestamp ?? 0;
      return;
    }
    const unread = chatMessages.filter(
      (msg) => !lastReadMsgAt.current || (msg.timestamp ?? 0) > lastReadMsgAt.current,
    ).length;
    if (unread > 0 && widgetState?.unreadMessages !== unread) {
      widget.dispatch?.({ msg: 'unread_msg', count: unread });
    }
  }, [chatMessages, layoutContext?.widget]);
}
