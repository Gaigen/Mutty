import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { createPortal } from 'react-dom';

interface BurgerMenuProps {
  children: React.ReactNode;
}

export function BurgerMenu({ children }: BurgerMenuProps) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [position, setPosition] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });

  React.useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', onOutside, true);
    return () => document.removeEventListener('click', onOutside, true);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  React.useEffect(() => {
    if (!open || !triggerRef.current) return;
    const updatePosition = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      setPosition({
        x: rect.right,
        y: rect.top,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const dropdown = (
    <div
      ref={menuRef}
      className="mutty-burger-dropdown"
      role="menu"
      style={{
        position: 'fixed',
        top: position.y - 8,
        right: window.innerWidth - position.x,
        bottom: 'auto',
      }}
    >
      {children}
    </div>
  );

  return (
    <div className="mutty-burger-wrapper">
      <button
        ref={triggerRef}
        type="button"
        className="lk-button mutty-burger-trigger"
        aria-label="More controls"
        title="More controls"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal size={18} aria-hidden />
      </button>
      {open && createPortal(dropdown, document.body)}
    </div>
  );
}
