import * as React from 'react';

export interface ControlDef {
  id: string;
  priority: number;
  /** Width in px including gap contribution */
  estimatedWidth: number;
}

interface OverflowResult {
  visibleIds: Set<string>;
  burgerIds: Set<string>;
  showBurger: boolean;
}

const GAP = 4;
const THRESHOLD = 20;
const BURGER_WIDTH = 42;

export function useOverflowControls(
  containerRef: React.RefObject<HTMLElement | null>,
  controls: ControlDef[],
): OverflowResult {
  const [containerWidth, setContainerWidth] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        setContainerWidth(Math.round(w));
      }
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [containerRef]);

  return React.useMemo(() => {
    if (containerWidth === 0) {
      const allIds = new Set(controls.map((c) => c.id));
      return { visibleIds: allIds, burgerIds: new Set<string>(), showBurger: false };
    }

    const priorityGroups = new Map<number, ControlDef[]>();
    for (const ctrl of controls) {
      const group = priorityGroups.get(ctrl.priority) ?? [];
      group.push(ctrl);
      priorityGroups.set(ctrl.priority, group);
    }

    const sortedPriorities = Array.from(priorityGroups.keys()).sort((a, b) => a - b);

    const visibleIds = new Set<string>();
    const burgerIds = new Set<string>();

    let usedWidth = 0;
    let overflowStarted = false;

    for (const priority of sortedPriorities) {
      const group = priorityGroups.get(priority)!;
      const groupWidth = group.reduce((sum, c) => sum + c.estimatedWidth + GAP, 0) - GAP;

      if (overflowStarted || usedWidth + groupWidth > containerWidth - THRESHOLD - BURGER_WIDTH) {
        overflowStarted = true;
        group.forEach((c) => burgerIds.add(c.id));
      } else {
        usedWidth += groupWidth + GAP;
        group.forEach((c) => visibleIds.add(c.id));
      }
    }

    return { visibleIds, burgerIds, showBurger: burgerIds.size > 0 };
  }, [containerWidth, controls]);
}
