import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { type ErrorComponentProps, useRouter } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';

export function ErrorState({ reset }: ErrorComponentProps) {
  const router = useRouter();
  const queryErrorResetBoundary = useQueryErrorResetBoundary();

  const retry = () => {
    queryErrorResetBoundary.reset();
    reset();
    void router.invalidate();
  };

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 py-8 text-center"
    >
      <h2 className="text-lg font-semibold">{t.common.errorTitle}</h2>
      <p className="text-muted-foreground text-sm">
        {t.common.errorDescription}
      </p>
      <Button onClick={retry}>{t.common.retry}</Button>
    </div>
  );
}
