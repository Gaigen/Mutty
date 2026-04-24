import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface ChatToastData {
  id: number;
  sender: string;
  message: string;
  avatar?: string;
}

let nextId = 0;
const toasts: ChatToastData[] = [];
const listeners = new Set<(t: ChatToastData[]) => void>();

function pushToast(toast: ChatToastData) {
  toasts.push(toast);
  if (toasts.length > 3) toasts.shift();
  listeners.forEach((fn) => fn([...toasts]));
}

function dismissToast(id: number) {
  const idx = toasts.findIndex((t) => t.id === id);
  if (idx >= 0) toasts.splice(idx, 1);
  listeners.forEach((fn) => fn([...toasts]));
}

export function useChatToasts() {
  const [items, setItems] = useState<ChatToastData[]>([]);
  useEffect(() => {
    const fn = (t: ChatToastData[]) => setItems(t);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return { items, dismiss: dismissToast };
}

export function notifyChatMessage(sender: string, message: string, avatar?: string) {
  pushToast({ id: nextId++, sender, message, avatar });
}

function ChatToastItem({ toast, onDismiss }: { toast: ChatToastData; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const preview = toast.message.length > 80 ? toast.message.slice(0, 80) + '...' : toast.message;

  return (
    <div
      className="flex items-start gap-2 p-3 rounded-lg bg-[var(--mutty-dropdown-bg)] border border-[var(--mutty-border-2)] shadow-lg animate-slide-in-right"
      style={{ maxWidth: 320 }}
    >
      {toast.avatar ? (
        <img
          src={`/avatars/${toast.avatar}.svg`}
          alt=""
          className="w-8 h-8 rounded-full flex-shrink-0 object-contain bg-[var(--mutty-surface-1)]"
        />
      ) : (
        <div className="w-8 h-8 rounded-full flex-shrink-0 bg-[var(--mutty-accent-4)] flex items-center justify-center text-xs text-[var(--mutty-accent-2)] font-medium">
          {toast.sender.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[var(--mutty-fg-1)] truncate">{toast.sender}</span>
          <button
            type="button"
            onClick={onDismiss}
            className="text-[var(--mutty-fg-3)] hover:text-[var(--mutty-fg-1)] transition-colors flex-shrink-0"
          >
            <X size={12} />
          </button>
        </div>
        <p className="text-xs text-[var(--mutty-fg-2)] mt-0.5 break-words">{preview}</p>
      </div>
    </div>
  );
}

export function ChatToastContainer() {
  const { items, dismiss } = useChatToasts();

  if (items.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {items.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ChatToastItem
            toast={toast}
            onDismiss={() => dismiss(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}
