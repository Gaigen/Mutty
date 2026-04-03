import * as React from 'react';

export interface ControlDef {
  id: string;
  priority: number;
  /** Width in px including gap contribution; used as fallback before real measurement */
  estimatedWidth: number;
}

interface OverflowResult {
  /** Controls that fit in the visible bar */
  visibleIds: Set<string>;
  /** Controls that overflow into the burger menu */
  burgerIds: Set<string>;
  /** True when at least one control is in the burger */
  showBurger: boolean;
}

const GAP = 4;
const THRESHOLD = 20;

export function useOverflowControls(
  containerRef: React.RefObject<HTMLElement | null>,
  controls: ControlDef[],
): OverflowResult {
  const [containerWidth, setContainerWidth] = React.useState(0);
  const [measuredWidths, setMeasuredWidths] = React.useState<Record<string, number>>({});

  // Observe container width changes
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
    // Initial measurement
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [containerRef]);

  // Measure individual button widths
  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const widths: Record<string, number> = {};
      controls.forEach(({ id }) => {
        const btn = el.querySelector<HTMLElement>(`[data-control-id="${id}"]`);
        if (btn) {
          const rect = btn.getBoundingClientRect();
          widths[id] = Math.ceil(rect.width);
        }
      });
      setMeasuredWidths(widths);
    };

    // Measure after a frame so DOM is settled
    const raf = requestAnimationFrame(measure);

    // Also measure on resize
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [containerRef, controls]);

  // Compute overflow
  return React.useMemo(() => {
    if (containerWidth === 0) {
      // Not measured yet — return all visible, no burger
      const allIds = new Set(controls.map((c) => c.id));
      return { visibleIds: allIds, burgerIds: new Set<string>(), showBurger: false };
    }

    // Build effective widths map (measured > estimated)
    const getWidth = (id: string, def: ControlDef) => measuredWidths[id] ?? def.estimatedWidth;

    // Group by priority
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
      const groupWidth = group.reduce((sum, c) => sum + getWidth(c.id, c) + GAP, 0) - GAP;

      if (overflowStarted || usedWidth + groupWidth > containerWidth - THRESHOLD) {
        overflowStarted = true;
        group.forEach((c) => burgerIds.add(c.id));
      } else {
        usedWidth += groupWidth + GAP;
        group.forEach((c) => visibleIds.add(c.id));
      }
    }

    return { visibleIds, burgerIds, showBurger: burgerIds.size > 0 };
  }, [containerWidth, measuredWidths, controls]);
}
