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
