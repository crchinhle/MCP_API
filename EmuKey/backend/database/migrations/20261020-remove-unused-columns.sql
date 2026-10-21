-- Remove unused profile and AI metadata; preserve guide content and audit evidence.
-- PostgreSQL 15 DROP COLUMN uses RESTRICT by default, so unexpected external
-- dependencies abort the transaction rather than being removed with CASCADE.
-- https://www.postgresql.org/docs/15/sql-altertable.html
BEGIN;

ALTER TABLE users
    DROP COLUMN IF EXISTS representative_name,
    DROP COLUMN IF EXISTS tax_code;

ALTER TABLE knowledge_chunks
    DROP CONSTRAINT IF EXISTS ck_knowledge_chunks_embedding,
    DROP CONSTRAINT IF EXISTS ck_knowledge_chunks_source_metadata,
    DROP COLUMN IF EXISTS embedding,
    DROP COLUMN IF EXISTS embedding_model,
    DROP COLUMN IF EXISTS embedding_dimension,
    DROP COLUMN IF EXISTS source_metadata;

ALTER TABLE messages DROP COLUMN IF EXISTS model_name;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS actor_email_snapshot;

-- An existing vector extension can remain installed for other database users.
-- Fresh databases no longer install or require it.
COMMIT;
