import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { t } from '@/i18n';
import {
  changeDirection,
  type ChangeDirection,
  formatQuantityWithUnit,
  type Quantity,
} from '@/lib/format';

const tones: Record<ChangeDirection, BadgeTone> = {
  down: 'primary',
  up: 'amber',
  none: 'neutral',
};

/**
 * Spec 23: a change in words with its amount, «Bajó 1,7 kg». Losing is not
 * good nor gaining bad by itself: green and amber, never red, always with
 * an arrow and a word.
 */
export function TrendBadge({
  change,
  quantity,
  size = 'md',
  className,
}: {
  change: number;
  quantity: Quantity;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const direction = changeDirection(change, quantity);
  const amount = formatQuantityWithUnit(Math.abs(change), quantity);

  return (
    <Badge tone={tones[direction]} size={size} className={className}>
      {direction === 'down' && <ArrowDownIcon aria-hidden className="size-4" />}
      {direction === 'up' && <ArrowUpIcon aria-hidden className="size-4" />}
      {direction === 'none' ? t.trend.none : t.trend[direction](amount)}
    </Badge>
  );
}
