BEGIN;

-- Preserve legacy addresses/namespaces and all invitation tokens. New invitations
-- reserve only an email; recipient profile and namespace are set at acceptance.
ALTER TABLE provider_invitations
    ALTER COLUMN display_name DROP NOT NULL,
    ALTER COLUMN organization_name DROP NOT NULL,
    ALTER COLUMN provider_chain_address DROP NOT NULL,
    ALTER COLUMN provider_chain_namespace DROP NOT NULL;

ALTER TABLE users DROP CONSTRAINT ck_users_provider_fields;
ALTER TABLE users ADD CONSTRAINT ck_users_provider_fields CHECK (
    (role = 'PROVIDER_ADMIN' AND organization_name IS NOT NULL AND provider_chain_namespace IS NOT NULL) OR
    (role <> 'PROVIDER_ADMIN' AND provider_chain_address IS NULL AND provider_chain_namespace IS NULL)
);

COMMIT;
