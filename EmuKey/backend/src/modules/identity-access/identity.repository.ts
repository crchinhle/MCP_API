import { Pool, type PoolClient } from 'pg';

import { AuditWriter } from '../../platform/audit/audit-writer.js';
import type { IdentityUser, UserState } from './identity.types.js';

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

  async createCustomer(input: {
    customerType: 'BUSINESS' | 'INDIVIDUAL' | 'STUDENT';
    displayName: string;
    email: string;
    passwordHash: string;
  }): Promise<IdentityUser | null> {
    return this.withTransaction(async (client) => {
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
