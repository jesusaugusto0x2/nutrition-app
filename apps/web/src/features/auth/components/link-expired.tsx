import { Link } from '@tanstack/react-router';
import { ClockIcon } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { t } from '@/i18n';

/**
 * An emailed link whose token is unknown, expired or already used. The API
 * does not say which, so neither does this page.
 */
export function LinkExpired({
  hint,
  children,
}: {
  /** An extra line under the explanation. */
  hint?: string;
  /** How to get a new link. */
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  // It may replace a form or a loading message that had focus.
  useEffect(() => heading.current?.focus(), []);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <span className="flex size-20 items-center justify-center rounded-full bg-amber-soft text-amber">
        <ClockIcon aria-hidden className="size-10" strokeWidth={1.8} />
      </span>

      <header className="flex flex-col gap-2.5">
        <h1
          ref={heading}
          tabIndex={-1}
          className="m-0 font-heading text-display font-medium outline-none lg:text-[40px] lg:leading-[1.1]"
        >
          {t.linkExpired.title}
        </h1>
        <p className="m-0">{t.linkExpired.body}</p>
        {hint && <p className="m-0 text-muted-foreground">{hint}</p>}
      </header>

      {children}

      <footer className="mt-auto border-t pt-5 text-center lg:mt-0 lg:text-left">
        <Link to="/login" className="font-bold">
          {t.checkEmail.backToSignIn}
        </Link>
      </footer>
    </div>
  );
}
