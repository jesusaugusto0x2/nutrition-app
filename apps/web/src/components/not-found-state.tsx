import { Link } from '@tanstack/react-router';
import { t } from '@/i18n';

export function NotFoundState({ title = t.common.notFoundTitle }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-muted-foreground text-sm">
        {t.common.notFoundDescription}
      </p>
      <Link to="/" className="text-primary text-sm underline">
        {t.common.goHome}
      </Link>
    </div>
  );
}
