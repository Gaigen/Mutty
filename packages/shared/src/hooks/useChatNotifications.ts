import * as React from 'react';
import type { ReceivedChatMessage } from '@livekit/components-react';
import { playChatNotificationSound } from '../lib/play-chat-notification';
import { usePlatform } from '@/platform';
import { IMG_PREFIX } from '../components/livekit/chat-with-attachments/constants';

interface Props {
  chatMessages: ReceivedChatMessage[];
  avatarMap: Map<string, string>;
}

export function useChatNotifications({ chatMessages, avatarMap }: Props) {
  const { notifications } = usePlatform();
  const prevChatLenForSoundRef = React.useRef<number | null>(null);

  // Request notification permission on mount
  React.useEffect(() => {
    notifications.requestPermission();
  }, [notifications]);

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
        for (const msg of remoteMsgs) {
          const sender = msg.from?.name || msg.from?.identity || 'Unknown';
          const text = msg.message.startsWith(IMG_PREFIX) ? 'Photo' : msg.message;
          const avatar = avatarMap.get(msg.from?.identity ?? '') || undefined;
          const icon = avatar ? `/avatars/${avatar}.svg` : undefined;
          notifications.send(sender, text, { icon });
        }
      }
    }
    prevChatLenForSoundRef.current = len;
  }, [chatMessages, avatarMap, notifications]);
}
