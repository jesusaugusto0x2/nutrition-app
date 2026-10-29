import { mailMessages } from './mail-messages';
import { escapeHtml, renderMail } from './mail-templates';

const ORIGIN = 'https://app.example.com';
const TOKEN = 'abc_DEF-123';

describe('renderMail', () => {
  it('links the verification email to the web page with the token', () => {
    const mail = renderMail(
      'email-verification',
      { name: 'Ana', token: TOKEN },
      ORIGIN,
    );
    const url = `${ORIGIN}/verify-email?token=${TOKEN}`;

    expect(mail.subject).toBe(mailMessages.emailVerification.subject);
    expect(mail.text).toContain('Hola, Ana:');
    expect(mail.text).toContain(url);
    expect(mail.html).toContain(`href="${url}"`);
  });

  it('links the password reset email to the web page with the token', () => {
    const mail = renderMail(
      'password-reset',
      { name: 'Ana', token: TOKEN },
      ORIGIN,
    );
    const url = `${ORIGIN}/reset-password?token=${TOKEN}`;

    expect(mail.subject).toBe(mailMessages.passwordReset.subject);
    expect(mail.text).toContain(url);
    expect(mail.html).toContain(`href="${url}"`);
  });

  it('renders the password changed notice without a link', () => {
    const mail = renderMail('password-changed', { name: 'Ana' }, ORIGIN);

    expect(mail.subject).toBe(mailMessages.passwordChanged.subject);
    expect(mail.text).toContain(mailMessages.passwordChanged.notYou);
    expect(mail.html).not.toContain('href=');
  });

  it('encodes the token in the link', () => {
    const mail = renderMail(
      'password-reset',
      { name: 'Ana', token: 'a&b=c d' },
      ORIGIN,
    );

    expect(mail.text).toContain('/reset-password?token=a%26b%3Dc+d');
  });

  it('escapes user input in the HTML part', () => {
    const name = '<img src=x onerror="alert(1)">';
    const mail = renderMail('password-changed', { name }, ORIGIN);

    expect(mail.html).not.toContain('<img');
    expect(mail.html).toContain(escapeHtml(`Hola, ${name}:`));
    // Plain text is not HTML: it keeps the name as typed.
    expect(mail.text).toContain(`Hola, ${name}:`);
  });
});

describe('escapeHtml', () => {
  it('escapes the characters that are special in HTML text and attributes', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
});
