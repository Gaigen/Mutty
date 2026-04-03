import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { cn } from '@/lib/utils';

function Switch({
  className,
  size = 'default',
  checked,
  ...props
}: SwitchPrimitive.Root.Props & { size?: 'sm' | 'default' }) {
  const h = size === 'sm' ? 'h-3.5' : 'h-5';
  const w = size === 'sm' ? 'w-6' : 'w-9';
  const thumbSize = size === 'sm' ? 'size-3' : 'size-4';
  const translate = size === 'sm' ? 'group-data-[checked]/switch:translate-x-3' : 'group-data-[checked]/switch:translate-x-4';

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      checked={checked}
      className={cn(
        'peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-colors outline-none',
        'focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/50',
        'data-disabled:cursor-not-allowed data-disabled:opacity-50',
        h, w,
        checked ? 'bg-indigo-600' : 'bg-[#3a3a3a]',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block rounded-full bg-white shadow-sm transition-transform',
          'translate-x-0.5',
          translate,
          thumbSize
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
