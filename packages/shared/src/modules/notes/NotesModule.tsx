// Collaborative notepad using useCollabState (lightweight JSON sync over LiveKit).

import * as React from 'react';
import { useFloatingWindow, FloatingWindow } from '../../floating';
import { useCollabState } from '../../collab';
import { useModuleToggle } from '../../hooks';

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

  useModuleToggle('notes', win.toggle);

  const saveToTxt = React.useCallback(async () => {
    const suggestedName = `notes-${new Date().toISOString().slice(0, 10)}.txt`;
    const text = state.text || '';

    // Try native "Save As" dialog (File System Access API)
    try {
      const showPicker = (window as any).showSaveFilePicker;
      if (showPicker) {
        const handle = await showPicker({
          suggestedName,
          types: [{
            description: 'Text Files',
            accept: { 'text/plain': ['.txt'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        return;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // user cancelled
      console.warn('[Notes] showSaveFilePicker failed:', err);
    }

    // Fallback: silent download
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state.text]);

  if (!win.isOpen) return null;

  return (
    <FloatingWindow
      api={win}
      headerRight={
        <button
          title="Save as .txt"
          onClick={saveToTxt}
          className="w-5 h-5 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      }
    >
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
