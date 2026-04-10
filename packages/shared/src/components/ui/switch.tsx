import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { cn } from '@/lib/utils';

const rootBase =
  'peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2';

const rootFocus =
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

const rootInvalid =
  'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40';

const rootSizes = {
  default: 'data-[size=default]:h-[18.4px] data-[size=default]:w-[32px]',
  sm: 'data-[size=sm]:h-[14px] data-[size=sm]:w-[24px]',
};

const rootStates =
  'data-disabled:cursor-not-allowed data-disabled:opacity-50';

const thumbBase =
  'pointer-events-none block rounded-full ring-0 transition-transform';

const thumbSizes = {
  default: 'group-data-[size=default]/switch:size-4',
  sm: 'group-data-[size=sm]/switch:size-3',
};

const thumbTranslate =
  'translate-x-0.5 group-data-[checked]/switch:translate-x-[calc(100%-2px)]';

const thumbColors =
  'bg-white dark:bg-white';

function Switch({
  className,
  size = 'default',
  checked,
  ...props
}: SwitchPrimitive.Root.Props & { size?: 'sm' | 'default' }) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      checked={checked}
      className={cn(
        rootBase,
        rootFocus,
        rootInvalid,
        rootSizes.default,
        rootSizes.sm,
        rootStates,
        checked ? 'bg-primary' : 'bg-input dark:bg-input/80',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          thumbBase,
          thumbSizes.default,
          thumbSizes.sm,
          thumbTranslate,
          thumbColors
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch };
