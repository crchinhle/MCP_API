BEGIN;

-- Aggregate device sync has its own projection fields and must not replace the
-- canonical lifecycle event used for license status, expiry, or key trust.
CREATE OR REPLACE FUNCTION enforce_latest_canonical_projection()
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

COMMIT;
