import * as React from 'react';
import { LinkPreview } from '../components/livekit/chat-with-attachments/link-preview';
import { findFirstUrl, hasMultipleUrls } from '../components/livekit/chat-with-attachments/link-preview/helpers';

const SAMPLE_MESSAGES = [
  {
    id: 1,
    author: 'Alice',
    avatar: '🐸',
    time: '10:30',
    text: 'Check out this video! https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    isLocal: false,
  },
  {
    id: 2,
    author: 'Bob',
    avatar: '🐻',
    time: '10:31',
    text: 'Nice! Here is a tweet https://x.com/elonmusk/status/1820685675899072930',
    isLocal: false,
  },
  {
    id: 3,
    author: 'Charlie',
    avatar: '🦊',
    time: '10:32',
    text: 'Listen to this playlist https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    isLocal: false,
  },
  {
    id: 4,
    author: 'Alice',
    avatar: '🐸',
    time: '10:33',
    text: 'Check this repo https://github.com/facebook/react',
    isLocal: false,
  },
  {
    id: 5,
    author: 'Bob',
    avatar: '🐻',
    time: '10:34',
    text: 'Random site https://example.com',
    isLocal: false,
  },
  {
    id: 6,
    author: 'Charlie',
    avatar: '🦊',
    time: '10:35',
    text: 'Multiple links: https://github.com and https://example.com',
    isLocal: false,
  },
  {
    id: 7,
    author: 'You',
    avatar: '🐧',
    time: '10:36',
    text: 'Here is a Twitch stream https://twitch.tv/shroud',
    isLocal: true,
  },
];

function ChatMessage({ msg }: { msg: typeof SAMPLE_MESSAGES[0] }) {
  const url = findFirstUrl(msg.text);
  const hasMultiple = hasMultipleUrls(msg.text);
  const showPreview = url && !hasMultiple;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: msg.isLocal ? 'flex-end' : 'flex-start',
        marginBottom: 16,
      }}
    >
      {!msg.isLocal && (
        <div
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: '#2a2a2a', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 18, marginRight: 10, flexShrink: 0,
          }}
        >
          {msg.avatar}
        </div>
      )}
      <div
        style={{
          maxWidth: 420,
          background: msg.isLocal ? '#6366f1' : '#1e1e2e',
          borderRadius: 12,
          padding: '10px 14px',
        }}
      >
        {!msg.isLocal && (
          <div style={{ fontSize: 12, fontWeight: 600, color: '#818cf8', marginBottom: 4 }}>
            {msg.author}
          </div>
        )}
        <div style={{ fontSize: 14, lineHeight: 1.4, marginBottom: showPreview ? 8 : 0 }}>
          {msg.text}
        </div>
        {showPreview && <LinkPreview url={url} />}
        <div
          style={{
            fontSize: 10,
            color: msg.isLocal ? 'rgba(255,255,255,0.5)' : '#666',
            textAlign: msg.isLocal ? 'right' : 'left',
            marginTop: 4,
          }}
        >
          {msg.time}
        </div>
      </div>
      {msg.isLocal && (
        <div
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: '#6366f1', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 18, marginLeft: 10, flexShrink: 0,
          }}
        >
          {msg.avatar}
        </div>
      )}
    </div>
  );
}

export default function PreviewTestPage() {
  const [customUrl, setCustomUrl] = React.useState('');
  const ulRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (ulRef.current) {
      ulRef.current.scrollTop = ulRef.current.scrollHeight;
    }
  }, []);

  return (
    <div style={{
      maxWidth: 520,
      margin: '20px auto',
      height: 'calc(100vh - 40px)',
      display: 'flex',
      flexDirection: 'column',
      background: '#13131f',
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        fontWeight: 600,
        fontSize: 16,
      }}>
        Messages
      </div>

      <div
        ref={ulRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 12px',
        }}
      >
        {SAMPLE_MESSAGES.map(msg => (
          <ChatMessage key={msg.id} msg={msg} />
        ))}
      </div>

      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        gap: 8,
      }}>
        <input
          type="text"
          value={customUrl}
          onChange={e => setCustomUrl(e.target.value)}
          placeholder="Paste URL to test preview..."
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: 14,
            background: '#1e1e2e',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            color: '#fff',
            outline: 'none',
          }}
        />
      </div>

      {customUrl && (
        <div style={{
          padding: '10px 12px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          <ChatMessage
            msg={{
              id: 999,
              author: 'You',
              avatar: '🐧',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              text: customUrl,
              isLocal: true,
            }}
          />
        </div>
      )}
    </div>
  );
}
