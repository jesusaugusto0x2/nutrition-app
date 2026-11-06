-- Proves that the application role has data access only
-- (docs/deployment.md, "Database (Neon)"). Run it connected as `nutri_app`.
--
-- Every check either prints `ok: ...` or stops with `FAIL: ...`. It reads no
-- rows and changes nothing: each DDL attempt is expected to be denied, and
-- one that is not denied raises an error, which rolls back the whole block.

DO $$
DECLARE
  missing text;
BEGIN
  IF current_user <> 'nutri_app' THEN
    RAISE EXCEPTION 'FAIL: connected as %, expected nutri_app', current_user;
  END IF;
  -- The catalogs are readable by every role, even without USAGE on a schema.
  IF (
    SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE (n.nspname, c.relname) IN (('public', 'patients'), ('drizzle', '__drizzle_migrations'))
  ) < 2 THEN
    RAISE EXCEPTION 'FAIL: no migrated schema; run this after the first migration';
  END IF;

  IF EXISTS (
    SELECT FROM pg_roles
    WHERE rolname = current_user
      AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'FAIL: nutri_app has role attributes beyond LOGIN';
  END IF;
  -- Direct or inherited membership in any other role, such as neon_superuser.
  IF EXISTS (
    SELECT FROM pg_roles r
    WHERE r.rolname <> current_user AND pg_has_role(current_user, r.oid, 'MEMBER')
  ) THEN
    RAISE EXCEPTION 'FAIL: nutri_app is a member of another role';
  END IF;
  RAISE NOTICE 'ok: no superuser attributes and no role memberships';

  SELECT string_agg(c.relname, ', ') INTO missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND NOT (
      has_table_privilege(c.oid, 'SELECT')
      AND has_table_privilege(c.oid, 'INSERT')
      AND has_table_privilege(c.oid, 'UPDATE')
      AND has_table_privilege(c.oid, 'DELETE')
    );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: missing data privileges on %', missing;
  END IF;
  RAISE NOTICE 'ok: SELECT, INSERT, UPDATE, DELETE on every public table (% tables)',
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p'));

  BEGIN
    EXECUTE 'CREATE TABLE public.app_role_check (id integer)';
    RAISE EXCEPTION 'FAIL: nutri_app can CREATE TABLE';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: CREATE TABLE denied';
  END;

  BEGIN
    EXECUTE 'CREATE SCHEMA app_role_check';
    RAISE EXCEPTION 'FAIL: nutri_app can CREATE SCHEMA';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: CREATE SCHEMA denied';
  END;

  BEGIN
    EXECUTE 'CREATE TEMPORARY TABLE app_role_check (id integer)';
    RAISE EXCEPTION 'FAIL: nutri_app can CREATE TEMPORARY TABLE';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: CREATE TEMPORARY TABLE denied';
  END;

  BEGIN
    EXECUTE 'ALTER TABLE public.patients ADD COLUMN app_role_check integer';
    RAISE EXCEPTION 'FAIL: nutri_app can ALTER TABLE';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: ALTER TABLE denied';
  END;

  BEGIN
    EXECUTE 'DROP TABLE public.patients';
    RAISE EXCEPTION 'FAIL: nutri_app can DROP TABLE';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: DROP TABLE denied';
  END;

  BEGIN
    EXECUTE 'TRUNCATE public.patients';
    RAISE EXCEPTION 'FAIL: nutri_app can TRUNCATE';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: TRUNCATE denied';
  END;

  BEGIN
    EXECUTE 'SELECT count(*) FROM drizzle.__drizzle_migrations';
    RAISE EXCEPTION 'FAIL: nutri_app can read the migrations journal';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: migrations journal (schema drizzle) not readable';
  END;

  RAISE NOTICE 'All checks passed.';
END
$$;
