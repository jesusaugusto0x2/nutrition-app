import { mailMessages as m } from './mail-messages';

/** Data each template needs. Links are built here from `APP_ORIGIN`. */
export interface MailTemplateData {
  'email-verification': { name: string; token: string };
  'password-reset': { name: string; token: string };
  'password-changed': { name: string };
}

export type MailTemplate = keyof MailTemplateData;

export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
}

interface MailContent {
  subject: string;
  name: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footer: string[];
}

// Email clients ignore stylesheets and CSS variables, so the few colors are
// inline values from the app's palette (apps/web/src/styles/globals.css).
// Keep them in sync with the tokens named in each comment.
const COLORS = {
  text: '#17302a', // --foreground
  muted: '#4a5e58', // --muted-foreground
  primary: '#1d6b5c', // --primary
  onPrimary: '#ffffff', // --primary-foreground
  background: '#f3f6f4', // --background
  card: '#ffffff', // --surface
};

export function renderMail<T extends MailTemplate>(
  template: T,
  data: MailTemplateData[T],
  appOrigin: string,
): RenderedMail {
  return render(toContent(template, data, appOrigin));
}

function toContent(
  template: MailTemplate,
  data: MailTemplateData[MailTemplate],
  appOrigin: string,
): MailContent {
  switch (template) {
    case 'email-verification': {
      const { name, token } = data as MailTemplateData['email-verification'];
      return {
        subject: m.emailVerification.subject,
        name,
        paragraphs: [m.emailVerification.intro],
        action: {
          label: m.emailVerification.action,
          url: linkWithToken(appOrigin, '/verify-email', token),
        },
        footer: [m.emailVerification.expiry, m.ignoreIfNotYou],
      };
    }
    case 'password-reset': {
      const { name, token } = data as MailTemplateData['password-reset'];
      return {
        subject: m.passwordReset.subject,
        name,
        paragraphs: [m.passwordReset.intro],
        action: {
          label: m.passwordReset.action,
          url: linkWithToken(appOrigin, '/reset-password', token),
        },
        footer: [m.passwordReset.expiry, m.ignoreIfNotYou],
      };
    }
    case 'password-changed':
      return {
        subject: m.passwordChanged.subject,
        name: data.name,
        paragraphs: [m.passwordChanged.intro],
        footer: [m.passwordChanged.notYou],
      };
  }
}

function linkWithToken(appOrigin: string, path: string, token: string) {
  const url = new URL(path, appOrigin);
  url.searchParams.set('token', token);
  return url.toString();
}

function render(content: MailContent): RenderedMail {
  const { subject, name, paragraphs, action, footer } = content;
  const greeting = m.greeting(name);

  const text = [
    greeting,
    ...paragraphs,
    ...(action ? [`${action.label}: ${action.url}`] : []),
    ...footer,
    `— ${m.appName}`,
  ].join('\n\n');

  const actionHtml = action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:12px 20px;background:${COLORS.primary};color:${COLORS.onPrimary};text-decoration:none;border-radius:8px;font-weight:600">${escapeHtml(action.label)}</a></p>
<p style="margin:0 0 16px;color:${COLORS.muted};font-size:14px">${escapeHtml(m.linkFallback)}<br><a href="${escapeHtml(action.url)}" style="color:${COLORS.primary};word-break:break-all">${escapeHtml(action.url)}</a></p>`
    : '';

  // Styles sit on wrapper divs: many email clients drop <body> styles.
  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0">
<div style="padding:24px 16px;background:${COLORS.background};font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:${COLORS.text}">
<div style="max-width:560px;margin:0 auto;padding:24px;background:${COLORS.card};border-radius:12px">
<p style="margin:0 0 16px;font-weight:600">${escapeHtml(greeting)}</p>
${paragraphs.map((paragraph) => `<p style="margin:0 0 16px">${escapeHtml(paragraph)}</p>`).join('\n')}
${actionHtml}
${footer.map((line) => `<p style="margin:0 0 8px;color:${COLORS.muted};font-size:14px">${escapeHtml(line)}</p>`).join('\n')}
<p style="margin:24px 0 0;color:${COLORS.muted};font-size:14px">${escapeHtml(m.appName)}</p>
</div>
</div>
</body>
</html>
`;

  return { subject, text, html };
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Every interpolated value is escaped: names are user input. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}
