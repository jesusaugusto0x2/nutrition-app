import { t } from '@/i18n';

export function LoadingState() {
  return (
    <p role="status" className="text-muted-foreground py-8 text-center text-sm">
      {t.common.loading}
    </p>
  );
}
