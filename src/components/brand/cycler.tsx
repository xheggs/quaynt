import { cn } from '@/lib/utils';

type CyclerProps = {
  items: readonly string[];
  /** Seconds each item is fully visible. Total cycle length = items.length * slotSeconds. */
  slotSeconds?: number;
  className?: string;
  /** Accessible label override; defaults to a comma-joined list of items. */
  ariaLabel?: string;
};

/**
 * Renders a fixed-width inline span that cycles through `items` using the
 * `engine-cycle` keyframes defined in globals.css. CSS-only — no JS scheduling,
 * no extra dependency, respects prefers-reduced-motion via the keyframes.
 */
export function Cycler({ items, slotSeconds = 3.5, className, ariaLabel }: CyclerProps) {
  if (items.length === 0) return null;
  const widest = items.reduce((a, b) => (b.length > a.length ? b : a), '');
  const cycleSeconds = items.length * slotSeconds;
  return (
    <span
      className={cn('relative inline-block text-foreground', className)}
      aria-label={ariaLabel ?? items.join(', ')}
    >
      <span aria-hidden="true" className="invisible">
        {widest}
      </span>
      {items.map((item, i) => (
        <span
          key={item}
          aria-hidden="true"
          className="engine-cycle absolute inset-0 opacity-0"
          style={{
            animationDelay: `${i * slotSeconds}s`,
            animationDuration: `${cycleSeconds}s`,
          }}
        >
          {item}
        </span>
      ))}
    </span>
  );
}
