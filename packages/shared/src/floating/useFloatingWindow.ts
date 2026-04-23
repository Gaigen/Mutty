// Hook for individual floating window control.

import { useEffect, useMemo, useCallback } from "react";
import { useManagerActions } from "./FloatingWindowManager";
import type { FloatingWindowApi, WindowConfig, Vec2, Size } from "./types";

const DEFAULT_POS: Vec2 = { x: 100, y: 100 };
const DEFAULT_SIZE: Size = { w: 640, h: 480 };
const DEFAULT_MIN: Size = { w: 200, h: 150 };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function useFloatingWindow(config: WindowConfig): FloatingWindowApi {
  const {
    id,
    initialPosition = DEFAULT_POS,
    initialSize = DEFAULT_SIZE,
    minSize = DEFAULT_MIN,
    title = id,
    isSingleton = true,
  } = config;

  const { register, unregister, update, bringToFront, getWindow } = useManagerActions();
  const win = getWindow(id);

  // Register on mount
  useEffect(() => {
    register(id, {
      position: initialPosition,
      size: initialSize,
      title,
      isOpen: false,
    });
    return () => unregister(id);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOpen = win?.isOpen ?? false;
  const isMinimized = win?.isMinimized ?? false;
  const isMaximized = win?.isMaximized ?? false;
  const isVisible = isOpen && !isMinimized;
  const position = win?.position ?? initialPosition;
  const size = win?.size ?? initialSize;

  const open = useCallback(() => update(id, { isOpen: true }), [update, id]);
  const close = useCallback(() => update(id, { isOpen: false }), [update, id]);
  const toggle = useCallback(() => update(id, { isOpen: !isOpen }), [update, id, isOpen]);
  const minimize = useCallback(() => update(id, { isMinimized: true }), [update, id]);
  const maximize = useCallback(() => update(id, { isMaximized: true }), [update, id]);
  const restore = useCallback(
    () => update(id, { isMinimized: false, isMaximized: false }),
    [update, id]
  );
  const setPosition = useCallback(
    (pos: Vec2) =>
      update(id, {
        position: {
          x: clamp(pos.x, 0, window.innerWidth - size.w),
          y: clamp(pos.y, 0, window.innerHeight - size.h),
        },
      }),
    [update, id, size]
  );
  const setSize = useCallback(
    (s: Size) =>
      update(id, {
        size: {
          w: clamp(s.w, minSize.w, window.innerWidth),
          h: clamp(s.h, minSize.h, window.innerHeight),
        },
      }),
    [update, id, minSize]
  );

  return useMemo(
    () => ({
      id,
      isOpen,
      isVisible,
      isMinimized,
      isMaximized,
      isFocused: false, // computed in component
      position,
      size,
      title,
      open,
      close,
      toggle,
      minimize,
      maximize,
      restore,
      setPosition,
      setSize,
      bringToFront: () => bringToFront(id),
    }),
    [
      id,
      isOpen,
      isVisible,
      isMinimized,
      isMaximized,
      position,
      size,
      title,
      open,
      close,
      toggle,
      minimize,
      maximize,
      restore,
      setPosition,
      setSize,
      bringToFront,
    ]
  );
}
