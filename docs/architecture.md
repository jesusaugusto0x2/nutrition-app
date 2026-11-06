# Architecture

This document records the architectural decisions behind Nutri and why they
were made. Day-to-day rules for contributors live in [CLAUDE.md](../CLAUDE.md).

## Product context

Nutri is a mobile-first web app for nutritionists: patients, their nutrition
history and weight/measurement tracking per consultation. It is multi-clinic
from day one: every nutritionist works inside a clinic and clinical data is
isolated per clinic. A read-only portal for patients (or their guardians,
for minors) is planned. The data is health data, so isolation, minimal
exposure and not leaking data into logs are first-class requirements.

## Monorepo

- **Nx + pnpm workspaces.** One repository for the API, the web app and the
  shared libraries, with task caching, affected commands and enforced module
  boundaries.
- **TypeScript project references, no `baseUrl`.** Workspace libraries are
  pnpm workspace packages (`@nutri/schemas`, `@nutri/utils`). In development
  they resolve to `src/` through the `@nutri/source` custom export condition;
  builds and runtime use `dist/`. `baseUrl` is deprecated in TypeScript 6 and
  removed in 7, so it is not used anywhere; the only `paths` entry is the web
  app's `@/*` alias (relative to its tsconfig), required by shadcn/ui.
- **Module boundaries** (`@nx/enforce-module-boundaries`, tags in each
  `package.json`):
  - `scope:api` and `scope:web` never import each other.
  - `scope:shared` libraries cannot import Nest, Express, React, TanStack or
    Drizzle, so they run unchanged on the server and in the browser.
  - `type:utils` may depend on `type:schemas`; never the reverse.

```
apps/api            NestJS API (also serves the built web app in production)
apps/web            React + Vite SPA/PWA
libs/shared/schemas Zod schemas: the API contract (@nutri/schemas)
libs/shared/utils   Pure domain calculations (@nutri/utils)
```

## Backend (apps/api)

- **Modular monolith.** One Nest module per domain under `src/modules`
  (`clinics`, `patients`, `consultations`, and empty `nutrition-history` and
  `portal` placeholders). Cross-cutting code lives in `config`, `database`,
  `common`, `health`, `auth` and `mail`.
- **Layers: controller → service → repository.** Controllers only deal with
  HTTP (routing, DTOs, status codes). Services hold business rules and map
  rows to API shapes. Repositories are the only code that touches the
  database. Modules talk to each other through exported services (e.g.
  `ConsultationsService` uses `PatientsService.assertExists`), never through
  another module's repository. This keeps data access rules, such as clinic
  scoping, in one place per table.
- **Transactions across modules.** A write that spans modules stays atomic
  without breaking those layers. The service that owns the use case opens the
  transaction with `TransactionRunner.run` (`database/transaction-runner.ts`,
  provided by the global `DatabaseModule`) and passes the `Transaction` handle
  to every step, as the last argument. Repository methods that can join one
  take an optional `tx` and write through `tx ?? this.db`. An exported service
  method that makes several writes takes a **required** `tx`, so it cannot run
  half outside a transaction (`ClinicsService.createWithOwner`). A repository
  method whose steps all live in one module may still open its own
  transaction (`CredentialsRepository.resetPassword`). Never send email or
  call another service over the network inside a transaction: it would hold a
  database connection for the whole call, and a rollback cannot unsend it.
  Sign-up is the reference example.
- **Validation and serialization with nestjs-zod.** Request DTOs and
  response DTOs are created from `@nutri/schemas`. `ZodValidationPipe`
  validates params and bodies; `ZodSerializerInterceptor` validates every
  response and strips undeclared fields, so internal columns such as
  `clinic_id` or `deleted_at` cannot leak by accident.
- **Configuration** is validated with Zod at startup (`src/config`). Invalid
  configuration fails fast and the error lists variable names, never values.
- **Errors** are normalized by `AllExceptionsFilter` into the shared
  `ApiError` shape (`statusCode`, `code`, `message`, optional `details`,
  `path`, `timestamp`). Unexpected errors become a generic 500.
- **Logging policy.** Never log patient data or secrets. The error filter
  logs only the route pattern, status and error type (plus stack frames
  without the message line, which may contain values).
- **Production serving.** One container: Nest serves the API under `/api` and
  the built SPA for everything else (`@nestjs/serve-static` with an
  `index.html` fallback; `/api/*` is excluded so unknown API routes return
  JSON 404s).

## Multi-tenancy and security

- Every clinical table carries `clinic_id`; every repository method takes a
  `clinicId` and filters by it (and by `deleted_at IS NULL`). There is no
  repository method that reads clinical data without a clinic.
- `consultations` has a composite foreign key `(patient_id, clinic_id) →
patients(id, clinic_id)`, so the database itself rejects a consultation in
  a different clinic than its patient.
- A patient from another clinic is indistinguishable from a missing one
  (404), so ids cannot be probed across clinics.
- Clinic routes live under `/api/clinic` and are marked with
  `@ClinicAccess()`; handlers receive the clinic through `@CurrentClinic()`,
  which `ClinicAccessGuard` resolves from the user's membership (see
  [Route protection](authentication.md#route-protection-12)).
- The patient portal will live under `/api/portal`: read-only and exposing
  only shareable fields, through the clinical modules' exported services.
- Clinical records are soft-deleted (`deleted_at`); never physically deleted.
- Row Level Security is planned as defense in depth (see the TODO in
  `apps/api/src/database/schema/index.ts`). Authentication now provides the
  clinic per request, so it is unblocked but not scheduled.
- The PWA service worker never handles `/api`: health data is not cached on
  devices.

## Authentication

Designed and built by the Authentication epic (#8). Details, runbooks and FAQ:
[docs/authentication.md](authentication.md). The decisions in short:

- **Server-side sessions in PostgreSQL, an opaque `HttpOnly` cookie in the
  browser, no JWT.** Nest serves the SPA and the API from one origin, so the
  API acts as a backend-for-frontend. Only SHA-256 hashes of session and
  emailed tokens are stored, and a session is revoked by deleting its row.
- **Passport strategies only; sessions are our own code.** Better Auth was
  rejected for its advisories. Google sign-in uses `openid-client` directly
  (Authorization Code with PKCE, server-side).
- **Email and password with argon2id** (OWASP parameters, NIST length rules:
  at least 15 characters, no composition rules), or **Google**. Emails are
  normalized once and a `CHECK` constraint enforces it.
- **The account kind comes from data:** a membership means staff, a
  `patient_access` grant means the portal, neither means onboarding. Open
  sign-up is for nutritionists only and creates the user, the clinic and an
  `owner` membership in one transaction.
- **Protected by default:** global `CsrfGuard` → `SessionAuthGuard` →
  `ClinicAccessGuard` / `PortalAccessGuard`. `@Public()` goes on each
  handler. Writes must come from `APP_ORIGIN`.
- **Auth failures never reveal whether an email has an account:** one
  401 for every bad sign-in, and the email-sending routes always answer 202
  and do the work after responding.
- **Rate limiting** only on the public auth routes, per IP and per email,
  never locking accounts. **Email** goes over SMTP (Mailpit locally, Resend in
  production), with its Spanish texts in the API.
- Sessions and auth tokens are auth data, not clinical records, so they are
  physically deleted (daily job).

## Data

- **PostgreSQL + Drizzle ORM**, migrations with drizzle-kit
  (`apps/api/src/database/migrations`). Docker Compose locally, Neon in
  production.
- **Casing:** snake_case tables/columns, camelCase in TypeScript via Drizzle's
  `casing: 'snake_case'`, set in both the client and `drizzle.config.ts`.
  Composite constraint names are explicit because Drizzle does not apply the
  casing to generated constraint names.
- **Conventions:** plural table names; uuid primary keys; `created_at` and
  `updated_at` (`timestamptz`, UTC) on every table; calendar dates (birth
  date, consultation date) as `date`; measurements as `numeric` read as
  numbers, in metric units (kg, m, cm).
- **Never edit an applied migration**; generate a new one.
- **Seed** (`pnpm db:seed`) creates fictional data relative to the current
  date and is repeatable.

## Shared contract

`@nutri/schemas` is the single source of truth for API shapes. The API
derives its DTOs from it; the web app validates every response with the same
schemas through its typed `api-client`, so drift between client and server
fails loudly. `@nutri/utils` holds pure calculations (BMI, age, consultation
differences) used by both sides.

## Frontend (apps/web)

- **React + Vite SPA, installable PWA** (vite-plugin-pwa), mobile-first.
- **TanStack Router** with file-based routes and four layouts: `_clinic`
  (staff), `_auth` (signed-out pages), `_link` (pages opened from an emailed
  link) and `_portal` (placeholder). Route loaders prefetch with
  **TanStack Query**, which owns data freshness.
- **shadcn/ui** (Base UI primitives, `base-nova` style) and Tailwind CSS 4.
  Forms use shadcn's `Field` components with React Hook Form's `Controller`
  and `zodResolver` over the shared schemas (the older `Form` component is no
  longer part of shadcn's current docs).
- **Structure:** `components/ui` holds generic shadcn components;
  `features/<domain>` mirrors the API modules and holds domain logic, queries
  and components; `routes` only composes features.
- **Language:** all UI text is Spanish and lives in `src/i18n/es.ts` with
  English keys (`t.patients.listTitle`). No i18n library yet; adding a
  language means adding a file typed as `Messages`.
- **Formatting:** dates as `dd/mm/aaaa` and decimal commas, only through
  `src/lib/format.ts`. Each quantity has a fixed precision (kg 1 decimal,
  m 2, cm none when whole, BMI 1) and negatives use the typographic minus.
- **Design system:** the source of truth is the "Mi consulta" component spec
  and its 16-screen prototype (both in claude.ai). Its tokens (colors, radii,
  type scale) live in `src/styles/globals.css`; shadcn's semantic variables
  are aliased to them so generated components inherit the palette. The app
  is light-only and self-hosts Atkinson Hyperlegible Next (UI) and Newsreader
  (headings) through Fontsource, so no font request leaves the app. Users are
  not technical: every control is at least 44 px tall.
- **Component library:** the 36 spec components are split by what they
  know. `components/ui` holds generic ones (shadcn restyled plus our own:
  `FormField`, `UnitInput`, `YesNoField`, `EvolutionChart`, `Pagination`,
  notices…); `components/navigation` the app shell (brand, sidebar, bottom
  bar, back link), which knows routes; `features/consultations` and
  `features/patients` the domain ones (BMI badge, records table, patient
  header and rows). Pure logic behind them (parsing, formatting, chart
  scale, record diffs, BMI category) lives in plain functions with unit
  tests. `/dev/components` (development only) shows every component with
  its variants and states.
- **Layout:** `_clinic` shows the sidebar from `md`, wrapping above the
  content when both do not fit (~800 px), and the bottom bar on phones.

## Testing

- **Vitest is the only test runner**, in every project.
- In the API, Vite 8 transforms tests with Oxc, which emits the decorator
  metadata Nest needs for constructor injection; the production build uses
  `tsc` (webpack + ts-loader). Both read the decorator settings from
  `apps/api/tsconfig.decorators.json`, and
  `src/common/decorator-metadata.spec.ts` fails if test-time metadata stops
  being emitted.
- Repository tests run real SQL against **PGlite** (in-process PostgreSQL)
  with the real migrations, so clinic isolation is tested end to end without
  Docker.

## Deployment

A single container on Railway (see the `Dockerfile`): the image builds both
apps, keeps only the API's production dependencies (Nx `prune`) and runs Nest
as the `node` user. Database: Neon. Not yet set up; decisions, variables and
runbooks are in [docs/deployment.md](deployment.md).

- **Region: US East (Virginia) for both.** Neon `aws-us-east-1` (N.
  Virginia) and Railway `us-east4-eqdc4a` (Virginia) are the closest pair
  the two providers offer, so the app's queries pay the least latency, and
  the users are in the Americas. Health data is therefore stored in the
  United States. Rejected: Railway Amsterdam + Neon Frankfurt (close to each
  other, far from the users). Details:
  [Database (Neon)](deployment.md#database-neon).
- **The app connects with a data-only role** (`nutri_app`: no DDL); only
  migrations use the owner role. Production requires `sslmode=verify-full`
  on `DATABASE_URL` (`loadConfig`).

CI builds this image on every run and smoke-tests it, without ever pushing it;
what the smoke test checks and why the job ignores Nx `affected` are in
[docs/ci.md](ci.md#job-build-and-smoke-test-the-docker-image).

## Known technical debt

Every deviation from the plan that leaves work pending is recorded here with
its reason, what blocks it and how to resolve it. Remove an entry when it is
resolved.

### ESLint 10 migration

- **Status:** pending. The workspace uses ESLint 9 (9.39.x).
- **Why:** ESLint 10 is the current stable major and ESLint 9 is already
  flagged as no longer supported, but the React lint stack does not accept
  ESLint 10 yet.
- **Blocked by:** `eslint-plugin-react` (peer `eslint: ^3 … ^9.7`) and
  `eslint-plugin-jsx-a11y` (peer `eslint: ^3 … ^9`). Both are pulled in by
  `@nx/eslint-plugin`'s `flat/react` config used by `apps/web`.
  `@nx/eslint`, `typescript-eslint` and `eslint-plugin-import` already accept
  ESLint 10.
- **Resolve when:** both plugins publish a release whose peer range includes
  `^10`. Then bump `eslint` and `@eslint/js` to 10, run `pnpm lint` and fix
  any rule changes.

### NestJS 12 upgrade

- **Status:** pending. The API uses NestJS 11 (11.2.x).
- **Why:** NestJS 12 is the current stable major.
- **Blocked by:** `@nx/nest` 23.x (peer `@nestjs/common` and
  `@nestjs/core` `<12.0.0`) and `nestjs-zod` 5.x (peer `@nestjs/common`
  `^10 || ^11`). `@nestjs/serve-static` is kept on 5.x, the line that
  targets Nest 11.
- **Resolve when:** both `@nx/nest` and `nestjs-zod` support Nest 12. Upgrade
  all `@nestjs/*` packages together, with `@nestjs/serve-static` 12.x.

### TypeScript 7 upgrade

- **Status:** pending. The workspace uses TypeScript 6.0.x.
- **Why:** TypeScript 7 is the current stable major.
- **Blocked by:** `typescript-eslint` (peer `typescript: >=4.8.4 <6.1.0`),
  required for typed linting.
- **Prepared:** no tsconfig uses `baseUrl` or `ignoreDeprecations`; the only
  `paths` entry (`@/*` in `apps/web`) is relative to its tsconfig, which
  TypeScript 7 supports. Workspace libraries resolve through pnpm workspace
  packages and the `@nutri/source` custom condition.
- **Resolve when:** `typescript-eslint` supports TypeScript 7.

### PGlite shipped in the production image

- **Status:** pending (cosmetic). The runtime image includes
  `@electric-sql/pglite` (~35 MB) although only repository tests use it.
- **Why:** the lockfile resolves `drizzle-orm` with PGlite as a peer (it is
  a devDependency of the API), and `pnpm install --prod` installs that
  resolved peer set. No runtime code imports it.
- **Resolve when:** image size matters (e.g. cold starts). Options: move the
  PGlite test helper into a separate test-only package, or prune the peer in
  the `prod-deps` Docker stage and verify the API still starts.

### Rate-limit counters in memory

- **Status:** accepted for now.
- **Why:** `@nestjs/throttler` keeps its counters in the API process
  (`ThrottlerStorageService`). With one container that is enough; counters
  reset on every restart or deploy.
- **Blocked by:** nothing; it only matters with more than one API instance,
  where each instance would count on its own (multiplying every limit).
- **Resolve when:** running more than one container. Pass a shared
  `storage` (e.g. a Redis-backed `ThrottlerStorage`) in
  `createThrottlerOptions`.

### Compromised password blocklist

- **Status:** pending.
- **Why:** NIST SP 800-63B-4 requires comparing new passwords against a
  blocklist of common, expected or compromised passwords. `passwordSchema`
  only checks length (#18).
- **Resolve when:** before the first production sign-up (#45). Options: a
  bundled list of the most common passwords, or the Have I Been Pwned range
  API (k-anonymity: only the first 5 characters of the SHA-1 hash leave the
  server). The check belongs in the API (sign-up and reset), not only in the
  shared schema.

### Production migrations

- **Status:** pending, part of the deployment work.
- **Why:** migrations run with drizzle-kit (`pnpm db:migrate`), a dev tool
  that is not in the production image, and deployment is out of scope.
- **Resolve when:** setting up Railway + Neon. Options: a release command
  that runs `drizzle-kit migrate` from the build stage, or a small migration
