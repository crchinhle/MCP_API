-- License Management — account-linked Customer, relayer-only blockchain schema v7.3
-- PostgreSQL 15+
-- Target baseline reviewed 17/09/2026.
-- This target schema has 18 tables. Customer accounts are retained; Customer Controller/KMS are removed.
-- Smart-contract policy/ABI is authoritative for License/Device rights.
-- PostgreSQL owns private identity/catalog/commerce/audit plus chain projection/evidence.
-- Global License Terms content is a versioned application artefact, not a DB table.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Login identity for internal users and Customers.
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL,
    status VARCHAR(40) NOT NULL,
    customer_type VARCHAR(20),
    email_verified_at TIMESTAMPTZ,
    session_version INT NOT NULL DEFAULT 1,
    organization_name VARCHAR(255),
    representative_name VARCHAR(255),
    tax_code VARCHAR(50),
    phone VARCHAR(30),
    address TEXT,
    provider_chain_address VARCHAR(42),
    provider_chain_namespace CITEXT,
    failed_login_count INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_users_role CHECK (
        role IN ('SYSTEM_ADMIN', 'PROVIDER_ADMIN', 'CUSTOMER', 'SUPPORT_STAFF')
    ),
    CONSTRAINT uq_users_id_role UNIQUE (id, role),
    CONSTRAINT ck_users_status CHECK (
        status IN ('PENDING_EMAIL_VERIFICATION', 'ACTIVE', 'LOCKED', 'DISABLED')
    ),
    CONSTRAINT ck_users_session_version CHECK (session_version > 0),
    CONSTRAINT ck_users_provider_fields CHECK (
        (role = 'PROVIDER_ADMIN' AND organization_name IS NOT NULL AND
            provider_chain_address IS NOT NULL AND provider_chain_namespace IS NOT NULL) OR
        (role <> 'PROVIDER_ADMIN' AND provider_chain_address IS NULL AND provider_chain_namespace IS NULL)
    ),
    CONSTRAINT ck_users_customer_fields CHECK (
        (role = 'CUSTOMER' AND customer_type IN ('INDIVIDUAL', 'STUDENT', 'BUSINESS')) OR
        (role <> 'CUSTOMER' AND customer_type IS NULL)
    ),
    CONSTRAINT ck_users_email_verification CHECK (
        (role = 'CUSTOMER' AND status = 'PENDING_EMAIL_VERIFICATION' AND email_verified_at IS NULL) OR
        (role = 'CUSTOMER' AND status <> 'PENDING_EMAIL_VERIFICATION' AND email_verified_at IS NOT NULL) OR
        (role <> 'CUSTOMER' AND status <> 'PENDING_EMAIL_VERIFICATION')
    ),
    CONSTRAINT ck_users_provider_address CHECK (
        provider_chain_address IS NULL OR provider_chain_address ~ '^0x[0-9a-f]{40}$'
    ),
    CONSTRAINT ck_users_login_counters CHECK (failed_login_count >= 0),
    CONSTRAINT uq_users_provider_identity UNIQUE (id, role, provider_chain_address, provider_chain_namespace)
);

CREATE UNIQUE INDEX uq_users_provider_chain_address
    ON users (lower(provider_chain_address)) WHERE provider_chain_address IS NOT NULL;
CREATE UNIQUE INDEX uq_users_provider_chain_namespace
    ON users (provider_chain_namespace) WHERE provider_chain_namespace IS NOT NULL;

-- 2. Provider-scoped Product.
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_user_id UUID NOT NULL,
    provider_role VARCHAR(30) GENERATED ALWAYS AS ('PROVIDER_ADMIN') STORED,
    code CITEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_products_provider
        FOREIGN KEY (provider_user_id, provider_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT uq_products_provider_code UNIQUE (provider_user_id, code),
    CONSTRAINT uq_products_id_provider UNIQUE (id, provider_user_id),
    CONSTRAINT ck_products_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT ck_products_publish CHECK (
        (status = 'DRAFT' AND published_at IS NULL) OR
        (status IN ('PUBLISHED', 'ARCHIVED') AND published_at IS NOT NULL)
    )
);

-- 3. Published Plan is immutable at application level. A changed rights set
-- creates a new version row. Service Terms are platform content, not Plan data.
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    provider_user_id UUID NOT NULL,
    provider_role VARCHAR(30) GENERATED ALWAYS AS ('PROVIDER_ADMIN') STORED,
    code CITEXT NOT NULL,
    version INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    billing_cycle VARCHAR(20) NOT NULL,
    duration_months INT NOT NULL,
    price_vnd BIGINT NOT NULL,
    max_active_devices INT NOT NULL,
    entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
    plan_commitment BYTEA NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_plans_product
        FOREIGN KEY (product_id, provider_user_id)
        REFERENCES products(id, provider_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_plans_provider
        FOREIGN KEY (provider_user_id, provider_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT uq_plans_product_code_version UNIQUE (product_id, code, version),
    CONSTRAINT uq_plans_id_provider UNIQUE (id, provider_user_id),
    CONSTRAINT uq_plans_id_product_provider_commitment
        UNIQUE (id, product_id, provider_user_id, plan_commitment),
    CONSTRAINT ck_plans_version CHECK (version > 0),
    CONSTRAINT ck_plans_billing_cycle CHECK (billing_cycle IN ('MONTHLY', 'YEARLY')),
    CONSTRAINT ck_plans_duration CHECK (
        (billing_cycle = 'MONTHLY' AND duration_months = 1) OR
        (billing_cycle = 'YEARLY' AND duration_months = 12)
    ),
    CONSTRAINT ck_plans_values CHECK (price_vnd > 0 AND max_active_devices > 0),
    CONSTRAINT ck_plans_entitlements CHECK (jsonb_typeof(entitlements) = 'object'),
    CONSTRAINT ck_plans_hashes CHECK (octet_length(plan_commitment) = 32),
    CONSTRAINT ck_plans_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT ck_plans_publish CHECK (
        (status = 'DRAFT' AND published_at IS NULL) OR
        (status IN ('PUBLISHED', 'ARCHIVED') AND published_at IS NOT NULL)
    )
);

-- 4. Customer-owned commerce order.
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) NOT NULL UNIQUE,
    idempotency_key UUID NOT NULL,
    customer_user_id UUID NOT NULL,
    customer_role VARCHAR(30) GENERATED ALWAYS AS ('CUSTOMER') STORED,
    provider_user_id UUID NOT NULL,
    provider_role VARCHAR(30) GENERATED ALWAYS AS ('PROVIDER_ADMIN') STORED,
    product_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    target_license_id UUID,
    order_type VARCHAR(20) NOT NULL,
    order_status VARCHAR(40) NOT NULL DEFAULT 'WAITING_SERVICE_TERMS_ACCEPTANCE',
    provider_name_snapshot VARCHAR(255) NOT NULL,
    product_name_snapshot VARCHAR(255) NOT NULL,
    plan_name_snapshot VARCHAR(255) NOT NULL,
    plan_version_snapshot INT NOT NULL,
    price_vnd_snapshot BIGINT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'VND',
    billing_cycle_snapshot VARCHAR(20) NOT NULL,
    duration_months_snapshot INT NOT NULL,
    max_active_devices_snapshot INT NOT NULL,
    entitlements_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    plan_commitment_snapshot BYTEA NOT NULL,
    payment_due_at TIMESTAMPTZ NOT NULL,
    ipn_accept_until TIMESTAMPTZ NOT NULL,
    service_terms_accepted_at TIMESTAMPTZ,
    service_terms_version_snapshot VARCHAR(40),
    service_terms_hash_snapshot CHAR(64),
    service_terms_content_snapshot TEXT,
    payment_accepted_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_orders_provider
        FOREIGN KEY (provider_user_id, provider_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_user_id, customer_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_product
        FOREIGN KEY (product_id, provider_user_id)
        REFERENCES products(id, provider_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_plan
        FOREIGN KEY (plan_id, product_id, provider_user_id, plan_commitment_snapshot)
        REFERENCES plans(id, product_id, provider_user_id, plan_commitment) ON DELETE RESTRICT,
    CONSTRAINT uq_orders_id_provider UNIQUE (id, provider_user_id),
    CONSTRAINT uq_orders_id_customer UNIQUE (id, customer_user_id),
    CONSTRAINT uq_orders_id_price UNIQUE (id, price_vnd_snapshot),
    CONSTRAINT uq_orders_customer_idempotency UNIQUE (customer_user_id, idempotency_key),
    CONSTRAINT uq_orders_id_provider_customer_target_type
        UNIQUE (id, provider_user_id, customer_user_id, target_license_id, order_type),
    CONSTRAINT uq_orders_id_provider_target_type
        UNIQUE (id, provider_user_id, target_license_id, order_type),
    CONSTRAINT uq_orders_origin_license_shape
        UNIQUE (id, provider_user_id, customer_user_id, product_id, plan_id,
                plan_commitment_snapshot, order_type),
    CONSTRAINT ck_orders_type CHECK (order_type IN ('NEW_PURCHASE', 'RENEWAL')),
    CONSTRAINT ck_orders_status CHECK (
        order_status IN ('WAITING_SERVICE_TERMS_ACCEPTANCE', 'WAITING_PAYMENT', 'PAYMENT_ACCEPTED', 'CANCELLED', 'EXPIRED')
    ),
    CONSTRAINT ck_orders_snapshots CHECK (
        plan_version_snapshot > 0 AND price_vnd_snapshot > 0 AND currency = 'VND' AND
        duration_months_snapshot > 0 AND max_active_devices_snapshot > 0 AND
        octet_length(plan_commitment_snapshot) = 32 AND payment_due_at > created_at AND
        ipn_accept_until > payment_due_at
    ),
    CONSTRAINT ck_orders_entitlements_snapshot CHECK (
        jsonb_typeof(entitlements_snapshot) = 'object'
    ),
    CONSTRAINT ck_orders_terms_gate CHECK (
        (order_status = 'WAITING_SERVICE_TERMS_ACCEPTANCE' AND service_terms_accepted_at IS NULL) OR
        (order_status IN ('WAITING_PAYMENT', 'PAYMENT_ACCEPTED') AND service_terms_accepted_at IS NOT NULL) OR
        order_status IN ('CANCELLED', 'EXPIRED')
    ),
    CONSTRAINT ck_orders_terms_snapshot CHECK (
        (service_terms_version_snapshot IS NULL
            AND service_terms_hash_snapshot IS NULL
            AND service_terms_content_snapshot IS NULL) OR
        (service_terms_version_snapshot IS NOT NULL
            AND service_terms_hash_snapshot ~ '^[0-9a-f]{64}$'
            AND service_terms_content_snapshot IS NOT NULL
            AND btrim(service_terms_content_snapshot) <> '')
    ),
    CONSTRAINT ck_orders_payment_gate CHECK (
        (order_status = 'PAYMENT_ACCEPTED' AND payment_accepted_at IS NOT NULL) OR
        (order_status <> 'PAYMENT_ACCEPTED' AND payment_accepted_at IS NULL)
    ),
    auto_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT ck_orders_auto_cancelled CHECK (NOT auto_cancelled OR
        (cancelled_at IS NOT NULL AND cancelled_at >= payment_due_at AND order_status IN ('CANCELLED', 'PAYMENT_ACCEPTED'))),
    CONSTRAINT ck_orders_cancelled CHECK (
        (order_status = 'CANCELLED' AND cancelled_at IS NOT NULL AND expired_at IS NULL AND
            payment_accepted_at IS NULL) OR
        (order_status = 'EXPIRED' AND expired_at IS NOT NULL AND cancelled_at IS NULL AND
            payment_accepted_at IS NULL) OR
        (order_status NOT IN ('CANCELLED', 'EXPIRED') AND expired_at IS NULL AND
            (cancelled_at IS NULL OR (auto_cancelled AND order_status = 'PAYMENT_ACCEPTED')))
    ),
    CONSTRAINT ck_orders_renewal_shape CHECK (
        (order_type = 'NEW_PURCHASE' AND target_license_id IS NULL) OR
        (order_type = 'RENEWAL' AND target_license_id IS NOT NULL)
    )
);

-- Every Order enters through the same Terms gate. Import/seed paths must not
-- bypass the lifecycle by inserting a later or terminal state directly.
CREATE FUNCTION enforce_order_initial_state()
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

CREATE TRIGGER trg_orders_initial_state
BEFORE INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION enforce_order_initial_state();

-- Commercial identity, Plan snapshot and payment cutoffs are immutable.
-- Only the explicit Order state graph may change lifecycle timestamps.
CREATE FUNCTION guard_order_snapshot_and_lifecycle()
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
           NEW.created_at,
           NEW.service_terms_version_snapshot, NEW.service_terms_hash_snapshot,
           NEW.service_terms_content_snapshot)
       IS DISTINCT FROM
       ROW(OLD.id, OLD.order_number, OLD.idempotency_key,
           OLD.customer_user_id, OLD.provider_user_id, OLD.product_id, OLD.plan_id,
           OLD.target_license_id, OLD.order_type,
           OLD.provider_name_snapshot, OLD.product_name_snapshot, OLD.plan_name_snapshot,
           OLD.plan_version_snapshot, OLD.price_vnd_snapshot, OLD.currency,
           OLD.billing_cycle_snapshot, OLD.duration_months_snapshot,
            OLD.max_active_devices_snapshot, OLD.entitlements_snapshot,
            OLD.plan_commitment_snapshot, OLD.payment_due_at, OLD.ipn_accept_until,
           OLD.created_at,
           OLD.service_terms_version_snapshot, OLD.service_terms_hash_snapshot,
           OLD.service_terms_content_snapshot) THEN
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

CREATE TRIGGER trg_orders_immutable_snapshot
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION guard_order_snapshot_and_lifecycle();

-- 5. Checkout attempts are independent from durable provider transaction events.
CREATE TABLE payment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    attempt_no INT NOT NULL,
    provider_reference VARCHAR(160) NOT NULL UNIQUE,
    amount_vnd BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMPTZ NOT NULL,
    succeeded_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    superseded_at TIMESTAMPTZ,
    corrected_from_status VARCHAR(30),
    correction_boundary_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_payment_attempts_order_amount
        FOREIGN KEY (order_id, amount_vnd)
        REFERENCES orders(id, price_vnd_snapshot) ON DELETE RESTRICT,
    CONSTRAINT uq_payment_attempts_id_order UNIQUE (id, order_id),
    CONSTRAINT uq_payment_attempts_fulfillment_match UNIQUE (id, order_id, amount_vnd),
    CONSTRAINT uq_payment_attempts_order_no UNIQUE (order_id, attempt_no),
    CONSTRAINT ck_payment_attempts_values CHECK (
        attempt_no > 0 AND amount_vnd > 0 AND expires_at > created_at AND
        btrim(provider_reference) <> ''
    ),
    CONSTRAINT ck_payment_attempts_status CHECK (
        status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'SUPERSEDED')
    ),
    CONSTRAINT ck_payment_attempts_terminal_stamp CHECK (
        (status = 'PENDING' AND succeeded_at IS NULL AND failed_at IS NULL AND
            expired_at IS NULL AND superseded_at IS NULL) OR
        (status = 'SUCCEEDED' AND succeeded_at IS NOT NULL AND failed_at IS NULL AND
            expired_at IS NULL AND superseded_at IS NULL) OR
        (status = 'FAILED' AND succeeded_at IS NULL AND failed_at IS NOT NULL AND
            expired_at IS NULL AND superseded_at IS NULL) OR
        (status = 'EXPIRED' AND succeeded_at IS NULL AND failed_at IS NULL AND
            expired_at IS NOT NULL AND superseded_at IS NULL) OR
        (status = 'SUPERSEDED' AND succeeded_at IS NULL AND failed_at IS NULL AND
            expired_at IS NULL AND superseded_at IS NOT NULL)
    ),
    CONSTRAINT ck_payment_attempts_correction_provenance CHECK (
        (corrected_from_status IS NULL AND correction_boundary_at IS NULL) OR
        (status = 'SUCCEEDED' AND
            corrected_from_status IN ('EXPIRED', 'SUPERSEDED') AND
            correction_boundary_at IS NOT NULL AND
            (corrected_from_status <> 'EXPIRED' OR correction_boundary_at = expires_at))
    )
);

CREATE FUNCTION guard_payment_attempt_identity_and_lifecycle()
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

CREATE TRIGGER trg_payment_attempts_immutable
BEFORE UPDATE ON payment_attempts
FOR EACH ROW EXECUTE FUNCTION guard_payment_attempt_identity_and_lifecycle();

-- 6. Every authenticated SePay/IPN payload normalized to a stable provider event is
-- durable and idempotent; normalized semantic anomalies can be reviewed.
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_event_id VARCHAR(180) NOT NULL UNIQUE,
    provider_transaction_ref VARCHAR(180),
    order_id UUID,
    payment_attempt_id UUID,
    amount_minor BIGINT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'VND',
    classification VARCHAR(40) NOT NULL,
    review_status VARCHAR(30),
    review_reason TEXT,
    review_resolution VARCHAR(30),
    effect_transaction_id UUID GENERATED ALWAYS AS (
        CASE
            WHEN classification = 'MATCHED' OR
                 review_resolution IN ('ACCEPT_AND_FULFILL', 'REMATCHED') THEN id
            ELSE NULL
        END
    ) STORED,
    fulfillment_order_id UUID GENERATED ALWAYS AS (
        CASE
            WHEN classification = 'MATCHED' OR
                 review_resolution IN ('ACCEPT_AND_FULFILL', 'REMATCHED') THEN order_id
            ELSE NULL
        END
    ) STORED,
    fulfillment_payment_attempt_id UUID GENERATED ALWAYS AS (
        CASE
            WHEN classification = 'MATCHED' OR
                 review_resolution IN ('ACCEPT_AND_FULFILL', 'REMATCHED') THEN payment_attempt_id
            ELSE NULL
        END
    ) STORED,
    fulfillment_amount_vnd BIGINT GENERATED ALWAYS AS (
        CASE
            WHEN classification = 'MATCHED' OR
                 review_resolution IN ('ACCEPT_AND_FULFILL', 'REMATCHED') THEN amount_minor
            ELSE NULL
        END
    ) STORED,
    duplicate_of_transaction_id UUID,
    raw_payload JSONB NOT NULL,
    provider_occurred_at TIMESTAMPTZ NOT NULL,
    timing_basis VARCHAR(30) NOT NULL DEFAULT 'PROVIDER'
        CHECK (timing_basis IN ('PROVIDER', 'SANDBOX_RECEIPT')),
    received_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
    reviewed_by_user_id UUID,
    reviewed_by_role VARCHAR(30) GENERATED ALWAYS AS (
        CASE WHEN reviewed_by_user_id IS NULL THEN NULL ELSE 'SYSTEM_ADMIN' END
    ) STORED,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_payment_transactions_order
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
    CONSTRAINT fk_payment_transactions_attempt_order
        FOREIGN KEY (payment_attempt_id, order_id)
        REFERENCES payment_attempts(id, order_id) ON DELETE RESTRICT,
    CONSTRAINT fk_payment_transactions_reviewer
        FOREIGN KEY (reviewed_by_user_id, reviewed_by_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT fk_payment_transactions_duplicate_of
        FOREIGN KEY (duplicate_of_transaction_id, order_id, payment_attempt_id, amount_minor, currency)
        REFERENCES payment_transactions(effect_transaction_id, order_id, payment_attempt_id,
                                        amount_minor, currency)
        ON DELETE RESTRICT,
    CONSTRAINT fk_payment_transactions_fulfillment_amount
        FOREIGN KEY (fulfillment_payment_attempt_id, fulfillment_order_id, fulfillment_amount_vnd)
        REFERENCES payment_attempts(id, order_id, amount_vnd) ON DELETE RESTRICT,
    CONSTRAINT uq_payment_transactions_effect_link
        UNIQUE (effect_transaction_id, order_id, payment_attempt_id, amount_minor, currency),
    CONSTRAINT uq_payment_transactions_fulfillment_order UNIQUE (fulfillment_order_id),
    CONSTRAINT ck_payment_transactions_amount CHECK (
        amount_minor > 0 AND currency ~ '^[A-Z]{3}$' AND btrim(provider_event_id) <> '' AND
        (provider_transaction_ref IS NULL OR btrim(provider_transaction_ref) <> '')
    ),
    CONSTRAINT ck_payment_transactions_payload CHECK (jsonb_typeof(raw_payload) = 'object'),
    CONSTRAINT ck_payment_transactions_classification CHECK (
        classification IN ('MATCHED', 'DUPLICATE', 'UNMATCHED', 'AMOUNT_MISMATCH', 'INVALID')
    ),
    CONSTRAINT ck_payment_transactions_review CHECK (
        review_status IS NULL OR review_status IN ('OPEN', 'RESOLVED', 'CLOSED_NO_ACTION')
    ),
    CONSTRAINT ck_payment_transactions_review_resolution CHECK (
        review_resolution IS NULL OR review_resolution IN (
            'ACCEPT_AND_FULFILL', 'REFUND_CONFIRMED', 'REMATCHED', 'NO_ACTION'
        )
    ),
    CONSTRAINT ck_payment_transactions_review_state CHECK (
        (classification IN ('MATCHED', 'DUPLICATE') AND review_status IS NULL AND
            review_reason IS NULL AND review_resolution IS NULL AND
            reviewed_by_user_id IS NULL AND reviewed_at IS NULL) OR
        (classification = 'MATCHED' AND review_status = 'OPEN' AND
            review_reason IS NOT NULL AND btrim(review_reason) <> '' AND
            review_resolution IS NULL AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL) OR
        (classification = 'MATCHED' AND review_status = 'RESOLVED' AND
            review_resolution = 'REFUND_CONFIRMED' AND
            reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND
            review_reason IS NOT NULL AND btrim(review_reason) <> '') OR
        (classification = 'MATCHED' AND review_status = 'CLOSED_NO_ACTION' AND
            review_resolution = 'NO_ACTION' AND
            reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND
            review_reason IS NOT NULL AND btrim(review_reason) <> '') OR
        (classification IN ('UNMATCHED', 'AMOUNT_MISMATCH', 'INVALID') AND
            review_status IS NOT NULL AND review_status = 'OPEN' AND
            review_reason IS NOT NULL AND btrim(review_reason) <> '' AND review_resolution IS NULL AND
            reviewed_by_user_id IS NULL AND reviewed_at IS NULL) OR
        (classification IN ('UNMATCHED', 'INVALID') AND
            review_status IS NOT NULL AND review_status = 'RESOLVED' AND
            review_resolution IS NOT NULL AND
            review_resolution IN ('ACCEPT_AND_FULFILL', 'REFUND_CONFIRMED', 'REMATCHED') AND
            reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND
            review_reason IS NOT NULL AND btrim(review_reason) <> '') OR
        (classification = 'AMOUNT_MISMATCH' AND review_status = 'RESOLVED' AND
            review_resolution IN ('REFUND_CONFIRMED', 'REMATCHED') AND
            reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND
            review_reason IS NOT NULL AND btrim(review_reason) <> '') OR
        (classification IN ('UNMATCHED', 'AMOUNT_MISMATCH', 'INVALID') AND
            review_status IS NOT NULL AND review_status = 'CLOSED_NO_ACTION' AND
            review_resolution IS NOT NULL AND review_resolution = 'NO_ACTION' AND
            reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND
            review_reason IS NOT NULL AND btrim(review_reason) <> '')
    ),
    CONSTRAINT ck_payment_transactions_linkage CHECK (
        (classification = 'MATCHED' AND currency = 'VND' AND
            order_id IS NOT NULL AND payment_attempt_id IS NOT NULL AND
            duplicate_of_transaction_id IS NULL) OR
        (classification = 'DUPLICATE' AND currency = 'VND' AND
            order_id IS NOT NULL AND payment_attempt_id IS NOT NULL AND
            duplicate_of_transaction_id IS NOT NULL AND duplicate_of_transaction_id <> id) OR
        (classification IN ('UNMATCHED', 'AMOUNT_MISMATCH', 'INVALID') AND
            duplicate_of_transaction_id IS NULL)
    ),
    CONSTRAINT ck_payment_transactions_attempt_order CHECK (
        payment_attempt_id IS NULL OR order_id IS NOT NULL
    ),
    CONSTRAINT ck_payment_transactions_fulfillment_link CHECK (
        (classification <> 'MATCHED' AND
         review_resolution NOT IN ('ACCEPT_AND_FULFILL', 'REMATCHED')) OR
        (currency = 'VND' AND order_id IS NOT NULL AND payment_attempt_id IS NOT NULL AND
         fulfillment_order_id IS NOT NULL AND fulfillment_payment_attempt_id IS NOT NULL AND
         fulfillment_amount_vnd IS NOT NULL)
    )
);

-- Ingress/processing timestamps are owned by PostgreSQL's statement clock.
-- Sandbox receipt timing is an explicit EmuKey test policy, never a provider claim.
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

-- Callers supply provider_occurred_at, but cannot backdate webhook receipt.
CREATE FUNCTION stamp_payment_transaction_ingest()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.review_status IN ('RESOLVED', 'CLOSED_NO_ACTION') THEN
        RAISE EXCEPTION 'A PaymentTransaction cannot enter with a terminal review';
    END IF;

    NEW.received_at := statement_timestamp();
    NEW.created_at := NEW.received_at;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_00_payment_transactions_ingest
BEFORE INSERT ON payment_transactions
FOR EACH ROW EXECUTE FUNCTION stamp_payment_transaction_ingest();

-- 7. Business License projection. While PENDING_ONCHAIN, period_start/expires_at and
-- activation_commitment/version are ISSUE proposals. On an existing License, the active
-- commitment/version stay canonical while pending_* holds the next ROTATE proposal;
-- KEY_ROTATED finality promotes pending atomically. Retry/finality evidence lives in chain tables.
CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_license_id VARCHAR(80) NOT NULL UNIQUE,
    origin_order_id UUID NOT NULL UNIQUE,
    origin_order_type VARCHAR(20) GENERATED ALWAYS AS ('NEW_PURCHASE') STORED,
    provider_user_id UUID NOT NULL,
    provider_role VARCHAR(30) GENERATED ALWAYS AS ('PROVIDER_ADMIN') STORED,
    customer_user_id UUID NOT NULL,
    customer_role VARCHAR(30) GENERATED ALWAYS AS ('CUSTOMER') STORED,
    product_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    plan_commitment BYTEA NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_ONCHAIN',
    period_start TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    max_active_devices INT NOT NULL,
    activation_commitment BYTEA NOT NULL,
    activation_key_version INT NOT NULL DEFAULT 1,
    pending_activation_commitment BYTEA,
    pending_activation_key_version INT,
    pending_activation_command_id UUID,
    activation_key_last4 VARCHAR(4),
    activation_key_trust_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_FINALITY',
    entitlement_version INT NOT NULL DEFAULT 1,
    active_device_count INT NOT NULL DEFAULT 0,
    device_state_version BIGINT NOT NULL DEFAULT 0,
    latest_requested_device_sync_version BIGINT,
    latest_confirmed_device_sync_version BIGINT,
    latest_confirmed_device_count INT,
    device_sync_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    last_applied_chain_event_id UUID,
    suspended_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    status_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_licenses_origin_order
        FOREIGN KEY (origin_order_id, provider_user_id, customer_user_id, product_id,
                     plan_id, plan_commitment, origin_order_type)
        REFERENCES orders(id, provider_user_id, customer_user_id, product_id,
                          plan_id, plan_commitment_snapshot, order_type) ON DELETE RESTRICT,
    CONSTRAINT fk_licenses_provider
        FOREIGN KEY (provider_user_id, provider_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT fk_licenses_customer
        FOREIGN KEY (customer_user_id, customer_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT fk_licenses_product
        FOREIGN KEY (product_id, provider_user_id)
        REFERENCES products(id, provider_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_licenses_plan
        FOREIGN KEY (plan_id, product_id, provider_user_id, plan_commitment)
        REFERENCES plans(id, product_id, provider_user_id, plan_commitment) ON DELETE RESTRICT,
    CONSTRAINT uq_licenses_id_provider UNIQUE (id, provider_user_id),
    CONSTRAINT uq_licenses_id_customer UNIQUE (id, customer_user_id),
    CONSTRAINT uq_licenses_id_provider_customer UNIQUE (id, provider_user_id, customer_user_id),
    CONSTRAINT uq_licenses_renewal_target
        UNIQUE (id, provider_user_id, customer_user_id, product_id, plan_id, plan_commitment),
    CONSTRAINT uq_licenses_id_provider_origin_order
        UNIQUE (id, provider_user_id, origin_order_id),
    CONSTRAINT ck_licenses_status CHECK (
        status IN ('PENDING_ONCHAIN', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED')
    ),
    CONSTRAINT ck_licenses_values CHECK (
        expires_at > period_start AND max_active_devices > 0 AND
        active_device_count >= 0 AND active_device_count <= max_active_devices AND
        device_state_version >= 0 AND entitlement_version > 0 AND
        activation_key_version > 0 AND
        octet_length(plan_commitment) = 32 AND octet_length(activation_commitment) = 32
    ),
    CONSTRAINT ck_licenses_pending_activation CHECK (
        (pending_activation_commitment IS NULL AND pending_activation_key_version IS NULL AND
            pending_activation_command_id IS NULL) OR
        (status <> 'PENDING_ONCHAIN' AND pending_activation_commitment IS NOT NULL AND
            pending_activation_key_version = activation_key_version + 1 AND
            pending_activation_command_id IS NOT NULL AND
            octet_length(pending_activation_commitment) = 32)
    ),
    CONSTRAINT ck_licenses_last4 CHECK (
        activation_key_last4 IS NULL OR activation_key_last4 ~ '^[0-9a-f]{4}$'
    ),
    CONSTRAINT ck_licenses_key_trust CHECK (
        activation_key_trust_status IN ('PENDING_FINALITY', 'TRUSTED', 'UNTRUSTED_REORG') AND
        ((status = 'PENDING_ONCHAIN' AND
            activation_key_trust_status IN ('PENDING_FINALITY', 'UNTRUSTED_REORG')) OR
         (status <> 'PENDING_ONCHAIN' AND
            activation_key_trust_status IN ('TRUSTED', 'UNTRUSTED_REORG')))
    ),
    CONSTRAINT ck_licenses_suspend_stamp CHECK (
        (status = 'SUSPENDED' AND suspended_at IS NOT NULL) OR status <> 'SUSPENDED'
    ),
    CONSTRAINT ck_licenses_revoke_stamp CHECK (
        (status = 'REVOKED' AND revoked_at IS NOT NULL) OR status <> 'REVOKED'
    )
);

-- Renewal order target FK can be declared after License exists.
ALTER TABLE orders
    ADD CONSTRAINT fk_orders_target_license
    FOREIGN KEY (target_license_id, provider_user_id, customer_user_id,
                 product_id, plan_id, plan_commitment_snapshot)
    REFERENCES licenses(id, provider_user_id, customer_user_id,
                        product_id, plan_id, plan_commitment) ON DELETE RESTRICT;

-- 8. Device projection; raw hardware identifiers are prohibited.
CREATE TABLE license_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL,
    device_ref VARCHAR(128) NOT NULL,
    device_signer_address VARCHAR(42) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    binding_generation INT NOT NULL DEFAULT 1,
    activated_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_license_devices_license
        FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE RESTRICT,
    CONSTRAINT uq_license_devices_ref UNIQUE (license_id, device_ref),
    CONSTRAINT uq_license_devices_signer UNIQUE (license_id, device_signer_address),
    CONSTRAINT uq_license_devices_id_license UNIQUE (id, license_id),
    CONSTRAINT ck_license_devices_status CHECK (
        status IN ('ACTIVE', 'REVOKED')
    ),
    CONSTRAINT ck_license_devices_ref CHECK (octet_length(device_ref) BETWEEN 1 AND 128),
    CONSTRAINT ck_license_devices_signer_address CHECK (
        device_signer_address ~ '^0x[0-9a-f]{40}$'
    ),
    CONSTRAINT ck_license_devices_generation CHECK (binding_generation > 0),
    CONSTRAINT ck_license_devices_active_stamp CHECK (
        status <> 'ACTIVE' OR activated_at IS NOT NULL
    ),
    CONSTRAINT ck_license_devices_revoke_stamp CHECK (
        (status = 'REVOKED' AND revoked_at IS NOT NULL) OR status <> 'REVOKED'
    )
);

-- 9. Durable command owner for relayer submit/retry/uncertain broadcast. Sequence,
-- predecessor and basis event define causal order under the per-License admission lock.
CREATE FUNCTION is_bounded_rfc3339_timestamp(
    p_value TEXT,
    p_lower_bound TIMESTAMPTZ,
    p_upper_bound TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_timestamp TIMESTAMPTZ;
BEGIN
    IF p_value IS NULL OR p_lower_bound IS NULL OR p_upper_bound IS NULL OR
       p_value !~
         '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]+)?(Z|[+-]((0[0-9]|1[0-3]):[0-5][0-9]|14:00))$' THEN
        RETURN FALSE;
    END IF;

    BEGIN
        v_timestamp := p_value::TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN
        RETURN FALSE;
    END;

    RETURN v_timestamp BETWEEN p_lower_bound AND p_upper_bound;
END;
$$;

CREATE TABLE chain_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key UUID NOT NULL UNIQUE,
    command_type VARCHAR(40) NOT NULL,
    expected_event_type VARCHAR(40) GENERATED ALWAYS AS (
        CASE command_type
            WHEN 'ISSUE_LICENSE' THEN 'LICENSE_ISSUED'
            WHEN 'RENEW_LICENSE' THEN 'LICENSE_RENEWED'
            WHEN 'SUSPEND_LICENSE' THEN 'LICENSE_SUSPENDED'
            WHEN 'RESUME_LICENSE' THEN 'LICENSE_RESUMED'
            WHEN 'REVOKE_LICENSE' THEN 'LICENSE_REVOKED'
            WHEN 'ROTATE_KEY' THEN 'KEY_ROTATED'
            WHEN 'ACTIVATE_DEVICE' THEN 'DEVICE_ACTIVATED'
            WHEN 'REVOKE_DEVICE' THEN 'DEVICE_REVOKED'
            WHEN 'SYNC_DEVICE_COUNT' THEN 'ACTIVE_DEVICE_COUNT_SYNCED'
        END
    ) STORED,
    provider_user_id UUID NOT NULL,
    order_id UUID,
    license_id UUID NOT NULL,
    license_command_sequence BIGINT NOT NULL,
    predecessor_sequence BIGINT GENERATED ALWAYS AS (
        CASE WHEN license_command_sequence > 1 THEN license_command_sequence - 1 END
    ) STORED,
    predecessor_command_id UUID,
    basis_chain_event_id UUID,
    confirmation_chain_event_id UUID,
    license_device_id UUID,
    issue_order_id UUID GENERATED ALWAYS AS (
        CASE WHEN command_type = 'ISSUE_LICENSE' THEN order_id END
    ) STORED,
    renewal_order_id UUID GENERATED ALWAYS AS (
        CASE WHEN command_type = 'RENEW_LICENSE' THEN order_id END
    ) STORED,
    renewal_order_type VARCHAR(30) GENERATED ALWAYS AS (
        CASE WHEN command_type = 'RENEW_LICENSE' THEN 'RENEWAL' END
    ) STORED,
    network VARCHAR(40) NOT NULL,
    chain_id BIGINT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    payload JSONB NOT NULL,
    payload_hash BYTEA NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    relayer_address VARCHAR(42),
    nonce BIGINT,
    signed_transaction TEXT,
    transaction_hash VARCHAR(66),
    receipt_status VARCHAR(20),
    receipt_block_number BIGINT,
    receipt_block_hash VARCHAR(66),
    receipt_checked_at TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    lease_owner VARCHAR(180),
    lease_expires_at TIMESTAMPTZ,
    last_error TEXT,
    locked_by VARCHAR(120),
    locked_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    resolution_reason TEXT,
    resolved_at TIMESTAMPTZ,
    resolution_evidence_type VARCHAR(40),
    resolution_evidence JSONB,
    superseded_by_command_id UUID,
    replaces_command_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_chain_commands_provider
        FOREIGN KEY (provider_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_chain_commands_order_provider
        FOREIGN KEY (order_id, provider_user_id)
        REFERENCES orders(id, provider_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_chain_commands_license_provider
        FOREIGN KEY (license_id, provider_user_id)
        REFERENCES licenses(id, provider_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_chain_commands_device_license
        FOREIGN KEY (license_device_id, license_id)
        REFERENCES license_devices(id, license_id) ON DELETE RESTRICT,
    CONSTRAINT fk_chain_commands_superseded_by
        FOREIGN KEY (superseded_by_command_id, license_id)
        REFERENCES chain_commands(id, license_id) ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT fk_chain_commands_replaces
        FOREIGN KEY (replaces_command_id, license_id)
        REFERENCES chain_commands(id, license_id) ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT fk_chain_commands_predecessor
        FOREIGN KEY (predecessor_command_id, license_id, predecessor_sequence)
        REFERENCES chain_commands(id, license_id, license_command_sequence) ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT fk_chain_commands_issue_order_license
        FOREIGN KEY (license_id, provider_user_id, issue_order_id)
        REFERENCES licenses(id, provider_user_id, origin_order_id) ON DELETE RESTRICT,
    CONSTRAINT fk_chain_commands_renewal_order_license
        FOREIGN KEY (renewal_order_id, provider_user_id, license_id, renewal_order_type)
        REFERENCES orders(id, provider_user_id, target_license_id, order_type) ON DELETE RESTRICT,
    CONSTRAINT uq_chain_commands_id_provider_license UNIQUE (id, provider_user_id, license_id),
    CONSTRAINT uq_chain_commands_id_license UNIQUE (id, license_id),
    CONSTRAINT uq_chain_commands_id_license_sequence
        UNIQUE (id, license_id, license_command_sequence),
    CONSTRAINT uq_chain_commands_id_license_device UNIQUE (id, license_id, license_device_id),
    CONSTRAINT uq_chain_commands_id_subject_event
        UNIQUE (id, provider_user_id, license_id, expected_event_type),
    CONSTRAINT uq_chain_commands_license_sequence
        UNIQUE (license_id, license_command_sequence),
    CONSTRAINT uq_chain_commands_replaces UNIQUE (replaces_command_id),
    CONSTRAINT uq_chain_commands_event_identity
        UNIQUE (id, provider_user_id, license_id, expected_event_type,
                network, chain_id, contract_address, transaction_hash),
    CONSTRAINT ck_chain_commands_type CHECK (
        command_type IN ('ISSUE_LICENSE', 'RENEW_LICENSE', 'SUSPEND_LICENSE', 'RESUME_LICENSE',
                         'REVOKE_LICENSE', 'ROTATE_KEY', 'ACTIVATE_DEVICE', 'REVOKE_DEVICE', 'SYNC_DEVICE_COUNT')
    ),
    CONSTRAINT ck_chain_commands_status CHECK (
        status IN ('PENDING', 'SUBMITTED', 'SUBMITTED_UNKNOWN', 'CONFIRMED',
                   'RETRYABLE_FAILED', 'DEAD_LETTER', 'ABANDONED', 'SUPERSEDED')
    ),
    CONSTRAINT ck_chain_commands_values CHECK (
        chain_id > 0 AND license_command_sequence > 0 AND attempt_count >= 0 AND
        octet_length(payload_hash) = 32 AND
        network = lower(network) AND
        contract_address ~ '^0x[0-9a-f]{40}$' AND
        (nonce IS NULL OR nonce >= 0) AND
        (relayer_address IS NULL OR relayer_address ~ '^0x[0-9a-f]{40}$') AND
        (signed_transaction IS NULL OR signed_transaction ~ '^0x[0-9a-f]+$') AND
        (receipt_status IS NULL OR receipt_status IN ('PENDING', 'SUCCESS', 'REVERTED')) AND
        (receipt_block_number IS NULL OR receipt_block_number >= 0) AND
        (receipt_block_hash IS NULL OR receipt_block_hash ~ '^0x[0-9a-f]{64}$')
    ),
    CONSTRAINT ck_chain_commands_payload CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT ck_chain_commands_tx_hash CHECK (
        transaction_hash IS NULL OR transaction_hash ~ '^0x[0-9a-f]{64}$'
    ),
    CONSTRAINT ck_chain_commands_sequence CHECK (
        (license_command_sequence = 1 AND predecessor_command_id IS NULL AND
            command_type = 'ISSUE_LICENSE') OR
        (license_command_sequence > 1 AND predecessor_command_id IS NOT NULL AND
            predecessor_command_id <> id)
    ),
    CONSTRAINT ck_chain_commands_basis CHECK (
        (command_type = 'ISSUE_LICENSE' AND basis_chain_event_id IS NULL) OR
        (command_type <> 'ISSUE_LICENSE' AND basis_chain_event_id IS NOT NULL)
    ),
    CONSTRAINT ck_chain_commands_subject CHECK (
        (command_type = 'ISSUE_LICENSE' AND order_id IS NOT NULL AND license_id IS NOT NULL AND license_device_id IS NULL) OR
        (command_type = 'RENEW_LICENSE' AND order_id IS NOT NULL AND license_device_id IS NULL) OR
        (command_type IN ('SUSPEND_LICENSE', 'RESUME_LICENSE', 'REVOKE_LICENSE', 'ROTATE_KEY', 'SYNC_DEVICE_COUNT')
            AND order_id IS NULL AND license_device_id IS NULL) OR
        (command_type IN ('ACTIVATE_DEVICE', 'REVOKE_DEVICE')
            AND order_id IS NULL AND license_device_id IS NOT NULL)
    ),
    CONSTRAINT ck_chain_commands_transaction_evidence CHECK (
        ((relayer_address IS NULL AND nonce IS NULL) OR
         (relayer_address IS NOT NULL AND nonce IS NOT NULL)) AND
        ((signed_transaction IS NULL AND transaction_hash IS NULL) OR
         (signed_transaction IS NOT NULL AND transaction_hash IS NOT NULL AND
          relayer_address IS NOT NULL AND nonce IS NOT NULL)) AND
        (status NOT IN ('SUBMITTED', 'SUBMITTED_UNKNOWN', 'CONFIRMED') OR
         (relayer_address IS NOT NULL AND nonce IS NOT NULL AND
          signed_transaction IS NOT NULL AND transaction_hash IS NOT NULL))
    ),
    CONSTRAINT ck_chain_commands_receipt_evidence CHECK (
        (receipt_status IS NULL AND receipt_block_number IS NULL AND receipt_block_hash IS NULL) OR
        (receipt_status IS NOT NULL AND receipt_status = 'PENDING' AND
            receipt_checked_at IS NOT NULL AND
            transaction_hash IS NOT NULL AND receipt_block_number IS NULL AND receipt_block_hash IS NULL) OR
        (receipt_status IS NOT NULL AND receipt_status IN ('SUCCESS', 'REVERTED') AND
            receipt_checked_at IS NOT NULL AND
            transaction_hash IS NOT NULL AND receipt_block_number IS NOT NULL AND
            receipt_block_hash IS NOT NULL)
    ),
    CONSTRAINT ck_chain_commands_status_evidence CHECK (
        ((status = 'CONFIRMED' AND confirmed_at IS NOT NULL AND
            confirmation_chain_event_id IS NOT NULL) OR
         (status <> 'CONFIRMED' AND confirmed_at IS NULL AND
            confirmation_chain_event_id IS NULL)) AND
        (status NOT IN ('SUBMITTED', 'SUBMITTED_UNKNOWN', 'CONFIRMED') OR
            submitted_at IS NOT NULL) AND
        (confirmed_at IS NULL OR (submitted_at IS NOT NULL AND confirmed_at >= submitted_at)) AND
        (resolved_at IS NULL OR resolved_at >= COALESCE(submitted_at, created_at)) AND
        (receipt_status IS DISTINCT FROM 'REVERTED' OR
            status IN ('DEAD_LETTER', 'ABANDONED', 'SUPERSEDED')) AND
        (status <> 'CONFIRMED' OR receipt_status IS DISTINCT FROM 'REVERTED') AND
        ((status = 'ABANDONED' AND resolved_at IS NOT NULL AND
            resolution_reason IS NOT NULL AND btrim(resolution_reason) <> '' AND
            superseded_by_command_id IS NULL) OR
         (status = 'SUPERSEDED' AND resolved_at IS NOT NULL AND
            resolution_reason IS NOT NULL AND btrim(resolution_reason) <> '' AND
            superseded_by_command_id IS NOT NULL AND superseded_by_command_id <> id) OR
         (status NOT IN ('ABANDONED', 'SUPERSEDED') AND resolved_at IS NULL AND
            resolution_reason IS NULL AND superseded_by_command_id IS NULL))
    ),
    CONSTRAINT ck_chain_commands_lock_shape CHECK (
        (locked_by IS NULL AND locked_at IS NULL) OR
        (locked_by IS NOT NULL AND locked_at IS NOT NULL)
    ),
    CONSTRAINT ck_chain_commands_replacement_shape CHECK (
        replaces_command_id IS NULL OR replaces_command_id <> id
    ),
    CONSTRAINT ck_chain_commands_issue_replacement CHECK (
        command_type <> 'ISSUE_LICENSE' OR
        (license_command_sequence = 1 AND replaces_command_id IS NULL) OR
        (license_command_sequence > 1 AND replaces_command_id IS NOT NULL)
    ),
    CONSTRAINT ck_chain_commands_resolution_evidence CHECK (
        (status NOT IN ('ABANDONED', 'SUPERSEDED') AND
            resolution_evidence_type IS NULL AND resolution_evidence IS NULL) OR
        (status IN ('ABANDONED', 'SUPERSEDED') AND
            resolution_evidence_type IN (
                'PRE_SUBMISSION_ABORT', 'NONCE_RESERVATION_RELEASED',
                'RECEIPT_REVERTED', 'RAW_TX_IRREVOCABLE_NO_EFFECT'
            ) AND
            resolution_evidence IS NOT NULL AND
            jsonb_typeof(resolution_evidence) = 'object' AND
            resolution_evidence <> '{}'::jsonb AND
            is_bounded_rfc3339_timestamp(
                resolution_evidence->>'checkedAt',
                GREATEST(created_at, submitted_at, receipt_checked_at),
                resolved_at
            ) AND
            ((resolution_evidence_type = 'PRE_SUBMISSION_ABORT' AND
                relayer_address IS NULL AND nonce IS NULL AND
                signed_transaction IS NULL AND transaction_hash IS NULL AND
                resolution_evidence ?& ARRAY['reasonCode', 'checkedAt'] AND
                jsonb_typeof(resolution_evidence->'reasonCode') = 'string' AND
                btrim(resolution_evidence->>'reasonCode') <> '' AND
                jsonb_typeof(resolution_evidence->'checkedAt') = 'string' AND
                resolution_evidence->>'checkedAt' ~
                    '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$') OR
             (resolution_evidence_type = 'NONCE_RESERVATION_RELEASED' AND
                relayer_address IS NOT NULL AND nonce IS NOT NULL AND
                signed_transaction IS NULL AND transaction_hash IS NULL AND
                receipt_status IS NULL AND
                resolution_evidence ?& ARRAY['reasonCode', 'checkedAt'] AND
                jsonb_typeof(resolution_evidence->'reasonCode') = 'string' AND
                btrim(resolution_evidence->>'reasonCode') <> '' AND
                jsonb_typeof(resolution_evidence->'checkedAt') = 'string' AND
                resolution_evidence->>'checkedAt' ~
                    '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$') OR
             (resolution_evidence_type = 'RECEIPT_REVERTED' AND
                relayer_address IS NOT NULL AND nonce IS NOT NULL AND
                signed_transaction IS NOT NULL AND transaction_hash IS NOT NULL AND
                receipt_status = 'REVERTED' AND
                resolution_evidence ?& ARRAY['rpcSource', 'checkedAt'] AND
                jsonb_typeof(resolution_evidence->'rpcSource') = 'string' AND
                btrim(resolution_evidence->>'rpcSource') <> '' AND
                jsonb_typeof(resolution_evidence->'checkedAt') = 'string' AND
                resolution_evidence->>'checkedAt' ~
                    '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$') OR
             (resolution_evidence_type = 'RAW_TX_IRREVOCABLE_NO_EFFECT' AND
                relayer_address IS NOT NULL AND nonce IS NOT NULL AND
                signed_transaction IS NOT NULL AND transaction_hash IS NOT NULL AND
                receipt_status IS DISTINCT FROM 'SUCCESS' AND
                receipt_status IS DISTINCT FROM 'REVERTED' AND
                resolution_evidence ?& ARRAY[
                    'rpcSource', 'checkedAt', 'finalizedBlockNumber',
                    'finalizedBlockHash', 'observedNonce',
                    'consumingTransactionHash', 'contractStateNoEffect'
                ] AND
                jsonb_typeof(resolution_evidence->'rpcSource') = 'string' AND
                btrim(resolution_evidence->>'rpcSource') <> '' AND
                jsonb_typeof(resolution_evidence->'checkedAt') = 'string' AND
                resolution_evidence->>'checkedAt' ~
                    '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' AND
                jsonb_typeof(resolution_evidence->'finalizedBlockNumber') = 'number' AND
                jsonb_typeof(resolution_evidence->'finalizedBlockHash') = 'string' AND
                jsonb_typeof(resolution_evidence->'observedNonce') = 'number' AND
                jsonb_typeof(resolution_evidence->'consumingTransactionHash') = 'string' AND
                jsonb_typeof(resolution_evidence->'contractStateNoEffect') = 'boolean' AND
                resolution_evidence->'contractStateNoEffect' = 'true'::jsonb AND
                resolution_evidence->>'finalizedBlockHash' ~ '^0x[0-9a-f]{64}$' AND
                resolution_evidence->>'consumingTransactionHash' ~ '^0x[0-9a-f]{64}$' AND
                resolution_evidence->>'consumingTransactionHash' <> transaction_hash AND
                CASE
                    WHEN resolution_evidence->>'finalizedBlockNumber' ~ '^[0-9]+$'
                    THEN (resolution_evidence->>'finalizedBlockNumber')::NUMERIC >= 0
                    ELSE FALSE
                END AND
                CASE
                    WHEN resolution_evidence->>'observedNonce' ~ '^[0-9]+$'
                    THEN (resolution_evidence->>'observedNonce')::NUMERIC > nonce
                    ELSE FALSE
                END)))
    )
);

CREATE UNIQUE INDEX uq_chain_commands_tx_hash
    ON chain_commands (network, chain_id, lower(transaction_hash))
    WHERE transaction_hash IS NOT NULL;

CREATE UNIQUE INDEX uq_chain_commands_relayer_nonce
    ON chain_commands (network, chain_id, lower(relayer_address), nonce)
    WHERE relayer_address IS NOT NULL AND nonce IS NOT NULL AND NOT (
        status IN ('ABANDONED', 'SUPERSEDED') AND
        resolution_evidence_type = 'NONCE_RESERVATION_RELEASED'
    );

ALTER TABLE licenses
    ADD CONSTRAINT fk_licenses_pending_activation_command
    FOREIGN KEY (pending_activation_command_id, id)
    REFERENCES chain_commands(id, license_id) ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED;

-- The License pending key proposal points to the earliest unresolved ROTATE in
-- its ordered recovery/forward set. Multiple historical UNKNOWN commands may
-- coexist after a deep reorg, but only the next causal proposal is projected.
CREATE FUNCTION enforce_license_pending_activation_relation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_license_id UUID;
    v_license_status VARCHAR(30);
    v_pending_command_id UUID;
    v_pending_sequence BIGINT;
    v_pending_type VARCHAR(40);
    v_pending_status VARCHAR(30);
BEGIN
    IF TG_TABLE_NAME = 'licenses' THEN
        v_license_id := NEW.id;
    ELSE
        v_license_id := NEW.license_id;
    END IF;

    SELECT status, pending_activation_command_id
    INTO v_license_status, v_pending_command_id
    FROM licenses
    WHERE id = v_license_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    IF v_pending_command_id IS NULL THEN
        IF v_license_status <> 'PENDING_ONCHAIN' AND EXISTS (
            SELECT 1 FROM chain_commands
            WHERE license_id = v_license_id
              AND command_type = 'ROTATE_KEY'
           AND status IN ('PENDING', 'SUBMITTED', 'SUBMITTED_UNKNOWN',
                          'RETRYABLE_FAILED', 'DEAD_LETTER')
           AND command_type <> 'SYNC_DEVICE_COUNT'
        ) THEN
            RAISE EXCEPTION 'Unresolved ROTATE_KEY requires a License pending key projection';
        END IF;
        RETURN NEW;
    END IF;

    SELECT license_command_sequence, command_type, status
    INTO v_pending_sequence, v_pending_type, v_pending_status
    FROM chain_commands
    WHERE id = v_pending_command_id
      AND license_id = v_license_id;

    IF NOT FOUND OR v_pending_type <> 'ROTATE_KEY' OR
       v_pending_status NOT IN ('PENDING', 'SUBMITTED', 'SUBMITTED_UNKNOWN',
                                'RETRYABLE_FAILED', 'DEAD_LETTER') THEN
        RAISE EXCEPTION 'License pending key must reference an unresolved ROTATE_KEY command';
    END IF;

    IF EXISTS (
        SELECT 1 FROM chain_commands
        WHERE license_id = v_license_id
          AND command_type = 'ROTATE_KEY'
          AND status IN ('PENDING', 'SUBMITTED', 'SUBMITTED_UNKNOWN',
                         'RETRYABLE_FAILED', 'DEAD_LETTER')
          AND license_command_sequence < v_pending_sequence
    ) THEN
        RAISE EXCEPTION 'License pending key must reference the earliest unresolved ROTATE_KEY';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_licenses_pending_activation_relation
AFTER INSERT OR UPDATE ON licenses
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_license_pending_activation_relation();

CREATE CONSTRAINT TRIGGER trg_chain_commands_pending_activation_relation
AFTER INSERT OR UPDATE ON chain_commands
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_license_pending_activation_relation();

-- 10. Durable RPC scan cursor and lease; Redis/BullMQ only trigger the scan.
CREATE TABLE chain_indexer_checkpoints (
    network VARCHAR(40) NOT NULL,
    chain_id BIGINT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    next_block BIGINT NOT NULL,
    last_scanned_block BIGINT,
    last_scanned_block_hash VARCHAR(66),
    locked_by VARCHAR(180),
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (network, chain_id, contract_address),
    CONSTRAINT ck_chain_indexer_checkpoint_values CHECK (
        chain_id > 0 AND network = lower(network) AND next_block >= 0 AND
        (last_scanned_block IS NULL OR last_scanned_block >= 0)
    ),
    CONSTRAINT ck_chain_indexer_checkpoint_shapes CHECK (
        contract_address ~ '^0x[0-9a-f]{40}$' AND
        (last_scanned_block_hash IS NULL OR last_scanned_block_hash ~ '^0x[0-9a-f]{64}$') AND
        ((last_scanned_block IS NULL AND last_scanned_block_hash IS NULL) OR
         (last_scanned_block IS NOT NULL AND last_scanned_block_hash IS NOT NULL)) AND
        ((locked_by IS NULL AND locked_at IS NULL) OR
         (locked_by IS NOT NULL AND locked_at IS NOT NULL))
    )
);

-- 11. Indexed on-chain evidence. The same event identity may cycle through
-- PENDING/CONFIRMED/REORGED. The row retains only latest finalized/reorg
-- timestamps plus cumulative reorg_count, not a full occurrence ledger.
CREATE TABLE chain_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_command_id UUID NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    provider_user_id UUID NOT NULL,
    license_id UUID NOT NULL,
    license_device_id UUID,
    network VARCHAR(40) NOT NULL,
    chain_id BIGINT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    block_number BIGINT NOT NULL,
    block_hash VARCHAR(66) NOT NULL,
    confirmation_count INT NOT NULL DEFAULT 0,
    finality_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    confirmed_event_id UUID GENERATED ALWAYS AS (
        CASE WHEN finality_status = 'CONFIRMED' THEN id ELSE NULL END
    ) STORED,
    confirmed_chain_command_id UUID GENERATED ALWAYS AS (
        CASE WHEN finality_status = 'CONFIRMED' THEN chain_command_id ELSE NULL END
    ) STORED,
    confirmed_license_event_id UUID GENERATED ALWAYS AS (
        CASE
            WHEN finality_status = 'CONFIRMED' AND
                 event_type NOT IN ('ACTIVE_DEVICE_COUNT_SYNCED') THEN id
            ELSE NULL
        END
    ) STORED,
    confirmed_device_event_id UUID GENERATED ALWAYS AS (
        CASE
            WHEN finality_status = 'CONFIRMED' AND
                 event_type IN ('DEVICE_ACTIVATED', 'DEVICE_REVOKED') THEN id
            ELSE NULL
        END
    ) STORED,
    activation_commitment BYTEA,
    activation_key_version INT,
    previous_activation_commitment BYTEA,
    previous_activation_key_version INT,
    payload JSONB NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    finalized_at TIMESTAMPTZ,
    reorged_at TIMESTAMPTZ,
    reorg_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_chain_events_command_subject
        FOREIGN KEY (chain_command_id, provider_user_id, license_id)
        REFERENCES chain_commands(id, provider_user_id, license_id) ON DELETE RESTRICT,
    CONSTRAINT fk_chain_events_command_type
        FOREIGN KEY (chain_command_id, provider_user_id, license_id, event_type,
                     network, chain_id, contract_address, transaction_hash)
        REFERENCES chain_commands(id, provider_user_id, license_id, expected_event_type,
                                  network, chain_id, contract_address, transaction_hash)
        ON DELETE RESTRICT,
    CONSTRAINT fk_chain_events_command_device
        FOREIGN KEY (chain_command_id, license_id, license_device_id)
        REFERENCES chain_commands(id, license_id, license_device_id) ON DELETE RESTRICT,
    CONSTRAINT fk_chain_events_provider
        FOREIGN KEY (provider_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_chain_events_license_provider
        FOREIGN KEY (license_id, provider_user_id)
        REFERENCES licenses(id, provider_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_chain_events_device_license
        FOREIGN KEY (license_device_id, license_id)
        REFERENCES license_devices(id, license_id) ON DELETE RESTRICT,
    CONSTRAINT uq_chain_events_identity UNIQUE (
        network, chain_id, contract_address, transaction_hash, log_index
    ),
    CONSTRAINT uq_chain_events_id_license UNIQUE (id, license_id),
    CONSTRAINT uq_chain_events_id_device_license UNIQUE (id, license_device_id, license_id),
    CONSTRAINT uq_chain_events_confirmed_command
        UNIQUE (confirmed_event_id, chain_command_id),
    CONSTRAINT uq_chain_events_one_confirmed_per_command
        UNIQUE (confirmed_chain_command_id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT uq_chain_events_confirmed_license_projection
        UNIQUE (confirmed_license_event_id, license_id),
    CONSTRAINT uq_chain_events_confirmed_device_projection
        UNIQUE (confirmed_device_event_id, license_device_id, license_id),
    CONSTRAINT ck_chain_events_type CHECK (
        event_type IN ('LICENSE_ISSUED', 'LICENSE_RENEWED', 'LICENSE_SUSPENDED', 'LICENSE_RESUMED',
                        'LICENSE_REVOKED', 'KEY_ROTATED', 'DEVICE_ACTIVATED', 'DEVICE_REVOKED', 'ACTIVE_DEVICE_COUNT_SYNCED')
    ),
    CONSTRAINT ck_chain_events_finality CHECK (
        finality_status IN ('PENDING', 'CONFIRMED', 'REORGED')
    ),
    CONSTRAINT ck_chain_events_values CHECK (
        chain_id > 0 AND network = lower(network) AND log_index >= 0 AND
        block_number >= 0 AND confirmation_count >= 0 AND
        reorg_count >= 0 AND
        contract_address ~ '^0x[0-9a-f]{40}$' AND
        transaction_hash ~ '^0x[0-9a-f]{64}$' AND
        block_hash ~ '^0x[0-9a-f]{64}$'
    ),
    CONSTRAINT ck_chain_events_device_shape CHECK (
        (event_type IN ('DEVICE_ACTIVATED', 'DEVICE_REVOKED') AND license_device_id IS NOT NULL) OR
        (event_type NOT IN ('DEVICE_ACTIVATED', 'DEVICE_REVOKED') AND license_device_id IS NULL)
    ),
    CONSTRAINT ck_chain_events_activation_shape CHECK (
        (event_type = 'LICENSE_ISSUED' AND
            activation_commitment IS NOT NULL AND octet_length(activation_commitment) = 32 AND
            activation_key_version IS NOT NULL AND activation_key_version > 0 AND
            previous_activation_commitment IS NULL AND previous_activation_key_version IS NULL) OR
        (event_type = 'KEY_ROTATED' AND
            activation_commitment IS NOT NULL AND octet_length(activation_commitment) = 32 AND
            activation_key_version IS NOT NULL AND activation_key_version > 1 AND
            previous_activation_commitment IS NOT NULL AND octet_length(previous_activation_commitment) = 32 AND
            previous_activation_key_version IS NOT NULL AND previous_activation_key_version > 0 AND
            activation_key_version = previous_activation_key_version + 1 AND
            activation_commitment <> previous_activation_commitment) OR
        (event_type NOT IN ('LICENSE_ISSUED', 'KEY_ROTATED') AND
            activation_commitment IS NULL AND activation_key_version IS NULL AND
            previous_activation_commitment IS NULL AND previous_activation_key_version IS NULL)
    ),
    CONSTRAINT ck_chain_events_payload CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT ck_chain_events_finality_stamps CHECK (
        ((reorged_at IS NULL AND reorg_count = 0) OR
         (reorged_at IS NOT NULL AND reorg_count > 0)) AND
        ((finality_status = 'PENDING' AND
            ((reorg_count = 0 AND finalized_at IS NULL AND reorged_at IS NULL) OR
             (reorg_count > 0 AND reorged_at IS NOT NULL AND
                observed_at >= reorged_at AND
                (finalized_at IS NULL OR finalized_at <= reorged_at)))) OR
         (finality_status = 'CONFIRMED' AND confirmation_count > 0 AND
             finalized_at IS NOT NULL AND finalized_at >= observed_at AND
            (reorged_at IS NULL OR observed_at >= reorged_at) AND
            (reorged_at IS NULL OR finalized_at > reorged_at)) OR
         (finality_status = 'REORGED' AND reorged_at IS NOT NULL AND
            reorged_at >= observed_at AND
            (finalized_at IS NULL OR reorged_at >= finalized_at)))
    )
);

CREATE FUNCTION enforce_chain_event_initial_state()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.finality_status <> 'PENDING' OR NEW.finalized_at IS NOT NULL OR
       NEW.reorged_at IS NOT NULL OR NEW.reorg_count <> 0 THEN
        RAISE EXCEPTION 'A new ChainEvent must enter in PENDING state without a reorg summary';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chain_events_initial_state
BEFORE INSERT ON chain_events
FOR EACH ROW EXECUTE FUNCTION enforce_chain_event_initial_state();

-- Event identity/decoded payload are immutable. The same transaction/log may be
-- observed in a new block only when a REORGED row re-enters canonical tracking.
CREATE FUNCTION guard_chain_event_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_enter_reorg BOOLEAN;
    v_enter_confirmed BOOLEAN;
    v_reinclusion BOOLEAN;
BEGIN
    v_enter_reorg := OLD.finality_status <> 'REORGED' AND NEW.finality_status = 'REORGED';
    v_enter_confirmed := OLD.finality_status <> 'CONFIRMED' AND NEW.finality_status = 'CONFIRMED';
    v_reinclusion := OLD.finality_status = 'REORGED' AND
                     NEW.finality_status IN ('PENDING', 'CONFIRMED');

    IF NEW.id IS DISTINCT FROM OLD.id OR
       NEW.chain_command_id IS DISTINCT FROM OLD.chain_command_id OR
       NEW.event_type IS DISTINCT FROM OLD.event_type OR
       NEW.provider_user_id IS DISTINCT FROM OLD.provider_user_id OR
       NEW.license_id IS DISTINCT FROM OLD.license_id OR
       NEW.license_device_id IS DISTINCT FROM OLD.license_device_id OR
       NEW.network IS DISTINCT FROM OLD.network OR
       NEW.chain_id IS DISTINCT FROM OLD.chain_id OR
       NEW.contract_address IS DISTINCT FROM OLD.contract_address OR
       NEW.transaction_hash IS DISTINCT FROM OLD.transaction_hash OR
       NEW.log_index IS DISTINCT FROM OLD.log_index OR
       NEW.activation_commitment IS DISTINCT FROM OLD.activation_commitment OR
       NEW.activation_key_version IS DISTINCT FROM OLD.activation_key_version OR
       NEW.previous_activation_commitment IS DISTINCT FROM OLD.previous_activation_commitment OR
       NEW.previous_activation_key_version IS DISTINCT FROM OLD.previous_activation_key_version OR
       NEW.payload IS DISTINCT FROM OLD.payload OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'ChainEvent identity and decoded payload are immutable';
    END IF;

    IF (NEW.block_number IS DISTINCT FROM OLD.block_number OR
        NEW.block_hash IS DISTINCT FROM OLD.block_hash OR
        NEW.observed_at IS DISTINCT FROM OLD.observed_at) AND NOT v_reinclusion THEN
        RAISE EXCEPTION 'ChainEvent occurrence evidence changes only on canonical re-inclusion';
    END IF;

    IF v_reinclusion AND NEW.observed_at < OLD.observed_at THEN
        RAISE EXCEPTION 'Re-included ChainEvent cannot move observed_at backwards';
    END IF;

    IF v_reinclusion AND OLD.reorged_at IS NOT NULL AND
       NEW.observed_at < OLD.reorged_at THEN
        RAISE EXCEPTION 'Re-included ChainEvent cannot be observed before its prior reorg';
    END IF;

    IF v_enter_reorg AND NEW.reorged_at < OLD.observed_at THEN
        RAISE EXCEPTION 'ChainEvent cannot be reorged before it was observed';
    END IF;

    IF v_enter_confirmed AND NEW.finalized_at < NEW.observed_at THEN
        RAISE EXCEPTION 'ChainEvent cannot be finalized before its current observation';
    END IF;

    IF NEW.confirmation_count < OLD.confirmation_count AND
       NOT (v_enter_reorg OR v_reinclusion) THEN
        RAISE EXCEPTION 'ChainEvent confirmation_count cannot decrease outside reorg/re-inclusion';
    END IF;

    IF NEW.finality_status IS DISTINCT FROM OLD.finality_status AND NOT (
        (OLD.finality_status = 'PENDING' AND
            NEW.finality_status IN ('CONFIRMED', 'REORGED')) OR
        (OLD.finality_status = 'CONFIRMED' AND NEW.finality_status = 'REORGED') OR
        (OLD.finality_status = 'REORGED' AND
            NEW.finality_status IN ('PENDING', 'CONFIRMED'))
    ) THEN
        RAISE EXCEPTION 'Invalid ChainEvent finality transition: % -> %',
            OLD.finality_status, NEW.finality_status;
    END IF;

    IF (v_enter_reorg AND
          (NEW.reorg_count <> OLD.reorg_count + 1 OR
           NEW.reorged_at IS NULL OR
           (OLD.reorged_at IS NOT NULL AND NEW.reorged_at <= OLD.reorged_at))) OR
       (NOT v_enter_reorg AND
          (NEW.reorg_count <> OLD.reorg_count OR
           NEW.reorged_at IS DISTINCT FROM OLD.reorged_at)) THEN
        RAISE EXCEPTION 'ChainEvent reorg summary changes monotonically only when entering REORGED';
    END IF;

    IF (v_enter_confirmed AND
          (NEW.finalized_at IS NULL OR
           (OLD.finalized_at IS NOT NULL AND NEW.finalized_at <= OLD.finalized_at))) OR
       (NOT v_enter_confirmed AND NEW.finalized_at IS DISTINCT FROM OLD.finalized_at) THEN
        RAISE EXCEPTION 'ChainEvent finalized_at changes only when entering CONFIRMED';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chain_events_immutable
BEFORE UPDATE ON chain_events
FOR EACH ROW EXECUTE FUNCTION guard_chain_event_evidence();

-- Recheck cross-row admission and causal basis at commit so a reorg in the same
-- transaction cannot leave a new forward command beside an unresolved suffix.
CREATE FUNCTION enforce_chain_command_commit_invariants()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_license_id UUID := NEW.license_id;
BEGIN
    IF EXISTS (
        SELECT 1 FROM chain_commands
        WHERE license_id = v_license_id
           AND status IN ('PENDING', 'SUBMITTED', 'RETRYABLE_FAILED')
           AND command_type <> 'SYNC_DEVICE_COUNT'
    ) AND EXISTS (
        SELECT 1 FROM chain_commands
        WHERE license_id = v_license_id
           AND status IN ('SUBMITTED_UNKNOWN', 'DEAD_LETTER')
           AND command_type <> 'SYNC_DEVICE_COUNT'
    ) THEN
        RAISE EXCEPTION 'Forward ChainCommand cannot coexist with an unresolved recovery suffix';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM chain_commands c
        WHERE c.license_id = v_license_id
          AND c.command_type <> 'ISSUE_LICENSE'
          AND c.status IN ('PENDING', 'SUBMITTED', 'RETRYABLE_FAILED')
          AND c.basis_chain_event_id IS DISTINCT FROM (
              SELECT prior.confirmation_chain_event_id
              FROM chain_commands prior
              WHERE prior.license_id = c.license_id
                AND prior.status = 'CONFIRMED'
                AND prior.license_command_sequence < c.license_command_sequence
              ORDER BY prior.license_command_sequence DESC
              LIMIT 1
          )
    ) THEN
        RAISE EXCEPTION 'Forward ChainCommand basis is not the latest preceding canonical confirmation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_chain_commands_commit_invariants
AFTER INSERT OR UPDATE ON chain_commands
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_chain_command_commit_invariants();

CREATE CONSTRAINT TRIGGER trg_chain_events_command_commit_invariants
AFTER INSERT OR UPDATE ON chain_events
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_chain_command_commit_invariants();

ALTER TABLE licenses
    ADD CONSTRAINT fk_licenses_last_chain_event
    FOREIGN KEY (last_applied_chain_event_id, id)
    REFERENCES chain_events(confirmed_license_event_id, license_id) ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE chain_commands
    ADD CONSTRAINT fk_chain_commands_basis_event
    FOREIGN KEY (basis_chain_event_id, license_id)
    REFERENCES chain_events(id, license_id) ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE chain_commands
    ADD CONSTRAINT fk_chain_commands_confirmation_event
    FOREIGN KEY (confirmation_chain_event_id, id)
    REFERENCES chain_events(confirmed_event_id, chain_command_id) ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED;

-- At commit, each materialized projection points to the latest confirmed event
-- for that subject and the projected state is compatible with that event type.
-- License EXPIRED is a temporal materialization of administrative ACTIVE.
CREATE FUNCTION enforce_latest_canonical_projection()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_license_id UUID;
    v_license_status VARCHAR(30);
    v_license_event_id UUID;
    v_license_event_type VARCHAR(40);
    v_latest_license_event_id UUID;
    v_latest_license_event_type VARCHAR(40);
BEGIN
    IF TG_TABLE_NAME = 'licenses' THEN
        v_license_id := NEW.id;
    ELSE
        v_license_id := NEW.license_id;
    END IF;

    SELECT status, last_applied_chain_event_id
    INTO v_license_status, v_license_event_id
    FROM licenses
    WHERE id = v_license_id;

    IF FOUND THEN
        SELECT e.id, e.event_type
        INTO v_latest_license_event_id, v_latest_license_event_type
        FROM chain_events e
        JOIN chain_commands c ON c.id = e.chain_command_id
        WHERE e.license_id = v_license_id
          AND e.license_device_id IS NULL
          AND e.event_type <> 'ACTIVE_DEVICE_COUNT_SYNCED'
          AND e.finality_status = 'CONFIRMED'
          AND c.status = 'CONFIRMED'
          AND c.confirmation_chain_event_id = e.id
        ORDER BY c.license_command_sequence DESC
        LIMIT 1;

        IF v_license_status = 'PENDING_ONCHAIN' THEN
            IF v_license_event_id IS NOT NULL OR v_latest_license_event_id IS NOT NULL THEN
                RAISE EXCEPTION 'PENDING_ONCHAIN License cannot retain a confirmed canonical event';
            END IF;
        ELSE
            IF v_latest_license_event_id IS NULL OR
               v_license_event_id IS DISTINCT FROM v_latest_license_event_id THEN
                RAISE EXCEPTION 'License projection must point to its latest confirmed canonical event';
            END IF;

            SELECT event_type INTO v_license_event_type
            FROM chain_events
            WHERE id = v_license_event_id;

            IF (v_license_status IN ('ACTIVE', 'EXPIRED') AND
                  v_license_event_type NOT IN (
                      'LICENSE_ISSUED', 'LICENSE_RENEWED', 'LICENSE_RESUMED', 'KEY_ROTATED'
                  )) OR
               (v_license_status = 'SUSPENDED' AND
                  v_license_event_type NOT IN (
                      'LICENSE_SUSPENDED', 'LICENSE_RENEWED', 'KEY_ROTATED'
                  )) OR
               (v_license_status = 'REVOKED' AND
                  v_license_event_type <> 'LICENSE_REVOKED') THEN
                RAISE EXCEPTION 'License status is incompatible with its latest canonical event';
            END IF;
        END IF;
    END IF;


    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_licenses_latest_canonical_projection
AFTER INSERT OR UPDATE ON licenses
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_latest_canonical_projection();

CREATE CONSTRAINT TRIGGER trg_chain_events_latest_canonical_projection
AFTER INSERT OR UPDATE ON chain_events
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_latest_canonical_projection();

-- License commercial identity and initial period never drift. Expiry may move
-- only while applying a confirmed renewal or rolling back that exact reorged
-- renewal; application/event decoding remains responsible for the exact value.
CREATE FUNCTION guard_license_rights_projection()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_renewal_apply BOOLEAN := FALSE;
    v_renewal_rollback BOOLEAN := FALSE;
BEGIN
    IF ROW(NEW.id, NEW.public_license_id, NEW.origin_order_id,
           NEW.provider_user_id, NEW.customer_user_id, NEW.product_id,
           NEW.plan_id, NEW.plan_commitment, NEW.period_start,
           NEW.max_active_devices, NEW.created_at)
       IS DISTINCT FROM
       ROW(OLD.id, OLD.public_license_id, OLD.origin_order_id,
           OLD.provider_user_id, OLD.customer_user_id, OLD.product_id,
           OLD.plan_id, OLD.plan_commitment, OLD.period_start,
           OLD.max_active_devices, OLD.created_at) THEN
        RAISE EXCEPTION 'License identity, Plan binding and initial period are immutable';
    END IF;

    IF NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
        SELECT NEW.last_applied_chain_event_id IS DISTINCT FROM OLD.last_applied_chain_event_id AND
               EXISTS (
                   SELECT 1
                   FROM chain_events e
                   JOIN chain_commands c ON c.id = e.chain_command_id
                   WHERE e.id = NEW.last_applied_chain_event_id
                     AND e.license_id = OLD.id
                     AND e.event_type = 'LICENSE_RENEWED'
                     AND e.finality_status = 'CONFIRMED'
                     AND c.status = 'CONFIRMED'
                     AND c.confirmation_chain_event_id = e.id
               )
        INTO v_renewal_apply;

        SELECT NEW.last_applied_chain_event_id IS DISTINCT FROM OLD.last_applied_chain_event_id AND
               EXISTS (
                   SELECT 1
                   FROM chain_events e
                   JOIN chain_commands c ON c.id = e.chain_command_id
                   WHERE e.id = OLD.last_applied_chain_event_id
                     AND e.license_id = OLD.id
                     AND e.event_type = 'LICENSE_RENEWED'
                     AND e.finality_status = 'REORGED'
                     AND c.status = 'SUBMITTED_UNKNOWN'
               )
        INTO v_renewal_rollback;

        IF NOT ((v_renewal_apply AND NEW.expires_at > OLD.expires_at) OR
                (v_renewal_rollback AND NEW.expires_at < OLD.expires_at)) THEN
            RAISE EXCEPTION 'License expiry changes only once with exact renewal apply or rollback';
        END IF;
    END IF;

    NEW.updated_at := statement_timestamp();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_licenses_rights_projection_guard
BEFORE UPDATE ON licenses
FOR EACH ROW EXECUTE FUNCTION guard_license_rights_projection();

-- Serialize creation per License and require a confirmed basis at admission time.
-- The raw basis FK remains after a later reorg so the causal suffix is traceable.
CREATE FUNCTION enforce_chain_command_admission_and_basis()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_latest_confirmed_event_id UUID;
BEGIN
    PERFORM 1 FROM licenses WHERE id = NEW.license_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'License % does not exist', NEW.license_id;
    END IF;

    IF NEW.status <> 'PENDING' THEN
        RAISE EXCEPTION 'A new ChainCommand must enter in PENDING state';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM chain_commands
        WHERE license_id = NEW.license_id
           AND status IN ('PENDING', 'SUBMITTED', 'SUBMITTED_UNKNOWN',
                          'RETRYABLE_FAILED', 'DEAD_LETTER')
           AND command_type <> 'SYNC_DEVICE_COUNT'
     ) THEN
         RAISE EXCEPTION 'License % already has an unresolved chain command', NEW.license_id;
    END IF;

    IF NEW.command_type <> 'ISSUE_LICENSE' THEN
        SELECT confirmation_chain_event_id
        INTO v_latest_confirmed_event_id
        FROM chain_commands
        WHERE license_id = NEW.license_id
          AND status = 'CONFIRMED'
          AND license_command_sequence < NEW.license_command_sequence
        ORDER BY license_command_sequence DESC
        LIMIT 1
        FOR SHARE;

        IF v_latest_confirmed_event_id IS NULL OR
           NEW.basis_chain_event_id IS DISTINCT FROM v_latest_confirmed_event_id THEN
            RAISE EXCEPTION 'Command basis must be the latest preceding confirmed event of the same License';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chain_commands_admission
BEFORE INSERT ON chain_commands
FOR EACH ROW EXECUTE FUNCTION enforce_chain_command_admission_and_basis();

-- Command identity/causal fields never change. Payload may be regenerated only
-- before any nonce/raw/hash evidence exists; reserved/built evidence is immutable.
CREATE FUNCTION guard_chain_command_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_latest_confirmed_event_id UUID;
BEGIN
    IF OLD.status IN ('ABANDONED', 'SUPERSEDED') AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION 'Resolved ChainCommand is fully immutable';
    END IF;

    IF NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR
       NEW.command_type IS DISTINCT FROM OLD.command_type OR
       NEW.provider_user_id IS DISTINCT FROM OLD.provider_user_id OR
       NEW.order_id IS DISTINCT FROM OLD.order_id OR
       NEW.license_id IS DISTINCT FROM OLD.license_id OR
       NEW.license_device_id IS DISTINCT FROM OLD.license_device_id OR
       NEW.license_command_sequence IS DISTINCT FROM OLD.license_command_sequence OR
       NEW.predecessor_command_id IS DISTINCT FROM OLD.predecessor_command_id OR
       NEW.basis_chain_event_id IS DISTINCT FROM OLD.basis_chain_event_id OR
       NEW.replaces_command_id IS DISTINCT FROM OLD.replaces_command_id OR
       NEW.network IS DISTINCT FROM OLD.network OR
       NEW.chain_id IS DISTINCT FROM OLD.chain_id OR
       NEW.contract_address IS DISTINCT FROM OLD.contract_address THEN
        RAISE EXCEPTION 'ChainCommand identity and causal fields are immutable';
    END IF;

    IF (OLD.nonce IS NOT NULL OR OLD.signed_transaction IS NOT NULL OR
        OLD.transaction_hash IS NOT NULL) AND
       (NEW.payload IS DISTINCT FROM OLD.payload OR
        NEW.payload_hash IS DISTINCT FROM OLD.payload_hash) THEN
        RAISE EXCEPTION 'ChainCommand payload is immutable after submission evidence exists';
    END IF;

    IF (OLD.relayer_address IS NOT NULL AND NEW.relayer_address IS DISTINCT FROM OLD.relayer_address) OR
       (OLD.nonce IS NOT NULL AND NEW.nonce IS DISTINCT FROM OLD.nonce) OR
       (OLD.signed_transaction IS NOT NULL AND NEW.signed_transaction IS DISTINCT FROM OLD.signed_transaction) OR
       (OLD.transaction_hash IS NOT NULL AND NEW.transaction_hash IS DISTINCT FROM OLD.transaction_hash) THEN
        RAISE EXCEPTION 'Reserved nonce/raw transaction/hash evidence is immutable';
    END IF;

    IF OLD.receipt_status IN ('SUCCESS', 'REVERTED') AND
       (NEW.receipt_status IS DISTINCT FROM OLD.receipt_status OR
        NEW.receipt_block_number IS DISTINCT FROM OLD.receipt_block_number OR
        NEW.receipt_block_hash IS DISTINCT FROM OLD.receipt_block_hash OR
        NEW.receipt_checked_at IS DISTINCT FROM OLD.receipt_checked_at) THEN
        RAISE EXCEPTION 'Definitive transaction receipt evidence is immutable';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
        (OLD.status = 'PENDING' AND
            NEW.status IN ('SUBMITTED', 'RETRYABLE_FAILED', 'DEAD_LETTER', 'ABANDONED')) OR
        (OLD.status = 'RETRYABLE_FAILED' AND NEW.status IN ('PENDING', 'DEAD_LETTER')) OR
        (OLD.status = 'SUBMITTED' AND NEW.status IN ('CONFIRMED', 'SUBMITTED_UNKNOWN', 'DEAD_LETTER')) OR
        (OLD.status = 'SUBMITTED_UNKNOWN' AND
            NEW.status IN ('SUBMITTED', 'CONFIRMED', 'DEAD_LETTER', 'ABANDONED', 'SUPERSEDED')) OR
        (OLD.status = 'DEAD_LETTER' AND
            NEW.status IN ('PENDING', 'SUBMITTED_UNKNOWN', 'ABANDONED', 'SUPERSEDED')) OR
        (OLD.status = 'CONFIRMED' AND NEW.status = 'SUBMITTED_UNKNOWN')
    ) THEN
        RAISE EXCEPTION 'Invalid ChainCommand status transition: % -> %', OLD.status, NEW.status;
    END IF;

    IF OLD.status NOT IN ('ABANDONED', 'SUPERSEDED') AND
       NEW.status IN ('ABANDONED', 'SUPERSEDED') THEN
        NEW.resolved_at := statement_timestamp();
    END IF;

    IF OLD.status = 'DEAD_LETTER' AND NEW.status = 'PENDING' AND
       (OLD.signed_transaction IS NOT NULL OR OLD.transaction_hash IS NOT NULL) THEN
        RAISE EXCEPTION 'DEAD_LETTER with submission evidence must reconcile via SUBMITTED_UNKNOWN';
    END IF;

    IF OLD.status = 'DEAD_LETTER' AND NEW.status = 'SUBMITTED_UNKNOWN' AND
       (OLD.signed_transaction IS NULL OR OLD.transaction_hash IS NULL) THEN
        RAISE EXCEPTION 'Same-raw reconciliation requires signed transaction and hash evidence';
    END IF;

    IF OLD.status = 'DEAD_LETTER' AND NEW.status = 'SUBMITTED_UNKNOWN' AND
       OLD.receipt_status = 'REVERTED' THEN
        RAISE EXCEPTION 'REVERTED transaction is definitive and cannot return to SUBMITTED_UNKNOWN';
    END IF;

    IF NEW.status IN ('ABANDONED', 'SUPERSEDED') AND
       NEW.signed_transaction IS NOT NULL AND
       NEW.resolution_evidence_type NOT IN (
           'RECEIPT_REVERTED', 'RAW_TX_IRREVOCABLE_NO_EFFECT'
       ) THEN
        RAISE EXCEPTION 'Broadcast transaction resolution requires durable proof that the raw transaction cannot create an effect';
    END IF;

    IF NEW.command_type <> 'ISSUE_LICENSE' AND
       NEW.status IN ('PENDING', 'SUBMITTED') AND
       NEW.status IS DISTINCT FROM OLD.status THEN
        SELECT confirmation_chain_event_id
        INTO v_latest_confirmed_event_id
        FROM chain_commands
        WHERE license_id = NEW.license_id
          AND status = 'CONFIRMED'
          AND license_command_sequence < NEW.license_command_sequence
        ORDER BY license_command_sequence DESC
        LIMIT 1
        FOR SHARE;

        IF v_latest_confirmed_event_id IS NULL OR
           NEW.basis_chain_event_id IS DISTINCT FROM v_latest_confirmed_event_id THEN
            RAISE EXCEPTION 'ChainCommand cannot reopen/submit from a stale or non-canonical basis';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chain_commands_immutable
BEFORE UPDATE ON chain_commands
FOR EACH ROW EXECUTE FUNCTION guard_chain_command_immutable_fields();

-- SUPERSEDED and its replacement form a reciprocal, append-only causal link.
CREATE FUNCTION enforce_chain_command_replacement_link()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_current chain_commands%ROWTYPE;
    v_linked chain_commands%ROWTYPE;
BEGIN
    SELECT * INTO v_current FROM chain_commands WHERE id = NEW.id;
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    IF v_current.status = 'SUPERSEDED' THEN
        SELECT * INTO v_linked
        FROM chain_commands
        WHERE id = v_current.superseded_by_command_id
          AND license_id = v_current.license_id;

        IF NOT FOUND OR
           v_linked.replaces_command_id IS DISTINCT FROM v_current.id OR
           v_linked.command_type IS DISTINCT FROM v_current.command_type OR
           v_linked.provider_user_id IS DISTINCT FROM v_current.provider_user_id OR
           v_linked.order_id IS DISTINCT FROM v_current.order_id OR
           v_linked.license_device_id IS DISTINCT FROM v_current.license_device_id OR
           v_linked.network IS DISTINCT FROM v_current.network OR
           v_linked.chain_id IS DISTINCT FROM v_current.chain_id OR
           v_linked.contract_address IS DISTINCT FROM v_current.contract_address OR
           v_linked.license_command_sequence <= v_current.license_command_sequence THEN
            RAISE EXCEPTION 'SUPERSEDED command requires reciprocal later replacement link';
        END IF;
    END IF;

    IF v_current.replaces_command_id IS NOT NULL THEN
        SELECT * INTO v_linked
        FROM chain_commands
        WHERE id = v_current.replaces_command_id
          AND license_id = v_current.license_id;

        IF NOT FOUND OR v_linked.status <> 'SUPERSEDED' OR
           v_linked.superseded_by_command_id IS DISTINCT FROM v_current.id OR
           v_linked.command_type IS DISTINCT FROM v_current.command_type OR
           v_linked.provider_user_id IS DISTINCT FROM v_current.provider_user_id OR
           v_linked.order_id IS DISTINCT FROM v_current.order_id OR
           v_linked.license_device_id IS DISTINCT FROM v_current.license_device_id OR
           v_linked.network IS DISTINCT FROM v_current.network OR
           v_linked.chain_id IS DISTINCT FROM v_current.chain_id OR
           v_linked.contract_address IS DISTINCT FROM v_current.contract_address OR
           v_current.license_command_sequence <= v_linked.license_command_sequence THEN
            RAISE EXCEPTION 'Replacement command requires reciprocal earlier SUPERSEDED link';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_chain_commands_replacement_link
AFTER INSERT OR UPDATE ON chain_commands
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_chain_command_replacement_link();

-- Keep License key projection aligned with the immutable command payload boundary.
-- Finality/reorg transactions update the command state first, then the projection.
CREATE FUNCTION guard_license_activation_projection()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_changed BOOLEAN;
    v_pending_changed BOOLEAN;
    v_exact_reorg_rollback BOOLEAN;
    v_exact_issue_reorg_rollback BOOLEAN;
    v_exact_issue_reconfirmation_recovery BOOLEAN;
BEGIN
    v_current_changed := NEW.activation_commitment IS DISTINCT FROM OLD.activation_commitment OR
                         NEW.activation_key_version IS DISTINCT FROM OLD.activation_key_version OR
                         NEW.activation_key_last4 IS DISTINCT FROM OLD.activation_key_last4;
    v_pending_changed := NEW.pending_activation_commitment IS DISTINCT FROM OLD.pending_activation_commitment OR
                         NEW.pending_activation_key_version IS DISTINCT FROM OLD.pending_activation_key_version OR
                         NEW.pending_activation_command_id IS DISTINCT FROM OLD.pending_activation_command_id;
    v_exact_reorg_rollback := FALSE;
    v_exact_issue_reorg_rollback := FALSE;
    v_exact_issue_reconfirmation_recovery := FALSE;

    IF v_current_changed AND
       NEW.activation_key_trust_status = 'UNTRUSTED_REORG' AND
       NEW.pending_activation_command_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM chain_commands c
            JOIN chain_events e ON e.chain_command_id = c.id
            WHERE c.id = NEW.pending_activation_command_id
              AND c.license_id = OLD.id
              AND c.command_type = 'ROTATE_KEY'
              AND c.status = 'SUBMITTED_UNKNOWN'
              AND e.event_type = 'KEY_ROTATED'
              AND e.finality_status = 'REORGED'
              AND OLD.activation_commitment = e.activation_commitment
              AND OLD.activation_key_version = e.activation_key_version
              AND NEW.activation_commitment = e.previous_activation_commitment
              AND NEW.activation_key_version = e.previous_activation_key_version
              AND NEW.pending_activation_commitment = e.activation_commitment
              AND NEW.pending_activation_key_version = e.activation_key_version
        ) INTO v_exact_reorg_rollback;
    END IF;

    IF v_pending_changed AND NOT v_current_changed AND
       OLD.pending_activation_command_id IS NOT NULL AND
       NEW.status = 'PENDING_ONCHAIN' AND
       NEW.activation_key_trust_status = 'UNTRUSTED_REORG' AND
       NEW.pending_activation_command_id IS NULL AND
       NEW.pending_activation_commitment IS NULL AND
       NEW.pending_activation_key_version IS NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM chain_commands issue_command
            JOIN chain_events issue_event
              ON issue_event.chain_command_id = issue_command.id
            JOIN chain_commands rotate_command
              ON rotate_command.id = OLD.pending_activation_command_id
            JOIN chain_events rotate_event
              ON rotate_event.chain_command_id = rotate_command.id
            WHERE issue_command.license_id = OLD.id
              AND issue_command.command_type = 'ISSUE_LICENSE'
              AND issue_command.status = 'SUBMITTED_UNKNOWN'
              AND issue_event.event_type = 'LICENSE_ISSUED'
              AND issue_event.finality_status = 'REORGED'
              AND issue_event.activation_commitment = NEW.activation_commitment
              AND issue_event.activation_key_version = NEW.activation_key_version
              AND rotate_command.license_id = OLD.id
              AND rotate_command.command_type = 'ROTATE_KEY'
              AND rotate_command.status = 'SUBMITTED_UNKNOWN'
              AND rotate_event.event_type = 'KEY_ROTATED'
              AND rotate_event.finality_status = 'REORGED'
              AND rotate_event.previous_activation_commitment = OLD.activation_commitment
              AND rotate_event.previous_activation_key_version = OLD.activation_key_version
              AND rotate_event.activation_commitment = OLD.pending_activation_commitment
              AND rotate_event.activation_key_version = OLD.pending_activation_key_version
        ) INTO v_exact_issue_reorg_rollback;
    END IF;

    IF v_pending_changed AND NOT v_current_changed AND
       OLD.status = 'PENDING_ONCHAIN' AND
       NEW.status IN ('ACTIVE', 'EXPIRED') AND
       OLD.activation_key_trust_status = 'UNTRUSTED_REORG' AND
       NEW.activation_key_trust_status = 'UNTRUSTED_REORG' AND
       OLD.pending_activation_command_id IS NULL AND
       NEW.pending_activation_command_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM chain_events issue_event
            JOIN chain_commands issue_command
              ON issue_command.id = issue_event.chain_command_id
            JOIN chain_commands rotate_command
              ON rotate_command.id = NEW.pending_activation_command_id
             AND rotate_command.license_id = OLD.id
            JOIN chain_events rotate_event
              ON rotate_event.chain_command_id = rotate_command.id
            WHERE issue_event.id = NEW.last_applied_chain_event_id
              AND issue_event.license_id = OLD.id
              AND issue_event.event_type = 'LICENSE_ISSUED'
              AND issue_event.finality_status = 'CONFIRMED'
              AND issue_event.activation_commitment = NEW.activation_commitment
              AND issue_event.activation_key_version = NEW.activation_key_version
              AND issue_command.command_type = 'ISSUE_LICENSE'
              AND issue_command.status = 'CONFIRMED'
              AND issue_command.confirmation_chain_event_id = issue_event.id
              AND rotate_command.command_type = 'ROTATE_KEY'
              AND rotate_command.status = 'SUBMITTED_UNKNOWN'
              AND rotate_command.license_command_sequence >
                  issue_command.license_command_sequence
              AND rotate_event.event_type = 'KEY_ROTATED'
              AND rotate_event.finality_status = 'REORGED'
              AND rotate_event.previous_activation_commitment =
                  NEW.activation_commitment
              AND rotate_event.previous_activation_key_version =
                  NEW.activation_key_version
              AND rotate_event.activation_commitment =
                  NEW.pending_activation_commitment
              AND rotate_event.activation_key_version =
                  NEW.pending_activation_key_version
              AND NOT EXISTS (
                  SELECT 1
                  FROM chain_commands earlier
                  WHERE earlier.license_id = OLD.id
                    AND earlier.command_type = 'ROTATE_KEY'
                    AND earlier.status IN (
                        'PENDING', 'SUBMITTED', 'SUBMITTED_UNKNOWN',
                        'RETRYABLE_FAILED', 'DEAD_LETTER'
                    )
                    AND earlier.license_command_sequence <
                        rotate_command.license_command_sequence
              )
        ) INTO v_exact_issue_reconfirmation_recovery;
    END IF;

    IF v_current_changed THEN
        IF OLD.status = 'PENDING_ONCHAIN' AND EXISTS (
            SELECT 1 FROM chain_commands
            WHERE license_id = OLD.id
              AND command_type = 'ISSUE_LICENSE'
              AND (nonce IS NOT NULL OR signed_transaction IS NOT NULL OR transaction_hash IS NOT NULL)
        ) THEN
            RAISE EXCEPTION 'ISSUE activation proposal is immutable after submission evidence exists';
        END IF;

        IF OLD.status <> 'PENDING_ONCHAIN' THEN
            IF OLD.pending_activation_command_id IS NOT NULL AND EXISTS (
                SELECT 1
                FROM chain_commands c
                JOIN chain_events e ON e.id = c.confirmation_chain_event_id
                WHERE c.id = OLD.pending_activation_command_id
                  AND c.license_id = OLD.id
                  AND c.command_type = 'ROTATE_KEY'
                  AND c.status = 'CONFIRMED'
                  AND e.event_type = 'KEY_ROTATED'
                  AND e.finality_status = 'CONFIRMED'
                  AND e.activation_commitment = OLD.pending_activation_commitment
                  AND e.activation_key_version = OLD.pending_activation_key_version
                  AND e.previous_activation_commitment = OLD.activation_commitment
                  AND e.previous_activation_key_version = OLD.activation_key_version
            ) THEN
                IF NEW.activation_commitment IS DISTINCT FROM OLD.pending_activation_commitment OR
                   NEW.activation_key_version IS DISTINCT FROM OLD.pending_activation_key_version THEN
                    RAISE EXCEPTION 'Confirmed ROTATE must promote the exact pending activation key';
                END IF;
            ELSIF NEW.activation_key_trust_status = 'UNTRUSTED_REORG' THEN
                IF NOT v_exact_reorg_rollback THEN
                    RAISE EXCEPTION 'Key rollback requires a reorged key event and SUBMITTED_UNKNOWN command';
                END IF;
            ELSE
                RAISE EXCEPTION 'Current activation key changes only by exact confirmed pending ROTATE promotion';
            END IF;
        END IF;
    END IF;

    IF v_pending_changed THEN
        IF OLD.pending_activation_command_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM chain_commands
            WHERE id = OLD.pending_activation_command_id
              AND license_id = OLD.id
           AND status IN ('PENDING', 'SUBMITTED', 'SUBMITTED_UNKNOWN',
                          'RETRYABLE_FAILED', 'DEAD_LETTER')
           AND command_type <> 'SYNC_DEVICE_COUNT'
              AND (nonce IS NOT NULL OR signed_transaction IS NOT NULL OR transaction_hash IS NOT NULL)
        ) AND NOT v_exact_reorg_rollback AND NOT v_exact_issue_reorg_rollback THEN
            RAISE EXCEPTION 'Pending ROTATE proposal is immutable after submission evidence exists';
        END IF;

        IF OLD.pending_activation_command_id IS NULL AND
           NEW.pending_activation_command_id IS NOT NULL AND EXISTS (
               SELECT 1 FROM chain_commands
               WHERE id = NEW.pending_activation_command_id
                 AND license_id = OLD.id
                 AND (nonce IS NOT NULL OR signed_transaction IS NOT NULL OR transaction_hash IS NOT NULL)
           ) AND NOT v_exact_reorg_rollback AND
                 NOT v_exact_issue_reconfirmation_recovery THEN
            RAISE EXCEPTION 'Submitted ROTATE evidence cannot be attached as a new pending proposal outside reorg rollback';
        END IF;

        IF OLD.pending_activation_command_id IS NOT NULL AND
           NEW.pending_activation_command_id IS DISTINCT FROM OLD.pending_activation_command_id THEN
            IF v_exact_reorg_rollback OR v_exact_issue_reorg_rollback THEN
                NULL;
            ELSIF EXISTS (
                SELECT 1 FROM chain_commands
                WHERE id = OLD.pending_activation_command_id
                  AND license_id = OLD.id
                  AND status = 'CONFIRMED'
            ) THEN
                IF NOT v_current_changed OR
                   NEW.activation_commitment IS DISTINCT FROM OLD.pending_activation_commitment OR
                   NEW.activation_key_version IS DISTINCT FROM OLD.pending_activation_key_version THEN
                    RAISE EXCEPTION 'Clearing confirmed ROTATE pending state requires exact current-key promotion';
                END IF;
            ELSIF EXISTS (
                SELECT 1 FROM chain_commands
                WHERE id = OLD.pending_activation_command_id
                  AND license_id = OLD.id
                  AND status IN ('ABANDONED', 'SUPERSEDED')
            ) THEN
                IF v_current_changed THEN
                    RAISE EXCEPTION 'Resolving an unconfirmed ROTATE cannot change the current activation key';
                END IF;
            ELSE
                RAISE EXCEPTION 'Pending ROTATE pointer changes only after confirmation or definitive resolution';
            END IF;
        END IF;
    END IF;

    IF NEW.activation_key_trust_status IS DISTINCT FROM OLD.activation_key_trust_status THEN
        IF OLD.activation_key_trust_status = 'PENDING_FINALITY' AND
           NEW.activation_key_trust_status = 'TRUSTED' THEN
            IF NOT EXISTS (
                SELECT 1
                FROM chain_events e
                JOIN chain_commands c ON c.id = e.chain_command_id
                WHERE e.id = NEW.last_applied_chain_event_id
                  AND e.license_id = OLD.id
                  AND e.event_type = 'LICENSE_ISSUED'
                  AND e.finality_status = 'CONFIRMED'
                  AND e.activation_commitment = NEW.activation_commitment
                  AND e.activation_key_version = NEW.activation_key_version
                  AND c.status = 'CONFIRMED'
                  AND c.confirmation_chain_event_id = e.id
            ) THEN
                RAISE EXCEPTION 'Initial key trust requires exact confirmed LICENSE_ISSUED evidence';
            END IF;
        ELSIF OLD.activation_key_trust_status IN ('PENDING_FINALITY', 'TRUSTED') AND
              NEW.activation_key_trust_status = 'UNTRUSTED_REORG' THEN
            IF NOT EXISTS (
                SELECT 1
                FROM chain_events e
                JOIN chain_commands c ON c.id = e.chain_command_id
                WHERE e.license_id = OLD.id
                  AND e.event_type IN ('LICENSE_ISSUED', 'KEY_ROTATED')
                  AND e.finality_status = 'REORGED'
                  AND c.status = 'SUBMITTED_UNKNOWN'
                  AND (
                      (e.event_type = 'LICENSE_ISSUED' AND
                       NEW.status = 'PENDING_ONCHAIN' AND
                       NEW.activation_commitment = e.activation_commitment AND
                       NEW.activation_key_version = e.activation_key_version) OR
                      (e.event_type = 'KEY_ROTATED' AND
                       NEW.activation_commitment = e.previous_activation_commitment AND
                       NEW.activation_key_version = e.previous_activation_key_version AND
                       NEW.pending_activation_commitment = e.activation_commitment AND
                       NEW.pending_activation_key_version = e.activation_key_version AND
                       NEW.pending_activation_command_id = c.id)
                  )
            ) THEN
                RAISE EXCEPTION 'UNTRUSTED_REORG requires reorged key evidence';
            END IF;
        ELSIF OLD.activation_key_trust_status = 'UNTRUSTED_REORG' AND
              NEW.activation_key_trust_status = 'TRUSTED' THEN
            IF EXISTS (
                SELECT 1 FROM chain_commands
                WHERE license_id = OLD.id
                  AND command_type IN ('ISSUE_LICENSE', 'ROTATE_KEY')
                  AND status = 'SUBMITTED_UNKNOWN'
            ) OR NOT EXISTS (
                SELECT 1
                FROM chain_events e
                JOIN chain_commands c ON c.id = e.chain_command_id
                WHERE e.id = NEW.last_applied_chain_event_id
                  AND e.license_id = OLD.id
                  AND e.event_type IN ('LICENSE_ISSUED', 'KEY_ROTATED')
                  AND e.finality_status = 'CONFIRMED'
                  AND e.activation_commitment = NEW.activation_commitment
                  AND e.activation_key_version = NEW.activation_key_version
                  AND c.status = 'CONFIRMED'
                  AND c.confirmation_chain_event_id = e.id
            ) THEN
                RAISE EXCEPTION 'Restored key trust requires exact canonical key event';
            END IF;
        ELSE
            RAISE EXCEPTION 'Invalid activation key trust transition: % -> %',
                OLD.activation_key_trust_status, NEW.activation_key_trust_status;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_licenses_activation_projection
BEFORE UPDATE ON licenses
FOR EACH ROW EXECUTE FUNCTION guard_license_activation_projection();

-- Provider evidence and its original classification never change. Review may
-- attach the exact Order/Attempt and resolution without rewriting the source event.
CREATE FUNCTION guard_payment_transaction_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_old_effect BOOLEAN;
    v_new_effect BOOLEAN;
BEGIN
    v_old_effect := OLD.classification = 'MATCHED' OR
                    COALESCE(OLD.review_resolution IN ('ACCEPT_AND_FULFILL', 'REMATCHED'), FALSE);
    v_new_effect := NEW.classification = 'MATCHED' OR
                    COALESCE(NEW.review_resolution IN ('ACCEPT_AND_FULFILL', 'REMATCHED'), FALSE);

    IF OLD.review_status = 'OPEN' AND
       NEW.review_status IN ('RESOLVED', 'CLOSED_NO_ACTION') THEN
        NEW.reviewed_at := statement_timestamp();
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id OR
       NEW.provider_event_id IS DISTINCT FROM OLD.provider_event_id OR
       NEW.provider_transaction_ref IS DISTINCT FROM OLD.provider_transaction_ref OR
       NEW.amount_minor IS DISTINCT FROM OLD.amount_minor OR
       NEW.currency IS DISTINCT FROM OLD.currency OR
       NEW.classification IS DISTINCT FROM OLD.classification OR
       NEW.duplicate_of_transaction_id IS DISTINCT FROM OLD.duplicate_of_transaction_id OR
       NEW.raw_payload IS DISTINCT FROM OLD.raw_payload OR
       NEW.provider_occurred_at IS DISTINCT FROM OLD.provider_occurred_at OR
       NEW.received_at IS DISTINCT FROM OLD.received_at OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'PaymentTransaction provider evidence/classification is immutable';
    END IF;

    IF v_old_effect AND
       (NOT v_new_effect OR
        NEW.order_id IS DISTINCT FROM OLD.order_id OR
        NEW.payment_attempt_id IS DISTINCT FROM OLD.payment_attempt_id) THEN
        RAISE EXCEPTION 'PaymentTransaction effect and Order/Attempt linkage are immutable';
    END IF;

    IF OLD.review_status IN ('RESOLVED', 'CLOSED_NO_ACTION') AND
       ROW(NEW.order_id, NEW.payment_attempt_id, NEW.review_status,
           NEW.review_reason, NEW.review_resolution,
           NEW.reviewed_by_user_id, NEW.reviewed_at)
       IS DISTINCT FROM
       ROW(OLD.order_id, OLD.payment_attempt_id, OLD.review_status,
           OLD.review_reason, OLD.review_resolution,
           OLD.reviewed_by_user_id, OLD.reviewed_at) THEN
        RAISE EXCEPTION 'Resolved PaymentTransaction review is immutable';
    END IF;

    IF (OLD.review_status IS NULL AND
          NEW.review_status IN ('RESOLVED', 'CLOSED_NO_ACTION')) OR
       (OLD.review_status = 'OPEN' AND NEW.review_status IS NULL) THEN
        RAISE EXCEPTION 'PaymentTransaction review must follow NONE -> OPEN -> terminal';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_transactions_immutable
BEFORE UPDATE ON payment_transactions
FOR EACH ROW EXECUTE FUNCTION guard_payment_transaction_evidence();

CREATE FUNCTION enforce_payment_attempt_admission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_order_status VARCHAR(40);
    v_service_terms_accepted_at TIMESTAMPTZ;
    v_payment_due_at TIMESTAMPTZ;
BEGIN
    IF NEW.status <> 'PENDING' THEN
        RAISE EXCEPTION 'A new PaymentAttempt must enter in PENDING state';
    END IF;

    IF NEW.succeeded_at IS NOT NULL OR NEW.failed_at IS NOT NULL OR
       NEW.expired_at IS NOT NULL OR NEW.superseded_at IS NOT NULL OR
       NEW.corrected_from_status IS NOT NULL OR NEW.correction_boundary_at IS NOT NULL THEN
        RAISE EXCEPTION 'A new PaymentAttempt cannot contain terminal or correction evidence';
    END IF;

    NEW.created_at := statement_timestamp();
    NEW.updated_at := NEW.created_at;

    SELECT order_status, service_terms_accepted_at, payment_due_at
    INTO v_order_status, v_service_terms_accepted_at, v_payment_due_at
    FROM orders
    WHERE id = NEW.order_id
    FOR UPDATE;

    IF NOT FOUND OR v_order_status <> 'WAITING_PAYMENT' OR
       v_service_terms_accepted_at IS NULL OR statement_timestamp() >= v_payment_due_at OR
       NEW.created_at < v_service_terms_accepted_at OR
       NEW.created_at >= v_payment_due_at OR NEW.expires_at > v_payment_due_at THEN
        RAISE EXCEPTION 'PaymentAttempt requires a terms-accepted WAITING_PAYMENT Order before due time';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_attempts_admission
BEFORE INSERT ON payment_attempts
FOR EACH ROW EXECUTE FUNCTION enforce_payment_attempt_admission();

-- An event may create a commercial effect only from the exact accepted-Terms
-- checkout lane and only when provider time falls inside both payment deadlines.
CREATE FUNCTION enforce_payment_fulfillment_gate()
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

CREATE TRIGGER trg_payment_transactions_fulfillment_gate
BEFORE INSERT OR UPDATE ON payment_transactions
FOR EACH ROW EXECUTE FUNCTION enforce_payment_fulfillment_gate();

-- The durable payment effect, Order projection and successful Attempt must agree
-- at transaction end. Insert/update the effect while Order is WAITING_PAYMENT and,
-- for late correction, before replacing the Attempt's old terminal evidence;
-- then correct the Attempt before projecting the Order to PAYMENT_ACCEPTED.
CREATE FUNCTION enforce_payment_effect_projection()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_order_id UUID;
    v_order_status VARCHAR(40);
    v_payment_accepted_at TIMESTAMPTZ;
    v_effect_count INT;
    v_effect_attempt_id UUID;
    v_effect_attempt_status VARCHAR(30);
BEGIN
    IF TG_TABLE_NAME = 'orders' THEN
        v_order_id := NEW.id;
    ELSIF TG_TABLE_NAME = 'payment_attempts' THEN
        v_order_id := NEW.order_id;
    ELSE
        v_order_id := NEW.order_id;
    END IF;

    IF v_order_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT order_status, payment_accepted_at
    INTO v_order_status, v_payment_accepted_at
    FROM orders
    WHERE id = v_order_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    SELECT count(*)
    INTO v_effect_count
    FROM payment_transactions
    WHERE fulfillment_order_id = v_order_id;

    IF v_effect_count = 1 THEN
        SELECT fulfillment_payment_attempt_id
        INTO v_effect_attempt_id
        FROM payment_transactions
        WHERE fulfillment_order_id = v_order_id;

        SELECT status INTO v_effect_attempt_status
        FROM payment_attempts
        WHERE id = v_effect_attempt_id AND order_id = v_order_id;

        IF v_order_status <> 'PAYMENT_ACCEPTED' OR v_payment_accepted_at IS NULL OR
           v_effect_attempt_status IS DISTINCT FROM 'SUCCEEDED' THEN
            RAISE EXCEPTION 'Payment effect requires PAYMENT_ACCEPTED Order and exact SUCCEEDED Attempt';
        END IF;

        IF EXISTS (
            SELECT 1 FROM payment_attempts
            WHERE order_id = v_order_id
              AND id <> v_effect_attempt_id
              AND status = 'PENDING'
        ) THEN
            RAISE EXCEPTION 'PAYMENT_ACCEPTED Order cannot retain another PENDING PaymentAttempt';
        END IF;
    ELSIF v_order_status = 'PAYMENT_ACCEPTED' THEN
        RAISE EXCEPTION 'PAYMENT_ACCEPTED Order requires exactly one durable payment effect';
    END IF;

    IF v_order_status IN ('CANCELLED', 'EXPIRED') AND EXISTS (
        SELECT 1 FROM payment_attempts
        WHERE order_id = v_order_id AND status = 'PENDING'
    ) THEN
        RAISE EXCEPTION 'Terminal Order cannot retain a PENDING PaymentAttempt';
    END IF;

    IF TG_TABLE_NAME = 'payment_attempts' THEN
        IF NEW.status = 'SUCCEEDED' AND NOT EXISTS (
            SELECT 1 FROM payment_transactions
            WHERE fulfillment_order_id = NEW.order_id
              AND fulfillment_payment_attempt_id = NEW.id
        ) THEN
            RAISE EXCEPTION 'SUCCEEDED PaymentAttempt requires its exact durable payment effect';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_orders_payment_effect_projection
AFTER INSERT OR UPDATE ON orders
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_payment_effect_projection();

CREATE CONSTRAINT TRIGGER trg_payment_attempts_effect_projection
AFTER INSERT OR UPDATE ON payment_attempts
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_payment_effect_projection();

CREATE CONSTRAINT TRIGGER trg_payment_transactions_effect_projection
AFTER INSERT OR UPDATE ON payment_transactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_payment_effect_projection();

-- A License and every commerce-backed chain command must be causally rooted in
-- one accepted durable payment effect. Deferred checks allow the effect,
-- projections, License and command to be written in one transaction.
CREATE FUNCTION enforce_license_paid_origin()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_license licenses%ROWTYPE;
BEGIN
    SELECT * INTO v_license FROM licenses WHERE id = NEW.id;
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM orders o
        JOIN payment_transactions pt ON pt.fulfillment_order_id = o.id
        WHERE o.id = v_license.origin_order_id
          AND o.order_type = 'NEW_PURCHASE'
          AND o.order_status = 'PAYMENT_ACCEPTED'
          AND payment_effective_time(pt) = v_license.period_start
          AND o.max_active_devices_snapshot = v_license.max_active_devices
    ) THEN
        RAISE EXCEPTION 'License origin requires the exact accepted payment effect, period start and device quota';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM chain_commands c
        WHERE c.license_id = v_license.id
          AND c.command_type = 'ISSUE_LICENSE'
          AND c.order_id = v_license.origin_order_id
    ) THEN
        RAISE EXCEPTION 'License creation requires its ISSUE_LICENSE command in the same transaction';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_licenses_paid_origin
AFTER INSERT ON licenses
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_license_paid_origin();

CREATE FUNCTION enforce_commerce_command_paid_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.command_type NOT IN ('ISSUE_LICENSE', 'RENEW_LICENSE') THEN
        RETURN NEW;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM orders o
        JOIN payment_transactions pt ON pt.fulfillment_order_id = o.id
        WHERE o.id = NEW.order_id
          AND o.order_status = 'PAYMENT_ACCEPTED'
    ) THEN
        RAISE EXCEPTION '% requires the exact accepted payment effect', NEW.command_type;
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_chain_commands_paid_order
AFTER INSERT ON chain_commands
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_commerce_command_paid_order();

-- A key-affecting event cannot lose finality while the delivered-key trust marker
-- remains TRUSTED. Other deferred FKs require command/projection pointers to move too.
CREATE FUNCTION enforce_key_reorg_trust()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM chain_commands c
        JOIN chain_events e ON e.chain_command_id = c.id
        WHERE c.license_id = NEW.license_id
          AND c.command_type = 'ISSUE_LICENSE'
          AND c.status = 'SUBMITTED_UNKNOWN'
          AND e.event_type = 'LICENSE_ISSUED'
          AND e.finality_status = 'REORGED'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM licenses l
            JOIN chain_commands c ON c.license_id = l.id
            JOIN chain_events e ON e.chain_command_id = c.id
            WHERE l.id = NEW.license_id
              AND l.status = 'PENDING_ONCHAIN'
              AND l.activation_key_trust_status = 'UNTRUSTED_REORG'
              AND l.pending_activation_command_id IS NULL
              AND c.command_type = 'ISSUE_LICENSE'
              AND c.status = 'SUBMITTED_UNKNOWN'
              AND e.event_type = 'LICENSE_ISSUED'
              AND e.finality_status = 'REORGED'
              AND l.activation_commitment = e.activation_commitment
              AND l.activation_key_version = e.activation_key_version
        ) THEN
            RAISE EXCEPTION 'ISSUE reorg must retain its exact proposal in PENDING_ONCHAIN/UNTRUSTED_REORG';
        END IF;
    ELSIF NOT EXISTS (
        SELECT 1
        FROM licenses l
        JOIN chain_commands c ON c.id = l.pending_activation_command_id
        JOIN chain_events e ON e.chain_command_id = c.id
        WHERE l.id = NEW.license_id
          AND l.activation_key_trust_status = 'UNTRUSTED_REORG'
          AND c.command_type = 'ROTATE_KEY'
          AND c.status = 'SUBMITTED_UNKNOWN'
          AND e.event_type = 'KEY_ROTATED'
          AND e.finality_status = 'REORGED'
          AND l.activation_commitment = e.previous_activation_commitment
          AND l.activation_key_version = e.previous_activation_key_version
          AND l.pending_activation_commitment = e.activation_commitment
          AND l.pending_activation_key_version = e.activation_key_version
          AND NOT EXISTS (
              SELECT 1 FROM chain_commands earlier
              WHERE earlier.license_id = l.id
                AND earlier.command_type = 'ROTATE_KEY'
                AND earlier.status = 'SUBMITTED_UNKNOWN'
                AND earlier.license_command_sequence < c.license_command_sequence
          )
    ) THEN
        RAISE EXCEPTION 'ROTATE reorg must project the earliest unresolved key transition exactly';
    END IF;
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_chain_events_key_reorg_trust
AFTER UPDATE OF finality_status ON chain_events
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
WHEN (OLD.finality_status = 'CONFIRMED' AND
      NEW.finality_status <> 'CONFIRMED' AND
      NEW.event_type IN ('LICENSE_ISSUED', 'KEY_ROTATED'))
EXECUTE FUNCTION enforce_key_reorg_trust();

-- Confirmation is a two-way relation at commit: the event is confirmed, and the
-- command points back to that exact event with CONFIRMED status.
CREATE FUNCTION enforce_confirmed_event_command_link()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM chain_commands
        WHERE id = NEW.chain_command_id
          AND status = 'CONFIRMED'
          AND confirmation_chain_event_id = NEW.id
    ) THEN
        RAISE EXCEPTION 'Confirmed ChainEvent requires matching confirmed ChainCommand pointer';
    END IF;
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_chain_events_confirmed_command
AFTER INSERT OR UPDATE OF finality_status ON chain_events
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
WHEN (NEW.finality_status = 'CONFIRMED')
EXECUTE FUNCTION enforce_confirmed_event_command_link();

-- A confirmed command may demote only when its own confirmation event is no
-- longer canonical in the same transaction.
CREATE FUNCTION enforce_confirmed_command_demotion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM chain_events
        WHERE id = OLD.confirmation_chain_event_id
          AND finality_status = 'CONFIRMED'
    ) THEN
        RAISE EXCEPTION 'Confirmed ChainCommand cannot demote while its event remains canonical';
    END IF;
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_chain_commands_confirmed_demotion
AFTER UPDATE OF status ON chain_commands
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
WHEN (OLD.status = 'CONFIRMED' AND NEW.status = 'SUBMITTED_UNKNOWN')
EXECUTE FUNCTION enforce_confirmed_command_demotion();

CREATE FUNCTION enforce_key_confirmation_trust()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM chain_commands
        WHERE license_id = NEW.license_id
          AND command_type IN ('ISSUE_LICENSE', 'ROTATE_KEY')
          AND status = 'SUBMITTED_UNKNOWN'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM licenses
            WHERE id = NEW.license_id
              AND activation_key_trust_status = 'UNTRUSTED_REORG'
              AND activation_commitment = NEW.activation_commitment
              AND activation_key_version = NEW.activation_key_version
              AND pending_activation_command_id IS NOT NULL
        ) THEN
            RAISE EXCEPTION 'Confirmed intermediate key event must remain UNTRUSTED_REORG while recovery suffix is unresolved';
        END IF;
    ELSIF NOT EXISTS (
        SELECT 1 FROM licenses
        WHERE id = NEW.license_id
          AND activation_key_trust_status = 'TRUSTED'
          AND activation_commitment = NEW.activation_commitment
          AND activation_key_version = NEW.activation_key_version
    ) THEN
        RAISE EXCEPTION 'Confirmed final key event requires TRUSTED License state';
    END IF;
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_chain_events_key_confirmation_trust
AFTER INSERT OR UPDATE OF finality_status ON chain_events
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
WHEN (NEW.finality_status = 'CONFIRMED' AND
      NEW.event_type IN ('LICENSE_ISSUED', 'KEY_ROTATED'))
EXECUTE FUNCTION enforce_key_confirmation_trust();

-- 12. Provider knowledge document; private storage metadata only.
CREATE TABLE knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_user_id UUID NOT NULL,
    product_id UUID NOT NULL,
    logical_document_key VARCHAR(180) NOT NULL,
    version INT NOT NULL,
    source_type VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    storage_key TEXT,
    storage_mime_type VARCHAR(120),
    storage_size_bytes BIGINT,
    checksum BYTEA,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_knowledge_documents_provider
        FOREIGN KEY (provider_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_knowledge_documents_product
        FOREIGN KEY (product_id, provider_user_id)
        REFERENCES products(id, provider_user_id) ON DELETE RESTRICT,
    CONSTRAINT uq_knowledge_documents_version UNIQUE (provider_user_id, logical_document_key, version),
    CONSTRAINT ck_knowledge_documents_version CHECK (version > 0),
    CONSTRAINT ck_knowledge_documents_source CHECK (source_type IN ('FAQ', 'PDF', 'TXT')),
    CONSTRAINT ck_knowledge_documents_status CHECK (
        status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED')
    ),
    CONSTRAINT ck_knowledge_documents_current CHECK (NOT is_current OR status = 'READY'),
    CONSTRAINT ck_knowledge_documents_file_size CHECK (storage_size_bytes IS NULL OR storage_size_bytes > 0)
);

CREATE UNIQUE INDEX uq_knowledge_documents_one_current
    ON knowledge_documents (provider_user_id, logical_document_key)
    WHERE is_current;

-- 13. RAG chunks. Embedding dimension remains configuration-gated.
CREATE TABLE knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    token_count INT,
    embedding VECTOR,
    embedding_model VARCHAR(120),
    embedding_dimension INT,
    source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_knowledge_chunks_document
        FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    CONSTRAINT uq_knowledge_chunks_position UNIQUE (document_id, chunk_index),
    CONSTRAINT ck_knowledge_chunks_index CHECK (chunk_index >= 0),
    CONSTRAINT ck_knowledge_chunks_tokens CHECK (token_count IS NULL OR token_count >= 0),
    CONSTRAINT ck_knowledge_chunks_source_metadata CHECK (
        jsonb_typeof(source_metadata) = 'object'
    ),
    CONSTRAINT ck_knowledge_chunks_embedding CHECK (
        (embedding IS NULL AND embedding_model IS NULL AND embedding_dimension IS NULL) OR
        (embedding IS NOT NULL AND embedding_model IS NOT NULL AND embedding_dimension > 0 AND
            vector_dims(embedding) = embedding_dimension)
    )
);

-- 14. Unified AI/Support conversation lifecycle.
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_user_id UUID NOT NULL,
    customer_role VARCHAR(30) GENERATED ALWAYS AS ('CUSTOMER') STORED,
    assigned_support_user_id UUID,
    assigned_support_role VARCHAR(30) GENERATED ALWAYS AS (
        CASE WHEN assigned_support_user_id IS NULL THEN NULL ELSE 'SUPPORT_STAFF' END
    ) STORED,
    status VARCHAR(30) NOT NULL DEFAULT 'AI_ACTIVE',
    version INT NOT NULL DEFAULT 1,
    title VARCHAR(255),
    context_type VARCHAR(20) NOT NULL DEFAULT 'GENERAL',
    context_id UUID,
    last_message_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_conversations_support
        FOREIGN KEY (assigned_support_user_id, assigned_support_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT fk_conversations_customer
        FOREIGN KEY (customer_user_id, customer_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT ck_conversations_status CHECK (
        status IN ('AI_ACTIVE', 'WAITING_SUPPORT', 'SUPPORT_ACTIVE', 'CLOSED')
    ),
    CONSTRAINT ck_conversations_version CHECK (version > 0),
    CONSTRAINT ck_conversations_context CHECK (
        context_type IN ('GENERAL', 'PRODUCT', 'PLAN', 'ORDER', 'LICENSE') AND
        ((context_type = 'GENERAL' AND context_id IS NULL) OR
         (context_type <> 'GENERAL' AND context_id IS NOT NULL))
    ),
    CONSTRAINT ck_conversations_assignment CHECK (
        (status = 'SUPPORT_ACTIVE' AND assigned_support_user_id IS NOT NULL AND claimed_at IS NOT NULL) OR
        (status = 'AI_ACTIVE' AND assigned_support_user_id IS NULL AND claimed_at IS NULL) OR
        (status = 'WAITING_SUPPORT' AND assigned_support_user_id IS NULL) OR
        status = 'CLOSED'
    ),
    CONSTRAINT ck_conversations_closed_stamp CHECK (
        (status = 'CLOSED' AND closed_at IS NOT NULL) OR
        (status <> 'CLOSED' AND closed_at IS NULL)
    )
);

-- 15. AI and Support share one ordered/idempotent timeline. Customer/Support
-- supply a stable client UUID; AI/System supply a stable event/job UUID.
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    sender_user_id UUID,
    sender_type VARCHAR(20) NOT NULL,
    sender_role VARCHAR(30) GENERATED ALWAYS AS (
        CASE sender_type
            WHEN 'CUSTOMER' THEN 'CUSTOMER'
            WHEN 'SUPPORT' THEN 'SUPPORT_STAFF'
            ELSE NULL
        END
    ) STORED,
    client_message_id UUID NOT NULL,
    server_sequence BIGINT NOT NULL,
    content TEXT NOT NULL,
    model_name VARCHAR(120),
    grounded BOOLEAN,
    sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_messages_conversation
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_sender
        FOREIGN KEY (sender_user_id, sender_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT uq_messages_client_id UNIQUE (conversation_id, client_message_id),
    CONSTRAINT uq_messages_sequence UNIQUE (conversation_id, server_sequence),
    CONSTRAINT ck_messages_sender CHECK (sender_type IN ('CUSTOMER', 'SUPPORT', 'AI', 'SYSTEM')),
    CONSTRAINT ck_messages_sequence CHECK (server_sequence > 0),
    CONSTRAINT ck_messages_sources CHECK (jsonb_typeof(sources) = 'array'),
    CONSTRAINT ck_messages_sender_identity CHECK (
        (sender_type IN ('CUSTOMER', 'SUPPORT') AND sender_user_id IS NOT NULL AND sender_role IS NOT NULL) OR
        (sender_type IN ('AI', 'SYSTEM') AND sender_user_id IS NULL AND sender_role IS NULL)
    )
);

-- 16. Durable per-channel notification owner.
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    event_key VARCHAR(180) NOT NULL,
    type VARCHAR(60) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    channel VARCHAR(20) NOT NULL,
    delivery_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    attempt_count INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    lease_owner VARCHAR(180),
    lease_expires_at TIMESTAMPTZ,
    last_error TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_notifications_event_channel UNIQUE (user_id, event_key, channel),
    CONSTRAINT ck_notifications_channel CHECK (channel IN ('IN_APP', 'EMAIL', 'PUSH')),
    CONSTRAINT ck_notifications_delivery CHECK (
        delivery_status IN ('PENDING', 'SENT', 'RETRYABLE_FAILED', 'DEAD_LETTER')
    ),
    CONSTRAINT ck_notifications_delivery_evidence CHECK (
        (delivery_status = 'SENT' AND sent_at IS NOT NULL) OR
        (delivery_status <> 'SENT' AND sent_at IS NULL)
    ),
    CONSTRAINT ck_notifications_data CHECK (jsonb_typeof(data) = 'object'),
    CONSTRAINT ck_notifications_attempts CHECK (attempt_count >= 0)
    ,CONSTRAINT ck_notifications_lease CHECK ((lease_owner IS NULL AND lease_expires_at IS NULL) OR (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL))
);

-- 17. Android push registration.
CREATE TABLE mobile_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token TEXT NOT NULL UNIQUE,
    provider VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    last_seen_at TIMESTAMPTZ,
    invalidated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_mobile_push_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT ck_mobile_push_tokens_status CHECK (status IN ('ACTIVE', 'INVALID')),
    CONSTRAINT ck_mobile_push_tokens_invalidation CHECK (
        (status = 'ACTIVE' AND invalidated_at IS NULL) OR
        (status = 'INVALID' AND invalidated_at IS NOT NULL)
    )
);

-- 18. Append-only audit. Message body, secrets and private keys must be redacted.
CREATE TABLE audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id UUID,
    actor_role VARCHAR(30),
    actor_email_snapshot CITEXT,
    action VARCHAR(120) NOT NULL,
    target_type VARCHAR(80),
    target_id UUID,
    reason TEXT,
    outcome VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_audit_logs_actor
        FOREIGN KEY (actor_user_id, actor_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT ck_audit_logs_actor_role CHECK (
        (actor_user_id IS NULL AND actor_role IS NULL) OR
        (actor_user_id IS NOT NULL AND
            actor_role IN ('SYSTEM_ADMIN', 'PROVIDER_ADMIN', 'CUSTOMER', 'SUPPORT_STAFF'))
    ),
    CONSTRAINT ck_audit_logs_outcome CHECK (outcome IN ('SUCCESS', 'DENIED', 'FAILED')),
    CONSTRAINT ck_audit_logs_metadata CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE FUNCTION reject_audit_logs_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = '55000';
    RETURN NULL;
END;
$$;

CREATE TRIGGER audit_logs_no_update_or_delete
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION reject_audit_logs_mutation();

CREATE TRIGGER audit_logs_no_truncate
    BEFORE TRUNCATE ON audit_logs
    FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_logs_mutation();

-- Provider payment evidence and blockchain command/event records are durable;
-- ChainEvent reorg occurrence detail is represented only by its durable summary.
-- Retention must archive by an explicit future policy, never mutate the baseline rows.
CREATE FUNCTION reject_durable_evidence_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '% is append-only and cannot be deleted or truncated', TG_TABLE_NAME
        USING ERRCODE = '55000';
    RETURN NULL;
END;
$$;

CREATE TRIGGER payment_transactions_no_delete
    BEFORE DELETE ON payment_transactions
    FOR EACH STATEMENT EXECUTE FUNCTION reject_durable_evidence_removal();

CREATE TRIGGER payment_transactions_no_truncate
    BEFORE TRUNCATE ON payment_transactions
    FOR EACH STATEMENT EXECUTE FUNCTION reject_durable_evidence_removal();

CREATE TRIGGER orders_no_delete
    BEFORE DELETE ON orders
    FOR EACH STATEMENT EXECUTE FUNCTION reject_durable_evidence_removal();

CREATE TRIGGER orders_no_truncate
    BEFORE TRUNCATE ON orders
    FOR EACH STATEMENT EXECUTE FUNCTION reject_durable_evidence_removal();

CREATE TRIGGER payment_attempts_no_delete
    BEFORE DELETE ON payment_attempts
    FOR EACH STATEMENT EXECUTE FUNCTION reject_durable_evidence_removal();

CREATE TRIGGER payment_attempts_no_truncate
    BEFORE TRUNCATE ON payment_attempts
    FOR EACH STATEMENT EXECUTE FUNCTION reject_durable_evidence_removal();

CREATE TRIGGER chain_commands_no_delete
    BEFORE DELETE ON chain_commands
    FOR EACH STATEMENT EXECUTE FUNCTION reject_durable_evidence_removal();

CREATE TRIGGER chain_commands_no_truncate
    BEFORE TRUNCATE ON chain_commands
    FOR EACH STATEMENT EXECUTE FUNCTION reject_durable_evidence_removal();

CREATE TRIGGER chain_events_no_delete
    BEFORE DELETE ON chain_events
    FOR EACH STATEMENT EXECUTE FUNCTION reject_durable_evidence_removal();

CREATE TRIGGER chain_events_no_truncate
    BEFORE TRUNCATE ON chain_events
    FOR EACH STATEMENT EXECUTE FUNCTION reject_durable_evidence_removal();

-- Query and durable worker indexes.
CREATE INDEX ix_users_role_status ON users (role, status);
CREATE INDEX ix_products_provider_status ON products (provider_user_id, status, updated_at DESC);
CREATE INDEX ix_products_catalog ON products (status, published_at DESC);
CREATE INDEX ix_plans_product_catalog ON plans (product_id, status, price_vnd);
CREATE INDEX ix_plans_provider ON plans (provider_user_id, status, updated_at DESC);
CREATE INDEX ix_orders_customer_status ON orders (customer_user_id, order_status, created_at DESC);
CREATE INDEX ix_orders_provider_history ON orders (provider_user_id, created_at DESC);
CREATE INDEX ix_orders_status_due ON orders (order_status, payment_due_at);
CREATE UNIQUE INDEX uq_orders_one_open_renewal
    ON orders (target_license_id)
    WHERE order_type = 'RENEWAL'
      AND order_status IN ('WAITING_SERVICE_TERMS_ACCEPTANCE', 'WAITING_PAYMENT');
CREATE INDEX ix_payment_attempts_order ON payment_attempts (order_id, created_at DESC);
CREATE UNIQUE INDEX uq_payment_attempts_one_pending
    ON payment_attempts (order_id) WHERE status = 'PENDING';
CREATE INDEX ix_payment_transactions_review ON payment_transactions (review_status, received_at)
    WHERE review_status = 'OPEN';
CREATE INDEX ix_payment_transactions_order
    ON payment_transactions (order_id, received_at DESC) WHERE order_id IS NOT NULL;
CREATE INDEX ix_payment_transactions_provider_ref
    ON payment_transactions (provider_transaction_ref)
    WHERE provider_transaction_ref IS NOT NULL;
CREATE UNIQUE INDEX uq_payment_transactions_one_effect_attempt
    ON payment_transactions (payment_attempt_id)
    WHERE effect_transaction_id IS NOT NULL;
CREATE INDEX ix_licenses_provider ON licenses (provider_user_id, status, expires_at);
CREATE INDEX ix_licenses_customer ON licenses (customer_user_id, status, expires_at);
CREATE INDEX ix_licenses_expiry ON licenses (status, expires_at);
CREATE INDEX ix_license_devices_license_status ON license_devices (license_id, status);
CREATE INDEX ix_chain_commands_retry ON chain_commands (status, next_attempt_at, created_at)
    WHERE status IN ('PENDING', 'SUBMITTED_UNKNOWN', 'RETRYABLE_FAILED');
CREATE INDEX ix_chain_commands_subject ON chain_commands (license_id, license_device_id, created_at DESC);
CREATE INDEX ix_chain_commands_causal_order
    ON chain_commands (license_id, license_command_sequence DESC);
CREATE INDEX ix_chain_commands_basis_event
    ON chain_commands (basis_chain_event_id) WHERE basis_chain_event_id IS NOT NULL;
-- Forward-only creation guard for every rights mutation. SUBMITTED_UNKNOWN and
-- DEAD_LETTER are intentionally excluded because a deep reorg can create an ordered
-- recovery set. The application-level per-License admission lock must block all new
-- mutations while any UNKNOWN or unresolved DEAD_LETTER row exists.
CREATE UNIQUE INDEX uq_chain_commands_one_forward_mutation
     ON chain_commands (license_id)
     WHERE status IN ('PENDING', 'SUBMITTED', 'RETRYABLE_FAILED')
       AND command_type <> 'SYNC_DEVICE_COUNT';
CREATE UNIQUE INDEX uq_chain_commands_current_issue_order
    ON chain_commands (issue_order_id)
    WHERE issue_order_id IS NOT NULL AND status NOT IN ('ABANDONED', 'SUPERSEDED');
CREATE UNIQUE INDEX uq_chain_commands_current_renewal_order
    ON chain_commands (renewal_order_id)
    WHERE renewal_order_id IS NOT NULL AND status NOT IN ('ABANDONED', 'SUPERSEDED');
CREATE INDEX ix_chain_events_finality ON chain_events (network, chain_id, contract_address, finality_status, block_number);
CREATE INDEX ix_chain_events_license ON chain_events (license_id, block_number DESC, log_index DESC);
CREATE INDEX ix_chain_events_command ON chain_events (chain_command_id);
CREATE INDEX ix_knowledge_documents_product ON knowledge_documents (provider_user_id, product_id, status, is_current);
CREATE INDEX ix_conversations_customer ON conversations (customer_user_id, updated_at DESC);
CREATE INDEX ix_conversations_support_queue ON conversations (status, created_at)
    WHERE status IN ('WAITING_SUPPORT', 'SUPPORT_ACTIVE');
CREATE INDEX ix_messages_timeline ON messages (conversation_id, server_sequence);
CREATE INDEX ix_notifications_delivery ON notifications (delivery_status, next_attempt_at, created_at)
    WHERE delivery_status IN ('PENDING', 'RETRYABLE_FAILED');
CREATE INDEX ix_notifications_inbox ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX ix_mobile_push_tokens_user ON mobile_push_tokens (user_id, status);
CREATE INDEX ix_audit_logs_search ON audit_logs (created_at DESC, action, target_type);

COMMIT;
