import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../config/app-config';
import { createSmtpTransport } from './mail-transport';
import { MailService } from './mail.service';

// Development only (`pnpm mail:test`): sends one email of every template
// through the configured SMTP server, Mailpit by default, to preview them at
// http://localhost:8025. The tokens are fake.

const TEST_RECIPIENT = 'ana@example.com';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to send test emails: NODE_ENV is production.');
  }

  const envFile = resolve(__dirname, '../../../../.env');
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
  const config = loadConfig();
  const mail = new MailService(
    createSmtpTransport({ url: config.SMTP_URL, requireTls: false }),
    config,
  );

  const name = 'Ana';
  await mail.send('email-verification', TEST_RECIPIENT, {
    name,
    token: 'test-verification-token',
  });
  await mail.send('password-reset', TEST_RECIPIENT, {
    name,
    token: 'test-reset-token',
  });
  await mail.send('password-changed', TEST_RECIPIENT, { name });
  console.log('Sent 3 test emails. Open http://localhost:8025 (Mailpit).');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
