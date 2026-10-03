import { Pool } from 'pg';

export class AuditRepository {
  constructor(private readonly pool: Pool) {}
  async list(input: { page: number; action?: string; outcome?: string }) {
    // Deliberately exclude metadata and email snapshots from the public contract.
    const result = await this.pool.query(
      `SELECT id::text, action, outcome, actor_user_id AS "actorUserId",
        actor_role AS "actorRole", target_type AS "targetType", target_id AS "targetId",
        reason, created_at AS "createdAt" FROM audit_logs
       WHERE ($1::text IS NULL OR action = $1) AND ($2::text IS NULL OR outcome = $2)
       ORDER BY created_at DESC, id DESC LIMIT 51 OFFSET $3`,
      [input.action?.trim() || null, input.outcome || null, (input.page - 1) * 50],
    );
    return { items: result.rows.slice(0, 50), hasMore: result.rows.length > 50, page: input.page };
  }
}
