import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';

interface BurgerMenuProps {
  children: React.ReactNode;
}

export function BurgerMenu({ children }: BurgerMenuProps) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

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

  return (
    <div className="mutty-burger-wrapper" ref={menuRef}>
      <button
        type="button"
        className="lk-button mutty-burger-trigger"
        aria-label="More controls"
        title="More controls"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal size={18} aria-hidden />
      </button>
      {open && (
        <div className="mutty-burger-dropdown" role="menu">
          {children}
        </div>
      )}
    </div>
  );
}
