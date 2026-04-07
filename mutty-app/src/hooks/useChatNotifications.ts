import * as React from 'react';
import type { ReceivedChatMessage } from '@livekit/components-react';
import { playChatNotificationSound } from '../lib/play-chat-notification';
import { invoke } from '@tauri-apps/api/core';
import { IMG_PREFIX } from '../components/livekit/chat-with-attachments/constants';

function sendNativeNotification(title: string, body: string) {
  try {
    invoke('send_native_notification', { title, body }).catch(() => {});
  } catch {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      void Notification.requestPermission().then((p) => {
        if (p === 'granted') new Notification(title, { body });
      });
    }
  }
}

interface Props {
  chatMessages: ReceivedChatMessage[];
}

export function useChatNotifications({ chatMessages }: Props) {
  const prevChatLenForSoundRef = React.useRef<number | null>(null);

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
          sendNativeNotification(sender, text);
        }
      }
    }
    prevChatLenForSoundRef.current = len;
  }, [chatMessages]);
}
