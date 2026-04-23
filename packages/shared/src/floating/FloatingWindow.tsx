// Universal floating window chrome — drag, resize, minimize, close.

import { useRef, useCallback, useEffect, type ReactNode, type MouseEvent } from "react";
import { useManager } from "./FloatingWindowManager";
import type { FloatingWindowApi } from "./types";

interface Props {
  api: FloatingWindowApi;
  children: ReactNode;
  className?: string;
  /** Extra content rendered in the title bar (e.g. action buttons) */
  headerRight?: ReactNode;
}

export function FloatingWindow({ api, children, className = "", headerRight }: Props) {
  const { state, dispatch } = useManager();
  const win = state.windows[api.id];
  if (!win || !win.isOpen) return null;

  const { position, size, zIndex, isMinimized, isMaximized, title } = win;
  const isVisible = !isMinimized;

  // Stabilize api reference so drag/resize listeners don't re-register mid-gesture
  const apiRef = useRef(api);
  apiRef.current = api;

  const dragRef = useRef<{ ox: number; oy: number; dragging: boolean }>({
    ox: 0,
    oy: 0,
    dragging: false,
  });

  const resizeRef = useRef<{
    ox: number;
    oy: number;
    ow: number;
    oh: number;
    resizing: boolean;
  }>({ ox: 0, oy: 0, ow: 0, oh: 0, resizing: false });

  // ── Drag ────────────────────────────────────────────────────────────────────
  const onDragMove = useCallback(
    (e: globalThis.MouseEvent) => {
      const { ox, oy, dragging } = dragRef.current;
      if (!dragging) return;
      apiRef.current.setPosition({
        x: e.clientX - ox,
        y: e.clientY - oy,
      });
    },
    []
  );

  const onDragUp = useCallback(() => {
    dragRef.current.dragging = false;
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragUp);
  }, [onDragMove]);

  const onHeaderMouseDown = useCallback(
    (e: MouseEvent) => {
      if (isMaximized) return;
      dragRef.current = {
        ox: e.clientX - position.x,
        oy: e.clientY - position.y,
        dragging: true,
      };
      api.bringToFront();
      window.addEventListener("mousemove", onDragMove);
      window.addEventListener("mouseup", onDragUp);
    },
    [position, isMaximized, api, onDragMove, onDragUp]
  );

  // ── Resize ──────────────────────────────────────────────────────────────────
  const onResizeMove = useCallback(
    (e: globalThis.MouseEvent) => {
      const { ox, oy, ow, oh, resizing } = resizeRef.current;
      if (!resizing) return;
      apiRef.current.setSize({
        w: ow + (e.clientX - ox),
        h: oh + (e.clientY - oy),
      });
    },
    []
  );

  const onResizeUp = useCallback(() => {
    resizeRef.current.resizing = false;
    window.removeEventListener("mousemove", onResizeMove);
    window.removeEventListener("mouseup", onResizeUp);
    // Notify canvas-based children (e.g. Excalidraw) that container resized
    window.dispatchEvent(new Event('resize'));
  }, [onResizeMove]);

  const onResizeMouseDown = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      resizeRef.current = {
        ox: e.clientX,
        oy: e.clientY,
        ow: size.w,
        oh: size.h,
        resizing: true,
      };
      window.addEventListener("mousemove", onResizeMove);
      window.addEventListener("mouseup", onResizeUp);
    },
    [size, onResizeMove, onResizeUp]
  );

  // ── Focus on click ──────────────────────────────────────────────────────────
  const onWindowMouseDown = useCallback(() => {
    api.bringToFront();
  }, [api]);

  // Cleanup
  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragUp);
      window.removeEventListener("mousemove", onResizeMove);
      window.removeEventListener("mouseup", onResizeUp);
    };
  }, [onDragMove, onDragUp, onResizeMove, onResizeUp]);

  return (
    <div
      className={`absolute rounded-lg border border-white/10 bg-[#1a1a1a]/95 shadow-2xl backdrop-blur-sm flex flex-col overflow-hidden select-none ${className}`}
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? 240 : size.w,
        height: isMinimized ? 36 : size.h,
        zIndex,
      }}
      onMouseDown={onWindowMouseDown}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 h-9 bg-white/5 cursor-move border-b border-white/5"
        onMouseDown={onHeaderMouseDown}
      >
        <span className="text-sm text-white/80 truncate">{title}</span>
        <div className="flex items-center gap-1">
          {headerRight}
          <button
            className="w-5 h-5 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10"
            onClick={() => (isMinimized ? api.restore() : api.minimize())}
          >
            {isMinimized ? "□" : "_"}
          </button>
          <button
            className="w-5 h-5 flex items-center justify-center rounded text-white/50 hover:text-red-400 hover:bg-white/10"
            onClick={api.close}
          >
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      {isVisible && (
        <div className="flex-1 relative overflow-hidden">
          {children}
          {/* Resize handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gradient-to-tl from-white/20 to-transparent z-10"
            onMouseDown={onResizeMouseDown}
          />
        </div>
      )}
    </div>
  );
}
