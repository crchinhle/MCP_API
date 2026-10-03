-- DESTRUCTIVE: permanently removes every non-extension table in schema public.
--
-- Before running this script:
--   1. Stop the API and Worker so they cannot write during the reset.
--   2. Create a Neon branch or snapshot for recovery.
--   3. Confirm that the connection targets the EmuKey database.
--
-- Preview the target set before running:
--   SELECT schemaname, tablename
--   FROM pg_tables
--   WHERE schemaname = 'public'
--   ORDER BY tablename;
--
-- CASCADE also removes views and foreign keys that depend on these tables.
-- The public schema and extension-owned objects are intentionally preserved.
--
-- PostgreSQL DDL is transactional. For a rehearsal, replace the final COMMIT
-- with ROLLBACK; all dropped objects will then be restored.
-- Prefer `corepack pnpm build` followed by `corepack pnpm db:reset` from
-- backend/. That entrypoint runs this cleanup and database/schema.sql in one
-- transaction, then verifies the resulting baseline before committing.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

SELECT pg_advisory_xact_lock(
  hashtextextended('emukey.drop-all-public-tables', 0)
);

DO $drop_public_routines$
DECLARE
  routine record;
BEGIN
  FOR routine IN
    SELECT
      namespace.nspname AS schema_name,
      procedure.proname AS routine_name,
      pg_get_function_identity_arguments(procedure.oid) AS identity_arguments
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend AS dependency
        WHERE dependency.classid = 'pg_proc'::regclass
          AND dependency.objid = procedure.oid
          AND dependency.deptype = 'e'
      )
  LOOP
    EXECUTE format(
      'DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE',
      routine.schema_name,
      routine.routine_name,
      routine.identity_arguments
    );
  END LOOP;
END
$drop_public_routines$;

DO $drop_public_tables$
DECLARE
  target record;
BEGIN
  IF current_database() <> 'EmuKey' THEN
    RAISE EXCEPTION
      'Refusing to run: connected to database %, expected EmuKey',
      current_database();
  END IF;

  FOR target IN
    SELECT namespace.nspname AS schema_name, relation.relname AS table_name
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind IN ('r', 'p')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend AS dependency
        WHERE dependency.classid = 'pg_class'::regclass
          AND dependency.objid = relation.oid
          AND dependency.deptype = 'e'
      )
    ORDER BY
      CASE relation.relkind WHEN 'r' THEN 0 ELSE 1 END,
      relation.relname
  LOOP
    RAISE NOTICE 'Dropping table %.%', target.schema_name, target.table_name;
    EXECUTE format(
      'DROP TABLE IF EXISTS %I.%I CASCADE',
      target.schema_name,
      target.table_name
    );
  END LOOP;
END
$drop_public_tables$;

DO $verify_public_tables_removed$
DECLARE
  remaining_tables integer;
BEGIN
  SELECT count(*)
  INTO remaining_tables
  FROM pg_class AS relation
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind IN ('r', 'p')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_depend AS dependency
      WHERE dependency.classid = 'pg_class'::regclass
        AND dependency.objid = relation.oid
        AND dependency.deptype = 'e'
    );

  IF remaining_tables <> 0 THEN
    RAISE EXCEPTION
      'Verification failed: % non-extension tables remain in schema public',
      remaining_tables;
  END IF;
END
$verify_public_tables_removed$;

COMMIT;
