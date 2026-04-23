// Floating window core types.

import type { ReactNode } from "react";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface WindowState {
  id: string;
  position: Vec2;
  size: Size;
  zIndex: number;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  title: string;
}

export interface WindowConfig {
  id: string;
  initialPosition?: Vec2;
  initialSize?: Size;
  minSize?: Size;
  maxSize?: Size;
  title?: string;
  icon?: ReactNode;
  isSingleton?: boolean;
  persistKey?: string;
}

export interface FloatingWindowApi {
  id: string;
  isOpen: boolean;
  isVisible: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  isFocused: boolean;
  position: Vec2;
  size: Size;
  title: string;
  open: () => void;
  close: () => void;
  toggle: () => void;
  minimize: () => void;
  maximize: () => void;
  restore: () => void;
  setPosition: (pos: Vec2) => void;
  setSize: (size: Size) => void;
  bringToFront: () => void;
}

export type ManagerAction =
  | { type: "REGISTER"; payload: WindowState }
  | { type: "UNREGISTER"; payload: { id: string } }
  | { type: "UPDATE"; payload: { id: string; partial: Partial<WindowState> } }
  | { type: "BRING_TO_FRONT"; payload: { id: string } }
  | { type: "MINIMIZE_ALL" }
  | { type: "CLOSE_ALL" }
  | { type: "RESET_LAYOUT" };

export interface ManagerState {
  windows: Record<string, WindowState>;
  highestZ: number;
}
