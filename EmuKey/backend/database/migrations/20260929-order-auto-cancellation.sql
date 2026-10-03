BEGIN;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_cancelled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS ck_orders_auto_cancelled;
ALTER TABLE orders DROP CONSTRAINT ck_orders_cancelled;
ALTER TABLE orders ADD CONSTRAINT ck_orders_auto_cancelled CHECK (NOT auto_cancelled OR
        (cancelled_at IS NOT NULL AND cancelled_at >= payment_due_at AND order_status IN ('CANCELLED', 'PAYMENT_ACCEPTED'))),
    ADD CONSTRAINT ck_orders_cancelled CHECK (
        (order_status = 'CANCELLED' AND cancelled_at IS NOT NULL AND expired_at IS NULL AND
            payment_accepted_at IS NULL) OR
        (order_status = 'EXPIRED' AND expired_at IS NOT NULL AND cancelled_at IS NULL AND
            payment_accepted_at IS NULL) OR
        (order_status NOT IN ('CANCELLED', 'EXPIRED') AND expired_at IS NULL AND
            (cancelled_at IS NULL OR (auto_cancelled AND order_status = 'PAYMENT_ACCEPTED')))
    );

CREATE OR REPLACE FUNCTION enforce_order_initial_state()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.order_status <> 'WAITING_SERVICE_TERMS_ACCEPTANCE' OR
       NEW.service_terms_accepted_at IS NOT NULL OR
       NEW.payment_accepted_at IS NOT NULL OR
       NEW.cancelled_at IS NOT NULL OR
       NEW.expired_at IS NOT NULL OR NEW.auto_cancelled THEN
        RAISE EXCEPTION 'A new Order must enter in WAITING_SERVICE_TERMS_ACCEPTANCE state';
    END IF;

    NEW.created_at := statement_timestamp();
    NEW.updated_at := NEW.created_at;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION guard_order_snapshot_and_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF ROW(NEW.id, NEW.order_number, NEW.idempotency_key,
           NEW.customer_user_id, NEW.provider_user_id, NEW.product_id, NEW.plan_id,
           NEW.target_license_id, NEW.order_type,
           NEW.provider_name_snapshot, NEW.product_name_snapshot, NEW.plan_name_snapshot,
           NEW.plan_version_snapshot, NEW.price_vnd_snapshot, NEW.currency,
           NEW.billing_cycle_snapshot, NEW.duration_months_snapshot,
            NEW.max_active_devices_snapshot, NEW.entitlements_snapshot,
            NEW.plan_commitment_snapshot, NEW.payment_due_at, NEW.ipn_accept_until,
           NEW.created_at)
       IS DISTINCT FROM
       ROW(OLD.id, OLD.order_number, OLD.idempotency_key,
           OLD.customer_user_id, OLD.provider_user_id, OLD.product_id, OLD.plan_id,
           OLD.target_license_id, OLD.order_type,
           OLD.provider_name_snapshot, OLD.product_name_snapshot, OLD.plan_name_snapshot,
           OLD.plan_version_snapshot, OLD.price_vnd_snapshot, OLD.currency,
           OLD.billing_cycle_snapshot, OLD.duration_months_snapshot,
            OLD.max_active_devices_snapshot, OLD.entitlements_snapshot,
            OLD.plan_commitment_snapshot, OLD.payment_due_at, OLD.ipn_accept_until,
           OLD.created_at) THEN
        RAISE EXCEPTION 'Order identity, commercial snapshot and payment cutoffs are immutable';
    END IF;

    IF NEW.order_status IS DISTINCT FROM OLD.order_status AND NOT (
        (OLD.order_status = 'WAITING_SERVICE_TERMS_ACCEPTANCE' AND
            NEW.order_status IN ('WAITING_PAYMENT', 'CANCELLED', 'EXPIRED')) OR
        (OLD.order_status = 'WAITING_PAYMENT' AND
            NEW.order_status IN ('PAYMENT_ACCEPTED', 'CANCELLED', 'EXPIRED')) OR
        (OLD.order_status = 'CANCELLED' AND OLD.auto_cancelled AND
            OLD.service_terms_accepted_at IS NOT NULL AND NEW.order_status = 'PAYMENT_ACCEPTED' AND
            statement_timestamp() < OLD.ipn_accept_until)
    ) THEN
        RAISE EXCEPTION 'Invalid Order status transition: % -> %',
            OLD.order_status, NEW.order_status;
    END IF;

    IF NEW.auto_cancelled IS DISTINCT FROM OLD.auto_cancelled AND NOT (
        NOT OLD.auto_cancelled AND NEW.auto_cancelled AND
        OLD.order_status IN ('WAITING_SERVICE_TERMS_ACCEPTANCE', 'WAITING_PAYMENT') AND
        NEW.order_status = 'CANCELLED' AND statement_timestamp() >= OLD.payment_due_at
    ) THEN
        RAISE EXCEPTION 'Automatic cancellation requires an unpaid overdue Order';
    END IF;

    IF OLD.order_status = 'WAITING_SERVICE_TERMS_ACCEPTANCE' AND
       NEW.order_status IN ('WAITING_PAYMENT', 'CANCELLED') AND
       NOT (NEW.order_status = 'CANCELLED' AND NEW.auto_cancelled) AND
       statement_timestamp() >= OLD.payment_due_at THEN
        RAISE EXCEPTION 'Terms acceptance or cancellation is closed at payment_due_at';
    END IF;

    IF OLD.order_status = 'WAITING_PAYMENT' AND
       NEW.order_status = 'CANCELLED' AND
       NOT NEW.auto_cancelled AND
       statement_timestamp() >= OLD.payment_due_at THEN
        RAISE EXCEPTION 'Order cancellation is closed at payment_due_at';
    END IF;

    IF OLD.order_status = 'WAITING_SERVICE_TERMS_ACCEPTANCE' AND
       NEW.order_status = 'EXPIRED' AND
       statement_timestamp() < OLD.payment_due_at THEN
        RAISE EXCEPTION 'Terms-pending Order cannot expire before payment_due_at';
    END IF;

    IF OLD.order_status = 'WAITING_PAYMENT' AND
       NEW.order_status = 'EXPIRED' AND
       statement_timestamp() < OLD.ipn_accept_until THEN
        RAISE EXCEPTION 'Payment-pending Order cannot expire before ipn_accept_until';
    END IF;

    IF NEW.order_status IS DISTINCT FROM OLD.order_status THEN
        CASE NEW.order_status
            WHEN 'WAITING_PAYMENT' THEN
                NEW.service_terms_accepted_at := statement_timestamp();
            WHEN 'PAYMENT_ACCEPTED' THEN
                NEW.payment_accepted_at := statement_timestamp();
            WHEN 'CANCELLED' THEN
                NEW.cancelled_at := statement_timestamp();
            WHEN 'EXPIRED' THEN
                NEW.expired_at := statement_timestamp();
            ELSE
                NULL;
        END CASE;
    END IF;

    IF OLD.service_terms_accepted_at IS NOT NULL AND
       NEW.service_terms_accepted_at IS DISTINCT FROM OLD.service_terms_accepted_at THEN
        RAISE EXCEPTION 'Accepted Service Terms timestamp is immutable';
    END IF;

    IF OLD.service_terms_accepted_at IS NULL AND NEW.service_terms_accepted_at IS NOT NULL AND NOT (
        OLD.order_status = 'WAITING_SERVICE_TERMS_ACCEPTANCE' AND
        NEW.order_status = 'WAITING_PAYMENT'
    ) THEN
        RAISE EXCEPTION 'Service Terms may be accepted only on WAITING_SERVICE_TERMS_ACCEPTANCE -> WAITING_PAYMENT';
    END IF;

    IF OLD.payment_accepted_at IS NOT NULL AND
       NEW.payment_accepted_at IS DISTINCT FROM OLD.payment_accepted_at THEN
        RAISE EXCEPTION 'Accepted payment timestamp is immutable';
    END IF;

    IF OLD.payment_accepted_at IS NULL AND NEW.payment_accepted_at IS NOT NULL AND NOT (
        (OLD.order_status = 'WAITING_PAYMENT' OR (OLD.order_status = 'CANCELLED' AND OLD.auto_cancelled))
        AND NEW.order_status = 'PAYMENT_ACCEPTED'
    ) THEN
        RAISE EXCEPTION 'Payment may be accepted only on WAITING_PAYMENT -> PAYMENT_ACCEPTED';
    END IF;

    IF OLD.cancelled_at IS NOT NULL AND NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at THEN
        RAISE EXCEPTION 'Order cancellation timestamp is immutable';
    END IF;

    IF OLD.expired_at IS NOT NULL AND NEW.expired_at IS DISTINCT FROM OLD.expired_at THEN
        RAISE EXCEPTION 'Order expiry timestamp is immutable';
    END IF;

    NEW.updated_at := statement_timestamp();

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION guard_payment_attempt_identity_and_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_late_success BOOLEAN := FALSE;
BEGIN
    IF ROW(NEW.id, NEW.order_id, NEW.attempt_no, NEW.provider_reference,
           NEW.amount_vnd, NEW.expires_at, NEW.created_at)
       IS DISTINCT FROM
       ROW(OLD.id, OLD.order_id, OLD.attempt_no, OLD.provider_reference,
           OLD.amount_vnd, OLD.expires_at, OLD.created_at) THEN
        RAISE EXCEPTION 'PaymentAttempt identity, amount and checkout window are immutable';
    END IF;

    IF OLD.status IN ('EXPIRED', 'SUPERSEDED') AND NEW.status = 'SUCCEEDED' THEN
        SELECT EXISTS (
            SELECT 1
            FROM payment_transactions pt
            JOIN orders o ON o.id = pt.fulfillment_order_id
            WHERE pt.fulfillment_payment_attempt_id = OLD.id
              AND pt.fulfillment_order_id = OLD.order_id
              AND (o.order_status = 'WAITING_PAYMENT' OR (o.order_status = 'CANCELLED' AND o.auto_cancelled))
              AND payment_effective_time(pt) >= o.service_terms_accepted_at
              AND payment_effective_time(pt) >= OLD.created_at
              AND payment_effective_time(pt) < OLD.expires_at
              AND payment_effective_time(pt) < o.payment_due_at
              AND pt.received_at < o.ipn_accept_until
              AND (OLD.status <> 'SUPERSEDED' OR
                   payment_effective_time(pt) < OLD.superseded_at)
        ) INTO v_late_success;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        NEW.succeeded_at := NULL;
        NEW.failed_at := NULL;
        NEW.expired_at := NULL;
        NEW.superseded_at := NULL;

        CASE NEW.status
            WHEN 'SUCCEEDED' THEN
                NEW.succeeded_at := statement_timestamp();
            WHEN 'FAILED' THEN
                NEW.failed_at := statement_timestamp();
            WHEN 'EXPIRED' THEN
                NEW.expired_at := statement_timestamp();
            WHEN 'SUPERSEDED' THEN
                NEW.superseded_at := statement_timestamp();
            ELSE
                NULL;
        END CASE;

        IF v_late_success THEN
            NEW.corrected_from_status := OLD.status;
            NEW.correction_boundary_at := CASE
                WHEN OLD.status = 'EXPIRED' THEN OLD.expires_at
                ELSE OLD.superseded_at
            END;
        ELSIF NEW.corrected_from_status IS NOT NULL OR
              NEW.correction_boundary_at IS NOT NULL THEN
            RAISE EXCEPTION 'Correction provenance is reserved for evidence-backed late success';
        END IF;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
        (OLD.status = 'PENDING' AND
            NEW.status IN ('SUCCEEDED', 'FAILED', 'EXPIRED', 'SUPERSEDED')) OR
        v_late_success
    ) THEN
        RAISE EXCEPTION 'Invalid PaymentAttempt status transition: % -> %',
            OLD.status, NEW.status;
    END IF;

    IF OLD.status <> 'PENDING' AND NOT v_late_success AND
       ROW(NEW.status, NEW.succeeded_at, NEW.failed_at, NEW.expired_at,
           NEW.superseded_at, NEW.corrected_from_status, NEW.correction_boundary_at)
       IS DISTINCT FROM
       ROW(OLD.status, OLD.succeeded_at, OLD.failed_at, OLD.expired_at,
           OLD.superseded_at, OLD.corrected_from_status, OLD.correction_boundary_at) THEN
        RAISE EXCEPTION 'Terminal PaymentAttempt is immutable';
    END IF;

    IF OLD.status = 'PENDING' AND NEW.status = 'EXPIRED' AND
       statement_timestamp() < OLD.expires_at THEN
        RAISE EXCEPTION 'PaymentAttempt cannot expire before expires_at';
    END IF;

    IF OLD.status = 'PENDING' AND NEW.status = 'SUPERSEDED' AND
       statement_timestamp() >= OLD.expires_at THEN
        RAISE EXCEPTION 'Expired PaymentAttempt cannot be superseded';
    END IF;

    NEW.updated_at := statement_timestamp();

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_payment_fulfillment_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_order_status VARCHAR(40);
    v_auto_cancelled BOOLEAN;
    v_service_terms_accepted_at TIMESTAMPTZ;
    v_payment_due_at TIMESTAMPTZ;
    v_ipn_accept_until TIMESTAMPTZ;
    v_attempt_status VARCHAR(30);
    v_attempt_created_at TIMESTAMPTZ;
    v_attempt_expires_at TIMESTAMPTZ;
    v_attempt_superseded_at TIMESTAMPTZ;
    v_new_effect BOOLEAN;
    v_old_effect BOOLEAN;
    v_effect_link_changed BOOLEAN;
BEGIN
    v_new_effect := NEW.classification = 'MATCHED' OR
                    COALESCE(NEW.review_resolution IN ('ACCEPT_AND_FULFILL', 'REMATCHED'), FALSE);
    v_old_effect := FALSE;
    v_effect_link_changed := TRUE;
    IF TG_OP = 'UPDATE' THEN
        v_old_effect := OLD.classification = 'MATCHED' OR
                        COALESCE(OLD.review_resolution IN ('ACCEPT_AND_FULFILL', 'REMATCHED'), FALSE);
        v_effect_link_changed := NEW.order_id IS DISTINCT FROM OLD.order_id OR
                                 NEW.payment_attempt_id IS DISTINCT FROM OLD.payment_attempt_id;
    END IF;

    IF v_new_effect AND (NOT v_old_effect OR v_effect_link_changed) THEN
        SELECT o.order_status, o.auto_cancelled, o.service_terms_accepted_at, o.payment_due_at, o.ipn_accept_until,
               pa.status, pa.created_at, pa.expires_at, pa.superseded_at
        INTO v_order_status, v_auto_cancelled, v_service_terms_accepted_at, v_payment_due_at, v_ipn_accept_until,
             v_attempt_status, v_attempt_created_at, v_attempt_expires_at,
             v_attempt_superseded_at
        FROM orders o
        JOIN payment_attempts pa
          ON pa.id = NEW.payment_attempt_id AND pa.order_id = o.id
        WHERE o.id = NEW.order_id
        FOR UPDATE OF o, pa;

        IF NOT FOUND OR NOT (v_order_status = 'WAITING_PAYMENT' OR (v_order_status = 'CANCELLED' AND v_auto_cancelled)) OR
           v_service_terms_accepted_at IS NULL OR
           v_attempt_status NOT IN ('PENDING', 'EXPIRED', 'SUPERSEDED') THEN
            RAISE EXCEPTION 'Payment fulfillment requires an eligible attempt on a terms-accepted WAITING_PAYMENT Order';
        END IF;

        IF payment_effective_time(NEW) < v_service_terms_accepted_at OR
           payment_effective_time(NEW) < v_attempt_created_at OR
           payment_effective_time(NEW) >= v_payment_due_at OR
           payment_effective_time(NEW) >= v_attempt_expires_at OR
           (v_attempt_status = 'SUPERSEDED' AND
                payment_effective_time(NEW) >= v_attempt_superseded_at) OR
           NEW.received_at >= v_ipn_accept_until THEN
            RAISE EXCEPTION 'Payment provider occurrence time is outside the accepted checkout window';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;

