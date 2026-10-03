-- PAY-08: an Order snapshots the exact Service Terms document presented at creation.
-- The snapshot is immutable so acceptance evidence survives later content updates.
ALTER TABLE orders
    ADD COLUMN service_terms_version_snapshot VARCHAR(40),
    ADD COLUMN service_terms_hash_snapshot CHAR(64),
    ADD COLUMN service_terms_content_snapshot TEXT;

-- Pre-existing Orders have no presented document to reconstruct, so they are
-- explicitly marked as lacking a snapshot instead of inheriting current content.
ALTER TABLE orders
    ADD CONSTRAINT ck_orders_terms_snapshot CHECK (
        (service_terms_version_snapshot IS NULL
            AND service_terms_hash_snapshot IS NULL
            AND service_terms_content_snapshot IS NULL) OR
        (service_terms_version_snapshot IS NOT NULL
            AND service_terms_hash_snapshot ~ '^[0-9a-f]{64}$'
            AND service_terms_content_snapshot IS NOT NULL
            AND btrim(service_terms_content_snapshot) <> '')
    );

-- The snapshot is commercial evidence, so it is immutable like the other snapshots.
CREATE OR REPLACE FUNCTION guard_order_terms_snapshot() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF ROW(NEW.service_terms_version_snapshot, NEW.service_terms_hash_snapshot,
           NEW.service_terms_content_snapshot)
       IS DISTINCT FROM
       ROW(OLD.service_terms_version_snapshot, OLD.service_terms_hash_snapshot,
           OLD.service_terms_content_snapshot) THEN
        RAISE EXCEPTION 'Order Service Terms snapshot is immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_terms_snapshot
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION guard_order_terms_snapshot();
