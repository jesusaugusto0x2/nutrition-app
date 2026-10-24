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
  `common`, `health` and `auth`.
- **Layers: controller → service → repository.** Controllers only deal with
  HTTP (routing, DTOs, status codes). Services hold business rules and map
  rows to API shapes. Repositories are the only code that touches the
  database. Modules talk to each other through exported services (e.g.
  `ConsultationsService` uses `PatientsService.assertExists`), never through
  another module's repository. This keeps data access rules, such as clinic
  scoping, in one place per table.
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
  `@ClinicAccess()`; handlers receive the clinic through `@CurrentClinic()`.
  Until authentication exists, a **TEMPORARY** `DevelopmentClinicGuard`
  assigns the seed clinic, only when `NODE_ENV=development`; in any other
  environment clinic routes return 401. Real auth replaces only that guard.
- The patient portal will live under `/api/portal`: read-only and exposing
  only shareable fields, through the clinical modules' exported services.
- Clinical records are soft-deleted (`deleted_at`); never physically deleted.
- Row Level Security is planned as defense in depth (see the TODO in
  `apps/api/src/database/schema/index.ts`); it needs real auth first.
- The PWA service worker never handles `/api`: health data is not cached on
  devices.

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
- **TanStack Router** with file-based routes and three layouts: `_clinic`
  (staff), `_auth` and `_portal` (placeholders). Route loaders prefetch with
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

## Deployment (planned)

A single container on Railway (see the `Dockerfile`): the image builds both
apps, keeps only the API's production dependencies (Nx `prune`) and runs Nest
as the `node` user. Database: Neon. Not yet set up.

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

### Production migrations

- **Status:** pending, part of the deployment work.
- **Why:** migrations run with drizzle-kit (`pnpm db:migrate`), a dev tool
  that is not in the production image, and deployment is out of scope.
- **Resolve when:** setting up Railway + Neon. Options: a release command
  that runs `drizzle-kit migrate` from the build stage, or a small migration
  entry point using `drizzle-orm`'s migrator shipped in the image.
