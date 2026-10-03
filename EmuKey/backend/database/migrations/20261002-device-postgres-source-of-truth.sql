BEGIN;

-- Individual device state is operational PostgreSQL data. Historical chain events remain
-- in chain_events for audit/reconciliation, but no longer drive license_devices.
ALTER TABLE license_devices
  DROP CONSTRAINT IF EXISTS ck_license_devices_projection_evidence,
  DROP CONSTRAINT IF EXISTS fk_license_devices_last_chain_event;

ALTER TABLE license_devices
  ALTER COLUMN status SET DEFAULT 'ACTIVE';

UPDATE license_devices
SET status = 'ACTIVE', activated_at = COALESCE(activated_at, created_at)
WHERE status = 'PENDING_ONCHAIN';

ALTER TABLE license_devices
  DROP CONSTRAINT IF EXISTS ck_license_devices_status;
ALTER TABLE license_devices
  ADD CONSTRAINT ck_license_devices_status CHECK (status IN ('ACTIVE', 'REVOKED'));

ALTER TABLE license_devices
  DROP COLUMN IF EXISTS last_applied_chain_event_id;

ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS active_device_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS device_state_version BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS latest_requested_device_sync_version BIGINT,
  ADD COLUMN IF NOT EXISTS latest_confirmed_device_sync_version BIGINT,
  ADD COLUMN IF NOT EXISTS latest_confirmed_device_count INT,
  ADD COLUMN IF NOT EXISTS device_sync_status VARCHAR(30) NOT NULL DEFAULT 'PENDING';

UPDATE licenses l
SET active_device_count = COALESCE(devices.active_count, 0)
FROM (
  SELECT l2.id AS license_id, count(d.id) FILTER (WHERE d.status = 'ACTIVE')::int AS active_count
  FROM licenses l2
  LEFT JOIN license_devices d ON d.license_id = l2.id
  GROUP BY l2.id
) devices
WHERE l.id = devices.license_id;

ALTER TABLE licenses
  DROP CONSTRAINT IF EXISTS ck_licenses_values;
ALTER TABLE licenses
  ADD CONSTRAINT ck_licenses_values CHECK (
    expires_at > period_start AND max_active_devices > 0 AND
    active_device_count >= 0 AND active_device_count <= max_active_devices AND
    device_state_version >= 0 AND entitlement_version > 0 AND activation_key_version > 0 AND
    octet_length(plan_commitment) = 32 AND octet_length(activation_commitment) = 32
  );

ALTER TABLE chain_commands
  DROP CONSTRAINT IF EXISTS ck_chain_commands_type,
  DROP CONSTRAINT IF EXISTS ck_chain_commands_subject;
ALTER TABLE chain_commands
  ADD CONSTRAINT ck_chain_commands_type CHECK (
    command_type IN ('ISSUE_LICENSE', 'RENEW_LICENSE', 'SUSPEND_LICENSE', 'RESUME_LICENSE',
                     'REVOKE_LICENSE', 'ROTATE_KEY', 'ACTIVATE_DEVICE', 'REVOKE_DEVICE', 'SYNC_DEVICE_COUNT')
  ),
  ADD CONSTRAINT ck_chain_commands_subject CHECK (
    (command_type = 'ISSUE_LICENSE' AND order_id IS NOT NULL AND license_device_id IS NULL) OR
    (command_type = 'RENEW_LICENSE' AND order_id IS NOT NULL AND license_device_id IS NULL) OR
    (command_type IN ('SUSPEND_LICENSE', 'RESUME_LICENSE', 'REVOKE_LICENSE', 'ROTATE_KEY', 'SYNC_DEVICE_COUNT')
      AND order_id IS NULL AND license_device_id IS NULL) OR
    (command_type IN ('ACTIVATE_DEVICE', 'REVOKE_DEVICE')
      AND order_id IS NULL AND license_device_id IS NOT NULL)
  );

-- Preserve historical DEVICE_ACTIVATED/DEVICE_REVOKED rows. Runtime no longer creates
-- them, but old chain evidence remains readable for audit and reorg analysis.
ALTER TABLE chain_events
  DROP CONSTRAINT IF EXISTS ck_chain_events_type,
  DROP CONSTRAINT IF EXISTS ck_chain_events_device_shape;
ALTER TABLE chain_events
  ADD CONSTRAINT ck_chain_events_type CHECK (
    event_type IN ('LICENSE_ISSUED', 'LICENSE_RENEWED', 'LICENSE_SUSPENDED', 'LICENSE_RESUMED',
                   'LICENSE_REVOKED', 'KEY_ROTATED', 'DEVICE_ACTIVATED', 'DEVICE_REVOKED',
                   'ACTIVE_DEVICE_COUNT_SYNCED')
  ),
  ADD CONSTRAINT ck_chain_events_device_shape CHECK (
    (event_type IN ('DEVICE_ACTIVATED', 'DEVICE_REVOKED') AND license_device_id IS NOT NULL) OR
    (event_type NOT IN ('DEVICE_ACTIVATED', 'DEVICE_REVOKED') AND license_device_id IS NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_chain_commands_one_forward_mutation
  ON chain_commands (license_id)
  WHERE status IN ('PENDING', 'SUBMITTED', 'RETRYABLE_FAILED')
    AND command_type <> 'SYNC_DEVICE_COUNT';

-- Legacy device event rows remain immutable historical evidence. New runtime commands
-- never create them; their projections are intentionally ignored by device lifecycle code.


COMMIT;
