# Patients & consultations

The nutritionist's daily tool: patients, their consultations with
measurements, nutrition history, internal notes and the home screen. This is
the reference for the Patients & consultations epic (#73). Every ticket of
the epic fills in its own section in the same pull request as the change.

**Status: in progress (#73).** What is built and verified is described per
section; the epic is done when every ticket is closed and this doc matches
what runs in production.

Domain terms and layout: [CLAUDE.md](../CLAUDE.md). Design export §6–§9 and
§13 (2026-11-19) is the visual reference; this doc records the decisions the
implementation adds on top of it.

Non-negotiables for every ticket (from #73): clinic isolation with specs,
Spanish i18n in `apps/web/src/i18n/es.ts`, every new spec component shown at
`/dev/components`, and this doc updated in the same pull request. The
«Próximamente» features are placeholders only — do not build them.

## Patients

### Patient list: search, sort and weight summary (#77)

**Status: implemented.** `GET /api/clinic/patients?q=&sort=` returns
`patientListItemSchema[]`: the patient plus `lastConsultation
{ date, weightKg }`, `currentWeight` and `trendWeightKg` (nulls when there
are no consultations, or fewer than two for the trend).

- **Search is accent-insensitive with `translate()`, not `unaccent`.** The
  filter folds Spanish accents (`áéíóúüñç…`) to base letters on both the
  name (`firstName || ' ' || lastName`) and the query, then `LIKE '%q%'`.
  `translate()` is plain SQL: it needs no `CREATE EXTENSION` (no migration,
  no owner-role step) and behaves identically on PGlite and Neon, so the
  repository specs test the real thing. `%`, `_` and `\` in the query are
  escaped so they match literally. Rejected: `unaccent` + an expression
  index and `pg_trgm` — index-friendly search matters at thousands of rows;
  a per-clinic list is far smaller, and the fold function would need the
  same expression index anyway. Revisit if a clinic's list grows past a few
  thousand patients.
- **The summary comes from correlated subqueries**, not a join: two
  scalar subqueries fetch the two latest non-deleted consultations' weights
  (`::float8` so the driver returns numbers) and one the latest date
  (`::text` so it stays `YYYY-MM-DD`). Soft-deleted consultations never
  count. Sorting repeats no logic: the query wraps the enriched selection
  in a subquery and orders outside it.
- **Default sort is `recent`**: latest consultation first, patients without
  consultations last (`NULLS LAST`), ties broken by last and first name.
  `sort=name` is the plain alphabetical order the list had before.
- **The trend is rounded to two decimals in the mapper** — the difference
  of two `numeric(5,2)` weights leaks float error otherwise
  (`69.5 - 70.05 = -0.5499…`). A trend of `null` (not `0`) means «fewer
  than two consultations», so the UI can tell «no data» apart from «no
  change».
- The response shape changed under the existing web list, which keeps
  working because Zod strips unknown keys; #90 builds the real list on the
  new fields. The default order of the current list screen changes to
  «most recent consultation first», which is the design's order (§8).

### Patient create and edit forms (#78)

**Status: implemented.** `/patients/new` and `/patients/$patientId/edit`,
one `PatientForm` in both modes — the first clinical write flow of the web
app.

- **The date is typed `dd/mm/aaaa` and parsed with `lib/parse.ts`** (never
  by hand, CLAUDE.md §5): a local extension of `createPatientSchema`
  overrides only `birthDate` (text → refined → transformed to
  `YYYY-MM-DD`), so the shared schema stays the single source of the rules
  and the API receives ISO. Refine messages are codes (`invalid`,
  `future`) the form maps to Spanish; the API re-validates the same rules.
- **Sex uses `ChoiceField` (spec 9), extended with an optional `error`
  prop** that renders `FieldError` and wires `aria-invalid` /
  `aria-describedby` on the radio group — the component had no error state
  before.
- **After create, navigate to the profile with a history-state flag**
  (`state: { patientCreated: true }`) that shows the success notice there:
  a flash message with no clinical data, gone on the next navigation.
  After edit the form stays and shows the notice inline; the next change
  clears it (spec 31: it must never say «guardado» over unsaved data).
- **Both mutations invalidate `patientKeys.all`**, which the detail key
  nests under, so the list and any open profile refetch without a manual
  refresh. API failures surface as a `FormAlert` above the form (the same
  pattern as auth), not as field errors.
- **Route structure:** the profile moved from `$patientId.tsx` to
  `$patientId/index.tsx` so `$patientId/edit.tsx` is a sibling leaf, not a
  child — as a child it rendered inside the profile (which has no
  `<Outlet/>`) and ran the profile's loader.
- The «Nuevo paciente» CTA lives on the list header and the «Editar»
  action in the profile's `CardAction`; both are real links styled with
  `buttonVariants` (navigation stays navigation).

## Consultations

### Editing and deleting a consultation (#76)

**Status: implemented.** `PATCH` and `DELETE` on
`/api/clinic/patients/:patientId/consultations/:consultationId`.

- **Editing replaces the editable fields with the same validations as
  create** (`updateConsultationSchema` in `@nutri/schemas`, an alias of
  `createConsultationSchema`): date not in the future, weight required and
  within bounds, optional measurements, notes up to 2000 characters. Weight
  staying required keeps «at least one measurement» structural — a
  corrected consultation can never end up with no measurement. Rejected: a
  partial patch like `updatePatientSchema` — the correction form (#79)
  submits the whole record anyway, and the full shape keeps the invariant
  without an extra refine.
- **Soft delete only:** `DELETE` sets `deleted_at` to the service clock time
  (clinical records are never physically deleted, CLAUDE.md §6). The row
  disappears from the list; further `PATCH`/`DELETE` answer 404.
- **A consultation from another clinic behaves exactly like a missing one:**
  the repository filters by `clinicId`, `patientId`, `id` and
  `deleted_at IS NULL` on both writes, and the service maps «no row» to 404. Probed ids reveal nothing.
- Repository methods accept an optional `tx` like the other repositories,
  for the day a write spans modules.
