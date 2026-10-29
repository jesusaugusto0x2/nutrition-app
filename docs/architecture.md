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
  environment clinic routes return 401. Real auth replaces only that guard
  (see [Authentication (planned)](#authentication-planned)).
- The patient portal will live under `/api/portal`: read-only and exposing
  only shareable fields, through the clinical modules' exported services.
- Clinical records are soft-deleted (`deleted_at`); never physically deleted.
- Row Level Security is planned as defense in depth (see the TODO in
  `apps/api/src/database/schema/index.ts`); it needs real auth first.
- The PWA service worker never handles `/api`: health data is not cached on
  devices.

## Authentication (planned)

**Status:** designed; partly implemented (the parts marked "implemented",
with their ticket). These are the decisions agreed in the
Authentication epic (#8); the work is split into tickets #9–#26. Until they
land, the `DevelopmentClinicGuard` described above is still in place. This
section is completed as each ticket lands (#27); values marked "decided in
its ticket" are proposals to be confirmed in that ticket's PR.

### Goals and account kinds

- Users sign in with email and password or with Google. There are two kinds
  of account: **staff** (nutritionists and their team) and **portal** users
  (patients and guardians).
- **The account kind is derived from data; there is no "account type"
  column.** A user with a `memberships` row is staff and lands on
  `/patients`; a user with a `patient_access` row is a portal user and lands
  on `/portal`; a user with neither (a new Google sign-in) goes to onboarding
  to create their clinic.
- **Open sign-up is for nutritionists only.** Sign-up creates the user,
  their clinic and an `owner` membership. Patients and guardians never
  self-register: they join by invitation from the patient's profile (Portal
  epic), so nobody can claim another person's clinical data.

### Library: Passport, sessions are our own code

- **Passport** through `@nestjs/passport`, using strategies only
  (`session: false`). Session handling is our own small module, not
  `express-session` or Passport's session support.
- **Better Auth was evaluated and rejected.** The npm advisory database lists
  25 advisories for `better-auth` (2 critical), several in exactly the flows
  we need (OAuth account auto-linking to an unverified email, OAuth `state`
  validation, rate-limiter bypass), many published in 2026.

### Server-side sessions, cookie in the browser (no JWT)

- **Sessions are rows in PostgreSQL; the browser holds an opaque cookie.**
  No bearer tokens or JWT ever reach the browser.
- **Why not JWT:** the IETF "OAuth 2.0 for Browser-Based Apps" guidance ranks
  a backend-for-frontend with `HttpOnly` cookies as the most secure pattern
  for sensitive apps. Nest already serves the SPA and the API from the same
  origin, so we are a BFF. A token readable by JavaScript can be stolen by
  any injected script, and this is health data. Server-side sessions can
  also be revoked instantly by deleting the row.
- **Token:** 32 random bytes (`crypto.randomBytes`), base64url-encoded,
  returned to the client once. The database stores only its SHA-256 hash
  (`sessions.token_hash`) and looks sessions up by hash, so a database leak
  does not leak usable sessions.
- **Cookie:** `HttpOnly`, `Secure` (production), `SameSite=Lax`, `Path=/`, no
  `Domain`; named `__Host-session` in production and a plain name in
  development over http. `Lax` rather than `Strict` because with `Strict`,
  opening the app from a link in WhatsApp or an email would look signed out.
- **Expiry (implemented, #10):** a session ends 30 days after sign-in
  (absolute, `expires_at`, also the cookie's `Expires`) or after 7 days
  without use (idle, `last_used_at`), whichever comes first.
  `last_used_at` is refreshed at most every 5 minutes, so a request does not
  always write. Both checks run in the lookup query; a session that fails
  them is deleted when its token is next presented. Time comes from an
  injected `CLOCK` (`common/clock`) so expiry is tested deterministically.
- **Implementation:** `auth/sessions/`: `SessionsRepository`,
  `SessionsService` (`create`, `validate`, `revoke`, `revokeAllForUser`) and
  the `SessionCookie` helper (set, clear, read). Cookies are parsed by the
  `cookie-parser` middleware (registered in `main.ts`, as the NestJS cookies
  guide recommends), unsigned because the token is already opaque and
  random. Malformed tokens are rejected before any query. Neither the token
  nor the cookie is ever logged or included in an error response.
- Password reset revokes every session of the user (implemented, #18).

### Emails: normalized once, enforced by the database

- `users.email` is stored **normalized** (trimmed, lowercase) and keeps its
  plain `UNIQUE` constraint. Every write and lookup goes through
  `normalizeEmail` (or `emailSchema`, which applies it) from
  `@nutri/schemas`.
- A `CHECK` constraint (`users_email_normalized_check`,
  `email = lower(btrim(email))`) rejects any email that skipped the helper,
  so a letter-case variant can never become a second account.
- **Why not a unique index on `lower(email)`:** it would allow mixed-case
  rows and force every lookup to wrap the column in `lower()` to use the
  index. With normalized data, `email = $1` uses the existing index.

### Passwords: argon2id

Passwords are hashed with **argon2id**. `users.password_hash` is nullable:
Google-only users have no password. Neither plain passwords nor raw tokens
are stored in any column, and the shared `authUserSchema` never includes
the hash.

- **Parameters (implemented, #11):** the OWASP Password Storage Cheat Sheet
  baseline, `m=19456` (19 MiB), `t=2`, `p=1`, checked in October 2026
  (`auth/passwords/password-hash-options.ts`). `PasswordHasher.needsRehash`
  flags hashes with other parameters or another argon2 variant, and a
  successful sign-in rehashes them, so the parameters can be raised later
  without a migration.
- **Package:** `argon2` (native). It is in `allowBuilds` in
  `pnpm-workspace.yaml` and ships prebuilt binaries for Alpine (musl, x64
  and arm64), so the production image needs no compiler; the CI Docker job
  proves it loads.
- **Length cap:** `signInSchema` limits passwords to 256 characters, since
  hashing cost grows with input length (denial of service). The check runs
  before any hashing.
- **Policy for new passwords (implemented, #18):** `passwordSchema` in
  `@nutri/schemas`, shared by password reset and sign-up, follows NIST SP
  800-63B-4 §3.1.1.2 (checked in October 2026): at least **15 characters**,
  because the password is the only factor (8 is allowed only with MFA, which
  we do not have); at most 256; **no composition rules** (NIST forbids
  requiring character types); each Unicode code point counts as one
  character; never trimmed. Sign-in keeps accepting any non-empty password
  so accounts created under another policy can still sign in.
- **Unicode:** `PasswordHasher` applies NFC before hashing and verifying, as
  NIST recommends, so the same password typed on another keyboard (e.g. "ñ"
  as one code point or as "n" plus a combining tilde) matches.
- The NIST blocklist of common or compromised passwords is not checked yet
  ("Known technical debt").

### Email and password sign-in (implemented, #11)

- `POST /api/auth/sign-in` `{ email, password }` (`signInSchema`) → 200 with
  `authUserSchema` and the session cookie. `POST /api/auth/sign-out` → 204,
  revokes the current session (if any) and clears the cookie.
- Passport's local strategy (`usernameField: 'email'`) behind
  `LocalAuthGuard`. Guards run before pipes, so the guard validates the body
  with `signInSchema` itself: a malformed body gets the usual 400
  `VALIDATION_ERROR`.
- **One failure for everything:** unknown email, wrong password and a
  Google-only account all return the same 401 `INVALID_CREDENTIALS` body.
  When there is no hash to check, the password is still verified against a
  dummy hash (created at startup with the current parameters), so response
  time does not reveal which emails have an account. A thrown
  `HttpException` can carry a specific `code`; `AllExceptionsFilter` keeps
  it when it is a known `ApiErrorCode`.
- **Session fixation:** sign-in always creates a new session and revokes
  the one of the incoming cookie, if any.
- Unverified emails are not rejected yet; the email verification ticket
  adds that check.
- Implementation: `AuthController`, `AuthService`, `LocalStrategy`,
  `LocalAuthGuard`, `CredentialsRepository` (the only code that reads
  `password_hash`) and `PasswordHasher` in `apps/api/src/auth`.

### Password reset (implemented, #18)

- `POST /api/auth/forgot-password` `{ email }` (`forgotPasswordSchema`) →
  **always 202 with an empty body.** If the email has an account (Google-only
  ones included, which can set a first password this way), a token is stored
  in `auth_tokens` (`password_reset`, 1 hour) and
  `${APP_ORIGIN}/reset-password?token=...` is emailed. Issuing a token
  deletes the user's earlier `password_reset` tokens, so only the latest link
  works.
- **The work runs after the response is sent** (`PasswordResetService
.requestReset` does not await it), so response time does not reveal
  whether the email has an account, and an SMTP failure cannot change the
  response. Failures are logged with the error name only, never the email.
- `POST /api/auth/reset-password` `{ token, password }`
  (`resetPasswordSchema`, password checked with `passwordSchema`) → 204. In
  **one transaction** (`CredentialsRepository.resetPassword`): consume the
  token, store the new argon2id hash, set `email_verified_at` if it was
  empty (the user proved access to the inbox) and delete **every session of
  the user**. Consuming is a single conditional `UPDATE ... RETURNING`
  (unused, unexpired, right purpose), so two concurrent requests with the
  same token cannot both succeed. It also clears the caller's cookie and does
  not sign the user in: the web app sends them to the login page.
- Unknown, expired, used, replaced and malformed tokens all return the same
  400 `INVALID_TOKEN`. Malformed tokens are rejected before hashing or
  querying. Then the "your password was changed" email (`password-changed`)
  is sent; if it fails the reset still stands and the failure is logged.
- Token format and hashing are shared with sessions
  (`auth/tokens/opaque-token.ts`: 32 random bytes, base64url, stored as
  SHA-256). `AuthTokensRepository.replace` is generic over the token purpose
  so email verification (#17) reuses it.
- **Until rate limiting lands (#20)** `forgot-password` can be used to send
  many reset emails to one address; the emails are harmless (the link only
  lets the inbox owner act) but noisy.

### Google: OpenID Connect

- **Authorization Code flow with PKCE, `state` and `nonce`, entirely
  server-side.** `state`, `nonce` and the PKCE verifier live in a
  short-lived `HttpOnly` cookie; the callback validates the ID token (`iss`,
  `aud`, `exp`, `nonce`) and requires `email_verified === true`.
- **Library:** `openid-client` (OpenID-certified) is preferred over
  `passport-google-oauth20`, which has not been published since 2023.
- **Account linking** (where Better Auth had an account-takeover bug):
  1. A linked `auth_accounts` row (`google`, `sub`) → sign in. After the
     first link, users are always matched by `sub`, never by email.
  2. A user with the same email and a verified email → link and sign in.
  3. A user with the same email but **unverified** → treated as a possible
     pre-registration attack: clear its password, revoke its sessions, mark
     the email verified, link and sign in.
  4. Otherwise → create a verified user without a password and send them to
     onboarding.
- Google routes answer 404 when `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
  are not configured (optional in development).

### CSRF

Cookies are attached by the browser automatically, and `SameSite=Lax` does
not block every cross-site write. As defense in depth, every unsafe method
(`POST`, `PUT`, `PATCH`, `DELETE`) under `/api` is rejected when
`Sec-Fetch-Site` is `cross-site`, and otherwise its `Origin` (fallback
`Referer`) must match `APP_ORIGIN`, following the OWASP CSRF Prevention Cheat
Sheet. No endpoint changes state on `GET` (the Google callback is protected
by `state`). CORS stays disabled: the SPA and the API share one origin.

### Rate limiting (implemented, #20)

- **`@nestjs/throttler`, only on authentication routes.** `AuthThrottlerGuard`
  is not global (clinic routes are not throttled). A route opts in with
  `@RateLimit(limits)` plus `@UseGuards(AuthThrottlerGuard, ...)`, listing the
  throttler first so a throttled request never reaches password hashing.
  Counters are per route. Code: `apps/api/src/auth/rate-limit/`.
- **Two counters:** `ip` (per client network) and `email` (per normalized
  target email, so spreading guesses over many IPs does not help). Routes
  without an email in the body skip the `email` counter.
- **Limits:** sign-in allows 20 requests per IP and 5 per email per 15
  minutes (successful ones count too). The endpoints still to come (sign-up,
  forgot password, resend and verify email, reset password, Google start)
  add `@RateLimit` in their own tickets; proposed limits per 15 minutes:
  sign-up 5 per IP; forgot password and resend verification 3 per email
  and 10 per IP; verify email and reset password 10 per IP; Google start 20
  per IP.
- **Throttle, never lock accounts:** a lockout lets an attacker block a real
  user. A blocked client waits until its window ends; the account itself is
  never disabled.
- **429 response:** `AllExceptionsFilter` returns the usual error shape with
  code `TOO_MANY_REQUESTS` and a single `Retry-After` header (seconds). No
  `X-RateLimit-*` headers are sent.
- **Client IP (`CLIENT_IP_SOURCE`, required in production).** The ticket
  planned an exact Express `trust proxy` hop count, but Railway says its hop
  count is not fixed and publishes no proxy ranges. Its docs name
  `X-Real-IP` as the client IP, and its edge overwrites caller-supplied
  `X-Real-IP` and `X-Forwarded-For` on every public request. So `trust proxy`
  stays off and `CLIENT_IP_SOURCE=x-real-ip` reads that header on Railway;
  `socket` (the development default) uses the TCP peer. A missing or invalid
  header falls back to the socket (the proxy), which only makes limits
  stricter. Requests over Railway's private network skip the edge, so
  nothing internal may call the auth endpoints with a forged header. Sources:
  [Railway public networking specs](https://docs.railway.com/networking/public-networking/specs-and-limits)
  and
  [Railway staff on the client-IP trust contract](https://station.railway.com/questions/need-authoritative-client-ip-proxy-tru-090eac86).
- **IPv6 is grouped by /64 prefix** (the library's `normalizeIp`), so
  rotating the last 64 bits does not reset the counter; IPv4-mapped IPv6 is
  counted as the IPv4 address. An IPv6 bypass of this kind was a Better Auth
  advisory (GHSA-p6v2-xcpg-h6xw).
- **Storage is in memory**, fine for one container (see Known technical
  debt).

### Email (implemented, #15)

- **One transport everywhere:** `MailModule` (`apps/api/src/mail/`) sends
  through `nodemailer` over SMTP, so development and production run the same
  code. `MailService.send(template, to, data)` renders the template and hands
  it to the injected `MAIL_TRANSPORT`; tests inject `FakeMailTransport`
  (`mail/testing`), which records messages instead of sending them.
- **Development:** Mailpit (Docker Compose) catches every email on
  `smtp://localhost:1025`, the default `SMTP_URL` outside production, with
  its inbox at http://localhost:8025. Nothing leaves the machine.
  `pnpm mail:test` sends one email of each template there.
- **Configuration** (`config/app-config.ts`): `SMTP_URL` (`smtps://` or
  `smtp://`, credentials included), `MAIL_FROM` and `APP_ORIGIN` (the
  public origin used to build links). Required in production, where the API
  refuses to boot without them and names the missing variable but never its
  value; development defaults point at Mailpit and the Vite dev server. In
  production an `smtp://` URL must upgrade with STARTTLS (`requireTLS`).
- **Templates:** `email-verification` and `password-reset` (links built from
  `APP_ORIGIN` with the token as a query parameter) and `password-changed`.
  Each one has a plain-text and a simple HTML part with inline styles
  (email clients ignore stylesheets), whose colors mirror the web tokens.
  Every interpolated value is HTML-escaped. Callers pass tokens, not URLs.
- **Spanish texts live in `mail/mail-messages.ts`,** an exception to the
  rule that user-facing Spanish lives in `apps/web/src/i18n/es.ts`: the API
  renders emails and must not depend on the web app.
- **Never logged:** recipient addresses and bodies. nodemailer's logger is
  off, and a failed delivery throws `MailDeliveryError` carrying only the
  template name and nodemailer's error code (such as `EAUTH`), because SMTP
  error messages can echo the recipient. Callers decide whether a failure
  fails their request.
- **Provider: Resend** (`smtps://resend:<API key>@smtp.resend.com:465`).
  Compared on 2026-10-28 from each provider's pricing page:

  | Provider   | Free tier                          | First paid tier          | Notes                                                            |
  | ---------- | ---------------------------------- | ------------------------ | ---------------------------------------------------------------- |
  | Resend     | 3,000/month, 100/day, SMTP on free | $20/month for 50,000     | Simple domain setup; sending region selectable                   |
  | Postmark   | 100/month                          | $15/month for 10,000     | Best-known deliverability; separate transactional streams        |
  | Amazon SES | Only via new-account AWS credits   | $0.10 per 1,000 (no fee) | Cheapest at volume; needs an AWS account and leaving the sandbox |

  Our volume is small (sign-ups, resets, invitations), so Resend's free tier
  covers the first clinics with no cost and no AWS account. The 100/day cap
  is the limit to watch; past it, Resend Pro or Postmark Basic. **Switching
  providers is a configuration change** (`SMTP_URL`, `MAIL_FROM`): no code
  depends on Resend. Domain DNS records (SPF, DKIM, DMARC) belong to the
  deployment epic.

### Auth data and soft delete

The auth tables (`sessions`, `auth_accounts`, `auth_tokens`) and the
credential columns on `users` are not clinic-scoped (a user can belong to
several clinics) and are not clinical records. Expired sessions and used or
expired one-time tokens may therefore be **physically deleted**, an
exception to the soft-delete rule. IP addresses are not stored.

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

CI builds this image on every pull request and push to `main` (Buildx with
the GitHub Actions layer cache, never pushed) and smoke-tests it against a
PostgreSQL service container with `scripts/smoke-test-image.sh`: it waits for
the image's own `HEALTHCHECK`, then checks `GET /api/health`, that `/` and
deep links return the SPA, that unknown `/api` routes return a JSON 404
instead of `index.html`, and that the process runs as `node`. The image
stages can break without `pnpm build` failing (a dependency missing from the
pruned lockfile, a native module on Alpine), so this job ignores Nx
`affected`.

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

### Cleanup of expired sessions

- **Status:** pending.
- **Why:** an expired or idle session is deleted only when its token is
  presented again (`SessionsService.validate`). Sessions whose cookie is
  never sent again (a cleared browser, a lost device) stay in `sessions`.
  They are unusable (the lookup checks both expiries) but accumulate.
- **Resolve when:** a scheduled job exists (e.g. `@nestjs/schedule` or a
  Railway cron) or the table grows enough to matter: delete rows where
  `expires_at <= now()` or `last_used_at <= now() - 7 days`. Expired
  one-time `auth_tokens` need the same treatment.

### Production migrations

- **Status:** pending, part of the deployment work.
- **Why:** migrations run with drizzle-kit (`pnpm db:migrate`), a dev tool
  that is not in the production image, and deployment is out of scope.
- **Resolve when:** setting up Railway + Neon. Options: a release command
  that runs `drizzle-kit migrate` from the build stage, or a small migration
  entry point using `drizzle-orm`'s migrator shipped in the image.
