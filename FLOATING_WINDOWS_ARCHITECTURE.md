# Floating Windows Architecture Proposal

**Status:** Undecided — Planning Phase  
**Component:** voice-app / packages/shared  
**Related:** Whiteboard (tldraw), LinkBrowser, future floating panels

---

## 🎯 Problem Statement

Current floating panels (e.g., `WhiteboardFloating.tsx`) implement drag/resize/hotkey logic inline, leading to:

- Code duplication across modules
- No centralized window management (z-index, minimization, persistence)
- Hard to extend with new floating features
- Inconsistent UX between panels

---

## 🏗️ Proposed Architecture

### 1. FloatingWindowManager (Singleton/Context)

Global state container responsible for:

- **Registry** — track all open floating windows by ID
- **Z-index stack** — auto-raise on click/focus, cycling order
- **Persistence** — save/restore positions & sizes (localStorage or room state)
- **Snap & Grid** (optional) — edge-snapping to screen borders, snapping to other windows
- **Global actions** — minimize all, close all, reset layout

**Implementation options:**
- React Context + useReducer (simple, no deps)
- Zustand/ Jotai (if already in use)
- LiveKit room state broadcast (for multi-user window sync — future)

---

### 2. useFloatingWindow Hook

Custom hook per floating module:

```ts
function useFloatingWindow(config: {
  id: string;                    // unique window ID
  initialPosition?: { x: number; y: number };
  initialSize?: { w: number; h: number };
  minSize?: { w: number; h: number };
  title?: string;
  icon?: React.ReactNode;
  isSingleton?: boolean;         // default true — single instance
}): FloatingWindowApi
```

**Returned API:**
- `isOpen`, `open`, `close`, `toggle`
- `position`, `setPosition`, `size`, `setSize`
- `minimize`, `maximize`, `restore`
- `bringToFront`, `isFocused`
- `isMinimized`, `isMaximized`

Hook internally registers/unregisters with FloatingWindowManager.

---

### 3. FloatingWindow Component (Universal)

Presentational component that renders any floating window:

```tsx
<FloatingWindow
  id="whiteboard"
  title="🖌️ Whiteboard"
  api={whiteboardApi}
  onClose={handleClose}
  onMinimize={handleMinimize}
>
  <Tldraw />
</FloatingWindow>
```

**Features built-in:**
- Draggable header (mouse + touch)
- Resize handles (all edges + corners)
- Minimize → header-only bar
- Maximize → fullscreen (within viewport)
- Close button
- Optional shadow/elevation based on z-index
- Focus ring / active state styling

Component receives all geometry/state from `api`, does NOT manage its own position.

---

### 4. Module Integration (Whiteboard Example)

```tsx
// WhiteboardModule.tsx
export function WhiteboardModule() {
  const wb = useFloatingWindow({
    id: 'whiteboard',
    initialPosition: { x: 150, y: 80 },
    initialSize: { w: 640, h: 480 },
    minSize: { w: 400, h: 300 },
    title: '🖌️ Whiteboard',
    isSingleton: true,
  });

  return wb.isOpen ? (
    <FloatingWindow api={wb}>
      <Tldraw />
    </FloatingWindow>
  ) : null;
}
```

Hotkeys and chat commands simply call `wb.toggle()`.

---

## 🧩 Open Questions

| Question | Options | Notes |
|----------|---------|-------|
| Persist positions? | localStorage / room state / none | localStorage simplest; room state for sync across users |
| Window manager UI? | Separate panel / invisible | Hidden by default; maybe `Win` key opens window picker |
| Snap/Grid? | Yes (edges+grid) / No | Edge snapping cheap; grid optional |
| Multiple instances? | Singleton per ID / allow multiples | Whiteboard singleton; maybe browser allows multi? |
| Z-index management? | Auto-raise on click / manual stacking order | Auto-raise expected; maybe Ctrl+Tab cycles |
| PiP mode? | Yes / No | Minimized → tiny draggable badge (like video PiP) |
| Cross-room persistence? | Yes / No | Different rooms may have different layouts |
| Size limits? | Max 90% viewport / unlimited | Prevent full-screen takeover |
| Theme integration? | Match app theme / standalone | Should inherit tailwind/dark colors |

---

## 📦 Dependencies & Impact

- **New shared package:** `@mutty/floating-windows` (inside packages/shared)
- **Files to create:**
  - `packages/shared/src/floating/FloatingWindowManager.tsx`
  - `packages/shared/src/floating/useFloatingWindow.ts`
  - `packages/shared/src/floating/FloatingWindow.tsx`
  - `packages/shared/src/floating/types.ts`
- **Existing refactors:**
  - Remove drag/resize logic from `WhiteboardFloating.tsx`
  - Convert `LinkBrowserFloating.tsx` to new system
  - Update `VideoConferenceWithVolume.tsx` to use manager/provider
- **Bundle impact:** negligible (no new runtime deps, just React)
- **Breaking changes:** none (migration path: one component at a time)

---

## 🗺️ Implementation Order

1. **Phase 1 — Core manager + hook** (no UI yet)
   - FloatingWindowManager context + reducer
   - useFloatingWindow hook (registration logic)
   - Types & interfaces

2. **Phase 2 — FloatingWindow component**
   - Drag logic (shared utility)
   - Resize handles
   - Header, buttons, minimize/close
   - Basic styling (dark theme)

3. **Phase 3 — Persistence**
   - localStorage save/restore
   - Optional: room state sync (LiveKit)

4. **Phase 4 — Migrate Whiteboard**
   - Replace `WhiteboardFloating` with new module
   - Keep `WhiteboardFloating.tsx` temporarily (deprecated)
   - Test drag/resize/minimize/persistence

5. **Phase 5 — Migrate LinkBrowser + others**
   - Convert `LinkBrowserFloating`
   - Add any new floating panels (notes? music player?)

6. **Phase 6 — Extras (if needed)**
   - Snap-to-edge
   - Window manager UI (picker)
   - PiP mode for minimized windows
   - Global hotkeys manager

---

## 📋 Decision Checklist

Before implementation starts, decide on:

- [ ] Persistence strategy (localStorage vs room state)
- [ ] Singleton vs multi-instance policy per module
- [ ] Snap/Grid requirement priority
- [ ] Z-index auto-raise vs manual control
- [ ] Whether to bundle manager into existing context or separate
- [ ] Naming conventions (`FloatingWindow` vs `Panel` vs `PiP`)

---

## 🚫 Alternative Considered (and rejected)

**Alternative:** Use existing tldraw's built-in UI for multi-user collaboration (no custom floating).  
**Rejected because:** tldraw's UI is opinionated, not embeddable as minimal floating panel; we need consistent chrome across all floating modules.

**Alternative:** Floating UI library (e.g., `react-floating-windows`).  
**Rejected because:** introduces external dependency; our needs are simple (drag+resize); custom implementation gives full control and no bundle bloat.

---

## 📚 References

- Current implementation: `packages/shared/src/components/livekit/WhiteboardFloating.tsx` (to be deleted)
- Existing pattern: `LinkBrowserFloating.tsx` (similar standalone approach)
- LiveKit UI patterns: custom floating components already exist (link browser, future whiteboard)

---

*Last updated: 2026-04-22 (after whiteboard attempt rollback)*
