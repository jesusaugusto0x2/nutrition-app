-- Sets a new password for `nutri_app` (docs/deployment.md, "Rotate
-- credentials", which has the exact command). Run it with psql as the OWNER
-- role; the new password comes from the APP_PASSWORD environment variable,
-- so it never appears on screen or in any history.

\set ON_ERROR_STOP on

\getenv app_password APP_PASSWORD
\if :{?app_password}
\else
  \echo 'APP_PASSWORD is not set: nothing was changed.'
  \quit
\endif

ALTER ROLE nutri_app WITH PASSWORD :'app_password';

\echo 'nutri_app password changed. Update DATABASE_URL in Railway now.'
