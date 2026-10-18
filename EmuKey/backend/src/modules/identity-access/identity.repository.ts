import { Pool, type PoolClient } from 'pg';

import { AuditWriter } from '../../platform/audit/audit-writer.js';
import type { AuthPrincipal, IdentityUser, UserState, ProviderInvitation, ProviderInvitationInput } from './identity.types.js';

function mapUser(value: unknown): IdentityUser {
  const row = value as Record<string, unknown>;
  const lockedUntil = row.locked_until;
  return {
    address: row.address as string | null,
    customerType: row.customer_type as IdentityUser['customerType'],
    displayName: String(row.display_name),
    email: String(row.email),
    emailVerifiedAt: row.email_verified_at ? dateValue(row.email_verified_at) : null,
    failedLoginCount: Number(row.failed_login_count),
    id: String(row.id),
    lockedUntil:
      lockedUntil instanceof Date
        ? lockedUntil
        : typeof lockedUntil === 'string'
          ? new Date(lockedUntil)
          : null,
    organizationName: row.organization_name as string | null,
    passwordHash: String(row.password_hash),
    phone: row.phone as string | null,
    role: row.role as IdentityUser['role'],
    sessionVersion: Number(row.session_version),
    status: row.status as UserState,
  };
}

function dateValue(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

export class IdentityRepository {
  constructor(
    private readonly pool: Pool,
    private readonly audit = new AuditWriter(),
  ) {}

  async createProviderInvitation(actor: AuthPrincipal, input: ProviderInvitationInput, tokenHash: string): Promise<ProviderInvitation> {
    return this.withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`identity-email:${input.email.trim().toLowerCase()}`]);
      const existing = await client.query(
        `SELECT id FROM users WHERE email = $1 OR provider_chain_address = $2 OR provider_chain_namespace = $3`,
        [input.email, input.providerChainAddress, input.providerChainNamespace],
      );
      if (existing.rows.length) throw new Error('PROVIDER_IDENTITY_CONFLICT');
      const result = await client.query<Record<string, unknown>>(
        `INSERT INTO provider_invitations
          (email, display_name, organization_name, provider_chain_address, provider_chain_namespace, token_hash, invited_by_user_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, decode($6, 'hex'), $7, now() + interval '24 hours')
         ON CONFLICT (email) DO UPDATE SET
           display_name = EXCLUDED.display_name, organization_name = EXCLUDED.organization_name,
           provider_chain_address = EXCLUDED.provider_chain_address, provider_chain_namespace = EXCLUDED.provider_chain_namespace,
           token_hash = EXCLUDED.token_hash, invited_by_user_id = EXCLUDED.invited_by_user_id,
           expires_at = EXCLUDED.expires_at, sent_at = NULL, updated_at = now()
         WHERE provider_invitations.accepted_at IS NULL
         RETURNING *`,
        [input.email, input.displayName, input.organizationName, input.providerChainAddress, input.providerChainNamespace, tokenHash, actor.sub],
      );
      if (!result.rows[0]) throw new Error('PROVIDER_IDENTITY_CONFLICT');
      const invitation = this.mapInvitation(result.rows[0]);
      await this.audit.write(client, { action: 'PROVIDER_INVITED', actorUserId: actor.sub, actorRole: actor.role, targetId: invitation.id, targetType: 'PROVIDER_INVITATION' });
      return invitation;
    });
  }

  async listProviderInvitations(): Promise<ProviderInvitation[]> {
    const result = await this.pool.query<Record<string, unknown>>('SELECT * FROM provider_invitations ORDER BY updated_at DESC');
    return result.rows.map((row) => this.mapInvitation(row));
  }

  async markProviderInvitationSent(id: string, tokenHash: string): Promise<void> {
    await this.pool.query("UPDATE provider_invitations SET sent_at = now() WHERE id = $1 AND token_hash = decode($2, 'hex')", [id, tokenHash]);
  }

  async acceptProviderInvitation(tokenHash: string, passwordHash: string): Promise<IdentityUser | null> {
    return this.withTransaction(async (client) => {
      const target = await client.query<{ email: string }>("SELECT email FROM provider_invitations WHERE token_hash = decode($1, 'hex')", [tokenHash]);
      if (!target.rows[0]) return null;
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`identity-email:${target.rows[0].email.trim().toLowerCase()}`]);
      // Row lock plus a conditional update makes acceptance single-use across processes.
      const pending = await client.query<Record<string, unknown>>(
        `SELECT i.* FROM provider_invitations i JOIN users inviter ON inviter.id = i.invited_by_user_id
         WHERE i.token_hash = decode($1, 'hex') AND i.accepted_at IS NULL AND i.expires_at > clock_timestamp()
           AND inviter.role = 'SYSTEM_ADMIN' AND inviter.status = 'ACTIVE'
         FOR UPDATE OF i`, [tokenHash],
      );
      const invitation = pending.rows[0];
      if (!invitation) return null;
      const result = await client.query<Record<string, unknown>>(
        `INSERT INTO users (email, password_hash, display_name, role, status, organization_name,
                            provider_chain_address, provider_chain_namespace, email_verified_at)
         VALUES ($1, $2, $3, 'PROVIDER_ADMIN', 'ACTIVE', $4, $5, $6, now()) RETURNING *`,
        [invitation.email, passwordHash, invitation.display_name, invitation.organization_name, invitation.provider_chain_address, invitation.provider_chain_namespace],
      );
      const user = mapUser(result.rows[0]);
      await client.query('UPDATE provider_invitations SET accepted_at = now(), accepted_user_id = $2, updated_at = now() WHERE id = $1', [invitation.id, user.id]);
      await this.audit.write(client, { action: 'PROVIDER_INVITATION_ACCEPTED', actorUserId: user.id, actorRole: user.role, targetId: user.id, targetType: 'USER', metadata: { invitationId: invitation.id, invitedByUserId: invitation.invited_by_user_id } });
      return user;
    });
  }

  async isProviderInvitationPending(tokenHash: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT i.id FROM provider_invitations i JOIN users inviter ON inviter.id = i.invited_by_user_id
       WHERE token_hash = decode($1, 'hex') AND accepted_at IS NULL AND expires_at > clock_timestamp()
         AND inviter.role = 'SYSTEM_ADMIN' AND inviter.status = 'ACTIVE'`, [tokenHash],
    );
    return result.rows.length > 0;
  }

  private mapInvitation(row: Record<string, unknown>): ProviderInvitation {
    return {
      id: String(row.id), email: String(row.email), displayName: String(row.display_name),
      organizationName: String(row.organization_name), providerChainAddress: String(row.provider_chain_address),
      providerChainNamespace: String(row.provider_chain_namespace), createdAt: dateValue(row.created_at).toISOString(),
      expiresAt: dateValue(row.expires_at).toISOString(), sentAt: row.sent_at ? dateValue(row.sent_at).toISOString() : null,
      status: row.accepted_at ? 'ACCEPTED' : dateValue(row.expires_at).getTime() <= Date.now() ? 'EXPIRED' : 'PENDING',
    };
  }

  async createCustomer(input: {
    customerType: 'BUSINESS' | 'INDIVIDUAL' | 'STUDENT';
    displayName: string;
    email: string;
    passwordHash: string;
  }): Promise<IdentityUser | null> {
    return this.withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`identity-email:${input.email.trim().toLowerCase()}`]);
      const reserved = await client.query('SELECT id FROM provider_invitations WHERE email = $1 AND accepted_at IS NULL AND expires_at > clock_timestamp()', [input.email.trim().toLowerCase()]);
      if (reserved.rows.length) return null;
      const result = await client.query<Record<string, unknown>>(
        `INSERT INTO users
          (email, password_hash, display_name, role, status, customer_type)
         VALUES ($1, $2, $3, 'CUSTOMER', 'PENDING_EMAIL_VERIFICATION', $4)
         ON CONFLICT (email) DO NOTHING
         RETURNING *`,
        [
          input.email.trim().toLowerCase(),
          input.passwordHash,
          input.displayName.trim(),
          input.customerType,
        ],
      );
      if (!result.rows[0]) return null;
      const user = mapUser(result.rows[0]);
      await this.audit.write(client, {
        action: 'CUSTOMER_REGISTERED',
        actorRole: 'CUSTOMER',
        actorUserId: user.id,
        targetId: user.id,
        targetType: 'USER',
      });
      return user;
    });
  }

  async activateCustomer(id: string): Promise<IdentityUser | null> {
    return this.withTransaction(async (client) => {
      const result = await client.query<Record<string, unknown>>(
        `UPDATE users
         SET status='ACTIVE', email_verified_at=now(), updated_at=now()
         WHERE id=$1 AND role='CUSTOMER'
           AND status='PENDING_EMAIL_VERIFICATION'
         RETURNING *`,
        [id],
      );
      if (!result.rows[0]) return null;
      await this.audit.write(client, {
        action: 'CUSTOMER_EMAIL_VERIFIED',
        actorRole: 'CUSTOMER',
        actorUserId: id,
        targetId: id,
        targetType: 'USER',
      });
      return mapUser(result.rows[0]);
    });
  }

  async findByEmail(email: string): Promise<IdentityUser | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.trim().toLowerCase()],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findById(id: string): Promise<IdentityUser | null> {
    const result = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async listUsers(query?: string): Promise<IdentityUser[]> {
    const value = query?.trim();
    const result = await this.pool.query(
      `SELECT * FROM users
       ${value ? 'WHERE email ILIKE $1 OR display_name ILIKE $1' : ''}
       ORDER BY created_at DESC`,
      value ? [`%${value}%`] : [],
    );
    return result.rows.map(mapUser);
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.withTransaction(async (client) => {
      const result = await client.query<{ role: string }>(
        `UPDATE users
         SET password_hash = $2, session_version = session_version + 1,
             updated_at = now()
         WHERE id = $1 RETURNING role`,
        [id, passwordHash],
      );
      const row = result.rows[0];
      if (!row) throw new Error('USER_NOT_FOUND');
      await this.audit.write(client, {
        action: 'PASSWORD_CHANGED',
        actorRole: row.role,
        actorUserId: id,
        targetId: id,
        targetType: 'USER',
      });
    });
  }

  async recordFailedLogin(
    email: string,
    threshold: number,
    lockedUntil: Date,
  ): Promise<void> {
    await this.withTransaction(async (client) => {
      const result = await client.query<{ id: string; role: string }>(
        `UPDATE users
         SET failed_login_count = failed_login_count + 1,
             status = CASE
               WHEN failed_login_count + 1 >= $2 THEN 'LOCKED'
               ELSE status
             END,
             locked_until = CASE
               WHEN failed_login_count + 1 >= $2 THEN $3
               ELSE locked_until
             END,
             updated_at = now()
         WHERE email = $1 AND status = 'ACTIVE'
         RETURNING id, role`,
        [email.trim().toLowerCase(), threshold, lockedUntil],
      );
      const user = result.rows[0];
      if (user) {
        await this.audit.write(client, {
          action: 'LOGIN_FAILED',
          actorRole: user.role,
          actorUserId: user.id,
          outcome: 'DENIED',
          targetId: user.id,
          targetType: 'USER',
        });
      }
    });
  }

  async unlockExpired(id: string): Promise<IdentityUser | null> {
    const result = await this.pool.query(
      `UPDATE users
       SET status = 'ACTIVE', failed_login_count = 0, locked_until = NULL,
           updated_at = now()
       WHERE id = $1 AND status = 'LOCKED' AND locked_until <= now()
       RETURNING *`,
      [id],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async touchLogin(id: string): Promise<void> {
    await this.withTransaction(async (client) => {
      const result = await client.query<{ role: string }>(
        `UPDATE users
         SET last_login_at = now(), failed_login_count = 0, locked_until = NULL,
             updated_at = now()
         WHERE id = $1 RETURNING role`,
        [id],
      );
      if (result.rows[0]) {
        await this.audit.write(client, {
          action: 'LOGIN_SUCCEEDED',
          actorRole: result.rows[0].role,
          actorUserId: id,
          targetId: id,
          targetType: 'USER',
        });
      }
    });
  }

  async bumpSessionVersion(id: string, action = 'SESSION_REVOKED'): Promise<void> {
    await this.withTransaction(async (client) => {
      const result = await client.query<{ role: string }>(
        `UPDATE users
         SET session_version = session_version + 1, updated_at = now()
         WHERE id = $1 RETURNING role`,
        [id],
      );
      if (result.rows[0]) {
        await this.audit.write(client, {
          action,
          actorRole: result.rows[0].role,
          actorUserId: id,
          targetId: id,
          targetType: 'USER',
        });
      }
    });
  }

  async changeStateByAdmin(
    targetId: string,
    status: UserState,
    actorId: string,
    actorRole: string,
    reason: string,
  ): Promise<IdentityUser> {
    return this.withTransaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('emukey:user-admin-state'))",
      );
      const target = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [targetId]);
      if (!target.rows[0]) throw new Error('USER_NOT_FOUND');
      const targetRow = target.rows[0] as Record<string, unknown>;
      const currentStatus = targetRow.status as UserState;
      const transitionAllowed =
        (status === 'LOCKED' && currentStatus === 'ACTIVE') ||
        (status === 'ACTIVE' && currentStatus === 'LOCKED') ||
        (status === 'DISABLED' &&
          (currentStatus === 'ACTIVE' || currentStatus === 'LOCKED'));
      if (!transitionAllowed) throw new Error('INVALID_USER_STATE_TRANSITION');
      if (
        targetRow.role === 'SYSTEM_ADMIN' &&
        currentStatus === 'ACTIVE' &&
        status !== 'ACTIVE'
      ) {
        const count = await client.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM users
           WHERE role = 'SYSTEM_ADMIN' AND status = 'ACTIVE'`,
        );
        if ((count.rows[0]?.count ?? 0) < 2) {
          throw new Error('LAST_ACTIVE_SYSTEM_ADMIN');
        }
      }
      const updated = await client.query(
        `UPDATE users
         SET status = $2::varchar, session_version = session_version + 1,
             locked_until = CASE WHEN $2::varchar = 'LOCKED' THEN locked_until ELSE NULL END,
             updated_at = now()
         WHERE id = $1 RETURNING *`,
        [targetId, status],
      );
      await this.audit.write(client, {
        action: `USER_${status}`,
        actorRole,
        actorUserId: actorId,
        metadata: { nextStatus: status, previousStatus: targetRow.status },
        reason,
        targetId,
        targetType: 'USER',
      });
      return mapUser(updated.rows[0]);
    });
  }

  async updateProfile(
    id: string,
    actorRole: string,
    fields: Record<string, string | null>,
  ): Promise<IdentityUser | null> {
    const allowed = ['display_name', 'organization_name', 'phone', 'address'];
    const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
    if (entries.length === 0) return this.findById(id);
    return this.withTransaction(async (client) => {
      const sets = entries.map(([key], index) => `${key} = $${index + 2}`).join(', ');
      const result = await client.query(
        `UPDATE users SET ${sets}, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id, ...entries.map(([, value]) => value)],
      );
      if (!result.rows[0]) return null;
      await this.audit.write(client, {
        action: 'PROFILE_UPDATED',
        actorRole,
        actorUserId: id,
        metadata: { fields: entries.map(([key]) => key) },
        targetId: id,
        targetType: 'USER',
      });
      return mapUser(result.rows[0]);
    });
  }

  private async withTransaction<T>(
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
