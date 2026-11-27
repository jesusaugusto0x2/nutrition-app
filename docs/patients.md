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

### New and edit consultation forms (#79)

**Status: implemented.** `/patients/$patientId/nueva-consulta` and
`/patients/$patientId/consultas/$consultationId/editar`, one
`ConsultationForm` in both modes.

- **Draft state, not React Hook Form.** The ticket's UX is «save disabled
  until valid» with live diffs per keystroke — the same pattern the inline
  record editors (`records-table`, `record-cards`) already use with
  `record-draft.ts`. RHF + `zodResolver` (the #78 pattern) shines with
  per-field errors on submit; here validation is «`readConsultationFormDraft`
  returns null», shown as the `weightRequired` message by the disabled
  button (which the Button spec requires: a disabled button always has a
  nearby explanation). The existing `draftFrom`/`readDraft` stay untouched
  for the inline editors; the form gets its own helpers in the same file
  (`emptyConsultationFormDraft`, `consultationFormDraftFrom`,
  `readConsultationFormDraft`, `readConsultationFormMeasures`), adding
  height (`parseHeightInput`: `162` → 1,62 m) and notes.
- **Live diffs are `diffConsultations` on the partial parses**, computed
  only once the draft has a usable date and weight and never for a date
  before the previous consultation (the util throws on a negative span).
  Rendered with `ChangeText`, so the form's «−2,0 kg» is byte-identical to
  the records table's. Previous values ride the `FormField` `hint` slot
  («Anterior: 70,5 kg»).
- **In edit mode the «previous» is the consultation before the edited
  one** (the list is most-recent-first, so the next index), and the edited
  record comes from the cached list — there is no single-consultation GET;
  an id missing from the list is a 404 page, like a foreign record.
- **Both modes navigate back to the profile** with the flash notice. The
  #78 `patientCreated` history flag became a `notice` union
  (`'patient-created' | 'consultation-saved'`) in `app/router.tsx` — one
  flash slot, mapped to its text in the profile.
- **Writes invalidate `patientKeys.all`**: the consultation keys nest
  under it, and the list's weight summary (#77) and the profile both
  refetch, so the new record shows first without a manual refresh.
- Entry points: «Nueva consulta» in the consultations section header and
  «Editar» on each record card, both real links with `buttonVariants`.

### Patient profile tabs (#81)

**Status: implemented.** The profile is a tabbed route (spec 5):
`/patients/$patientId` is Resumen (default, the consultations list) with
nested siblings `/historia`, `/control-medidas` and `/notas`.

- **`$patientId.tsx` is a layout route with only `<Outlet/>` and a
  validation loader.** It preloads the patient detail and turns 404/400
  into the profile's not-found page, so a deep link to any tab of an
  unknown, foreign or malformed id 404s exactly like the profile always
  did. Form routes (`edit`, `nueva-consulta`) stay plain children of this
  layout: they render outside the profile frame — this is the same
  child-route trap #78 documented, now solved by an actual `<Outlet/>`
  instead of demoting the profile to `index.tsx`.
- **The shared frame (`PatientShell`) wraps only the four tabs**: back
  link, flash notice, patient card and the tab bar around the tab's own
  content. The active tab is a prop of the route rendering it, never
  derived from the URL by hand — deep-linking and tab clicks are the same
  code path, and the tab bar (`SectionTabs`, spec 5) navigates on change.
- **Not-yet-wired tabs land with `ComingSoonCard` (spec 35)**, not blank
  screens: Historia (#87), Control de medidas (#83) and Notas (#84) each
  say what arrives and when. Resumen renders the existing consultation
  list, now without its patient loader — the layout owns patient
  validation, the index route only adds `consultationsQueryOptions`.
- Pacientes stays `aria-current` in the navigation on every tab for free:
  the nav links match by route prefix, and the tabs are nested paths.

## Notes

### Internal patient notes (#80)

**Status: implemented (API + table).** `GET`/`POST`
`/api/clinic/patients/:patientId/notes` and `DELETE .../notes/:noteId`.
The web tab arrives with #84.

- **Notes are nutritionist-only.** They live under `/api/clinic` like the
  rest of the staff API and are never exposed to the portal — the portal
  reads through its own read-only endpoints, which do not include them.
- **Own module (`modules/notes`), not inside patients.** One Nest module
  per domain (CLAUDE.md §5); notes will grow (the #84 tab), and the module
  mirrors consultations: controller → service → repository, patient
  existence asserted through `PatientsService`, 404 identical for missing,
  foreign and soft-deleted records.
- **Table `patient_notes`** with the same composite foreign key as
  consultations (`(patient_id, clinic_id) → patients(id, clinic_id)`, so a
  note's patient must belong to its clinic) and soft delete.
  `created_by → users` is stored for audit but **not exposed by the API
  yet**: a bare user uuid means nothing to the UI, and the design's notes
  screen does not show an author; when one is wanted, the response gains a
  display name through a join, not the raw id.
- **Body rules in the shared schema:** trimmed, 1–2000 characters
  (`NOTE_BODY_MAX_LENGTH`, exported for the #84 form).
- The seed truncates `patient_notes` (its FK to `patients` requires it)
  and leaves two fictional notes on the first patient for local dev.

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
