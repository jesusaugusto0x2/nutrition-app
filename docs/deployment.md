# Deployment

How «Mi consulta» runs in production and why: what runs where, the decisions
behind it, and how to deploy, roll back and recover. This is the reference
for the Deployment epic (#37). Every ticket of the epic fills in its own
section in the same pull request as the change.

**Status: nothing is deployed yet.** Sections marked "pending" point to the
ticket that writes them; anything else describes the agreed design, not a
running system, until its ticket closes. Runbooks are drafts until they have
been used once in production.

Never write secret values here: names only.

## Overview

```text
pull request ──> CI (.github/workflows/ci.yml) ──> merge to main
                                                        │
                                                        v
                                        CI runs again on the push to main
                                                        │  passes ("Wait for CI")
                                                        v
Railway: build the Dockerfile ──> pre-deploy: run migrations ──> start new version
                                        │                               │
                              direct connection                 pooled connection
                                (owner role)                       (app role)
                                        v                               v
                                        └───────> Neon PostgreSQL <─────┘

Browser ──HTTPS──> our domain ──> Railway edge ──> one container
                                                   (Nest: /api + the web app)
Container ──SMTP──> Resend ──> patients and staff
```

- **GitHub:** source of truth for code. CI approves commits; it never pushes
  an image.
- **Railway:** one service, one container. Nest serves the API under `/api`
  and the web app on every other route.
- **Neon:** the production database.
- **Domain:** pending, see #41.
- **Resend:** transactional email over SMTP (chosen in
  [docs/authentication.md](authentication.md#email-15)).

How a change reaches production: a merge to `main` triggers CI on the push;
Railway waits for that run, builds the image, runs pending migrations in a
separate container and, if they succeed, starts the new version, which takes
over from the old one once its healthcheck passes.

## Decisions

- **One Railway service built from the repository `Dockerfile`.** The image
  is already smoke-tested in CI (#6), and Railway building it means there is
  no registry to run. Rejected: pushing an image from CI (more moving parts
  for the same result); separate API and web services (the single origin is
  what lets CORS stay disabled).
- **Railway Infrastructure as Code (`.railway/railway.ts`).** Service
  settings are reviewed in pull requests. Rejected: `railway.toml` /
  `railway.json` (Config as Code), deprecated, unavailable to new services
  and no longer read from 2026-12-01; dashboard-only configuration (no
  history, no review).
- **Deploy only what CI approved:** autodeploy from `main` with Railway's
  "Wait for CI". Rejected: autodeploy without it (a commit that fails CI
  would reach production).
- **Neon PostgreSQL, pooled connection for the app, direct for migrations,**
  as Neon recommends. Rejected: the pooled string for migrations (Neon lists
  schema migrations as a direct-connection use case; tools may not support
  transaction pooling).
- **Migrations run as a Railway pre-deploy command from the image.** If they
  fail, the deploy stops and the previous version keeps serving. Rejected:
  `drizzle-kit migrate` in a release step (a dev tool that is not in the
  image); running them at app startup (a failed migration would mean a
  crashing app, and replicas would race).
- **No staging environment, no error tracking or log drains yet, one
  replica.** Out of the epic's scope (#37). One replica is also what the
  in-memory rate limiter assumes.

Sources, checked on 2026-11-01:
[Railway IaC](https://docs.railway.com/infrastructure-as-code),
[Railway pre-deploy command](https://docs.railway.com/deployments/pre-deploy-command),
[Railway GitHub autodeploys](https://docs.railway.com/deployments/github-autodeploys),
[Railway deployment actions](https://docs.railway.com/deployments/deployment-actions),
[Railway cron jobs](https://docs.railway.com/cron-jobs),
[Railway Serverless](https://docs.railway.com/deployments/serverless),
[Neon connection pooling](https://neon.com/docs/connect/connection-pooling),
[Neon instant restore](https://neon.com/docs/introduction/branch-restore).

## Database (Neon)

Pending, see #38 (project, region, roles, restore window, restore test).

## Migrations

Pending, see #39 (entry point `migrate.js`, `DATABASE_MIGRATION_URL`).

## Railway service

Pending, see #40 (service, `.railway/railway.ts`, Wait for CI, region).

## Domain and HTTPS

Pending, see #41 (domain, certificate, `APP_ORIGIN`, HSTS).

## Email delivery

Pending, see #42 (SPF, DKIM, DMARC, `SMTP_URL`, `MAIL_FROM`).

## Scheduled jobs

One job, `AuthCleanupJob` (`apps/api/src/auth/cleanup/auth-cleanup.job.ts`).
It runs inside the API process every day at 03:00 UTC and physically deletes:

- `sessions` where `expires_at <= now` or `last_used_at <= now - 7 days`, the
  exact opposite of the active-session lookup;
- `auth_tokens` that expired or were used.

A session is otherwise deleted only when its token comes back, so rows of a
cleared browser or a lost device would stay forever. They are auth data, not
clinical records, so physical deletion is correct (see
[Auth data and soft delete](authentication.md#auth-data-and-soft-delete)).

Why in-process with `@nestjs/schedule`:

- The container is always on, so the job needs no new service, variables or
  deployment settings, and it ships and rolls back with the code.
- Rejected: a Railway cron. It is a setting on a service that runs the start
  command on the schedule and expects the process to exit, so it cannot live
  on the API service. It would need a second service, a second entry point
  and a copy of `DATABASE_URL`.
- The delete is idempotent. A run missed during a deploy or restart is caught
  up by the next one, and a duplicate run on several replicas deletes nothing
  more. There is no distributed lock because none is needed.

What this design requires of the service:

- **Serverless (App Sleeping) must stay off.** A sleeping service wakes only
  on inbound traffic; Railway documents no timer that wakes it, so the job
  would not fire. #40 must keep it off in `.railway/railway.ts`.

Operating it:

- **Check that it ran:** look for a line from `AuthCleanupJob` in the Railway
  logs, `Deleted <n> sessions and <m> one-time tokens`, once a day after 03:00
  UTC. It logs only those counts, also when both are 0, so the line itself
  proves the job ran.
- **If it fails:** the line is `Could not clean up auth data (<error name>)`.
  Nothing else is logged, on purpose: `@nestjs/schedule` logs whatever a job
  throws, and a query error carries its SQL and parameters, so the job catches
  every error itself. Expired rows are unusable, so a failure is not urgent;
  the next run retries. If it repeats, check the database connection and that
  the application role can `DELETE` on both tables (#38).
- **Run it now or change the time:** there is no manual trigger. Change the
  `@Cron` expression in a pull request.

**Status: built and tested, not yet seen in production.** Nothing is deployed
yet; #43 stays open until the log line has been checked once after #40.

## Go-live

Pending, see #45 (end-to-end check before the first real user).

## Variables

Names only. A new variable gets a row here in the same pull request.
"Railway" means the value lives in Railway variables, with secrets also kept
in a password manager. The pre-deploy command sees the same variables as the
app.

| Variable                 | Purpose                                             | Used by    | Managed in            |
| ------------------------ | --------------------------------------------------- | ---------- | --------------------- |
| `NODE_ENV`               | `production`; turns on required variables           | App        | `Dockerfile`          |
| `WEB_DIST_DIR`           | Path of the built web app                           | App        | `Dockerfile`          |
| `PORT`                   | Port the API listens on                             | App        | `Dockerfile`; see #40 |
| `DATABASE_URL`           | Pooled connection, application role                 | App        | Railway (secret)      |
| `DATABASE_MIGRATION_URL` | Direct connection, owner role (added by #39)        | Pre-deploy | Railway (secret)      |
| `SMTP_URL`               | SMTP server with credentials                        | App        | Railway (secret)      |
| `MAIL_FROM`              | Sender of every email, on the verified domain       | App        | Railway               |
| `APP_ORIGIN`             | Public origin; builds email links, checked by CSRF  | App        | Railway               |
| `CLIENT_IP_SOURCE`       | `x-real-ip` on Railway; client IP for rate limiting | App        | Railway               |
| `GOOGLE_CLIENT_ID`       | OAuth client for Google sign-in                     | App        | Railway               |
| `GOOGLE_CLIENT_SECRET`   | Its secret                                          | App        | Railway (secret)      |

## Runbooks

### Deploy

Merge to `main`. Nothing else: CI runs on the push, and Railway deploys when
it passes. Confirm in the Railway deployment history that the new version is
active, then check `GET /api/health`.

### Deploy manually when "Wait for CI" is stuck

A deploy is `WAITING` until every workflow on the commit finishes, and
`SKIPPED` if one fails, if they have not finished after two hours, or if one
was cancelled and none succeeded.

1. Find out why first. If CI failed, fix it with a new pull request; do not
   deploy around it.
2. If CI passed or was only cancelled, open the Railway Command Palette
   (`Cmd + K`) and run **Deploy Latest Commit**. Railway's docs do not say
   whether this waits for CI, so watch the result (confirm in #40).

### Roll back

Use Railway's rollback on the previous successful deployment: it restores the
image and the variables. Deployments older than the plan's retention cannot
be restored.

**Migrations are forward-only: a rollback does not undo them.** The old
version runs against the new schema. That is safe only if every migration
stays compatible with the version before it, so remove or rename columns in
two releases (stop using it, then drop it). If a migration itself is wrong,
fix forward with a new migration.

### Restore the database

Draft until #38 tests it.

1. Try to avoid restoring production: within the history window, create a
   branch at the point in time and read from it to confirm the right moment.
2. If production must go back, use Neon's instant restore. It **discards
   every change after that point in all databases on the branch**, and keeps
   the prior state in a backup branch `{branch_name}_old_{head_timestamp}`,
   which is how a restore is undone.
3. Connections drop for a few seconds and the connection details do not
   change, so the app reconnects by itself. Check `GET /api/health`.

### Rotate credentials

Draft until #38 and #42 are done. Never paste a value in an issue, a pull
request or a chat.

- **Neon:** reset the role's password in Neon, then update `DATABASE_URL`
  (application role) or `DATABASE_MIGRATION_URL` (owner role) in Railway and
  deploy. New app connections fail between the two steps, so expect a short
  outage when rotating the application role.
- **SMTP:** create a new Resend API key, update `SMTP_URL` in Railway and
  deploy, confirm an email arrives, then delete the old key. There is no
  outage in this order.

Update the password manager in both cases.

## FAQ / gotchas

**Why two connection strings?** Neon's pooled host runs PgBouncer in
transaction mode: the app gets many cheap connections, but session features
do not work (`SET`, `LISTEN`/`NOTIFY`, SQL-level `PREPARE`, session advisory
locks). Migrations need a direct connection. Protocol-level prepared
statements from the driver work over the pooler.

**Why no `railway.toml`?** Railway deprecated it: new services cannot use it
and existing files stop being read on 2026-12-01.

**Does a merge apply `.railway/railway.ts`?** No. Railway does not read
`.railway/` during deploys; only `railway config apply` or the
`railwayapp/config` GitHub Action does. #40 decides which one we use.

**Does CI have to run on `push`?** Yes. Wait for CI needs a workflow with an
`on: push` trigger for the deployed branch, and it watches workflows as a
whole, not individual jobs. `ci.yml` has one.

**Two quick merges: is a deploy lost?** CI uses `cancel-in-progress`, so the
first run can be cancelled and its deploy skipped. That is fine: the second
commit contains the first, and its pre-deploy command runs every pending
migration.

**What does the pre-deploy command see?** The service's variables and the
image, in a separate container with no volumes. It is not retried on failure.

**Does the API boot with only the database variables?** No. In production it
refuses to start without `SMTP_URL`, `MAIL_FROM`, `APP_ORIGIN`,
`CLIENT_IP_SOURCE`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
(`apps/api/src/config/app-config.ts`), so see the first deploy under open
questions.

**Google sign-in answers `redirect_uri_mismatch`.** The client at Google does
not list `${APP_ORIGIN}/api/auth/google/callback` exactly. Add it, and change it
together with the domain. See
[Register a new Google redirect URI](authentication.md#register-a-new-google-redirect-uri).

**Every sign-in or save answers 403, but pages load.** `APP_ORIGIN` does not
match the address in the browser: `CsrfGuard` logs `Rejected POST <route>`
for each one. Set it to the exact public origin (scheme, host and port), and
change it together with the domain. See
[CSRF](authentication.md#csrf-13).

**Do we need an index on `expires_at` for the cleanup job?** No. It scans
`sessions` and `auth_tokens` once a day, and both tables stay small because
of it. Add an index, in a new migration, only if the query shows up as slow.

**Does the job read clinical data or need `clinicId`?** No. Sessions and
one-time tokens are not clinic-scoped, so the job crosses clinics by design
and touches only those two tables.

**Which clock does the job use?** The API's (`CLOCK`), not the database's
`now()`, like the session lookup, so both always agree on what is expired.

**Does the job keep Neon awake?** No. If the compute has scaled to zero, the
job wakes it once a day for one short query.

## Open questions and debt

- **The first deploy needs variables owned by later tickets.** #40 comes
  before the domain (#41) and the mail records (#42), but the app cannot boot
  without `APP_ORIGIN`, `SMTP_URL`, `MAIL_FROM`, `CLIENT_IP_SOURCE`,
  `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. #40 must set temporary values
  (the Railway URL as `APP_ORIGIN`, with its callback registered at Google),
  and #41 and #42 replace them.
- **CSRF behind Railway's edge is unverified.** OWASP warns that proxies can
  strip `Origin` or `Sec-*` headers, which would turn every write into a 403.
  #40 must sign in through the Railway URL after the first deploy.
- **The owner-role string is visible to the app.** Pre-deploy shares the
  service's variables, so `DATABASE_MIGRATION_URL` is also in the running
  container's environment. The app never reads it, but this weakens the
  least-privilege split. #40 should check whether it can be avoided, or
  record that it is accepted.
- **Which settings `.railway/railway.ts` covers.** Railway's overview shows
  the healthcheck; #40 must confirm the pre-deploy command, restart policy
  and Wait for CI in the IaC reference.

Known technical debt that affects production
([docs/architecture.md](architecture.md#known-technical-debt)):

- [Production migrations](architecture.md#production-migrations), resolved
  by #39.
- [Rate-limit counters in memory](architecture.md#rate-limit-counters-in-memory):
  blocks running more than one replica.
- [Compromised password blocklist](architecture.md#compromised-password-blocklist):
  required before the first production sign-up (#45).
- [PGlite shipped in the production image](architecture.md#pglite-shipped-in-the-production-image).
