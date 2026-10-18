// TODO(rls): Add PostgreSQL Row Level Security as defense in depth for clinic
// isolation. Today isolation is enforced in the repositories, which always
// filter by clinic_id. Plan: enable RLS on every table with a clinic_id,
// set the current clinic per transaction (e.g. `set_config('app.clinic_id',
// ...)`) and add policies matching clinic_id; requires real auth first.
export * from './clinics';
export * from './consultations';
export * from './memberships';
export * from './patient-access';
export * from './patients';
export * from './users';
