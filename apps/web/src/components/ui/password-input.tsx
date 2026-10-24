import { useState } from 'react';
import { Input, type InputProps } from '@/components/ui/input';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Spec 13: password field with a «Mostrar» / «Ocultar» text button inside.
 * The button changes its visible words instead of using `aria-pressed`, so
 * its accessible name always matches what it says (WCAG 2.5.3).
 */
function PasswordInput({
  className,
  ...props
}: Omit<InputProps, 'type' | 'size'>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        size="lg"
        type={visible ? 'text' : 'password'}
        autoComplete="current-password"
        className={cn('pr-28', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute inset-y-[7px] right-1.5 cursor-pointer rounded-nav bg-background px-3 text-meta font-bold text-primary hover:text-primary-hover"
      >
        {visible ? t.forms.hidePassword : t.forms.showPassword}
      </button>
    </div>
  );
}

export { PasswordInput };
