// Global floating window manager — Context + useReducer.

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { ManagerState, ManagerAction, WindowState } from "./types";

const BASE_Z = 1000;

function makeWindowState(id: string, opts: Partial<WindowState> = {}): WindowState {
  return {
    id,
    position: opts.position ?? { x: 100, y: 100 },
    size: opts.size ?? { w: 640, h: 480 },
    zIndex: opts.zIndex ?? BASE_Z,
    isOpen: opts.isOpen ?? false,
    isMinimized: opts.isMinimized ?? false,
    isMaximized: opts.isMaximized ?? false,
    title: opts.title ?? id,
  };
}

function reducer(state: ManagerState, action: ManagerAction): ManagerState {
  switch (action.type) {
    case "REGISTER": {
      const { id } = action.payload;
      if (state.windows[id]) return state; // singleton guard
      return {
        ...state,
        windows: { ...state.windows, [id]: action.payload },
        highestZ: Math.max(state.highestZ, action.payload.zIndex),
      };
    }
    case "UNREGISTER": {
      const { [action.payload.id]: _, ...rest } = state.windows;
      return { ...state, windows: rest };
    }
    case "UPDATE": {
      const win = state.windows[action.payload.id];
      if (!win) return state;
      return {
        ...state,
        windows: {
          ...state.windows,
          [action.payload.id]: { ...win, ...action.payload.partial },
        },
      };
    }
    case "BRING_TO_FRONT": {
      const win = state.windows[action.payload.id];
      if (!win) return state;
      const nextZ = state.highestZ + 1;
      return {
        ...state,
        windows: {
          ...state.windows,
          [action.payload.id]: { ...win, zIndex: nextZ },
        },
        highestZ: nextZ,
      };
    }
    case "MINIMIZE_ALL": {
      const next: Record<string, WindowState> = {};
      for (const [k, v] of Object.entries(state.windows)) {
        next[k] = { ...v, isMinimized: true };
      }
      return { ...state, windows: next };
    }
    case "CLOSE_ALL": {
      const next: Record<string, WindowState> = {};
      for (const [k, v] of Object.entries(state.windows)) {
        next[k] = { ...v, isOpen: false };
      }
      return { ...state, windows: next };
    }
    case "RESET_LAYOUT": {
      const next: Record<string, WindowState> = {};
      for (const [k, v] of Object.entries(state.windows)) {
        next[k] = {
          ...v,
          position: { x: 100, y: 100 },
          size: { w: 640, h: 480 },
          isMinimized: false,
          isMaximized: false,
        };
      }
      return { ...state, windows: next };
    }
    default:
      return state;
  }
}

const initialState: ManagerState = { windows: {}, highestZ: BASE_Z };

// ── Context ──────────────────────────────────────────────────────────────────

interface ManagerContextValue {
  state: ManagerState;
  dispatch: React.Dispatch<ManagerAction>;
}

const ManagerCtx = createContext<ManagerContextValue | null>(null);

export function FloatingWindowManagerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return <ManagerCtx.Provider value={value}>{children}</ManagerCtx.Provider>;
}

export function useManager() {
  const ctx = useContext(ManagerCtx);
  if (!ctx) throw new Error("useManager must be inside FloatingWindowManagerProvider");
  return ctx;
}

// ── Imperative helpers (for hook consumption) ────────────────────────────────

export function useManagerActions() {
  const { state, dispatch } = useManager();

  const register = useCallback(
    (id: string, opts: Partial<WindowState>) => {
      dispatch({ type: "REGISTER", payload: makeWindowState(id, opts) });
    },
    [dispatch]
  );

  const unregister = useCallback(
    (id: string) => dispatch({ type: "UNREGISTER", payload: { id } }),
    [dispatch]
  );

  const update = useCallback(
    (id: string, partial: Partial<WindowState>) =>
      dispatch({ type: "UPDATE", payload: { id, partial } }),
    [dispatch]
  );

  const bringToFront = useCallback(
    (id: string) => dispatch({ type: "BRING_TO_FRONT", payload: { id } }),
    [dispatch]
  );

  const getWindow = useCallback(
    (id: string) => state.windows[id] ?? null,
    [state.windows]
  );

  return { register, unregister, update, bringToFront, getWindow, state };
}
