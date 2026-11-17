import type { CitationDetail } from '../application/ports/ai-gateway.port.js';
import type { AdvisorAnswer, AiTurn } from '../application/ai-advisor.service.js';
import { createHash, randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

function stableEventUuid(value: string): string {
  const bytes = createHash('sha256').update(value).digest('hex').slice(0, 32).split('');
  bytes[12] = '5';
  bytes[16] = ((Number.parseInt(bytes[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${bytes.slice(0, 8).join('')}-${bytes.slice(8, 12).join('')}-${bytes.slice(12, 16).join('')}-${bytes.slice(16, 20).join('')}-${bytes.slice(20).join('')}`;
}

import type { ConversationActor } from '../assistance-support.types.js';
import type {
  ConversationRecord,
  ConversationStatus,
  MessageRecord,
  MessageSenderType,
} from '../assistance-support.types.js';
import type { NotificationWriter } from '../../operations/application/notification-writer.js';
import type { CreateConversationDto } from '../assistance-support.dto.js';

function mapConversation(row: Record<string, unknown>): ConversationRecord {
  return {
    claimVersion: Number(row.claim_version ?? 0),
    claimExpiresAt: row.claim_expires_at instanceof Date ? row.claim_expires_at.toISOString() : null,
    assignedSupportUserId: typeof row.assigned_support_user_id === 'string' ? row.assigned_support_user_id : null,
    contextId: (row.product_id ?? row.plan_id ?? row.order_id ?? row.license_id ?? null) as string | null,
    contextType: row.product_id ? 'PRODUCT' : row.plan_id ? 'PLAN' : row.order_id ? 'ORDER' : row.license_id ? 'LICENSE' : 'GENERAL',
    customerUserId: String(row.customer_user_id),
    id: String(row.id),
    status: String(row.status) as ConversationStatus,
    title: typeof row.title === 'string' ? row.title : null,
    ...(row.updated_at instanceof Date ? { updatedAt: row.updated_at } : {}),
  };
}

function mapMessage(row: Record<string, unknown>): MessageRecord {
  return {
    ...(row.ai_metadata && typeof row.ai_metadata === 'object' ? { aiMetadata: row.ai_metadata, ...row.ai_metadata } : {}),
    citationDetails:Array.isArray(row.citation_details)?row.citation_details as CitationDetail[]:[],
    clientMessageId: String(row.client_message_id),
    content: String(row.content),
    conversationId: String(row.conversation_id),
    ...(row.created_at instanceof Date ? { createdAt: row.created_at } : {}),
    id: String(row.id),
    senderType: String(row.sender_type) as MessageSenderType,
    serverSequence: Number(row.server_sequence),
    ...(typeof row.grounded === 'boolean' ? { grounded: row.grounded } : {}),
    ...(Array.isArray(row.sources)
      ? { sources: row.sources.filter((source): source is string => typeof source === 'string') }
      : {}),
  };
}

export class AssistanceSupportRepository {
  constructor(
    private readonly pool: Pool,
    private readonly notifications: NotificationWriter,
  ) {}

  async aiContext(input: { conversationId: string; customerUserId: string }) {
    const conversation = await this.findConversationForActor({ sub: input.customerUserId, role: 'CUSTOMER' }, input.conversationId);
    if (!conversation) throw new Error('CONVERSATION_NOT_FOUND');
    if (conversation.status !== 'AI_ACTIVE') throw new Error('CONVERSATION_STATE_INVALID');
    const result = await this.pool.query<Record<string, unknown>>(`SELECT content, sender_type, ai_metadata FROM messages WHERE conversation_id=$1 AND sender_type IN ('CUSTOMER','AI') ORDER BY server_sequence DESC LIMIT 16`, [input.conversationId]);
    const history: AiTurn[] = result.rows.reverse().map(row => ({ role: row.sender_type === 'AI' ? 'assistant' : 'user', content: String(row.content), catalogSources: (row.ai_metadata as Partial<AdvisorAnswer> | null)?.catalogSources ?? [] }));
    return { history, ...(conversation.contextType === 'PRODUCT' && conversation.contextId ? { productIds: [conversation.contextId] } : {}), ...(conversation.contextType === 'PLAN' && conversation.contextId ? { planIds: [conversation.contextId] } : {}) };
  }

  async findAiAnswer(conversationId: string, clientMessageId: string) {
    const result = await this.pool.query<Record<string, unknown>>(`SELECT * FROM messages WHERE conversation_id=$1 AND client_message_id=$2 AND sender_type='AI'`, [conversationId, clientMessageId]);
    return result.rows[0] ? mapMessage(result.rows[0]) : undefined;
  }

  async createConversation(customerUserId: string, input: CreateConversationDto) {
    return this.transaction(async (client) => {
    const contextType = input.contextType ?? 'GENERAL';
    const id = input.clientRequestId ? stableEventUuid(`conversation:create:${customerUserId}:${input.clientRequestId.toLowerCase()}`) : randomUUID();
    // Serialize creation retries before the row exists. The primary key is the
    // durable uniqueness boundary; the lock covers payload comparison as well.
    // https://www.postgresql.org/docs/15/explicit-locking.html#ADVISORY-LOCKS
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [id]);
    const previous = await client.query<Record<string, unknown>>('SELECT * FROM conversations WHERE id=$1', [id]);
    const initialId = stableEventUuid(`${id}:initial-message`);
    if (previous.rows[0]) {
      const conversation = mapConversation(previous.rows[0]);
      const initial = await client.query<{ content: string }>('SELECT content FROM messages WHERE conversation_id=$1 AND client_message_id=$2', [id, initialId]);
      if (conversation.customerUserId !== customerUserId || conversation.title !== (input.title ?? null) ||
          conversation.contextType !== contextType || conversation.contextId !== (input.contextId?.toLowerCase() ?? null) ||
          (initial.rows[0]?.content ?? null) !== (input.mode === 'SUPPORT' ? input.initialMessage!.trim() : null)) {
        throw new Error('CONVERSATION_CREATE_CONFLICT');
      }
      return conversation;
    }
    if (contextType === 'ORDER') {
      const owned = await client.query('SELECT 1 FROM orders WHERE id = $1 AND customer_user_id = $2', [input.contextId, customerUserId]);
      if (!owned.rows[0]) throw new Error('CONVERSATION_CONTEXT_NOT_FOUND');
    } else if (contextType === 'LICENSE') {
      const owned = await client.query('SELECT 1 FROM licenses WHERE id = $1 AND customer_user_id = $2', [input.contextId, customerUserId]);
      if (!owned.rows[0]) throw new Error('CONVERSATION_CONTEXT_NOT_FOUND');
    } else if (contextType === 'PLAN') {
      const visible = await client.query("SELECT 1 FROM plans p JOIN products pr ON pr.id = p.product_id WHERE p.id = $1 AND p.status = 'PUBLISHED' AND pr.status = 'PUBLISHED'", [input.contextId]);
      if (!visible.rows[0]) throw new Error('CONVERSATION_CONTEXT_NOT_FOUND');
    } else if (contextType === 'PRODUCT') {
      const visible = await client.query("SELECT 1 FROM products WHERE id = $1 AND status = 'PUBLISHED'", [input.contextId]);
      if (!visible.rows[0]) throw new Error('CONVERSATION_CONTEXT_NOT_FOUND');
    }
    const result = await client.query<Record<string, unknown>>(
      `INSERT INTO conversations (customer_user_id, product_id, plan_id, order_id, license_id, title, id, status)
       VALUES ($1, CASE WHEN $2='PRODUCT' THEN $3::uuid END, CASE WHEN $2='PLAN' THEN $3::uuid END,
         CASE WHEN $2='ORDER' THEN $3::uuid END, CASE WHEN $2='LICENSE' THEN $3::uuid END, $4, $5, $6) RETURNING *`,
      [customerUserId, contextType, input.contextId ?? null, input.title ?? null, id, input.mode === 'SUPPORT' ? 'WAITING_SUPPORT' : 'AI_ACTIVE'],
    );
    if (input.mode === 'SUPPORT') {
      await client.query(`INSERT INTO messages (conversation_id,sender_user_id,sender_type,client_message_id,server_sequence,content)
        VALUES ($1,$2,'CUSTOMER',$3,1,$4)`, [id, customerUserId, initialId, input.initialMessage!.trim()]);
      await this.appendSystemMessageInTransaction(client, id, 'Yêu cầu đã được gửi. Đang chờ nhân viên hỗ trợ.', 'support-requested');
      await this.notifyWaitingInTransaction(client, id, 1);
    }
    return mapConversation(result.rows[0]!);
    });
  }

  async listForActor(actor: ConversationActor) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM conversations
       WHERE ($1 = 'CUSTOMER' AND customer_user_id = $2)
           OR ($1 = 'SUPPORT_STAFF' AND assigned_support_user_id = $2)
           OR $1 = 'SYSTEM_ADMIN'
       ORDER BY updated_at DESC`,
      [actor.role, actor.sub],
    );
    return result.rows.map(mapConversation);
  }

  async listSupportQueue(actor: ConversationActor) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM conversations
       WHERE status = 'WAITING_SUPPORT'
          OR (status = 'SUPPORT_ACTIVE' AND ($1 = 'SYSTEM_ADMIN' OR assigned_support_user_id = $2))
       ORDER BY created_at ASC`,
      [actor.role, actor.sub],
    );
    return result.rows.map(mapConversation);
  }

  async findConversationForActor(actor: ConversationActor, conversationId: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM conversations
       WHERE id = $1 AND (
         ($2 = 'CUSTOMER' AND customer_user_id = $3) OR
         ($2 = 'SUPPORT_STAFF' AND assigned_support_user_id = $3) OR
         $2 = 'SYSTEM_ADMIN'
       )`,
      [conversationId, actor.role, actor.sub],
    );
    return result.rows[0] ? mapConversation(result.rows[0]) : null;
  }

  async listMessages(actor: ConversationActor, conversationId: string) {
    return this.transaction(async client => {
      const permitted = await client.query(`SELECT id FROM conversations WHERE id=$1 AND (
        ($2='CUSTOMER' AND customer_user_id=$3) OR ($2='SUPPORT_STAFF' AND assigned_support_user_id=$3) OR $2='SYSTEM_ADMIN') FOR SHARE`, [conversationId, actor.role, actor.sub]);
      if (!permitted.rows[0]) return null;
      return this.listMessagesForConversation(client, conversationId);
    });
  }

  async listQueuePreviewMessages(actor: ConversationActor, conversationId: string) {
    if (actor.role !== 'SUPPORT_STAFF' && actor.role !== 'SYSTEM_ADMIN') return null;
    return this.transaction(async client => {
    const result = await client.query<Record<string, unknown>>(
      `SELECT * FROM conversations WHERE id = $1 AND (
         $2 = 'SYSTEM_ADMIN' OR
         (status = 'WAITING_SUPPORT' AND assigned_support_user_id IS NULL)
       ) FOR SHARE`,
      [conversationId, actor.role],
    );
    if (!result.rows[0]) return null;
    return this.listMessagesForConversation(client, conversationId, true);
    });
  }

  private async listMessagesForConversation(client: PoolClient, conversationId: string, preview = false) {
    const result = await client.query<Record<string, unknown>>(
      preview ? `SELECT * FROM messages WHERE conversation_id=$1 ORDER BY server_sequence DESC LIMIT 20`
        : `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY server_sequence`,
      [conversationId],
    );
    return (preview ? result.rows.reverse() : result.rows).map(mapMessage);
  }

  async requestSupport(customerUserId: string, conversationId: string, reason: string) {
    return this.transaction(async (client) => {
      const locked = await client.query<Record<string, unknown>>('SELECT * FROM conversations WHERE id=$1 AND customer_user_id=$2 FOR UPDATE', [conversationId, customerUserId]);
      if (!locked.rows[0]) throw new Error('CONVERSATION_NOT_FOUND');
      const current = mapConversation(locked.rows[0]);
      // A lost response or concurrent duplicate must not create another handoff event.
      if (current.status === 'WAITING_SUPPORT' || current.status === 'SUPPORT_ACTIVE') return current;
      if (current.status !== 'AI_ACTIVE') throw new Error('CONVERSATION_STATE_INVALID');
      const result = await client.query<Record<string, unknown>>(
        `UPDATE conversations
         SET status = 'WAITING_SUPPORT', version = version + 1, updated_at = now()
         WHERE id = $1 AND customer_user_id = $2 AND status = 'AI_ACTIVE'
         RETURNING *`,
        [conversationId, customerUserId],
      );
      if (!result.rows[0]) throw new Error('CONVERSATION_STATE_INVALID');
      await this.appendSystemMessageInTransaction(client, conversationId, `Yêu cầu nhân viên hỗ trợ: ${reason}`, 'support-requested');
      await this.notifyWaitingInTransaction(client, conversationId, Number(result.rows[0].version));
      return mapConversation(result.rows[0]);
    });
  }

  async claimConversation(supportUserId: string, conversationId: string) {
    return this.transaction(async (client) => {
      const locked = await this.lockConversation(client, conversationId);
      const current = locked.rows[0] ? mapConversation(locked.rows[0]) : null;
      if (!current) throw new Error('CONVERSATION_NOT_FOUND');
      if (current.status === 'SUPPORT_ACTIVE' && current.assignedSupportUserId === supportUserId && locked.rows[0]?.claim_valid === true) return current;
      if (current.status !== 'WAITING_SUPPORT') {
        throw new Error('CONVERSATION_ALREADY_CLAIMED');
      }
      const result = await client.query<Record<string, unknown>>(
        `UPDATE conversations
         SET assigned_support_user_id = $2, claimed_at = COALESCE(claimed_at, now()),
             status = 'SUPPORT_ACTIVE', version = version + 1, updated_at = now(),
             claim_version=claim_version+1, claim_expires_at=statement_timestamp()+interval '120 seconds'
         WHERE id = $1 RETURNING *`,
        [conversationId, supportUserId],
      );
      const conversation = mapConversation(result.rows[0]!);
      await this.appendSystemMessageInTransaction(client, conversationId, 'Nhân viên hỗ trợ đã tiếp nhận hội thoại.', `claimed:${conversation.claimVersion}`);
      await this.notifications.enqueueInTransaction(client, {
        channel: 'IN_APP',
        content: 'Hội thoại của bạn đã được nhân viên hỗ trợ tiếp nhận.',
        data: { conversationId },
        eventKey: `conversation:${conversationId}:claimed:${conversation.claimVersion}`,
        title: 'Đã tiếp nhận yêu cầu hỗ trợ',
        type: 'SUPPORT_ASSIGNED',
        userId: conversation.customerUserId,
      });
      return conversation;
    });
  }

  async heartbeat(supportUserId: string, conversationId: string, claimVersion: number) {
    return this.transaction(async (client) => {
      await this.lockConversation(client, conversationId);
      const result = await client.query<Record<string,unknown>>(`UPDATE conversations
        SET claim_expires_at=statement_timestamp()+interval '120 seconds'
        WHERE id=$1 AND assigned_support_user_id=$2 AND claim_version=$3 AND status='SUPPORT_ACTIVE'
        AND claim_expires_at>statement_timestamp() RETURNING *`, [conversationId,supportUserId,claimVersion]);
      if (!result.rows[0]) throw new Error('CONVERSATION_CLAIM_EXPIRED');
      return mapConversation(result.rows[0]);
    });
  }

  async requeueExpiredClaims(): Promise<number> {
    return this.transaction(async (client) => {
      const result=await client.query<{id:string;claim_version:string;version:number}>(`UPDATE conversations SET assigned_support_user_id=NULL,
        claimed_at=NULL,claim_expires_at=NULL,status='WAITING_SUPPORT',version=version+1,updated_at=statement_timestamp()
        WHERE status='SUPPORT_ACTIVE' AND (claim_expires_at IS NULL OR claim_expires_at<=statement_timestamp()) RETURNING id,claim_version,version`);
      for (const row of result.rows) {
        await this.appendSystemMessageInTransaction(client,row.id,'Phiên hỗ trợ đã hết hạn. Hội thoại được trả về hàng đợi.',`expired:${row.claim_version}`);
        await this.notifyWaitingInTransaction(client, row.id, row.version);
      }
      return result.rows.length;
    });
  }

  async releaseConversation(supportUserId: string, conversationId: string, claimVersion?: number) {
    return this.transaction(async (client) => {
      const locked = await this.lockConversation(client, conversationId);
      const current = locked.rows[0] ? mapConversation(locked.rows[0]) : null;
      if (!current) throw new Error('CONVERSATION_NOT_FOUND');
      const releaseEvent = `released:${supportUserId}:${claimVersion}`;
      if (current.status === 'WAITING_SUPPORT' && current.claimVersion === claimVersion) {
        const previous = await client.query(`SELECT 1 FROM messages WHERE conversation_id=$1 AND client_message_id=$2 AND sender_type='SYSTEM'`,
          [conversationId, stableEventUuid(`${conversationId}:${releaseEvent}`)]);
        if (previous.rows[0]) return current;
      }
      if (current.status !== 'SUPPORT_ACTIVE' || current.assignedSupportUserId !== supportUserId) {
        throw new Error('CONVERSATION_STATE_INVALID');
      }
      if (current.claimVersion!==claimVersion || locked.rows[0]?.claim_valid !== true) throw new Error('CONVERSATION_CLAIM_EXPIRED');
      const result = await client.query<Record<string, unknown>>(
        `UPDATE conversations
         SET assigned_support_user_id = NULL, claimed_at = NULL, claim_expires_at=NULL,
             status = 'WAITING_SUPPORT', version = version + 1, updated_at = now()
         WHERE id = $1 AND assigned_support_user_id = $2 RETURNING *`,
        [conversationId, supportUserId],
      );
      if (!result.rows[0]) throw new Error('CONVERSATION_STATE_INVALID');
      await this.appendSystemMessageInTransaction(client, conversationId, 'Hội thoại được trả về hàng đợi. Đang chờ nhân viên tiếp tục hỗ trợ.', releaseEvent);
      await this.notifyWaitingInTransaction(client, conversationId, Number(result.rows[0].version));
      return mapConversation(result.rows[0]);
    });
  }

  async closeConversation(actor: ConversationActor, conversationId: string, claimVersion?: number) {
    return this.transaction(async (client) => {
      const locked = await this.lockConversation(client, conversationId);
      if (!locked.rows[0]) throw new Error('CONVERSATION_CLOSE_NOT_ALLOWED');
      const current = mapConversation(locked.rows[0]);
      if (!(actor.role === 'CUSTOMER' && current.customerUserId === actor.sub) && actor.role !== 'SYSTEM_ADMIN' &&
          !(actor.role === 'SUPPORT_STAFF' && current.assignedSupportUserId === actor.sub && current.claimVersion === claimVersion)) {
        throw new Error('CONVERSATION_CLOSE_NOT_ALLOWED');
      }
      if (locked.rows[0].status === 'CLOSED') return mapConversation(locked.rows[0]);
      if (actor.role === 'SUPPORT_STAFF' && locked.rows[0].claim_valid !== true) throw new Error('CONVERSATION_CLAIM_EXPIRED');
      const result = await client.query<Record<string, unknown>>(
        `UPDATE conversations SET status = 'CLOSED', closed_at = now(), version = version + 1, updated_at = now()
         WHERE id = $1 AND status <> 'CLOSED' AND (
           ($2 = 'CUSTOMER' AND customer_user_id = $3) OR
           ($2 = 'SUPPORT_STAFF' AND assigned_support_user_id = $3 AND claim_version=$4 AND claim_expires_at>statement_timestamp()) OR
           $2 = 'SYSTEM_ADMIN'
         ) RETURNING *`,
        [conversationId, actor.role, actor.sub, claimVersion ?? null],
      );
      if (!result.rows[0]) throw new Error('CONVERSATION_CLOSE_NOT_ALLOWED');
      await this.appendSystemMessageInTransaction(client, conversationId, 'Hội thoại đã hoàn tất. Bạn có thể tạo yêu cầu hỗ trợ mới.', 'closed');
      return mapConversation(result.rows[0]);
    });
  }

  async appendMessage(input: {
    claimVersion?: number;
    actorUserId: string;
    clientMessageId: string;
    content: string;
    conversationId: string;
    senderType: Extract<MessageSenderType, 'CUSTOMER' | 'SUPPORT'>;
  }) {
    return this.transaction(async (client) => {
      const locked = await this.lockConversation(client, input.conversationId);
      const conversation = locked.rows[0] ? mapConversation(locked.rows[0]) : null;
      if (!conversation) throw new Error('CONVERSATION_NOT_FOUND');
      if (conversation.status === 'CLOSED') throw new Error('CONVERSATION_CLOSED');
      if (input.senderType === 'CUSTOMER' && conversation.customerUserId !== input.actorUserId) throw new Error('CONVERSATION_ACCESS_DENIED');
      if (input.senderType === 'SUPPORT' && conversation.assignedSupportUserId !== input.actorUserId) throw new Error('CONVERSATION_ACCESS_DENIED');
      if (input.senderType==='SUPPORT' && (conversation.claimVersion!==input.claimVersion || locked.rows[0]?.claim_valid !== true)) throw new Error('CONVERSATION_CLAIM_EXPIRED');
      if (conversation.status === 'AI_ACTIVE') throw new Error('CONVERSATION_STATE_INVALID');

      const existing = await client.query<Record<string, unknown>>(
        `SELECT * FROM messages WHERE conversation_id = $1 AND client_message_id = $2`,
        [input.conversationId, input.clientMessageId],
      );
      if (existing.rows[0]) {
        const previous = existing.rows[0];
        if (previous.content !== input.content || previous.sender_type !== input.senderType || previous.sender_user_id !== input.actorUserId) {
          throw new Error('CONVERSATION_MESSAGE_CONFLICT');
        }
        return mapMessage(previous);
      }

      const sequence = await client.query<{ next_sequence: string }>(
        `SELECT COALESCE(MAX(server_sequence), 0) + 1 AS next_sequence
         FROM messages WHERE conversation_id = $1`,
        [input.conversationId],
      );
      const inserted = await client.query<Record<string, unknown>>(
        `INSERT INTO messages (conversation_id, sender_user_id, sender_type, client_message_id, server_sequence, content)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [input.conversationId, input.actorUserId, input.senderType, input.clientMessageId, Number(sequence.rows[0]!.next_sequence), input.content],
      );
      await client.query(
        `UPDATE conversations SET last_message_at = now(), updated_at = now(),
          version = version + 1 WHERE id = $1`,
        [input.conversationId],
      );
      if (input.senderType==='SUPPORT') await this.notifications.enqueueInTransaction(client,{channel:'IN_APP',
        type:'SUPPORT_REPLY',title:'Nhân viên hỗ trợ đã phản hồi',content:'Mở hội thoại để xem phản hồi.',
        userId:conversation.customerUserId,eventKey:`support-reply:${String(inserted.rows[0]!.id)}:${conversation.customerUserId}`,data:{conversationId:input.conversationId}});
      if (input.senderType === 'CUSTOMER' && conversation.status === 'SUPPORT_ACTIVE' && conversation.assignedSupportUserId && locked.rows[0]?.claim_valid === true) {
        await this.notifications.enqueueInTransaction(client, { channel: 'IN_APP', type: 'SUPPORT_MESSAGE', title: 'Khách hàng gửi tin nhắn mới',
          content: 'Mở hội thoại để xem nội dung.', userId: conversation.assignedSupportUserId,
          eventKey: `customer-message:${String(inserted.rows[0]!.id)}`, data: { conversationId: input.conversationId } });
      }
      return mapMessage(inserted.rows[0]!);
    });
  }

  async appendAiMessage(input: { clientMessageId: string; conversationId: string; content: string; citedSourceIds: string[]; grounded: boolean;citationDetails?:CitationDetail[]; aiMetadata?: Partial<AdvisorAnswer> }) {
    return this.transaction(async (client) => {
      const locked = await client.query<{ status: string }>('SELECT status FROM conversations WHERE id = $1 FOR UPDATE', [input.conversationId]);
      if (!locked.rows[0]) throw new Error('CONVERSATION_NOT_FOUND');
      if (locked.rows[0].status === 'CLOSED') throw new Error('CONVERSATION_CLOSED');
      if (locked.rows[0].status !== 'AI_ACTIVE') throw new Error('CONVERSATION_STATE_INVALID');
      const result = await client.query<Record<string, unknown>>(
        `INSERT INTO messages (conversation_id, sender_type, client_message_id, server_sequence, content, grounded, sources, citation_details, ai_metadata)
         SELECT $1, 'AI', $2, COALESCE(MAX(server_sequence), 0) + 1, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb
         FROM messages WHERE conversation_id = $1
         ON CONFLICT (conversation_id, client_message_id) DO UPDATE SET content = messages.content
         RETURNING *`,
        [input.conversationId, input.clientMessageId, input.content, input.grounded, JSON.stringify(input.citedSourceIds),JSON.stringify(input.citationDetails??[]), JSON.stringify(input.aiMetadata ?? {})],
      );
      return mapMessage(result.rows[0]!);
    });
  }

  async appendCustomerMessage(input: { clientMessageId: string; conversationId: string; customerUserId: string; content: string }) {
    return this.transaction(async (client) => {
      const locked = await client.query<Record<string, unknown>>(
        'SELECT * FROM conversations WHERE id = $1 FOR UPDATE',
        [input.conversationId],
      );
      const conversation = locked.rows[0] ? mapConversation(locked.rows[0]) : null;
      if (!conversation) throw new Error('CONVERSATION_NOT_FOUND');
      if (conversation.customerUserId !== input.customerUserId) throw new Error('CONVERSATION_ACCESS_DENIED');
      if (conversation.status === 'CLOSED') throw new Error('CONVERSATION_CLOSED');
      if (conversation.status !== 'AI_ACTIVE') throw new Error('CONVERSATION_STATE_INVALID');

      const existing = await client.query<Record<string, unknown>>(
        `SELECT * FROM messages WHERE conversation_id = $1 AND client_message_id = $2`,
        [input.conversationId, input.clientMessageId],
      );
      if (existing.rows[0]) {
        const previous = existing.rows[0];
        if (previous.content !== input.content || previous.sender_type !== 'CUSTOMER' || previous.sender_user_id !== input.customerUserId) {
          throw new Error('CONVERSATION_MESSAGE_CONFLICT');
        }
        return mapMessage(previous);
      }

      const sequence = await client.query<{ next_sequence: string }>(
        `SELECT COALESCE(MAX(server_sequence), 0) + 1 AS next_sequence
         FROM messages WHERE conversation_id = $1`,
        [input.conversationId],
      );
      const inserted = await client.query<Record<string, unknown>>(
        `INSERT INTO messages (conversation_id, sender_user_id, sender_type, client_message_id, server_sequence, content)
         VALUES ($1, $2, 'CUSTOMER', $3, $4, $5) RETURNING *`,
        [input.conversationId, input.customerUserId, input.clientMessageId, Number(sequence.rows[0]!.next_sequence), input.content],
      );
      await client.query(
        `UPDATE conversations SET last_message_at = now(), updated_at = now(),
          version = version + 1 WHERE id = $1`,
        [input.conversationId],
      );
      return mapMessage(inserted.rows[0]!);
    });
  }

  private async lockConversation(client: PoolClient, conversationId: string) {
    await client.query('SELECT id FROM conversations WHERE id=$1 FOR UPDATE', [conversationId]);
    // Check the clock after acquiring the row lock. A timestamp evaluated in
    // the locking SELECT can precede a long lock wait and revive an expired claim.
    return client.query<Record<string, unknown>>(
      'SELECT *, claim_expires_at>clock_timestamp() AS claim_valid FROM conversations WHERE id=$1', [conversationId]);
  }

  private async notifyWaitingInTransaction(client: PoolClient, conversationId: string, version: number) {
    const users = await client.query<{ id: string }>("SELECT id FROM users WHERE role='SUPPORT_STAFF' AND status='ACTIVE'");
    for (const user of users.rows) await this.notifications.enqueueInTransaction(client, {
      channel: 'IN_APP', type: 'SUPPORT_REQUESTED', title: 'Hội thoại cần hỗ trợ',
      content: 'Có một hội thoại đang chờ hỗ trợ.', data: { conversationId },
      eventKey: `conversation:${conversationId}:waiting-support:${version}`, userId: user.id,
    });
  }

  private async appendSystemMessageInTransaction(client: PoolClient, conversationId: string, content: string, eventKey = content): Promise<void> {
    const clientMessageId = stableEventUuid(`${conversationId}:${eventKey}`);
    await client.query(
      `INSERT INTO messages (conversation_id, sender_type, client_message_id, server_sequence, content)
       VALUES ($1, 'SYSTEM', $2, COALESCE((SELECT MAX(server_sequence) + 1 FROM messages WHERE conversation_id = $1), 1), $3)
       ON CONFLICT (conversation_id, client_message_id) DO NOTHING`,
      [conversationId, clientMessageId, content],
    );
  }

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
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
