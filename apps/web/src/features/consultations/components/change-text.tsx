import { t } from '@/i18n';
import {
  changeDirection,
  formatSignedQuantity,
  type Quantity,
} from '@/lib/format';
import { cn } from '@/lib/utils';

const colors = {
  down: 'text-primary',
  up: 'text-amber',
  none: 'text-muted-foreground',
};

/**
 * Signed change under a value in records («−2,3», «sin cambio»), colored
 * like the trend badge. The unit is in the column header.
 */
export function ChangeText({
  change,
  quantity,
  className,
}: {
  change: number;
  quantity: Quantity;
  className?: string;
}) {
  const direction = changeDirection(change, quantity);
  return (
    <span className={cn('font-bold', colors[direction], className)}>
      {direction === 'none'
        ? t.consultations.noChangeInline
        : formatSignedQuantity(change, quantity)}
    </span>
  );
}
