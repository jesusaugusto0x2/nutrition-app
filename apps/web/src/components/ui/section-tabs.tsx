import { Tabs } from '@base-ui/react/tabs';
import { cn } from '@/lib/utils';
import type { Choice } from '@/components/ui/choice-field';

interface SectionTabsProps<T extends string> {
  /** Accessible name of the tab list, e.g. «Secciones de la ficha». */
  label: string;
  /** Full names, never abbreviated. */
  items: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Spec 5: tabs of the patient profile. A 2×2 grid of buttons on phones and
 * an underlined row from `md`. Base UI provides `role="tab"`,
 * `aria-selected` and arrow-key navigation.
 */
export function SectionTabs<T extends string>({
  label,
  items,
  value,
  onChange,
  className,
}: SectionTabsProps<T>) {
  return (
    <Tabs.Root
      value={value}
      onValueChange={(next) => onChange(next as T)}
      className={className}
    >
      <Tabs.List
        aria-label={label}
        className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-1 md:border-b-2"
      >
        {items.map((item) => (
          <Tabs.Tab
            key={item.value}
            value={item.value}
            className={cn(
              'min-h-13 cursor-pointer rounded-field border-2 border-input bg-surface px-2.5 py-1.5 text-base font-bold text-foreground',
              'data-active:border-primary data-active:bg-primary data-active:text-primary-foreground',
              'md:-mb-0.5 md:rounded-none md:border-0 md:border-b-3 md:border-transparent md:bg-transparent md:px-5 md:text-body md:text-muted-foreground md:hover:text-primary',
              'md:data-active:border-primary md:data-active:bg-transparent md:data-active:text-primary',
            )}
          >
            {item.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
