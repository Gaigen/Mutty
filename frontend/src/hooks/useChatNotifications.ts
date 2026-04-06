import * as React from 'react';
import type { ReceivedChatMessage } from '@livekit/components-react';
import { playChatNotificationSound } from '../lib/play-chat-notification';
import { requestNotificationPermission, sendChatNotification } from '../lib/notify-chat';

interface Props {
  chatMessages: ReceivedChatMessage[];
  avatarMap: Map<string, string>;
}

export function useChatNotifications({ chatMessages, avatarMap }: Props) {
  const prevChatLenForSoundRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    requestNotificationPermission();
  }, []);

  React.useEffect(() => {
    const len = chatMessages.length;
    if (prevChatLenForSoundRef.current === null) {
      prevChatLenForSoundRef.current = len;
      return;
    }
    if (len > prevChatLenForSoundRef.current) {
      const added = chatMessages.slice(prevChatLenForSoundRef.current);
      const remoteMsgs = added.filter((m) => !m.from?.isLocal);
      if (remoteMsgs.length > 0) {
        playChatNotificationSound();
        const msg = remoteMsgs[remoteMsgs.length - 1];
        const sender = msg.from?.name || msg.from?.identity || 'Unknown';
        const body = msg.message ?? '';
        const avatar = avatarMap.get(msg.from?.identity ?? '') || undefined;
        const icon = avatar ? `/avatars/${avatar}.svg` : undefined;
        sendChatNotification(sender, body, icon);
      }
    }
    prevChatLenForSoundRef.current = len;
  }, [chatMessages, avatarMap]);
}
