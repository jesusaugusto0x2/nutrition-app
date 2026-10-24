import { type BmiCategory, classifyBmi } from '@nutri/utils';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { t } from '@/i18n';

const tones: Record<BmiCategory, BadgeTone> = {
  underweight: 'info',
  normal: 'primary',
  overweight: 'amber',
  obesity1: 'rust',
  obesity2: 'rust',
  obesity3: 'rust',
};

/**
 * Spec 24 for BMI: the adult category, or «Menor de edad» for minors,
 * whose BMI is read by percentile instead.
 */
export function BmiBadge({
  bmi,
  minor,
  size = 'md',
  className,
}: {
  bmi: number;
  minor: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  if (minor) {
    return (
      <Badge tone="info" size={size} className={className}>
        {t.bmi.minor}
      </Badge>
    );
  }
  const category = classifyBmi(bmi);
  return (
    <Badge tone={tones[category]} size={size} className={className}>
      {t.bmi.categories[category]}
    </Badge>
  );
}
