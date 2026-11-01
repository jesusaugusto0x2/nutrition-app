# Nutri (Mi consulta)

Mobile-first web app for nutritionists to manage patients, their nutrition
history and weight/measurement tracking per consultation. Multi-clinic, with
per-clinic data isolation. The UI is in Spanish.

- `apps/api`: NestJS API (serves the web app in production)
- `apps/web`: React + Vite SPA/PWA
- `libs/shared/schemas`: shared Zod schemas (`@nutri/schemas`)
- `libs/shared/utils`: shared pure calculations (`@nutri/utils`)

See [docs/architecture.md](docs/architecture.md) for the design and
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

Clinic routes do not require a session yet: in development every clinic
route acts on the seed clinic (see "TEMPORARY" in
`apps/api/src/common/guards`). Sign-in already works
(`POST /api/auth/sign-in`) with these seed users (development only; the seed
refuses to run in production):

| User                 | Password             | Kind                                         |
| -------------------- | -------------------- | -------------------------------------------- |
| `owner@example.com`  | `nutri-dev-password` | Staff: owner of the seed clinic              |
| `portal@example.com` | `nutri-dev-password` | Portal: guardian of the patient Valentina R. |

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
  -e DATABASE_URL=postgres://user:password@host:5432/db \
  -e SMTP_URL=smtps://resend:API_KEY@smtp.resend.com:465 \
  -e 'MAIL_FROM=Mi consulta <no-reply@example.com>' \
  -e APP_ORIGIN=https://app.example.com \
  -e CLIENT_IP_SOURCE=socket \
  nutri
```

The container runs only Nest: the API under `/api` and the web app on every
other route. Migrations are not run by the image yet (see
[Known technical debt](docs/architecture.md#known-technical-debt)).

CI builds the image and smoke-tests it on every pull request. To run the same
smoke test locally against the Docker Compose database:

```bash
docker build -t nutri .
DATABASE_URL=postgres://nutri:nutri@host.docker.internal:5432/nutri \
  scripts/smoke-test-image.sh nutri
```

## Troubleshooting

- **Clinic routes return 503 "Development clinic not found"**: run
  `pnpm db:seed`.
- **Nx reports "The workspace is out of sync"**: run `pnpm nx sync` (needed
  after adding a dependency between workspace projects).
- **CI fails on "Commit messages"**: a commit in the pull request does not
  follow Conventional Commits with a scope; reword it (`git rebase -i`) and
  force-push the branch.
- **CI fails on "Drizzle schema and migrations"**: run `pnpm db:generate`
  and commit the new migration.
- **CI fails on "Generated files are committed"**: run `pnpm build` and
  commit the files it changed (usually `apps/web/src/routeTree.gen.ts`).
- **Tests ignore a tsconfig change**: run `pnpm exec vitest --clearCache`
  (Vitest caches transformed modules on disk).
