-- Creates the application role `nutri_app` on the production database
-- (docs/deployment.md, "Database (Neon)", which has the exact command).
--
-- Run it once with psql, connected as the OWNER role (the role that runs
-- migrations) over the direct connection. The new role's password comes from
-- the APP_PASSWORD environment variable, so it never appears on screen, in
-- shell history or in the Neon SQL Editor's history. Do not paste it into the
-- SQL Editor.
--
-- The role is created with SQL on purpose: roles created in the Neon Console,
-- API or CLI join `neon_superuser`, which can read and write every table and
-- create databases and roles. A role created with SQL gets only what is
-- granted below.
--
-- Safe to run before or after the first migration: it grants on the tables
-- that exist now and, through default privileges, on every table the owner
-- role creates later. Everything runs in one transaction.

\set ON_ERROR_STOP on

\getenv app_password APP_PASSWORD
\if :{?app_password}
\else
  \echo 'APP_PASSWORD is not set: nothing was changed.'
  \quit
\endif

BEGIN;

CREATE ROLE nutri_app WITH LOGIN PASSWORD :'app_password';

-- Connect and use the public schema, nothing else (no CREATE on the schema).
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO nutri_app', current_database());
  -- No temporary tables either, for any role without an explicit grant: the
  -- app does not use them, and the pooler (transaction mode) would break
  -- them anyway. The owner keeps them as the database owner.
  EXECUTE format('REVOKE TEMPORARY ON DATABASE %I FROM PUBLIC', current_database());
END
$$;
GRANT USAGE ON SCHEMA public TO nutri_app;

-- Data access on what exists now. No TRUNCATE, REFERENCES or TRIGGER.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nutri_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nutri_app;

-- The same grants on tables and sequences that future migrations create.
-- Default privileges apply only to objects created by the role running this
-- statement, so this must be the role that runs migrations.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nutri_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO nutri_app;

COMMIT;

\echo 'nutri_app created. Run check-app-role.sql as nutri_app after the first migration.'
