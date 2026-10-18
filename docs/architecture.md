# Architecture

> The full architecture write-up (decisions and their rationale) is completed
> in the documentation phase. This file already tracks known technical debt.

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
  `^10`. Then bump `eslint` and `@eslint/js` to 10, run
  `pnpm nx run-many -t lint` and fix any rule changes.

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
- **Prepared:** no tsconfig uses `baseUrl`, `paths` or `ignoreDeprecations`;
  workspace libraries resolve through pnpm workspace packages and the
  `@nutri/source` custom condition, so the upgrade needs no tsconfig rewrite.
- **Resolve when:** `typescript-eslint` supports TypeScript 7.
