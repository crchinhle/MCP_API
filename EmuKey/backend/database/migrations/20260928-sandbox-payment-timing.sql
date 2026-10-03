-- Forward-only, transactional upgrade. Does not alter existing payment evidence.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE payment_transactions ADD COLUMN timing_basis VARCHAR(30) NOT NULL DEFAULT 'PROVIDER'
    CHECK (timing_basis IN ('PROVIDER', 'SANDBOX_RECEIPT'));

CREATE FUNCTION payment_effective_time(payment payment_transactions)
RETURNS TIMESTAMPTZ LANGUAGE sql IMMUTABLE STRICT AS $$
    SELECT CASE WHEN payment.timing_basis = 'SANDBOX_RECEIPT'
        THEN payment.received_at ELSE payment.provider_occurred_at END
$$;

CREATE FUNCTION guard_payment_timing_basis()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.timing_basis IS DISTINCT FROM OLD.timing_basis AND NOT COALESCE((
        OLD.timing_basis = 'PROVIDER' AND NEW.timing_basis = 'SANDBOX_RECEIPT'
        AND OLD.classification = 'UNMATCHED' AND OLD.review_status = 'OPEN'
        AND OLD.review_reason = 'PAYMENT_OUTSIDE_ACCEPTED_WINDOW'
        AND NEW.review_status = 'RESOLVED' AND NEW.review_resolution = 'ACCEPT_AND_FULFILL'
        AND NEW.reviewed_by_user_id IS NOT NULL
    ), FALSE) THEN
        RAISE EXCEPTION 'Payment timing basis is immutable outside audited sandbox reconciliation';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_payment_transactions_timing_basis
BEFORE UPDATE ON payment_transactions
FOR EACH ROW EXECUTE FUNCTION guard_payment_timing_basis();

-- Preserve every existing guard, replacing only its timing expression. Abort on
-- unexpected schema drift; never replace the evidence-immutability function.
DO $$
DECLARE
    function_name TEXT;
    definition TEXT;
    old_expression TEXT;
    expected_count INTEGER;
BEGIN
    FOR function_name, old_expression, expected_count IN
        SELECT * FROM (VALUES
            ('guard_payment_attempt_identity_and_lifecycle', 'pt.provider_occurred_at', 5),
            ('enforce_payment_fulfillment_gate', 'NEW.provider_occurred_at', 5),
            ('enforce_license_paid_origin', 'pt.provider_occurred_at', 1)
        ) AS guards(name, expression, occurrences)
    LOOP
        definition := pg_get_functiondef(to_regprocedure(function_name || '()'));
        IF definition IS NULL OR
           (length(definition) - length(replace(definition, old_expression, ''))) / length(old_expression) <> expected_count THEN
            RAISE EXCEPTION 'Unexpected payment schema: %', function_name;
        END IF;
        EXECUTE replace(definition, old_expression,
            CASE WHEN old_expression LIKE 'NEW.%' THEN 'payment_effective_time(NEW)' ELSE 'payment_effective_time(pt)' END);
    END LOOP;
END;
$$;
COMMIT;
