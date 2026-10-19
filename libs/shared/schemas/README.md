# @nutri/schemas

Zod schemas and types shared by the API and the web app: the single source
of truth for the API contract (requests, responses and the `ApiError` shape).
Framework-free: it must not import Nest, React or Drizzle.

```bash
pnpm nx test schemas
pnpm nx build schemas
```
