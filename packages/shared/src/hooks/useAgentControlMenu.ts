import { useEffect, useRef, useState } from 'react';

export function useAgentControlMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownBottom, setDropdownBottom] = useState(60);
  const menuRef = useRef<HTMLDivElement>(null);
  const queueInputRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', onOutside, true);
    return () => document.removeEventListener('click', onOutside, true);
  }, [menuOpen]);

  // Calculate dropdown bottom based on button position to avoid burger overlap
  useEffect(() => {
    if (!menuOpen) return;
    const updatePosition = () => {
      const rect = menuRef.current?.getBoundingClientRect();
      if (!rect) return;
      const bottom = window.innerHeight - rect.top + 6;
      setDropdownBottom(bottom);
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [menuOpen]);

  // Focus queue input when menu opens
  useEffect(() => {
    if (menuOpen) {
      setTimeout(() => queueInputRef.current?.focus(), 50);
    }
  }, [menuOpen]);

  return {
    menuOpen,
    setMenuOpen,
    dropdownBottom,
    menuRef,
    queueInputRef,
  };
}
