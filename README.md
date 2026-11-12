# Nutri (Mi consulta)

Mobile-first web app for nutritionists to manage patients, their nutrition
history and weight/measurement tracking per consultation. Multi-clinic, with
per-clinic data isolation. The UI is in Spanish.

- `apps/api`: NestJS API (serves the web app in production)
- `apps/web`: React + Vite SPA/PWA
- `libs/shared/schemas`: shared Zod schemas (`@nutri/schemas`)
- `libs/shared/utils`: shared pure calculations (`@nutri/utils`)

See [docs/architecture.md](docs/architecture.md) for the design,
[docs/authentication.md](docs/authentication.md) for sign-in and accounts,
[docs/deployment.md](docs/deployment.md) for production,
[docs/ci.md](docs/ci.md) for CI and quality checks and
[CLAUDE.md](CLAUDE.md) for development rules.

## Requirements

- Node.js 24+
- pnpm 11 (`npm install --global pnpm@11`)
- Docker with Docker Compose (local PostgreSQL)

## Run locally

```bash
# 1. Install dependencies (also installs the git hooks)
pnpm install

# 2. Create your local environment file
cp .env.example .env

# 3. Start PostgreSQL and Mailpit (development email inbox)
docker compose up -d

# 4. Create the schema and load fictional data
pnpm db:migrate
pnpm db:seed

# 5. Start the API and the web app
pnpm dev
```

Open http://localhost:4200. The web dev server proxies `/api` to the API on
http://localhost:3000 (health check: http://localhost:3000/api/health).

Every email the API sends in development lands in Mailpit at
http://localhost:8025; nothing leaves your machine. `pnpm mail:test` sends
one email of each template there to preview them.

### Sign in

The seed creates two verified users (development only; the seed refuses to
run in production):

| User                 | Password             | Lands on                                                      |
| -------------------- | -------------------- | ------------------------------------------------------------- |
| `owner@example.com`  | `nutri-dev-password` | `/patients`: owner of the seed clinic                         |
| `portal@example.com` | `nutri-dev-password` | `/portal`: guardian of the patient Valentina R. (placeholder) |

Open http://localhost:4200/login and sign in with either one. To try the
whole sign-up flow instead, register at http://localhost:4200/sign-up with any
address and open the verification link from Mailpit. Every route except
health and the sign-in family needs a session; how it all works is in
[docs/authentication.md](docs/authentication.md).

### Sign in with Google locally

Google sign-in is optional in development: without credentials the
«Continuar con Google» button leads to a 404. To try it end to end:

1. Create an OAuth client of type **Web application** as described in
   [Setting up the client in Google](docs/authentication.md#setting-up-the-client-in-google),
   with the redirect URI `http://localhost:4200/api/auth/google/callback`
   (exactly; the Vite proxy forwards it to the API). While the app is in
   **Testing**, add your Google account as a test user.
2. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the root `.env` and
   restart `pnpm dev`.
3. Open http://localhost:4200/login and click «Continuar con Google». A new
   account lands on `/onboarding`, where it names its clinic and then goes to
   `/patients`; an account that already exists goes straight home.

Any failure lands on `/login?error=google`. The API logs the reason as
`Google sign-in failed (<reason>)`; `TypeError` means it could not reach
Google.

## Scripts

| Script             | What it does                             |
| ------------------ | ---------------------------------------- |
| `pnpm dev`         | API and web app in watch mode            |
| `pnpm build`       | Build every project                      |
| `pnpm lint`        | ESLint, including Nx module boundaries   |
| `pnpm typecheck`   | TypeScript type checking                 |
| `pnpm test`        | Vitest in every project                  |
| `pnpm format`      | Prettier on the whole repository         |
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm db:migrate`  | Apply pending migrations                 |
| `pnpm db:seed`     | Reset local data to the fictional seed   |
| `pnpm db:studio`   | Open Drizzle Studio                      |
| `pnpm mail:test`   | Send every email template to Mailpit     |

Run a target for one project with Nx, e.g. `pnpm nx test api`.

## Production image

```bash
docker build -t nutri .
docker run -p 3000:3000 \
  -e "DATABASE_URL=postgres://user:password@host:5432/db?sslmode=verify-full" \
  -e SMTP_URL=smtps://resend:API_KEY@smtp.resend.com:465 \
  -e 'MAIL_FROM=Mi consulta <no-reply@example.com>' \
  -e APP_ORIGIN=https://app.example.com \
  -e CLIENT_IP_SOURCE=socket \
  -e GOOGLE_CLIENT_ID=CLIENT_ID \
  -e GOOGLE_CLIENT_SECRET=CLIENT_SECRET \
  nutri
```

The container runs only Nest: the API under `/api` and the web app on every
other route. Migrations are a separate command from the same image, which
Railway runs before each deploy
([Migrations](docs/deployment.md#migrations)):

```bash
docker run --rm \
  -e "DATABASE_MIGRATION_URL=postgres://owner:password@host:5432/db?sslmode=verify-full" \
  nutri node migrate.js
```

CI builds the image and smoke-tests it on every pull request and push to `main`
([what it checks](docs/ci.md#job-build-and-smoke-test-the-docker-image)). To run
the same smoke test locally, use a scratch database in the Docker Compose
Postgres (the smoke test migrates it), never the dev database:

```bash
docker build -t nutri .
docker compose exec postgres createdb -U nutri nutri_smoke
DATABASE_URL="postgres://nutri:nutri@host.docker.internal:5432/nutri_smoke?sslmode=disable" \
  scripts/smoke-test-image.sh nutri
docker compose exec postgres dropdb -U nutri nutri_smoke
```

## Troubleshooting

- **Signing in with a seed user fails**: run `pnpm db:seed` (it resets the
  local data and both passwords). Too many attempts answer 429; wait 15
  minutes or restart `pnpm dev`.
- **No email arrives in Mailpit**: check `docker compose up -d` and the API
  log; see
  [Read emails locally](docs/authentication.md#read-emails-locally-mailpit).
- **Nx reports "The workspace is out of sync"**: run `pnpm nx sync` (needed
  after adding a dependency between workspace projects).
- **Tests ignore a tsconfig change**: run `pnpm exec vitest --clearCache`
  (Vitest caches transformed modules on disk).
- **CI fails or does not run**: see
  [Troubleshooting and FAQ](docs/ci.md#troubleshooting-and-faq).
