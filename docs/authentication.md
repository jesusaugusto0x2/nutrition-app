# Authentication

How users sign in to Mi consulta, why it was built this way, how to operate
it and the doubts that came up while building it. Built by the
Authentication epic (#8, tickets #9–#27). The summary in
[docs/architecture.md](architecture.md#authentication) points here; the
day-to-day rules are in [CLAUDE.md](../CLAUDE.md) §6.

**Status:** implemented. Values that tickets left to decide (session
lifetimes, rate limits, email provider) are final and written below.

## At a glance

| Flow                 | API (`/api/auth/...`)                           | Web page                              | Section                                                                              |
| -------------------- | ----------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| Sign-up              | `POST sign-up` → 202                            | `/sign-up`                            | [Sign-up](#sign-up-16)                                                               |
| Email verification   | `POST verify-email`, `POST resend-verification` | `/verify-email` (emailed link)        | [Email verification](#email-verification-17)                                         |
| Sign-in and sign-out | `POST sign-in`, `POST sign-out`                 | `/login`, account menu                | [Sign-in](#email-and-password-sign-in-11)                                            |
| Password reset       | `POST forgot-password`, `POST reset-password`   | `/forgot-password`, `/reset-password` | [Password reset](#password-reset-18)                                                 |
| Google               | `GET google` → Google → `GET google/callback`   | «Continuar con Google»                | [Google](#google-openid-connect-19)                                                  |
| First clinic         | `POST onboarding`                               | `/onboarding`                         | [First clinic of a Google user](#first-clinic-of-a-google-user-19)                   |
| Who is signed in     | `GET me`                                        | every guard (`meQueryOptions`)        | [Current user](#current-user-14), [Web app](#web-app-auth-state-and-route-guards-21) |

Every route needs a session unless its handler is `@Public()`; every write
passes `CsrfGuard`; the public auth routes are rate limited. Code lives in
`apps/api/src/auth/` (one folder per flow), `apps/api/src/mail/` and
`apps/web/src/features/auth/`.

## Variables

Names only; what each one accepts is commented in `.env.example` and
validated by `apps/api/src/config/app-config.ts`. Where they are set in
production: [docs/deployment.md](deployment.md).

| Variable               | Used for                                              | Development default                |
| ---------------------- | ----------------------------------------------------- | ---------------------------------- |
| `APP_ORIGIN`           | links in emails, CSRF origin, Google `redirect_uri`   | `http://localhost:4200`            |
| `SMTP_URL`             | outgoing email                                        | Mailpit, `smtp://localhost:1025`   |
| `MAIL_FROM`            | sender of every email                                 | `Mi consulta <no-reply@localhost>` |
| `CLIENT_IP_SOURCE`     | client IP for rate limiting (`socket` or `x-real-ip`) | `socket`                           |
| `GOOGLE_CLIENT_ID`     | Google sign-in (set both or neither)                  | unset: Google routes answer 404    |
| `GOOGLE_CLIENT_SECRET` | Google sign-in                                        | unset                              |

All six are required in production, where the API refuses to boot without
them and names the missing variable, never its value.

## Goals and account kinds

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

## Library: Passport, sessions are our own code

- **Passport** through `@nestjs/passport`, using strategies only
  (`session: false`). Session handling is our own small module, not
  `express-session` or Passport's session support.
- **Better Auth was evaluated and rejected.** The npm advisory database lists
  25 advisories for `better-auth` (2 critical), several in exactly the flows
  we need (OAuth account auto-linking to an unverified email, OAuth `state`
  validation, rate-limiter bypass), many published in 2026.

## Server-side sessions, cookie in the browser (no JWT)

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
- **Expiry (#10):** a session ends 30 days after sign-in
  (absolute, `expires_at`, also the cookie's `Expires`) or after 7 days
  without use (idle, `last_used_at`), whichever comes first.
  `last_used_at` is refreshed at most every 5 minutes, so a request does not
  always write. Both checks run in the lookup query; a session that fails
  them is deleted when its token is next presented. Time comes from an
  injected `CLOCK` (`common/clock`) so expiry is tested deterministically.
- **Implementation:** `auth/sessions/`: `SessionsRepository`,
  `SessionsService` (`create`, `validate`, `revoke`, `revokeAllForUser`,
  `deleteInactive`) and the `SessionCookie` helper (set, clear, read). Cookies
  are parsed by the `cookie-parser` middleware (registered in `main.ts`, as
  the NestJS cookies guide recommends), unsigned because the token is already opaque and
  random. Malformed tokens are rejected before any query. Neither the token
  nor the cookie is ever logged or included in an error response.
- Password reset revokes every session of the user (#18).

## Emails: normalized once, enforced by the database

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

## Passwords: argon2id

Passwords are hashed with **argon2id**. `users.password_hash` is nullable:
Google-only users have no password. Neither plain passwords nor raw tokens
are stored in any column, and the shared `authUserSchema` never includes
the hash.

- **Parameters (#11):** the OWASP Password Storage Cheat Sheet
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
- **Policy for new passwords (#18):** `passwordSchema` in
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
  ([Known technical debt](architecture.md#compromised-password-blocklist)).

## Sign-up (#16)

- `POST /api/auth/sign-up` `{ name, email, password, clinicName }`
  (`signUpSchema`, password checked with `passwordSchema`) → **always 202 with
  an empty body**, like forgot password. The web app already knows what to
  show ("check your email"), so the API sends no text.
- **The work runs after the response is sent** (`SignUpService.requestSignUp`
  does not await it), so response time does not reveal whether the email has
  an account, and a failure cannot change the response. The cost is that a
  failed sign-up looks like a successful one to the user: it is logged with
  the error name only, and they can sign up again. No request data is logged.
- **One path for both cases.** The password is always hashed, then a single
  transaction (see "Transactions across modules" in
  [docs/architecture.md](architecture.md#backend-appsapi)) inserts the user with
  `ON CONFLICT DO NOTHING` and, if a row was created, the clinic and the
  `owner` membership. The unique constraint on `users.email` decides who is
  new, so two concurrent sign-ups with the same email create one account and
  one clinic, and the loser is treated as an existing email.
- **New email:** the user stays unverified and `EmailVerificationService` emails
  a verification link after the commit (`email_verification` token, 24 hours,
  `${APP_ORIGIN}/verify-email?token=...`). The token is stored outside the
  transaction, so if it or the email fails the account remains and the user
  can ask for a new link (see "Email verification").
- **Existing email** (Google-only accounts included): nothing changes and its
  owner gets the `sign-up-attempt` notice, with a link to the login page. The
  notice uses the **stored** name, never the submitted one, so a stranger cannot
  put their own text in an email to someone else. An unverified account gets
  this notice too, not a new link: `resend-verification` is the way to get one.
- **No session is created.** The user is signed in when they verify the email.
- Rate limited: 3 per email and 5 per IP per 15 minutes (see Rate limiting).

## Email verification (#17)

- `POST /api/auth/verify-email` `{ token }` (`verifyEmailSchema`) → 200 with
  `authUserSchema` and the session cookie. In **one transaction**
  (`CredentialsRepository.verifyEmail`): consume the token and set
  `email_verified_at`. Then the session starts as in sign-in, revoking the one
  of the incoming cookie, if any.
- **`POST`, not `GET`:** link previews in WhatsApp and email clients fetch
  `GET` URLs and would consume the token. The link opens the web page, which
  reads the token and posts it. The token is single use, so that page (#24)
  must post it exactly once, also under React Strict Mode, which runs effects
  twice in development.
- Unknown, expired, used, replaced and malformed tokens all return the same
  400 `INVALID_TOKEN` as password reset (`tokens/invalid-token.ts`).
- **A link for an already verified email is rejected too.** The link signs the
  user in, so it must not outlive its purpose: otherwise one left in the inbox
  would open a session after a password reset (which also verifies the email)
  ended them all. The web page shows the error state, whose next step is
  signing in.
- `POST /api/auth/resend-verification` `{ email }`
  (`resendVerificationSchema`) → **always 202 with an empty body.** It emails a
  new link only if the email has an unverified account, and runs after the
  response is sent, like forgot password, so neither the response nor its
  timing reveal which emails have one. Failures are logged with the error name
  only. `AuthTokensRepository.replace` deletes the earlier token, so only the
  latest link works.
- **Sign-in:** a correct password on an unverified email → 403
  `EMAIL_NOT_VERIFIED`, and the web app offers to resend. It comes after the
  password check, so a wrong password still gets the usual 401 and only
  someone who holds the credentials learns the state of the account.
  `SessionAuthGuard` does not check it: every way to get a session already
  requires a verified email.
- **Known limit, pre-registration:** someone can sign up with another person's
  email and choose the password. If the owner clicks the verification link
  anyway, the account is verified with that password. The email tells them to
  ignore it if it was not them, and signing in with Google for that email
  clears the password (see "Google: OpenID Connect").
- Rate limited: `resend-verification` 3 per email and 10 per IP, `verify-email`
  10 per IP, per 15 minutes (see Rate limiting).

## Email and password sign-in (#11)

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
- A correct password on an unverified email → 403 `EMAIL_NOT_VERIFIED` (see
  "Email verification").
- Implementation: `AuthController`, `AuthService`, `LocalStrategy`,
  `LocalAuthGuard`, `CredentialsRepository` (the only code that reads
  `password_hash`) and `PasswordHasher` in `apps/api/src/auth`.

## Current user (#14)

- `GET /api/auth/me` (`authMeSchema`) tells the web app who is signed in and
  where to send them: `user`, `memberships` (`clinicId`, `clinicName`, `role`)
  and `patientAccess` (`patientId`, `firstName`, `lastName`, `relationship`).
  A membership means the clinic area, a grant means the portal, and neither
  means onboarding; a user can have both.
- Requires a session but no clinic, so it stays reachable for portal users
  and for users with neither. Without a valid session it answers 401.
- **Everything is looked up by the session's user**, never from the request,
  so it lists only that user's clinics and patients. Memberships come oldest
  first (the first is the clinic `ClinicAccessGuard` uses); soft-deleted
  patients are left out, as in `PortalAccessGuard`.
- `AuthService.getMe` reads them through `ClinicsService` and
  `PatientAccessService`; `AuthModule` imports `ClinicsModule` and
  `PortalModule`. Those modules must not import `AuthModule` back.

## Password reset (#18)

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
- Rate limited (#20): `forgot-password` 3 per email and 10 per IP,
  `reset-password` 10 per IP, per 15 minutes (see Rate limiting).

## Google: OpenID Connect (#19)

- **Authorization Code flow with PKCE, `state` and `nonce`, entirely
  server-side.** The browser only sees redirects. The ID token is read once
  and thrown away; no Google token is stored and the app calls no Google API.
- `GET /api/auth/google` generates the three values, keeps them in a 10-minute
  `HttpOnly`, `SameSite=Lax` cookie (`__Host-google-flow` in production) and
  redirects to Google with scope `openid email profile`. `Lax` because the
  callback is a navigation from Google, which `Strict` would not send it with.
- `GET /api/auth/google/callback` clears that cookie whatever happens, compares
  `state`, exchanges the code and validates the ID token (`iss`, `aud`, `exp`,
  `nonce`), requires `email_verified === true`, resolves the account and starts
  a session as sign-in does (new session, the incoming one revoked). A new user
  goes to `/onboarding`, anyone else to `/`, where the web app routes them.
- **Every failure redirects to `/login?error=google`,** with no details in the
  URL, including the user cancelling at Google and Google being unreachable. The
  log gets a fixed reason (`state-mismatch`, `email-not-verified`,
  `email-not-authoritative`) or the error name, never a message: those can quote
  what Google sent.
- **Library:** `openid-client` (OpenID-certified) functions directly, wrapped by
  `GoogleOidcClient`, the only code that talks to Google. **Deviation from the
  epic's "Passport strategies only":** its Passport strategy requires
  `express-session` (`req.session`), and sessions here are our own code.
  `passport-google-oauth20` has not been published since 2023.
- **The ID token's signature is not checked,** which is the library's default
  and OpenID Connect Core allows it: the token comes straight from Google's
  token endpoint over TLS, authenticated with the client secret.
- **Google's endpoints are discovered on first use** and kept for the life of the
  process, so the API boots while Google is down; a failed discovery is retried
  by the next sign-in.
- **Connection attempts get 2 s, not Node's 250 ms** (`main.ts`,
  `setDefaultAutoSelectFamilyAttemptTimeout`). Node tries each resolved address
  for that long; on a network without IPv6 a slower IPv4 handshake failed every
  call to Google, so the callback logged `TypeError` (`fetch failed`,
  ETIMEDOUT) and redirected to the login page. It applies to every outgoing
  connection (SMTP too) and only waits longer when a handshake is slow.
- **`redirect_uri` is `${APP_ORIGIN}/api/auth/google/callback`,** never derived
  from `Host`, which the Vite proxy and Railway's edge rewrite. In development
  that is the Vite origin, whose proxy carries the cookies through.
- **Account resolution** (where Better Auth had an account-takeover bug) runs in
  one transaction with the user's row locked (`GoogleAuthService`):
  1. A linked `auth_accounts` row (`google`, `sub`) → sign in. After the first
     link, users are always matched by `sub`, never by email: Google says an
     account can have several emails over time and `sub` never changes.
  2. A user with the same email, **only if Google is authoritative for it**
     (see below); otherwise the sign-in is refused and nothing changes:
     - Verified → link and sign in. The password stays.
     - **Unverified** → a possible pre-registration attack: clear its password,
       revoke its sessions, mark the email verified, link and sign in.
  3. Otherwise → create a verified user without a password and go to onboarding.
     `users.name` is Google's `name`, or the email, since that claim is never
     guaranteed.
- **Stricter than the ticket: linking needs Google to be authoritative.** Google
  [says](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
  it speaks for an address only for `@gmail.com` or when the token has `hd`
  (Workspace). Anyone can open a Google account on a third-party address, and
  `email_verified` may then be true although "ownership of the third party email
  account may have since changed". Linking on that alone would hand an account,
  or wipe its password, to a former owner of the address. A real user in this
  case still signs in with their password; a new person is unaffected, as
  there is no account to protect.
- **What a takeover keeps:** the clinic and membership created at sign-up stay,
  since this is also how a real user who never verified continues. If it was an
  attacker they lose all access, but the names they typed remain until edited.
- **Races fail closed:** two first sign-ins at once hit a unique constraint
  (`users.email`, `auth_accounts`), which rolls back and redirects to the login
  page; the second attempt then succeeds. `link` never uses `ON CONFLICT`, so an
  identity can never be attached to the wrong user quietly.
- Google routes answer 404 when `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are
  not set, which is allowed only outside production. One without the other fails
  on startup. A rate-limited request (20 per IP per 15 minutes, per route) gets
  the usual 429 JSON rather than a redirect.

### Setting up the client in Google

Operator steps; one project is enough for development and production:

1. In [Google Auth Platform](https://console.cloud.google.com/auth/overview),
   create or pick a project and register the app.
2. **Branding:** app name, support email, developer contact. Before publishing,
   add the production domain to **Authorized domains** and the homepage, privacy
   policy and terms links.
3. **Audience:** user type **External**. While in **Testing**, the consent screen
   works for up to 100 listed test users. **Publish app** opens it to anyone, as
   sign-up requires. These three scopes are non-sensitive, so Google does not
   require app verification; only showing the app name and logo on the consent
   screen does (brand verification).
4. **Clients → Create client → Web application.** Authorized redirect URIs:
   `http://localhost:4200/api/auth/google/callback` and
   `https://<production domain>/api/auth/google/callback`. They must match
   exactly (scheme, host, port, path, no trailing slash) or Google answers
   `redirect_uri_mismatch`. No authorized JavaScript origins are needed: the
   browser never talks to Google directly. Changes can take minutes to hours.
5. Copy the client secret when it is created: it is not shown again. Set
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the root `.env` for
   development and in Railway for production. Rotate with **Add secret** in the
   client, deploy, then disable the old one.

## First clinic of a Google user (#19)

- `POST /api/auth/onboarding` `{ clinicName }` (`onboardingSchema`) → 204, for a
  signed-in user with neither a membership nor portal access. Anyone else gets
  409 `CONFLICT`. The web app reads `me` again afterwards.
- It uses `ClinicsService.createWithOwner`, as sign-up does. The user's row is
  locked from the check to the insert (`OnboardingService`), so a double submit
  creates one clinic. The check reads the same data as `me`, so a grant on a
  soft-deleted patient does not count, as in `PortalAccessGuard`.
- It needs a session and passes `CsrfGuard` like any write. Not rate limited: a
  user can only succeed once and a failure costs two queries.

## Route protection (#12)

Three global guards run on every request, in the order `AppModule` registers
them. Each one only reads what the one before it set:

| Guard               | Applies to                  | Sets                       | Rejects                     |
| ------------------- | --------------------------- | -------------------------- | --------------------------- |
| `SessionAuthGuard`  | every route but `@Public()` | `request.user`             | 401 without a valid session |
| `ClinicAccessGuard` | `@ClinicAccess()`           | `request.clinicId`         | 403 without a membership    |
| `PortalAccessGuard` | `@PortalAccess()`           | `request.portalPatientIds` | 403 without patient access  |

- **Protected by default.** A new route needs a session unless it says
  otherwise, and `@Public()` goes on each handler, never on a controller, so
  a new route in `AuthController` is protected too. Public today: health,
  sign-up, sign-in, sign-out (it answers 204 either way), verify email and
  resend verification, forgot and reset password, and both Google routes.
  `me` and `onboarding` need a session.
- **Handlers read the result** with `@CurrentUser()`, `@CurrentClinic()` and
  `@PortalPatientIds()`. The clinic never comes from the client.
- **A route marked both `@Public()` and `@ClinicAccess()` or `@PortalAccess()`
  fails closed:** the access guard answers 401 when there is no user.
- **One clinic per user in the MVP.** The guard takes the oldest membership;
  choosing among several clinics needs a selector in the web app and is out
  of scope (TODO in `ClinicsService`).
- **Portal grants are by user, across clinics,** and a soft-deleted patient
  no longer counts as a grant. No portal endpoint exists yet; the guard is
  tested with a probe route in `app.module.spec.ts`.
- **Lookups stay inside their module:** `ClinicsService` (memberships) and
  `PatientAccessService` (`patient_access`) are the exported entry points.
  These two repositories take a user, not a clinic, because they are how a
  request finds its clinic and its patients.
- **The middleware serving the SPA is not behind the guards:** the built web
  app is public, and only `/api` requires a session.

## Web app: auth state and route guards (#21)

- **`me` is the only source of auth state** (`meQueryOptions` in
  `features/auth/api.ts`). A 401 from `/api/auth/me` resolves to `null`
  instead of failing: being signed out is normal on `/login`, and an error
  there would fire the global 401 handler.
- **Guards live in `features/auth/guards.ts`** and run in `beforeLoad`:

  | Route         | Signed out               | Signed in without access |
  | ------------- | ------------------------ | ------------------------ |
  | `_clinic`     | `/login?redirect=<path>` | the user's home          |
  | `_portal`     | `/login?redirect=<path>` | the user's home          |
  | `/onboarding` | `/login?redirect=<path>` | home, if they have one   |
  | `_auth`       | stays                    | always the user's home   |
  | `_link`       | stays                    | stays                    |
  | `/`           | `/login`                 | always the user's home   |

  The home comes from `homePath`: `/patients` with a membership, otherwise
  `/portal` with portal access, otherwise `/onboarding`. Someone who is both
  staff and a patient lands on `/patients` and can still open `/portal`.

- **Guards use `fetchQuery`, not `ensureQueryData`,** so a stale `me` is
  refetched and awaited before it authorizes a navigation (fresh for the
  default 30 seconds). Any failure other than a 401 shows the error page.
- **`/onboarding` is outside `_auth`:** its user is signed in, so that layout
  would bounce them in a loop. It shares the layout component
  (`AuthLayout`) instead.
- **Pages reached from an emailed link** (`/verify-email`, `/reset-password`)
  are in `_link`, which has no guard: `_auth` would send a signed-in user home
  and drop the token unused (see "Web app: emailed-link pages").
- **`redirect` is validated by `safeRedirectPath`,** which parses with the
  WHATWG URL algorithm instead of matching characters, because browsers read
  `/\evil.com` as `//evil.com` and strip tabs and newlines. `/login` reads it
  from `Route.useSearch()`: the URL can still show a rejected value, but the
  page never receives it (`validateSearch` must always return the key, because
  the router merges it over the raw params). It may contain a query string, so
  the login page goes there with `router.history.push(redirect)`, not
  `navigate({ to })`.
- **Global 401 handling:** `createQueryClient` reports any 401 from a query or
  mutation, except `INVALID_CREDENTIALS` (a wrong password, shown by the form),
  and `handleUnauthorized` ends the session and keeps the current path in
  `redirect`. A 401 that arrives on `/login` only clears the cache, so it does
  not overwrite that `redirect`.
- **Leaving a session has a fixed order (`endSession`):** set `me` to `null`,
  navigate to `/login`, then clear the cache. Clearing first would make the
  page still mounted refetch what was removed, and without `me = null`,
  `_auth` would send the user back home. `queryClient.clear()` also removes
  mutations, whose variables can hold a password. A guard that finds the
  session gone clears the cache too, since no 401 error fired in that path.
- **Sign-out clears only after the API answers:** the cookie is `HttpOnly`, so
  if the request fails the user is still signed in and must not be told
  otherwise.
- **Loaders and guards never return data** (rule in CLAUDE.md). The router
  keeps left matches, with their loader results, out of reach of
  `queryClient.clear()`; `api.spec.tsx` proves no patient data stays there
  after going back.
- `useSignIn` removes the cached `me` rather than invalidating it, so nothing
  can read the old "signed out". `useResetPassword` clears everything, since
  the API ends every session of the user.

## Web app: account menu and sign-out (#26)

- **Design is provisional.** The component spec lists "name of who signed in
  and «Cerrar sesión» in the nutritionist app" as still to define; the
  prototype only has it in the portal (foot of the sidebar). The staff app
  copies that block. Revisit when the spec defines it.
- **Where it sits:** at the foot of the desktop sidebar (`AccountPanel`: name,
  email, «Cerrar sesión»), as a fourth «Cuenta» cell of the phone bottom bar
  (`AccountMenu`, a Base UI popover that opens upwards), and on the right of
  the placeholder portal header (same menu, opening downwards). The portal
  gets its own sidebar and bottom bar (Inicio, Progreso, Mi cuenta) with its
  screens.
- **Layout slots, not imports:** `Sidebar` and `BottomNav` take an optional
  `account` node, so generic navigation never reads the session. The layouts
  pass the wired versions from `features/auth/components/signed-in-account.tsx`,
  which read `me` from the cache (`useAccount`) and render nothing once it is
  `null`, as happens between `endSession` marking the user signed out and the
  layout unmounting.
- **Sign-out reuses `useSignOut`** (see above): the button is disabled while
  the request runs and, if the API does not confirm, the panel says the
  session is still open and nothing is cleared. The text avoids «tú» and
  «usted» because the panel appears in both apps.
- `signed-in-account.spec.tsx` drives the real layouts: sign-out from the
  sidebar, the bottom bar and the portal header ends on `/login` with the
  patient cache cleared; a failed sign-out keeps both.
- Not built (out of scope): the account settings page and changing the
  password while signed in.

## Web app: login page (#22)

- `/login` is `features/auth/components/login-form.tsx` inside the `_auth`
  layout: the brand panel (spec 42) beside the form from `lg`, one column
  with the boxed brand on phones. The sign-up, onboarding and password pages
  share the layout.
- **After a success** `useSignIn` removes `me`, the form fetches it again and
  goes to `redirect` or `homePath(me)`. A failure while fetching `me` shows the
  generic error.
- **Every failure above the form is a `FormAlert` (spec 40):**

  | API answer                | Shown                                        |
  | ------------------------- | -------------------------------------------- |
  | 401 `INVALID_CREDENTIALS` | one generic message                          |
  | 429 with `Retry-After`    | wait in minutes; password and submit blocked |
  | 429 without it            | "in a few minutes"; nothing blocked          |
  | 403 `EMAIL_NOT_VERIFIED`  | "resend email" action                        |
  | anything else             | generic error                                |

- **The live countdown is only on the submit button.** Text inside
  `role="alert"` is read aloud whenever it changes, so the alert keeps the
  minutes computed when the 429 arrived.
- **Changing the email lifts the block:** the 5-attempt limit counts per email
  and someone may simply have mistyped it. If the IP limit was the one hit, the
  next attempt gets a new 429 with the right wait. The block is client state
  only; reloading loses it and the API still answers 429.
- **`ApiClientError.retryAfterSeconds`** carries the header. Only the seconds
  form is read, which is what `AuthThrottlerGuard` sends.
- **Validation messages are chosen in the form,** because `signInSchema`
  messages are English: the schema decides whether a field is valid, the form
  picks the Spanish text.
- **Resending the link:** `useResendVerification` posts the email the user just
  typed, already normalized, to `/api/auth/resend-verification` (see "Email
  verification"). The alert appears only after a correct password, so offering
  it reveals nothing about which emails have an account.
- «¿Olvidaste tu contraseña?» and the 429 alert's «Crear una contraseña nueva
  ahora» are `Link`s to `/forgot-password` (#24). «Crear cuenta» is a `Link`
  to `/sign-up` (#23).
- **Differences from the prototype, on purpose:**
  - No "te quedan N intentos": the API does not report it, and #22 asks for
    one generic message.
  - No "mantener la sesión abierta": sessions have one lifetime and the API has
    no such option.
  - "¿Olvidaste tu contraseña?" sits under the field on desktop too, so there
    is a single link and the tab order goes through the password first.

## Web app: sign-up page (#23)

- `/sign-up` is `features/auth/components/sign-up-form.tsx` in the `_auth`
  layout (prototype boards `registro` and `verifica`). It posts
  `POST /api/auth/sign-up` through `useSignUp` with the values `signUpSchema`
  returned: trimmed names and a normalized email.
- **Validation is the shared schema;** the form only picks the Spanish text
  (as on the login page). `passwordLength`, `PASSWORD_MIN_LENGTH`,
  `PASSWORD_MAX_LENGTH` and `SIGN_UP_NAME_MAX_LENGTH` come from
  `@nutri/schemas`, so the hint and the messages cannot drift from the rule.
- **Password hint:** "Al menos 15 caracteres", with a check once met, plus a
  tip that spaces are allowed. It is the field's description
  (`aria-describedby`). The password field has `autocomplete="new-password"`.
- **Check your email is a state of the same page, not a route.** After the 202
  the form is replaced by `CheckEmail`, showing the normalized address. The
  address is never put in the URL (history, logs). Reloading shows the empty
  form again; the email already went out.
- **It reads the same whether or not the email had an account,** as the API
  answers: the existing owner gets the `sign-up-attempt` notice instead.
- **«¿Escribiste mal tu email? Corrígelo»** brings back the form with
  everything as typed (React Hook Form keeps unmounted values) and focuses the
  email. Submitting again sends a new request (and counts toward its limit).
- **Resend:** `useResendVerification` with the normalized email. After a
  success the button waits 60 s (`RESEND_COOLDOWN_MS`), so a double tap does
  not spend the 3-per-15-minutes limit. A 429 says how many minutes to wait and
  disables the button until `Retry-After`; without the header nothing is
  blocked. Any other failure shows the resend error. 429 handling is shared
  with the login page through `features/auth/throttle.ts` (`readThrottle`).
- **Sign-up failures** above the form: a 429 shows the wait in minutes (no
  countdown or lock, unlike sign-in), anything else the generic error. The
  form does not expect a 400: the schema already ran.
- **Focus:** the «Verifica tu email» heading takes focus when it appears, so
  screen readers start from it.
- **Differences from the prototype, on purpose:**
  - Password rules: the prototype lists 8 characters, a letter and a number.
    `passwordSchema` follows NIST (only a 15-character minimum, no composition
    rules), so the hint shows that one rule.
  - No "Términos de uso" / "Política de privacidad" line: those pages do not
    exist yet.
  - No "‹ Iniciar sesión" back link at the top on phones: the shared `_auth`
    layout shows the boxed brand there; the link at the bottom remains.
  - "El enlace vence en 24 horas" is a fixed text: it must change with
    `EMAIL_VERIFICATION_TOKEN_LIFETIME_MS` in the API.

## Web app: emailed-link pages (#24)

Prototype boards `recuperar`, `recuperar-enviado`, `nueva-clave` and
`enlace-error`.

- **Placement:** `/forgot-password` is in `_auth` (signed-out only).
  `/verify-email` and `/reset-password` are in `_link`, the same
  `AuthLayout` without a guard, so the link works while signed in (a reset
  asked from another device, a verification link of another account).
- **The token leaves the address bar at once.** `validateLinkSearch` keeps the
  raw `token` param and `useLinkToken` (`features/auth/link-token.ts`) copies
  it into component state, then navigates to the same page with no search and
  `replace: true`: the history entry is replaced, so neither Back nor a copied
  URL carries it. A malformed token (`oneTimeTokenSchema` fails) is removed too
  and shown as an expired link without calling the API. The token is never put
  in the query cache, a loader, storage or a log.
- **No third-party requests:** the pages use the self-hosted fonts and the app
  bundle only, so no `Referer` with the token can leave (it is gone from the
  URL before any later request anyway).
- **`/verify-email` posts the token as soon as it opens** (`useVerifyEmail`),
  once: a ref stops the second effect of Strict Mode, which would fail with
  `INVALID_TOKEN` after the first request used the token. On 200 the API set
  the session cookie; the hook removes every cached query (the previous
  account's, if someone was signed in) and the page goes to `/` with
  `replace`, whose guard reads `me` and sends the user home (`/onboarding` for
  a new account until it has a clinic).
- **Errors on `/verify-email`:**

  | API answer          | Shown                                           |
  | ------------------- | ----------------------------------------------- |
  | 400 `INVALID_TOKEN` | expired link + email form to send a new link    |
  | 429                 | the wait in minutes + «Reintentar» (same token) |
  | anything else       | generic error + «Reintentar» (same token)       |

  The new-link form posts `resend-verification` and then shows `CheckEmail`.
  It asks for the email because the API never says whose token it was. The
  expired page adds "si ya activaste tu cuenta, solo inicia sesión": a used
  token and an already verified email answer the same.

- **`/forgot-password`** posts the normalized email (`forgotPasswordSchema`)
  and shows `CheckEmail` with `purpose="passwordReset"`: «Si hay una cuenta
  con …», the 1-hour expiry, resend (same 60 s cooldown, it calls
  `forgot-password` again) and «Usar otro email», which brings the empty form
  back with the field focused. 429 and other failures use the same alert as
  sign-up (`request-failure.tsx`).
- **`/reset-password`** asks for the new password twice. The confirmation only
  exists in the form schema (`passwordSchema` + a refine); the API body is
  `resetPasswordSchema`. The hint and messages are the sign-up ones
  (`password-hint.tsx`). On 204 `useResetPassword` clears the cache (the API
  ended every session) and the page says it worked, with a link to `/login`.
  `INVALID_TOKEN` shows the expired link with «Pedir un enlace nuevo» to
  `/forgot-password`; 429 and other failures keep the form, so the user can
  submit again with the same token.
- **Focus:** the heading of each new state (expired, failed, done, check your
  email) takes focus, as on sign-up.
- **Differences from the prototype, on purpose:**
  - No «Para la cuenta carmen@…» on `/reset-password`: the API does not reveal
    whose token it is before it is used.
  - Password rules: one 15-character rule, as on sign-up (NIST), not the
    prototype's 8 characters, a letter and a number.
  - The expired page has no note about portal invitations: those do not exist
    yet. It says «ya no funciona» instead of «ya venció», since the API does
    not tell an expired token from a used one.
  - The note under the reset button says the session ends on **all** devices:
    the API ends this one too, not only the others.
  - «El enlace vence en 1 hora» is fixed text: it must change with
    `PASSWORD_RESET_TOKEN_LIFETIME_MS` in the API.

## Web app: Google button and onboarding (#25)

- **«Continuar con Google» (spec 37) is a plain `<a href="/api/auth/google">`**
  (`GoogleButton`, `GOOGLE_SIGN_IN_PATH`), never `fetch` or the router's
  `Link`: the API answers with a redirect to Google, so the whole page must
  navigate. It sits above the form on `/login` and `/sign-up`, followed by the
  «o con tu email» separator (spec 38, `OrSeparator`); on `/sign-up` it adds
  «Después te pediremos el nombre de tu consultorio».
- **Google's branding rules** ([guidelines](https://developers.google.com/identity/branding-guidelines))
  allow a custom button with the standard-colour "G", unchanged, on a white
  background, and a localized "Continue with Google". The button is the
  secondary style of the spec (white, `borde-campo`, 58 px, app font).
  `src/assets/google-g.png` is the logo of Google's official sign-in assets
  (`signin-assets.zip`, light square Android + Web button at 4x), cropped to
  the 20 px "G" without changing it. Not the SVG: it draws the gradient with
  `foreignObject`, which an `<img>` does not render reliably. **Deviation:**
  Google's own buttons use Google Sans; ours keeps the app font so it matches
  the other buttons. If Google's review ever asks for it, swap in the official
  button image.
- **No loading state:** the browser shows its own while it leaves the page.
  The spec leaves this state "to be defined".
- **`/login?error=google`** shows one generic `FormAlert` («No pudimos iniciar
  sesión con Google»), whatever the cause; the reason is only in the API log.
  `validateLoginSearch` keeps `error` only when it is exactly `google`. The
  alert goes away when the user tries with their email. A Google sign-in does
  not keep `redirect`: the API sends it to `/`, which routes by `homePath`.
- **Without `GOOGLE_CLIENT_ID` in development** the button still shows and
  leads to the API's 404 JSON. Production requires the credentials.
- **`/onboarding`** (`OnboardingForm`) asks for the clinic name with the same
  field, rules and texts as the sign-up page, and posts
  `POST /api/auth/onboarding` through `useOnboarding`, which then removes `me`.
  The form fetches `me` again and goes to `homePath(me)`, which is `/patients`.
  A 409 (the account got a clinic or portal access meanwhile, e.g. from
  another tab) goes home the same way; anything else shows the generic error.
  Its guard (`requireNoAccount`, tested in `auth-routing.spec.tsx`) keeps out
  everyone who has a membership or portal access.
- **«¿No es tu cuenta? Cerrar sesión»** on `/onboarding`: someone who picked
  the wrong Google account has no other way out of the page.
- **Trying it against a real Google client** in development: README, "Sign in
  with Google locally".

## CSRF (#13)

Cookies are attached by the browser automatically, and `SameSite=Lax` does
not block every cross-site write. As defense in depth, the global `CsrfGuard`
(`apps/api/src/common/guards/csrf.guard.ts`) checks every method except `GET`,
`HEAD` and `OPTIONS`, following the OWASP CSRF Prevention Cheat Sheet. CORS
stays disabled: the SPA and the API share one origin.

- **The rule:** reject when `Sec-Fetch-Site` is `cross-site`; otherwise
  `Origin`, or `Referer` only when `Origin` is absent, must match `APP_ORIGIN`
  exactly. A browser on the app always sends `Origin` on these methods.
- **Every other `Sec-Fetch-Site` value goes on to the origin check** instead
  of being trusted. That covers `same-site` (sibling subdomains are not
  trusted) and unknown values, which OWASP says to ignore.
- **Fails closed:** `Origin: null` and a request with neither header get 403,
  because neither is evidence of a same-origin request. A client that is not
  a browser, such as `curl`, must send `Origin` itself.
- **The target is the configured `APP_ORIGIN`, never `Host`.** OWASP calls this
  the most secure option, and `Host` is unreliable behind a proxy. The Vite
  proxy rewrites `Host` (`changeOrigin: true`) but not `Origin`, so development
  uses `http://localhost:4200`. In production the app sits behind Railway's
  edge; the checks after the first deploy must include a sign-in through it.
- **It runs first, with no exemptions.** It comes before `SessionAuthGuard`, so
  a rejected request costs no database work and no rate-limit counter, and it
  also covers `@Public()` routes (sign-in is a login CSRF target). A future
  cross-site `POST`, such as a webhook, would need its own explicit exemption
  and its own authentication.
- **No endpoint changes state on `GET`** (checked for #13). The only writes on
  a `GET` are session bookkeeping in `SessionAuthGuard` (`last_used_at`, removing
  an expired row), which an attacker gains nothing from. The Google callback
  is a `GET` that signs in, protected by `state` and the flow cookie instead.
- **No `Vary` header:** OWASP asks for it when a cache could reuse a response,
  and responses to these methods are not cacheable. No log-only rollout
  either: nothing was deployed before the guard.
- **Rejections are logged** as a warning with the method and route pattern
  only. The same warnings on every write mean a wrong `APP_ORIGIN`.

## Rate limiting (#20)

- **`@nestjs/throttler`, only on authentication routes.** `AuthThrottlerGuard`
  is not global (clinic routes are not throttled). A route opts in with
  `@RateLimit(limits)` plus `@UseGuards(AuthThrottlerGuard, ...)`, listing the
  throttler first so a throttled request never reaches password hashing.
  Counters are per route. Code: `apps/api/src/auth/rate-limit/`.
- **Two counters:** `ip` (per client network) and `email` (per normalized
  target email, so spreading guesses over many IPs does not help). Routes
  without an email in the body skip the `email` counter.
- **Limits (per 15 minutes; successful requests count too):** sign-in 20
  per IP and 5 per email; sign-up 5 per IP and 3 per email (every request
  sends an email, so the per-email limit stops anyone flooding an inbox with
  notices from many IPs); forgot password 10 per IP and 3 per email; reset
  password 10 per IP; resend verification 10 per IP and 3 per email; verify
  email 10 per IP; Google start and callback 20 per IP each.
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

## Email (#15)

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
  `APP_ORIGIN` with the token as a query parameter), `sign-up-attempt` (links
  to the login page) and `password-changed`. Each one has a plain-text and a simple HTML part with inline styles
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

## Auth data and soft delete

The auth tables (`sessions`, `auth_accounts`, `auth_tokens`) and the
credential columns on `users` are not clinic-scoped (a user can belong to
several clinics) and are not clinical records. Expired sessions and used or
expired one-time tokens may therefore be **physically deleted**, an
exception to the soft-delete rule, which a daily job does
([Scheduled jobs](deployment.md#scheduled-jobs)). IP addresses are not stored.

## Runbooks

### Sign in locally

`pnpm db:seed` creates two verified users, both with the password
`nutri-dev-password`: `owner@example.com` (staff, owner of the seed clinic)
and `portal@example.com` (portal, guardian of a seed patient). Sign in at
http://localhost:4200/login. To try sign-up instead, use any address: every
email lands in Mailpit (next runbook). The seed refuses to run in production.

### Read emails locally (Mailpit)

1. `docker compose up -d` starts Mailpit with PostgreSQL.
2. Open http://localhost:8025. Every email the API sends in development is
   there; nothing leaves the machine, whatever address was used.
3. Links in them point at `APP_ORIGIN` (`http://localhost:4200`), so clicking
   one opens the local web app with the token.
4. `pnpm mail:test` sends one email of each template, to preview the design.

No email in Mailpit after sign-up or "forgot password"? Those routes always
answer 202 and do the work after responding, so look at the API log: a
failure is logged with the error name only, such as
`Could not process a sign-up request (MailDeliveryError)` when Mailpit is not
running. An
existing address gets the `sign-up-attempt` notice, not a verification link.

### Revoke every session of a user

Sessions are rows in `sessions`, so deleting them signs the user out
everywhere; their next request answers 401 and the web app goes to `/login`.

- **The user can do it:** a password reset ends every session of the user
  ([Password reset](#password-reset-18)). This is the first answer to "I lost
  my phone" or "someone has my password".
- **An operator** (for example, a suspected stolen session) runs, in the
  database's SQL console, with the email normalized (trimmed, lowercase):

  ```sql
  DELETE FROM sessions
  WHERE user_id = (SELECT id FROM users WHERE email = 'person@example.com');
  ```

  It only removes auth data, which may be physically deleted
  ([Auth data and soft delete](#auth-data-and-soft-delete)). If the password
  may be known to someone else, the user must also reset it, or the attacker
  simply signs in again. In production this is a manual write: do it only as
  the operator, and never run migrations or the seed this way (CLAUDE.md §6).

There is no admin endpoint or screen for it yet.

### Register a new Google redirect URI

Needed for a new domain (production, a preview environment) or a new local
port.

1. [Google Auth Platform](https://console.cloud.google.com/auth/clients) →
   **Clients** → the app's Web client → **Authorized redirect URIs** → add
   `<APP_ORIGIN>/api/auth/google/callback`. It must match exactly: scheme,
   host, port, path, no trailing slash. No JavaScript origin is needed.
2. For a new public domain, also add it to **Branding → Authorized domains**.
3. Set that environment's `APP_ORIGIN` to the same origin: the API builds
   `redirect_uri` from it, never from `Host`.
4. Save and wait: Google says changes can take from minutes to hours. Until
   then Google shows `redirect_uri_mismatch` instead of the consent screen.

Creating the client from scratch: [Setting up the client in
Google](#setting-up-the-client-in-google).

### A user is rate limited

Counters live in the API process and reset after 15 minutes
([Rate limiting](#rate-limiting-20)). Accounts are never locked, so there is
nothing to unlock: the user waits, or, in an emergency, restarting the API
clears every counter (for everyone). Locally, restarting `pnpm dev` does the
same.

## FAQ

**Why sessions in PostgreSQL and not JWT?** A token JavaScript can read can
be stolen by any injected script, and this is health data. A session row can
be revoked at once. See
[Server-side sessions](#server-side-sessions-cookie-in-the-browser-no-jwt).

**Why not Better Auth?** Its advisories hit exactly the flows we need
(account auto-linking, OAuth `state`, rate-limit bypass). See
[Library](#library-passport-sessions-are-our-own-code).

**Why does sign-up always answer 202, even for an email that exists?** So
neither the answer nor its timing reveals which emails have an account. The
owner of an existing account gets an email instead. The same goes for
`forgot-password` and `resend-verification`.

**Why is verifying an email a `POST` from the page, not the link itself?**
Link previews in WhatsApp and email clients open `GET` URLs and would use up
the single-use token.

**My `curl` write gets 403.** `CsrfGuard` needs an `Origin` header equal to
`APP_ORIGIN` on every method but `GET`, `HEAD` and `OPTIONS`; browsers send it,
`curl` does not. Add `-H 'Origin: http://localhost:4200'`. Many 403 warnings
in production mean a wrong `APP_ORIGIN`. See [CSRF](#csrf-13).

**I signed in with `curl`, but the next request is 401.** The cookie is
`HttpOnly`; save and send it (`-c cookies.txt` then `-b cookies.txt`). In
production it is named `__Host-session` and needs HTTPS.

**«Continuar con Google» gives a 404 locally.** `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` are not set; see README, "Sign in with Google
locally".

**Google sign-in fails and the log says `TypeError`.** The API could not
reach Google (no network, or a slow IPv4 handshake on a network without
IPv6; see the 2 s connection timeout in [Google](#google-openid-connect-19)).
Other reasons are logged by name (`state-mismatch`, `email-not-verified`,
`email-not-authoritative`).

**Why can a Google account not take over an account with a non-Gmail
address?** Google is authoritative only for `@gmail.com` and Workspace
(`hd`) addresses; for anything else a former owner of the address could
pass `email_verified`. The person keeps signing in with their password.

**Why 15 characters and no "a letter and a number", unlike the
prototype?** NIST SP 800-63B-4: the password is the only factor, so at least
15, and composition rules are forbidden. See
[Passwords](#passwords-argon2id).

**Why no "keep me signed in"?** Sessions have one lifetime (30 days, or 7
idle); the API has no such option.

**Can a nutritionist belong to several clinics?** The data allows it, but
the MVP uses the oldest membership; choosing a clinic needs a selector that
is out of scope. See [Route protection](#route-protection-12).

**Why are the email texts in the API and not in `i18n/es.ts`?** The API
renders the emails and must not depend on the web app. They live in
`apps/api/src/mail/mail-messages.ts`.

**Can sessions and tokens be deleted, against the soft-delete rule?** Yes:
they are auth data, not clinical records. A daily job deletes expired ones.
