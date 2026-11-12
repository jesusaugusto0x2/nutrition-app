# CI and quality checks

How every change is verified before it reaches `main`, and why it works this
way: the workflow, its checks and caches, the branch protection that enforces
them and the local hooks. This is the reference for the CI & quality epic (#2).
The rules contributors must follow stay short in
[CLAUDE.md](../CLAUDE.md) §9 and §11; the explanations live here.

What happens after the merge (Railway's "Wait for CI", the deploy) is in
[docs/deployment.md](deployment.md).

## Overview

Everything runs from one workflow, `CI`
([.github/workflows/ci.yml](../.github/workflows/ci.yml)), with two parallel
jobs:

| Job (`name:`, what GitHub shows)        | Id       | Scope                                                   |
| --------------------------------------- | -------- | ------------------------------------------------------- |
| `Lint, typecheck, test and build`       | `checks` | Affected projects on pull requests, all of them on push |
| `Build and smoke-test the Docker image` | `image`  | Always, on every run                                    |

It is triggered by:

- **`pull_request` targeting `main`:** lint, typecheck, test and build run with
  `nx affected`, which diffs against the merge base with the target branch.
- **`push` to `main`:** the same steps run with `nx run-many`, over every
  project.

Other settings that apply to the whole workflow:

- **Concurrency:** one run per workflow and ref; a new push cancels the run in
  progress. For what this means on `main`, see
  [the deployment FAQ](deployment.md#faq--gotchas).
- **Permissions:** `contents: read` only.
- **Environment:** `HUSKY=0`, `NX_DAEMON=false` and `NX_NO_CLOUD=true`, the same
  as the `Dockerfile`.
- **Toolchain:** Node.js 24, pnpm from `packageManager` in `package.json`,
  `pnpm install --frozen-lockfile`.
- **No secrets:** repository tests run on PGlite and the build does not read
  `DATABASE_URL`. The only database URLs in the workflow are throwaway values.

## Checks

The first column is the exact step name in `ci.yml`, which is what the Actions
log and the failure annotations show.

### Job `Lint, typecheck, test and build`

| Step                            | Runs on         | Verifies                                              | Reproduce locally                                   |
| ------------------------------- | --------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `Commit messages`               | Pull requests   | Every commit the PR adds passes commitlint            | `pnpm exec commitlint --from origin/main --to HEAD` |
| `TypeScript project references` | Both            | Project references are in sync (`pnpm nx sync:check`) | `pnpm nx sync:check`                                |
| `Drizzle schema and migrations` | Both            | The schema matches the committed migrations           | `pnpm db:generate` must create no migration         |
| `Lint`                          | Both (affected) | ESLint, including Nx module boundaries                | `pnpm lint`                                         |
| `Typecheck`                     | Both (affected) | TypeScript                                            | `pnpm typecheck`                                    |
| `Test`                          | Both (affected) | Vitest                                                | `pnpm test`                                         |
| `Build`                         | Both (affected) | Every project builds                                  | `pnpm build`                                        |
| `Generated files are committed` | Both            | The steps above left `git status` clean               | `pnpm build`, then `git status`                     |

"Both (affected)" means `nx affected` on pull requests and `nx run-many` on
push. The other steps ignore which projects changed.

Details worth knowing:

- **`Commit messages`** covers the range from the PR's base SHA to its head SHA,
  because the local hook can be skipped with `--no-verify`. Merge commits are
  ignored by the conventional config.
- **`Drizzle schema and migrations`** runs two commands. `drizzle-kit check`
  checks the consistency of the migration history, and `drizzle-kit generate`
  must then leave `apps/api/src/database/migrations` unchanged. Neither connects
  to a database, but `drizzle.config.ts` requires `DATABASE_URL`, so the step
  sets a placeholder.
- **`Test`** runs once and exits: `nx.json` sets `testMode: "watch"`, and Vitest
  disables watch mode when `CI=true`, which GitHub Actions sets.
- **Web tests wait up to 5 s** in `findBy*` and `waitFor`
  (`apps/web/src/test-setup.ts`). The default 1 s failed the first render of a
  lazy route in CI and locally whenever `pnpm test` ran every project at once.
  A passing wait still returns as soon as it can.
- **`Generated files are committed`** runs after `Build` because the build
  regenerates committed files (`apps/web/src/routeTree.gen.ts`). Any change
  fails the step with an annotation on each file saying how to regenerate it.

### Job `Build and smoke-test the Docker image`

| Step                   | Verifies                                               |
| ---------------------- | ------------------------------------------------------ |
| `Set up Docker Buildx` | Prepares Buildx for the layer cache                    |
| `Build image`          | Every `Dockerfile` stage builds (`push: false`)        |
| `Smoke test`           | The image really starts and serves the app (see below) |

The job ignores `nx affected` because the image stages (`api:prune`,
`prod-deps`, runtime) can break without `pnpm build` failing: a dependency
missing from the pruned lockfile, or a native module that fails on Alpine.

`scripts/smoke-test-image.sh` runs the image against a `postgres:18-alpine`
service container (the same version as Docker Compose), which starts empty.
First it runs the migration entry point the way Railway's pre-deploy command
does (`node migrate.js`, [Migrations](deployment.md#migrations)) and checks
that:

- the first run migrates the empty database and exits 0;
- a second run logs `No pending migrations` and exits 0;
- with a broken migration added (a copy of the image's migrations mounted over
  its folder: one statement that works, then one that fails), it exits
  non-zero, logs the SQLSTATE (`42P01`) but not the SQL, and a following run
  still finds nothing pending, so nothing was recorded.

Then it starts the app against the migrated database, waits up to 60 s for
the image's own `HEALTHCHECK`, and checks that:

- the image config sets `USER node`, and inside the container the process runs
  as `node`, not root;
- `argon2`, a native module, hashes and verifies inside the image, proving its
  prebuilt binary loads on Alpine (musl);
- `GET /api/health` returns 200 JSON with `"status":"ok"`;
- `GET /` and the deep link `GET /patients` return the SPA's `index.html`;
- `GET /api/does-not-exist` returns a JSON 404 with `"code":"NOT_FOUND"`, not
  the SPA;
- `POST /api/auth/sign-out` answers 204 with `Origin` set to `APP_ORIGIN` and 403
  with any other origin, so CSRF protection is active in the built image.

On failure it prints the last migration output and the container logs; it
always removes the container. `DATABASE_URL` and `DATABASE_MIGRATION_URL` (which
defaults to `DATABASE_URL`: in CI both are the service's owner) are forwarded
with `--env`, so their values never appear on a command line. It ends in `?sslmode=disable`: in production the app accepts only an
explicit `verify-full` or `disable`
([Database (Neon)](deployment.md#database-neon)), and the service container
has no TLS. `SMTP_URL`, `MAIL_FROM`, `APP_ORIGIN`, `CLIENT_IP_SOURCE`,
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` default to placeholders (nothing
is emailed, and Google is never called), and `SMOKE_PORT` (default 3100) sets the host
port. To run it locally, see
[Production image](../README.md#production-image) in the README. Do it after
changing the `Dockerfile` or runtime dependencies.

## Caching

| Cache           | Mechanism                               | Key                             | Saved by           |
| --------------- | --------------------------------------- | ------------------------------- | ------------------ |
| pnpm store      | `actions/setup-node` with `cache: pnpm` | `pnpm-lock.yaml` hash           | `Set up Node.js`   |
| Nx task results | `actions/cache` (`Restore Nx cache`)    | OS + lockfile hash + commit SHA | `Restore Nx cache` |
| Docker layers   | Buildx `type=gha`, scope `nutri-image`  | Managed by Buildx (`mode=max`)  | `Build image`      |

- **The Nx cache has two paths, and both are required.** Nx 23 keeps its cache
  under `~/.nx` by default, so `NX_CACHE_DIRECTORY: .nx/cache` brings it inside
  the checkout. Nx also indexes artifacts in a metadata DB in
  `.nx/workspace-data`; restored without it, the artifacts are unusable and every
  task misses. This setting exists only in the workflow: local development keeps
  the default location.
- **Restoring:** the Nx key is saved once per commit, and a new commit restores
  the latest cache for the same lockfile. A lockfile change starts from an empty
  Nx cache and a new pnpm store cache.
- **Editing `ci.yml` invalidates every Nx task.** The file is the only entry in
  `sharedGlobals` (`nx.json`), an input of every task. A change to CI therefore
  reruns everything, and marks every project as affected, instead of reusing
  results produced by the old workflow.
- **Scope:** a cache saved by a pull request can only be restored by re-runs of
  that same pull request. The caches every PR can restore are the ones saved by
  the push to `main` after a merge.
- **Failures:** `actions/cache` saves only when the job succeeds, so a failed run
  does not overwrite the cache. A failed Docker layer export does not fail the
  job (`ignore-error=true`).
- **Quota:** all three share the repository's Actions cache, 10 GB by default.
  `NX_MAX_CACHE_SIZE: 1GB` keeps the Nx share small, because the default limit is
  a fraction of the runner's disk, which is above that quota. Check usage with
  `gh api repos/jesusaugusto0x2/nutrition-app/actions/cache/usage`.

Measured when caching was added (#31), for the same commit: 74 s for the job
with no cache and 35 s with both caches hit, with lint, typecheck, test and build
going from 56 s to 9 s. Most of the gain comes from the Nx cache, because
`pnpm install` still has to link `node_modules`.

## Branch protection

`main` is protected by the repository ruleset **"Protect main"** (id `26089537`,
active on the default branch). It is a repository setting, not a file, so no
pull request shows a change to it. Read it with
`gh api repos/jesusaugusto0x2/nutrition-app/rulesets/26089537`.

| Rule                  | Setting                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| Pull request required | 0 approvals; allowed merge method: `merge`                                 |
| Required checks       | `Lint, typecheck, test and build`, `Build and smoke-test the Docker image` |
| Check source          | GitHub Actions only (`integration_id` 15368)                               |
| Up to date            | The branch must include the latest `main` (strict policy)                  |
| Force pushes          | Blocked                                                                    |
| Deletion              | Blocked                                                                    |
| Bypass                | Nobody, the repository owner included                                      |

Repository settings complete it: **merge commits only** (squash and rebase are
disabled) and **head branches are deleted automatically** after merging.

Every atomic commit reaches `main` as written, so each one must pass commitlint.
The merge commit itself is ignored by it.

### Renaming a CI job

The required checks match the job's `name:`, not its id. A renamed job reports a
new check, and the old one never arrives, so every pull request stays blocked
until the ruleset changes:

1. Rename the job in a pull request and wait for it to pass.
2. Replace the old name in the ruleset's required checks.
3. Merge. Other open pull requests need `main` merged in to report the new name.
4. Update the job names in this doc.

Railway's "Wait for CI" watches the workflow, not individual jobs, so it is not
affected.

## Local hooks

`pnpm install` installs the [husky](https://typicode.github.io/husky/) hooks
through the `prepare` script. They give fast feedback; CI is what enforces the
rules, because hooks can be skipped with `--no-verify`.

- **`pre-commit`** runs lint-staged (`lint-staged.config.mjs`):
  - code files: `prettier --write`, then `nx affected -t lint` for the projects
    of the staged files, so module-boundary and typed rules use each project's
    own config;
  - `json`, `md`, `css`, `html`, `yml` and `yaml`: `prettier --write`.
- **`commit-msg`** runs commitlint (`commitlint.config.mjs`): the conventional
  config, plus a required scope from `api, web, shared, db, infra, docs, deps`.

## Decisions

- **Affected projects on pull requests, every project on `main`.** PRs get fast
  feedback, and the full run on `main` both checks the merged result and saves
  the caches PRs restore.
- **`NX_BASE=origin/<base>`, not `nrwl/nx-set-shas`.** That action finds the last
  successful run on `main`, which needs `actions: read`. Pushes to `main` run
  everything, so the only base needed is the PR's target branch, and this needs
  no extra action or permission.
- **Full history with a treeless clone** (`fetch-depth: 0`, `filter: tree:0`).
  `nx affected` needs the base branch history, and the filter keeps the clone
  small.
- **The image job ignores `affected`.** Nx does not see the `Dockerfile` stages,
  which can fail while `pnpm build` passes.
- **No `paths` filter on the workflow.** GitHub leaves the required checks of a
  workflow skipped by path filtering pending, which blocks the merge. On a
  docs-only PR `nx affected` finds no project, so the `checks` job still reports
  success, quickly.
- **Merge commits only.** Commits are small, atomic and validated, so they reach
  `main` as written. Rejected: squash merging, which would turn the PR title into
  the commit and need its own validation in CI.
- **No approvals required.** The project has a solo developer, so the ruleset
  relies on the required checks.
- **The image is never pushed from CI.** Railway builds the `Dockerfile` itself,
  so there is no registry to run. See
  [Decisions in docs/deployment.md](deployment.md#decisions).
- **`on: push` stays in the workflow.** Besides the full run, Railway's "Wait for
  CI" needs a workflow with that trigger.
- **Nx Cloud stays off** (`NX_NO_CLOUD=true`). The GitHub Actions cache already
  gives full Nx hits on a rerun, with no extra account or service.
- **`ci.yml` is a shared global Nx input,** so a CI change can never pass on
  results from the old workflow.
- **Commit messages are rechecked in CI.** The `commit-msg` hook alone can be
  skipped, and with merge commits every commit lands on `main`.
- **Least privilege:** `contents: read`, nothing else. No step needs more.

## Troubleshooting and FAQ

### CI failures

**CI fails on `Commit messages`.** A commit in the pull request does not follow
Conventional Commits with a scope. Reword it (`git rebase -i`) and force-push the
branch. The ruleset blocks force pushes only on `main`.

**CI fails on `TypeScript project references`.** Run `pnpm nx sync` and commit
the result. It is needed after adding a dependency between workspace projects.

**CI fails on `Drizzle schema and migrations`.** Run `pnpm db:generate` and commit
the new migration.

**CI fails on `Generated files are committed`.** Run `pnpm build` and commit the
files it changed, usually `apps/web/src/routeTree.gen.ts`. If the file should not
be committed, add it to `.gitignore`.

**CI fails on `Smoke test`.** The job log ends with the container logs. Reproduce
it with the local command in the README. `container exited before becoming
healthy` usually means the app refused to start, for example because a new
required production variable is not set in `scripts/smoke-test-image.sh`, or
`DATABASE_URL: Must set sslmode=verify-full in production` when the smoke
test's `DATABASE_URL` lost its `?sslmode=disable`. A failure in
`node migrate.js` prints the migration output instead: a SQLSTATE such as
`42P01` means a new migration does not apply to an empty database (generate it
again with `pnpm db:generate`), and `ECONNREFUSED` means the container did not
reach the Postgres service.

### Pull requests with no result

**`gh pr checks --watch` says "no checks reported" right after opening a PR.**
The run has not been created yet. Find it with `gh run list --branch <branch>` and
follow it with `gh run watch <id>`.

**A PR has no run at all, or the required checks wait forever.** Check
`gh pr view --json mergeable`. GitHub does not run `pull_request` workflows while
a PR has a merge conflict. Merge `origin/main` into the branch and resolve the
conflict; the push starts a new run. This is common when parallel branches change
CI or the same docs. The other cause is a renamed job, see
[Renaming a CI job](#renaming-a-ci-job).

**The checks pass but the merge is blocked because the branch is out of date.**
The ruleset requires the branch to include the latest `main`, and new commits on
`main` do not rerun a PR. Merge `origin/main` into the branch; the resulting merge
commit is ignored by commitlint.

### Caching and affected

**Why did the whole workspace run on a PR that barely changes anything?** Usually
it changes `ci.yml`, an input of every task, see [Caching](#caching). Check which
projects a PR affects with `pnpm nx show projects --affected --base=origin/main`.

**Why did a PR not run a project's tests?** Nothing it depends on changed. A
change to `apps/web` affects only `web`; a change to `libs/shared/schemas` also
affects `utils`, `web` and `api`. The push to `main` runs every project anyway.

**The Nx cache is not reused.** `Path Validation Error` in `Restore Nx cache`
means `.nx/cache` is empty, so `NX_CACHE_DIRECTORY` is missing. `Nx found
unrecognized artifacts in the cache directory` means `.nx/workspace-data` was not
restored with it. Keep both paths in the step.

**A PR reruns tasks that `main` already ran.** A run restores only caches saved by
`main` or by re-runs of its own PR, and only for the same lockfile, so a PR that
changes `pnpm-lock.yaml` starts with an empty Nx cache.

**Tests ignore a tsconfig change.** Run `pnpm exec vitest --clearCache`. Vitest
caches transformed modules on disk, under `node_modules/.vite`. This happens only
locally: CI does not cache `node_modules`, so a run that passes while your local
tests disagree may be this.
