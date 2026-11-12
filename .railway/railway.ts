// Railway Infrastructure as Code: the source of truth for the production
// service (CLAUDE.md §6). Railway does not read this file during deploys; the
// "Railway config" workflow plans it on pull requests and applies the
// reviewed plan on merge. Never change these settings in the dashboard.
// What each setting is for: docs/deployment.md "Railway service".
import { defineRailway, github, preserve, service } from 'railway/iac';

/** Railway's own domain until the custom domain (#41). */
const RAILWAY_DOMAIN = 'nutrition-app-production.up.railway.app';

/** Virginia, next to Neon's aws-us-east-1 (docs/deployment.md "Region"). */
const REGION = 'us-east4-eqdc4a';

/** The port Nest listens on: the image's default, set here so Railway's
 * injected PORT, the healthcheck and the domain all agree. */
const PORT = 3000;

export default defineRailway((_ctx, project) =>
  project('nutrition-app', {
    resources: [
      service('nutrition-app', {
        // Autodeploy from main, only after every GitHub Actions workflow on
        // the commit passed ("Wait for CI").
        source: github('jesusaugusto0x2/nutrition-app', {
          branch: 'main',
          checkSuites: true,
        }),
        build: { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile' },
        deploy: {
          // Runs in its own container before the new version starts; if it
          // fails, the deploy stops and the previous version keeps serving.
          preDeployCommand: ['node migrate.js'],
          healthcheckPath: '/api/health',
          // Seconds: Neon may need a moment to wake a suspended compute.
          healthcheckTimeout: 120,
          restartPolicyType: 'ON_FAILURE',
          restartPolicyMaxRetries: 10,
          // The daily auth cleanup job needs the process awake (#43).
          sleepApplication: false,
          // One replica: the rate limiter keeps its counters in memory.
          multiRegionConfig: { [REGION]: { numReplicas: 1 } },
        },
        networking: {
          serviceDomains: { [RAILWAY_DOMAIN]: { port: PORT } },
        },
        // NODE_ENV and WEB_DIST_DIR come from the image. Secrets are
        // preserve(): their values live only in Railway and the password
        // manager, never in this file.
        env: {
          PORT: String(PORT),
          DATABASE_URL: preserve(),
          DATABASE_MIGRATION_URL: preserve(),
          APP_ORIGIN: `https://${RAILWAY_DOMAIN}`,
          CLIENT_IP_SOURCE: 'x-real-ip',
          GOOGLE_CLIENT_ID: preserve(),
          GOOGLE_CLIENT_SECRET: preserve(),
          // Placeholders until email delivery (#42): the API needs both to
          // boot, and nothing listens there, so every email fails to send.
          SMTP_URL: 'smtp://smtp.invalid:587',
          MAIL_FROM: 'Mi consulta <no-reply@example.com>',
        },
      }),
    ],
  }),
);
