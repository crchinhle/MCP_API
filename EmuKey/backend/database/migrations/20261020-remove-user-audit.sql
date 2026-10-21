-- Run after earlier migrations, with old API/worker processes stopped.
-- Removes user activity audit data; business history is retained.
BEGIN;

DROP TABLE IF EXISTS audit_logs;
DROP FUNCTION IF EXISTS reject_audit_logs_mutation();

COMMIT;
