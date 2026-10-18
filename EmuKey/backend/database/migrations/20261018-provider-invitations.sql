BEGIN;

-- Provider onboarding: durable, single-use invitations; no account exists until acceptance.
CREATE TABLE provider_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL CHECK (btrim(display_name) <> ''),
    organization_name VARCHAR(255) NOT NULL CHECK (btrim(organization_name) <> ''),
    provider_chain_address VARCHAR(42) NOT NULL UNIQUE
        CHECK (provider_chain_address ~ '^0x[0-9a-f]{40}$' AND provider_chain_address <> '0x0000000000000000000000000000000000000000'),
    provider_chain_namespace CITEXT NOT NULL UNIQUE
        CHECK (provider_chain_namespace ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(provider_chain_namespace) <= 100),
    token_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
    invited_by_user_id UUID NOT NULL,
    invited_by_role VARCHAR(30) GENERATED ALWAYS AS ('SYSTEM_ADMIN') STORED,
    expires_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    accepted_user_id UUID,
    accepted_role VARCHAR(30) GENERATED ALWAYS AS ('PROVIDER_ADMIN') STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_provider_invitations_inviter FOREIGN KEY (invited_by_user_id, invited_by_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT fk_provider_invitations_recipient FOREIGN KEY (accepted_user_id, accepted_role)
        REFERENCES users(id, role) ON DELETE RESTRICT,
    CONSTRAINT ck_provider_invitations_acceptance CHECK (
        (accepted_at IS NULL AND accepted_user_id IS NULL) OR
        (accepted_at IS NOT NULL AND accepted_user_id IS NOT NULL)
    )
);

COMMIT;
