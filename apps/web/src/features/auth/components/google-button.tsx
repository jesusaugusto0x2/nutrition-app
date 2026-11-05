import googleLogo from '@/assets/google-g.png';
import { buttonVariants } from '@/components/ui/button';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { GOOGLE_SIGN_IN_PATH } from '../api';

/**
 * Spec 37. A plain link, not `fetch` or the router's `Link`: the API answers
 * with a redirect to Google, so the whole page has to navigate.
 *
 * Google's branding guidelines for a custom button: the standard-colour "G"
 * on a white background, unchanged in colour and proportions, and a localized
 * "Continue with Google". `google-g.png` is the 20 px logo of Google's
 * official sign-in assets (the light, square, Android + Web button at 4x),
 * cropped to the logo; the official SVG draws its gradient with
 * `foreignObject`, which an `<img>` does not render reliably.
 */
export function GoogleButton({ className }: { className?: string }) {
  return (
    <a
      href={GOOGLE_SIGN_IN_PATH}
      className={cn(
        buttonVariants({ variant: 'secondary', size: 'md', fullWidth: true }),
        'h-[58px]',
        className,
      )}
    >
      <img src={googleLogo} alt="" width={20} height={20} />
      {t.google.continue}
    </a>
  );
}
