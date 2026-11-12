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

**Status: the Neon project and `nutri_app` exist (#38); the database is
still empty.** What is done and what is left is in
[Production record](#production-record). The scripts were also rehearsed end
to end on a scratch local Postgres 18 with a non-superuser owner role.

### What is set up

| Setting        | Value                                       |
| -------------- | ------------------------------------------- |
| Project        | `nutrition-app`, Neon **Free** plan         |
| Region         | AWS US East (N. Virginia), `aws-us-east-1`  |
| Postgres       | 18, the same major as Docker Compose and CI |
| Branch         | `production` (the root branch)              |
| Database       | `nutri`                                     |
| Owner role     | created with the project; runs migrations   |
| App role       | `nutri_app`, created with SQL; data only    |
| Restore window | 6 hours (Free plan maximum, up to 1 GB)     |

**Region.** Railway offers four regions (California, Virginia, Amsterdam,
Singapore) and Neon eight AWS regions. Railway's `us-east4-eqdc4a`
(Virginia) and Neon's `aws-us-east-1` (N. Virginia) are in the same area, so
every query pays the least round-trip time, and the users are in the
Americas. #40 must put the Railway service in `us-east4-eqdc4a`. Rejected:
Amsterdam + Frankfurt (`aws-eu-central-1`), close to each other but far from
the users. Both lists were checked on 2026-11-05.

**Plan.** Free, chosen by the owner for now. What it means in production:

- **Restore window of 6 hours** (and at most 1 GB of changes). A mistake
  noticed the next day cannot be undone from Neon. See
  [Open questions and debt](#open-questions-and-debt).
- **Scale to zero after 5 minutes idle, and it cannot be turned off.** The
  first query after a quiet period waits for the compute to start (usually
  well under a second). `GET /api/health` is also slower then.
- 1 GB of storage and 100 CU-hours a month per project, 10 branches
  (counting `production`). Check usage in the Neon Console before inviting
  more clinics.

### Roles

Two roles, least privilege:

- **Owner role** (created with the project, a member of `neon_superuser`).
  Owns every table, because migrations create them. Used only by migrations
  (`DATABASE_MIGRATION_URL`, #39) and by a person following a runbook, over the
  direct connection.
- **`nutri_app`**: the app's role (`DATABASE_URL`). `SELECT`, `INSERT`,
  `UPDATE` and `DELETE` on the tables in `public`, `USAGE`/`SELECT` on its
  sequences, nothing else: no DDL, no `TRUNCATE`, no temporary tables, no
  access to the `drizzle` schema (the migrations journal).

Why `nutri_app` is created with SQL: roles created in the Neon Console, API
or CLI join `neon_superuser`, which can read and write every table (it has
`pg_read_all_data` and `pg_write_all_data`), bypass row-level security, and
create roles and databases. A role created with SQL gets only what is granted
to it.

`scripts/neon/create-app-role.sql` grants on the tables that exist now and
sets `ALTER DEFAULT PRIVILEGES`, so tables and sequences created later **by
the owner role** get the same grants. Default privileges belong to the role
that created the object: a table created by any other role gets no grants,
and `check-app-role.sql` then fails with `missing data privileges on <table>`.
So migrations must always run as the owner role.

What the app needs, checked in the code: plain reads and writes and
`SELECT ... FOR UPDATE` (needs `UPDATE`). No session-level `SET`,
`LISTEN`/`NOTIFY`, SQL `PREPARE` or advisory locks, which the pooler would
break anyway.

### Connection strings

Copy them from **Connect** in the Neon Console (choose the `production`
branch, the `nutri` database, then the role; "Connection pooling" on for the
app, off for the owner). Then change the query string as shown:

```text
DATABASE_URL            postgresql://nutri_app:<password>@<endpoint>-pooler.<region>.aws.neon.tech/nutri?sslmode=verify-full
DATABASE_MIGRATION_URL  postgresql://<owner>:<password>@<endpoint>.<region>.aws.neon.tech/nutri?sslmode=verify-full
```

- **`sslmode=verify-full`, not Neon's `sslmode=require`.** With our `pg`
  (8.23, `pg-connection-string` 2.14), `require` already means `verify-full`,
  but it prints a security warning: pg 9 adopts libpq's meaning, where
  `require` encrypts without checking the certificate. `verify-full` keeps
  the check across that upgrade. Neon's certificates come from a public CA,
  which Node trusts by default, so no `sslrootcert` is needed.
- **Production refuses to boot without it.** `loadConfig` rejects a
  `DATABASE_URL` whose `sslmode` is not `verify-full`, or `disable` (accepted
  only because the CI smoke test runs the production image against a local
  Postgres without TLS; it is visible in review). A missing `sslmode` is
  rejected too.
- **Drop `channel_binding=require`.** `pg` ignores that parameter (channel
  binding is a client option, `enableChannelBinding`, which we do not set);
  `verify-full` already prevents a man in the middle.
- Passwords are generated URL-safe (see the runbook), so they need no
  percent-encoding.

### Runbook: set up the project

Do this once. Keep every password only in the password manager and in
Railway variables (#40): never in the repository, an issue, a pull request or
a chat. Run it from the repository root, which has `scripts/neon/`.

1. **Create the project** in the Neon Console: name `nutrition-app`, Postgres
   18, AWS, US East (N. Virginia), database name `nutri`. Note the owner role
   Neon creates (Roles page) in [Production record](#production-record).
2. **Save the owner's direct connection string** in the password manager as
   `DATABASE_MIGRATION_URL`, with `sslmode=verify-full` as shown above.
3. **Generate the app role's password** and copy it to the clipboard
   without printing it:

   ```bash
   openssl rand -base64 33 | tr '+/' '-_' | tr -d '\n' | pbcopy
   ```

   Save it in the password manager right away (it is 44 URL-safe characters,
   well above Neon's 60-bit entropy minimum).

4. **Create `nutri_app`.** With the app password still in the clipboard, run
   the script as the owner over the direct host. psql asks for the owner's
   password without echoing it:

   ```bash
   APP_PASSWORD="$(pbpaste)" docker run --rm -it -e APP_PASSWORD \
     -v "$PWD/scripts/neon:/sql:ro" postgres:18-alpine \
     psql "host=<endpoint>.<region>.aws.neon.tech dbname=nutri user=<owner> sslmode=verify-full sslrootcert=system" \
     -f /sql/create-app-role.sql
   ```

   It prints `nutri_app created.` It runs in one transaction, so a failure
   changes nothing. Neon rejects a weak password at this step. Clear the
   clipboard afterwards.

5. **Build `DATABASE_URL`** for `nutri_app` over the pooled host (`-pooler`)
   and save it in the password manager.
6. **After the first migration** (the first deploy, #40), prove the app role's limits with
   the next runbook.

### Runbook: check the app role

Run it after the first migration and after anything that touches roles or
grants. It connects as `nutri_app` over the pooled host, as the app does, and
asks for its password:

```bash
docker run --rm -it -v "$PWD/scripts/neon:/sql:ro" postgres:18-alpine \
  psql "host=<endpoint>-pooler.<region>.aws.neon.tech dbname=nutri user=nutri_app sslmode=verify-full sslrootcert=system" \
  -f /sql/check-app-role.sql
```

It reads no rows and changes nothing. Expected output, one `NOTICE` each:
no role attributes or memberships; the four data privileges on every
`public` table; `CREATE TABLE`, `CREATE SCHEMA`, `CREATE TEMPORARY TABLE`,
`ALTER TABLE`, `DROP TABLE` and `TRUNCATE` denied; the migrations journal not
readable; `All checks passed.` Any failure stops with `FAIL: <what>`. If it
says `missing data privileges`, a table was created by a role other than the
owner: fix it with a `GRANT` as the owner and find out how it happened.

### Runbook: test a restore

The acceptance test for #38, and a drill worth repeating before go-live
(#45). It never touches `production`:

1. Write down the current time (UTC). Within the restore window (6 hours),
   create a branch: **Branches → New branch**, parent `production`, **Past
   data**, a time a few minutes earlier, auto-delete after 1 hour.
2. Connect to the branch's own host (it differs from `production`'s) as the
   owner, for example with the `psql` command above, and confirm the schema
   and the expected rows: `SELECT count(*) FROM drizzle.__drizzle_migrations;`
   and a row count on a table you changed after that time. Do not copy
   patient data out of it.
3. Delete the branch (or let auto-delete do it) and fill in
   [Production record](#production-record).

Restoring `production` itself is [Restore the database](#restore-the-database).

### Production record

Fill this in as the steps are done; names and dates only, never secrets.
The endpoint host is not written here either (the repository is public): copy
it from **Connect** in the Neon Console.

- **Project created: 2026-11-06.** `nutrition-app`, in a Neon-managed
  organization: the owner's first organization is managed by Vercel, where
  projects can only be created from Vercel. AWS `aws-us-east-1`, Postgres 18,
  history window 6 hours (21600 s), root branch `production`, database
  `nutri`.
- **Owner role: `neondb_owner`** (created with the project).
- **`nutri_app` created: 2026-11-09**, with `create-app-role.sql`. Checked
  the same day in the catalogs, connected as the owner: `LOGIN` only, not a
  member of `neon_superuser`, no `CREATE` on `public`, no `TEMPORARY`; default
  privileges from `neondb_owner` are `arwd` on tables and `rU` on sequences.
- **`check-app-role.sql` passing: pending.** It needs the migrated schema, so
  run it after the first migration, which the first deploy's pre-deploy
  command runs (#40). Migrations are never run by hand against production.
- **Migrations applied with the owner role: pending.** `node migrate.js`
  exists (#39); the first deploy (#40) runs it with `DATABASE_MIGRATION_URL`.
- **Restore to a branch tested: pending.** Do it after the first migration,
  when there is a schema to compare.
- Passwords: both are in the owner's password manager; the full connection
  strings are built from them as shown in
  [Connection strings](#connection-strings), and go to Railway in #40.

## Migrations

**Status: built and tested in CI (#39); not run in production yet.** #40
sets the Railway pre-deploy command to `node migrate.js`.

### What is set up

- **Entry point:** `apps/api/src/database/migrate.ts`, built to `migrate.js`
  next to `main.js` (a second webpack entry, `additionalEntryPoints` in
  `apps/api/webpack.config.js`). It calls `migrate(db, { migrationsFolder })`
  from `drizzle-orm/node-postgres/migrator`, the runtime migrator that is
  already a production dependency; `migration-runner.ts` wraps it with the
  logging and checks below.
- **Its own variable:** it reads only `DATABASE_MIGRATION_URL` (the owner
  role's direct connection), validated by `loadMigrationConfig`
  (`src/config/migration-config.ts`) with the same `sslmode` rule as
  `DATABASE_URL`: in production only `verify-full`, or `disable` for the CI
  smoke test. The image sets `NODE_ENV=production`. It never falls back to
  `DATABASE_URL`, and the app never reads `DATABASE_MIGRATION_URL`.
- **Migrations in the image:** the `Dockerfile` copies
  `apps/api/src/database/migrations` (SQL files and `meta/`, whose
  `_journal.json` lists them) to `/app/api/migrations`, next to `migrate.js`.
- **Owner role, always.** Tables created by any other role miss the app
  role's default privileges ([Roles](#roles)).
- **Local development keeps drizzle-kit** (`pnpm db:migrate`). Both use the
  same journal table, `drizzle.__drizzle_migrations`, so a database migrated
  by either one is up to date for the other.

Sources, checked on 2026-11-11: the installed drizzle-orm 0.45.4
(`node-postgres/migrator.js`, `pg-core/dialect.js`),
[Drizzle migrations](https://orm.drizzle.team/docs/migrations),
[Railway pre-deploy command](https://docs.railway.com/deployments/pre-deploy-command).

### How it behaves

- **What runs:** Drizzle creates the `drizzle` schema and the journal table
  if they are missing, then applies every migration in `_journal.json` whose
  `when` is newer than the newest `created_at` in the table. Order is the
  journal's.
- **All or nothing:** every pending migration runs in **one transaction**. If
  one statement fails, none of them is applied or recorded.
- **Out-of-order migrations are refused.** Drizzle compares timestamps only,
  so a migration older than the last applied one would be skipped without a
  word (two branches that generated migrations in parallel, merged in the
  other order). `migrate.js` fails instead, before touching anything, naming
  it. Fix: regenerate it on top of `main` so its `when` is the newest.
- **Exit codes:** `0` when the database is up to date (migrations applied, or
  nothing pending); `1` for an invalid variable, a failed connection, a
  failed or out-of-order migration. Railway does not retry a failed
  pre-deploy command: the deploy stops and the previous version keeps
  serving.
- **Logs:** only `Applying N migration(s)...`, `Applied <name>` for each one,
  `No pending migrations (N applied).`, or `Migrations failed, none applied
(code: <code>).` The code is a Postgres SQLSTATE (`42P01`), a Node network
  code (`ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`) or the error's class. The
  error message is never logged: it carries SQL, values or connection
  details (CLAUDE.md §6). Configuration errors name the variable only.
- **Connection:** one connection, 30 s connect timeout (Neon may take a few
  seconds to wake a suspended compute).

What CI proves on every run (empty database, second run is a no-op, a broken
migration exits non-zero and leaves nothing behind) is in
[docs/ci.md](ci.md#job-build-and-smoke-test-the-docker-image). The
PGlite tests in `migration-runner.spec.ts` cover the same cases plus an
older database and the out-of-order refusal. On 2026-11-11 the image was
also run by hand against a scratch database migrated by drizzle-kit and
holding `main`'s seed: nothing pending, then an extra migration applied with
the seeded rows intact.

### Runbook: a migration failed before a deploy

Draft until it has been used once.

1. The Railway deployment shows the pre-deploy command failed; its log ends
   with `Migrations failed, none applied (code: <code>)`. Nothing was
   applied and the previous version is still serving: there is no outage.
2. Read the code:
   - `28P01` (wrong password) or `28000`: `DATABASE_MIGRATION_URL` is out of
     date, for example after an owner password reset. Update it in Railway
     and redeploy.
   - `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`: network or host. Check the
     host is the direct one (no `-pooler`) and Neon's status, then redeploy.
   - `Invalid environment configuration`: the variable is missing or has no
     `sslmode=verify-full`.
   - Any other SQLSTATE (see Postgres' "Error codes" appendix): the
     migration itself failed. Common ones: `23502` (a new `NOT NULL` column
     without a default on a table with rows), `23505` (a new unique index
     over duplicate rows), `42P01`/`42703` (a missing table or column).
   - "older than the last applied migration": regenerate it (see above).
3. For a failing migration, reproduce it locally: `pnpm db:seed` (fictional
   data), then `pnpm db:migrate`. Never run migrations by hand against
   production (CLAUDE.md §6).
4. Fix forward with a pull request. The failed migration applied nothing in
   production, so correcting that migration's SQL is allowed; anyone who
   applied the old version locally recreates their database. If it is data
   dependent (step 2), write the migration so it handles existing rows (a
   default, a backfill before `NOT NULL`).

### Changing the schema safely

The old version keeps serving while the pre-deploy command runs, and serves
against the new schema if a deploy is rolled back
([Roll back](#roll-back)). So every migration must work with the version
before it: add columns as nullable or with a default; remove or rename in two
releases. Statements that cannot run inside a transaction
(`CREATE INDEX CONCURRENTLY`) do not work with this migrator, and a new enum
value cannot be used by a later statement of the same deploy (Postgres
requires the `ADD VALUE` to commit first): split such changes across two
deploys.

## Railway service

**Status (#40): configuration written, not applied yet.** The service exists
but still has Railway's defaults (Railpack, no Wait for CI, no domain, no
variables); every merge since the repository was connected built with
Railpack and crashed, without a public URL, so nothing was ever exposed.
[Runbook: first deploy](#runbook-first-deploy) lists what is left, in order,
and [Service record](#service-record) what has been done.

### What is set up

Everything below lives in
[`.railway/railway.ts`](../.railway/railway.ts), the source of truth for the
service (CLAUDE.md §6). Never change these settings in the dashboard: the
next apply fails on the drift (see below), or undoes the change.

| Setting           | Value                                                       | Why                                                                                                                        |
| ----------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Project / service | `nutrition-app` / `nutrition-app`, environment `production` | One service: Nest serves the API and the web app ([Decisions](#decisions))                                                 |
| Source            | `jesusaugusto0x2/nutrition-app`, branch `main`              | Autodeploy from `main` only                                                                                                |
| Wait for CI       | On (`checkSuites: true`)                                    | Only commits whose workflows passed deploy                                                                                 |
| Build             | `DOCKERFILE`, `Dockerfile`                                  | The image smoke-tested in CI; Railway's default is Railpack                                                                |
| Pre-deploy        | `node migrate.js`                                           | [Migrations](#migrations); a failure stops the deploy                                                                      |
| Healthcheck       | `/api/health`, timeout 120 s                                | The new version takes traffic only once it answers 200; 120 s leaves room for Neon to wake up (Railway's default is 300 s) |
| Restart policy    | `ON_FAILURE`, at most 10 retries                            | A crash restarts the container; a crash loop stops instead of retrying forever                                             |
| App Sleeping      | Off (`sleepApplication: false`)                             | The daily cleanup job needs the process awake ([Scheduled jobs](#scheduled-jobs))                                          |
| Region, replicas  | `us-east4-eqdc4a` (Virginia), 1                             | Next to Neon ([Database (Neon)](#database-neon)); one replica because of the in-memory rate limiter                        |
| Domain            | `nutrition-app-production.up.railway.app` → port 3000       | Railway's own domain until #41                                                                                             |
| Variables         | See below and [Variables](#variables)                       | Literals for non-secrets, `preserve()` for secrets                                                                         |

Sources, checked on 2026-11-11: the `railway` SDK 3.16.0 types
(`DeployConfig`, `BuildConfig`, `ServiceSource`; the reference pages do not
list every field yet), `railway config --help` in CLI 5.71.0,
[Railway IaC](https://docs.railway.com/infrastructure-as-code),
[IaC reference](https://docs.railway.com/infrastructure-as-code/reference),
[railwayapp/config](https://github.com/railwayapp/config),
[Railway healthchecks](https://docs.railway.com/deployments/healthchecks),
[Railway GitHub autodeploys](https://docs.railway.com/deployments/github-autodeploys).

**Port.** Railway injects `PORT` into the container and probes the
healthcheck on it; the app listens on `PORT` (`loadConfig`). The file sets
`PORT=3000`, the image's own default, so the variable, the healthcheck and the
domain's target port are all visibly the same number. Without it Railway
picks a port itself (8080 by default), which also works but hides the value
the domain has to match.

**Variables.** Literals in the file: `PORT`, `APP_ORIGIN`
(`https://` + the Railway domain), `CLIENT_IP_SOURCE=x-real-ip`, and two
placeholders until email delivery (#42): `SMTP_URL=smtp://smtp.invalid:587`
(nothing resolves there, so every email fails and only the error name is
logged) and `MAIL_FROM`. Secrets are `preserve()`: the file names them, and
their values exist only in Railway and the password manager. `DATABASE_URL`,
`DATABASE_MIGRATION_URL`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
by hand ([Runbook: set the secrets](#runbook-set-the-secrets)). `NODE_ENV` and
`WEB_DIST_DIR` come from the image.

**The app never sees the owner role.** Railway gives the pre-deploy command
and the app the same variables, so `DATABASE_MIGRATION_URL` reaches the app's
container too. The image starts with
`CMD ["env", "-u", "DATABASE_MIGRATION_URL", "node", "main.js"]`: `env` removes
it and execs node, which stays PID 1 and receives Railway's `SIGTERM` itself.
The smoke test proves both. The value is still stored in the service's
variables and visible to anyone with access to the Railway project; what this
removes is the app process (and anything that dumps its environment) holding
the owner's credentials.

### How the file is applied

Railway does not read `.railway/` during deploys. The `Railway config` workflow
([.github/workflows/railway-config.yml](../.github/workflows/railway-config.yml))
uses Railway's `railwayapp/config` action:

1. A pull request that touches `.railway/` runs `Plan Railway config`, which
   evaluates the file with the pinned CLI (5.71.0) and comments the diff on the
   pull request, marking destructive changes. Values are shown as `«hidden»`.
2. Review the comment like code. Merging is the approval.
3. On merge, `Apply Railway config` applies **the plan from the pull request**,
   not a new one.

It authenticates with `RAILWAY_TOKEN`, a Railway **project token** for the
`production` environment, stored as a repository secret
([Runbook: the Railway token](#runbook-the-railway-token)). Fork pull requests
get no secrets, so they are never planned.

The apply fails, by design, when:

- **the environment changed after the plan** (a dashboard edit, a variable set
  by hand, another apply): push a commit or close and reopen the pull request
  to plan again, then merge. A merged pull request cannot be re-planned: open a
  new one that touches `.railway/` (a comment change is enough);
- **`.railway/` changed between the plan and the merge**, or there is no plan
  for the merged head: same fix.

`pnpm railway:typecheck` (also a CI step) type-checks the file against the
SDK; the plan itself is the real test.

**A merge that changes both code and `.railway/`.** The apply and the deploy
start from the same merge, but the deploy waits for CI (minutes) and the
apply takes seconds, so the deploy normally uses the new settings. Check the
deployment's settings if it matters, and use **Deploy Latest Commit** after
the apply when in doubt.

**Running the CLI locally** (to `railway config pull` or `plan` before a pull
request): install `@railway/cli` 5.71.0, `railway login`, `railway link` to
this project and the `production` environment, then `railway config plan`.
Never `railway config apply` by hand: apply only through the workflow, so
every change has a reviewed pull request.

### Runbook: the Railway token

1. Railway → project `nutrition-app` → **Settings → Tokens → Create**, name
   `github-railway-config`, environment `production`. Copy it once.
2. GitHub → repository → **Settings → Secrets and variables → Actions → New
   repository secret**, name `RAILWAY_TOKEN`, paste it. Keep no other copy
   (it can always be replaced), and never paste it in a chat, issue or log.
3. To rotate: create a new token, replace the secret, delete the old token.

### Runbook: set the secrets

Values come from the password manager ([Connection strings](#connection-strings)
and [Google](authentication.md#register-a-new-google-redirect-uri)); never
paste them anywhere else. In Railway → service `nutrition-app` →
**Variables**, add or edit:

- `DATABASE_URL`: pooled host, `nutri_app`, `sslmode=verify-full`;
- `DATABASE_MIGRATION_URL`: direct host (no `-pooler`), `neondb_owner`,
  `sslmode=verify-full`;
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: the existing Web client (one
  client serves development and production).

The dashboard stages the change: deploy it from the banner. Do it **before**
a pull request is planned (or plan again afterwards), since a variable edit
makes an older plan stale. These are the only service settings changed in the
dashboard, because the file marks them `preserve()`.

### Runbook: first deploy

Each step depends on the previous one. Record the dates in
[Service record](#service-record).

1. **Token:** [Runbook: the Railway token](#runbook-the-railway-token).
2. **Secrets:** [Runbook: set the secrets](#runbook-set-the-secrets).
3. **Google:** add
   `https://nutrition-app-production.up.railway.app/api/auth/google/callback`
   to the Web client's redirect URIs
   ([Register a new Google redirect URI](authentication.md#register-a-new-google-redirect-uri)).
4. **Plan:** push to (or reopen) the #40 pull request and read the plan
   comment. Expect the build to change to `DOCKERFILE`, Wait for CI on, the
   pre-deploy command, healthcheck, restart policy, the domain and the literal
   variables, and probably the project name, from `charming-cooperation`
   (the name Railway generated) to `nutrition-app`. Nothing destructive: if
   the plan marks anything destructive, stop and find out why. If the
   domain is taken, choose another `*.up.railway.app` name, update
   `RAILWAY_DOMAIN` and step 3, and plan again.
5. **Merge.** The apply runs. The merge's own deploy may already have started
   with the old settings (no Wait for CI yet); once the apply succeeds, run
   **Deploy Latest Commit** (`Cmd + K`) if the active deployment was not
   built from the `Dockerfile`.
6. **Check the deploy:** the pre-deploy log shows `Applying N migration(s)...`
   then one `Applied <name>` per migration, and the deployment becomes active
   after the healthcheck passes.
7. **Check the service** (the smoke test's checks, against the public URL):

   ```bash
   base=https://nutrition-app-production.up.railway.app
   curl -si "$base/api/health"            # 200 {"status":"ok",...}
   curl -si "$base/" | head -n 1          # 200, the SPA
   curl -si "$base/patients" | head -n 1  # 200, the SPA (deep link)
   curl -si "$base/api/does-not-exist"    # 404 JSON, code NOT_FOUND
   curl -si "$base/api/clinic/patients"   # 401: no session
   curl -si -X POST -H "Origin: $base" "$base/api/auth/sign-out"                # 204
   curl -si -X POST -H 'Origin: https://evil.example' "$base/api/auth/sign-out" # 403
   ```

   The two `POST`s prove `Origin` crosses Railway's edge and `CsrfGuard` sees
   it. Then sign in with Google in a browser and create a clinic: the
   onboarding is a `POST` from the real browser (with `Sec-Fetch-Site`).

8. **Check the logs:** no request bodies, emails, patient data or variable
   values; Nest's startup lines and route map only. The HTTP log stream shows
   paths and status codes, which carry no patient data (ids are uuids).
9. **Database follow-ups (#38):** run [check-app-role.sql](#runbook-check-the-app-role)
   now that the schema exists, and [test a restore](#runbook-test-a-restore).
10. **Wait for CI:** confirm the next merge goes through `WAITING` before
    deploying, and that a commit whose CI fails is `SKIPPED` (watch the next
    red run on `main`, if one happens; never break `main` on purpose).
11. **Cleanup job (#43):** after 03:00 UTC, look for the `AuthCleanupJob`
    line ([Scheduled jobs](#scheduled-jobs)).

### Service record

Names and dates only.

- **Project and service created: before 2026-11-05**, connected to the
  repository, region `us-east4-eqdc4a` (Virginia), one replica. Railway named
  the project `charming-cooperation`; the file names it `nutrition-app`.
- **`.railway/railway.ts` applied: pending** (first apply on the #40 merge).
- **`RAILWAY_TOKEN` created: pending.**
- **Secrets set: pending.**
- **Google redirect URI for the Railway domain: pending.**
- **First successful deploy and first migration: pending.**
- **Checks of step 7–8: pending.**
- **Deploy Latest Commit and Wait for CI:** pending; record whether a manual
  deploy waits for CI (Railway's docs do not say).

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
in a password manager; non-secret Railway values are literals in
`.railway/railway.ts` ("IaC"), secrets are `preserve()` there. Today
`SMTP_URL` and `MAIL_FROM` are placeholder literals (#42), and `APP_ORIGIN`
is the Railway domain (#41). The pre-deploy command sees the same variables as
the app, except that the app's `CMD` removes `DATABASE_MIGRATION_URL`
([Railway service](#railway-service)).

| Variable                 | Purpose                                             | Used by    | Managed in        |
| ------------------------ | --------------------------------------------------- | ---------- | ----------------- |
| `NODE_ENV`               | `production`; turns on required variables           | App        | `Dockerfile`      |
| `WEB_DIST_DIR`           | Path of the built web app                           | App        | `Dockerfile`      |
| `PORT`                   | Port the API listens on: 3000                       | App        | `Dockerfile`, IaC |
| `DATABASE_URL`           | Pooled connection, `nutri_app`; `verify-full`       | App        | Railway (secret)  |
| `DATABASE_MIGRATION_URL` | Direct connection, owner role; `verify-full`        | Pre-deploy | Railway (secret)  |
| `RAILWAY_TOKEN`          | Project token; applies `.railway/railway.ts`        | GitHub     | GitHub secret     |
| `SMTP_URL`               | SMTP server with credentials                        | App        | Railway (secret)  |
| `MAIL_FROM`              | Sender of every email, on the verified domain       | App        | Railway           |
| `APP_ORIGIN`             | Public origin; builds email links, checked by CSRF  | App        | Railway           |
| `CLIENT_IP_SOURCE`       | `x-real-ip` on Railway; client IP for rate limiting | App        | Railway           |
| `GOOGLE_CLIENT_ID`       | OAuth client for Google sign-in                     | App        | Railway           |
| `GOOGLE_CLIENT_SECRET`   | Its secret                                          | App        | Railway (secret)  |

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
   (`Cmd + K`) and run **Deploy Latest Commit**. It deploys the latest commit
   of `main`. Railway's docs do not say whether it waits for CI, so watch the
   result and write it in [Service record](#service-record) the first time.
3. If the deploy is not in the history at all, click **Show Skipped**: a
   skipped deploy says why.

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

Draft until it has been used once. Act fast: the restore window is **6
hours** on the Free plan ([Database (Neon)](#database-neon)); after that,
the past is gone.

1. Try to avoid restoring production: within the history window, create a
   branch at the point in time and read from it to confirm the right moment
   ([Runbook: test a restore](#runbook-test-a-restore) has the steps).
2. If production must go back, use Neon's instant restore: select the
   `production` branch, **Backup & Restore → Restore from history**, pick the
   time, **Next**, review, **Restore**. It **discards
   every change after that point in all databases on the branch**, and keeps
   the prior state in a backup branch `{branch_name}_old_{head_timestamp}`,
   which is how a restore is undone.
3. Connections drop for a few seconds and the connection details do not
   change, so the app reconnects by itself. Check `GET /api/health`.

### Rotate credentials

Draft until #42 is done and each part has been used once. Never paste a
value in an issue, a pull request or a chat.

- **Neon, `nutri_app`:** it was created with SQL, so change its password with
  SQL too (Neon does not document the Console's reset for such roles).
  Generate a password and copy it as in step 3 of
  [Runbook: set up the project](#runbook-set-up-the-project), save it in the
  password manager, then run, as the owner over the direct host:

  ```bash
  APP_PASSWORD="$(pbpaste)" docker run --rm -it -e APP_PASSWORD \
    -v "$PWD/scripts/neon:/sql:ro" postgres:18-alpine \
    psql "host=<endpoint>.<region>.aws.neon.tech dbname=nutri user=<owner> sslmode=verify-full sslrootcert=system" \
    -f /sql/rotate-app-password.sql
  ```

  Then update `DATABASE_URL` in Railway and deploy. Connections already open
  keep working; new ones fail until the deploy, so expect a short outage.

- **Neon, owner role:** reset its password in the Neon Console (Roles →
  Reset password), then update `DATABASE_MIGRATION_URL` in Railway. Only the
  next deploy's migrations use it, so there is no outage.
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

**Does a merge apply `.railway/railway.ts`?** Not by itself: Railway does
not read `.railway/` during deploys. The `Railway config` workflow applies it
when a pull request that touches `.railway/` is merged
([How the file is applied](#how-the-file-is-applied)).

**The `Railway config` apply failed after a merge.** Usually the environment
changed after the plan (someone edited the dashboard or a variable). Nothing
was applied. Open a new pull request that touches `.railway/` to plan again.

**Why is a secret `preserve()` instead of written in the file?** The
repository is public. `preserve()` tells the apply to keep whatever value
Railway has, so the value is set once by hand and never leaves Railway and
the password manager.

**Does the `Railway config` workflow block a deploy?** No. Wait for CI looks
at workflows on the deployed commit (the push to `main`); `Railway config`
runs on `pull_request` events only.

**Why `nutrition-app-production.up.railway.app`?** It is a Railway domain
declared in the file (Railway's usual `<service>-<environment>` pattern), so
`APP_ORIGIN` and the Google redirect URI can be written down before the first
deploy. #41 adds the custom domain.

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
(`apps/api/src/config/app-config.ts`). Until #41 and #42, `.railway/railway.ts`
sets the Railway domain and email placeholders
([Railway service](#railway-service)).

**Sign-up and password reset emails never arrive.** Expected until #42:
`SMTP_URL` is a placeholder, so sending fails and the log shows only
`Could not process a sign-up request (<error name>)` or similar. Sign in with
Google meanwhile.

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

**The app logs `permission denied for table <name>` after a deploy.** The
table was created by a role other than the owner, so the default privileges
did not apply. Run `check-app-role.sql` to list every such table, grant on
them as the owner (`GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO
nutri_app;`), and make sure migrations run with `DATABASE_MIGRATION_URL`.

**Why not run the role script in the Neon SQL Editor?** The editor keeps a
history of what was run, and the script contains a password. psql in a
throwaway container reads it from an environment variable filled from the
clipboard, so it is never displayed or stored.

**Why does the app role not get `CREATE` on `public` explicitly revoked?**
Since Postgres 15, `PUBLIC` has only `USAGE` on `public`, and roles created
with SQL on Neon get nothing more; `check-app-role.sql` proves it. Temporary
tables are the one default that had to be revoked (`REVOKE TEMPORARY ... FROM
PUBLIC`).

**Can a branch or a restore leak data?** A branch is a full copy of
production, patient data included, with the same roles and passwords. Create
one only for a restore check, read counts rather than rows, and let it
auto-delete.

**Does `node migrate.js` need the app's variables?** No. It reads only
`DATABASE_MIGRATION_URL`; the app's required production variables
(`SMTP_URL`, `APP_ORIGIN`...) are not checked, so a missing one fails the
app's start, not the migrations.

**Why not `drizzle-kit migrate` in the image?** drizzle-kit is a dev
dependency (it generates migrations), not in the pruned production install.
drizzle-orm's migrator is already a runtime dependency, applies the same
folder and records in the same table.

**Can two migration runs collide?** Railway runs the pre-deploy command once
per deploy. If two deploys overlapped, the second run would wait on the
first one's locks and then fail (for example `42P07`, the table already
exists) without applying anything; its deploy stops, and the next deploy
finds nothing pending. There is no advisory lock.

**Why does the smoke test use `DATABASE_URL` as `DATABASE_MIGRATION_URL`?**
In CI the Postgres service has one user, which owns the database. In
production they are two roles over two hosts.

**What if the folder or journal is missing from the image?** `migrate.js`
fails with `code: ENOENT` and the deploy stops. The smoke test would catch it
first, since its first run must migrate an empty database.

**Is the seed ever run on Neon?** Never. It refuses to run with
`NODE_ENV=production`, and the runbooks never call it.

**Rehearsing the role scripts locally.** Use a scratch database and a
non-superuser owner with `CREATEROLE`, never the dev database. In the
Docker Compose Postgres, connections over `localhost` inside the container
are trusted without a password (the image's `pg_hba.conf`), so test
passwords from another container through `host.docker.internal`.

## Open questions and debt

- **The restore window is 6 hours (Neon Free).** For clinical data that is a
  short margin: a mistake noticed the next morning cannot be undone, and
  nothing else backs up the database. Decide before the first real user
  (#45): move to Launch (pay as you go) and raise the window to 7 days
  (history is billed per GB-month), or add a scheduled logical backup.
  Recorded on 2026-11-05, when the owner chose Free to start.
- **Rotate `neondb_owner`'s password before the first real user (#45).** It
  left the password manager during setup (2026-11-09). The database is still
  empty, so the owner chose to keep it for now. Follow
  [Rotate credentials](#rotate-credentials).

- **Temporary values until #41 and #42.** `APP_ORIGIN` is the Railway
  domain (its Google callback is registered too), and `SMTP_URL`/`MAIL_FROM`
  are placeholders, so no email is delivered. #41 replaces the origin and the
  callback, #42 the mail variables (as `preserve()` for `SMTP_URL`). Recorded
  on 2026-11-11 (#40).
- **CSRF behind Railway's edge is unverified until the first deploy.** OWASP
  warns that proxies can strip `Origin` or `Sec-*` headers, which would turn
  every write into a 403. Step 7 of
  [Runbook: first deploy](#runbook-first-deploy) checks it.
- **The owner role's string is still a service variable.** The app process
  no longer has it (`env -u` in the image's `CMD`), but anyone with access to
  the Railway project can read it, as with every other variable. Railway has
  no variables scoped to the pre-deploy command. Accepted on 2026-11-11.

Known technical debt that affects production
([docs/architecture.md](architecture.md#known-technical-debt)):

- [Rate-limit counters in memory](architecture.md#rate-limit-counters-in-memory):
  blocks running more than one replica.
- [Compromised password blocklist](architecture.md#compromised-password-blocklist):
  required before the first production sign-up (#45).
- [PGlite shipped in the production image](architecture.md#pglite-shipped-in-the-production-image).
