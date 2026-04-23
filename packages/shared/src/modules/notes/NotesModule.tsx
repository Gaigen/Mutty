// Collaborative notepad using useCollabState (lightweight JSON sync over LiveKit).

import * as React from 'react';
import { useFloatingWindow, FloatingWindow } from '../../floating';
import { useCollabState } from '../../collab';
import { matchHotkey, useModuleHotkeys } from '../../hooks';

export const NOTES_ID = 'notes';

interface NotesState {
  text: string;
}

interface NotesAction {
  type: 'SET_TEXT';
  payload: string;
  ts: number;
  author: string;
}

function notesReducer(state: NotesState, action: NotesAction): NotesState {
  if (action.type === 'SET_TEXT') {
    return { text: action.payload };
  }
  return state;
}

const INITIAL_STATE: NotesState = { text: '' };

export function NotesModule() {
  const win = useFloatingWindow({
    id: NOTES_ID,
    initialPosition: { x: 140, y: 100 },
    initialSize: { w: 400, h: 320 },
    minSize: { w: 250, h: 180 },
    title: '📝 Notes',
    isSingleton: true,
  });

  const [state, broadcast] = useCollabState<NotesState, NotesAction>(
    NOTES_ID,
    notesReducer,
    INITIAL_STATE
  );

  const { settings } = useModuleHotkeys();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const isTypingRef = React.useRef(false);

  // Sync remote text → textarea without jumping cursor while typing
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el || isTypingRef.current) return;
    if (el.value !== state.text) {
      el.value = state.text;
    }
  }, [state.text]);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      isTypingRef.current = true;
      broadcast({ type: 'SET_TEXT', payload: text });
      // Release typing lock after a short delay so remote updates can apply
      window.clearTimeout((handleChange as any)._timer);
      (handleChange as any)._timer = window.setTimeout(() => {
        isTypingRef.current = false;
      }, 300);
    },
    [broadcast]
  );

  // Toggle hotkey
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (matchHotkey(e, settings.toggleNotes)) {
        e.preventDefault();
        win.toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [win, settings.toggleNotes]);

  if (!win.isOpen) return null;

  return (
    <FloatingWindow api={win}>
      <div className="w-full h-full bg-[#1e1e1e] flex flex-col">
        <textarea
          ref={textareaRef}
          className="flex-1 w-full h-full bg-transparent text-white/90 text-sm p-3 resize-none outline-none font-mono leading-relaxed placeholder-white/20"
          placeholder="Type shared notes here..."
          defaultValue={state.text}
          onChange={handleChange}
          spellCheck={false}
        />
      </div>
    </FloatingWindow>
  );
}
