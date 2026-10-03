import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  isRead!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  readAt!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Object })
  target!: NotificationTarget | null;
}

export interface NotificationTarget {
  kind: 'LICENSE' | 'ORDER' | 'CONVERSATION' | 'PAYMENT' | 'SYSTEM';
  id: string | null;
}

const KNOWN_TARGET_TYPES: Record<string, (data: Record<string, unknown>) => NotificationTarget | null> = {
  LICENSE_CONFIRMED: (data) => ({ kind: 'LICENSE', id: typeof data.licenseId === 'string' ? data.licenseId : null }),
  LICENSE_SUSPENDED: (data) => ({ kind: 'LICENSE', id: typeof data.licenseId === 'string' ? data.licenseId : null }),
  LICENSE_REVOKED: (data) => ({ kind: 'LICENSE', id: typeof data.licenseId === 'string' ? data.licenseId : null }),
  LICENSE_RENEWED: (data) => ({ kind: 'LICENSE', id: typeof data.licenseId === 'string' ? data.licenseId : null }),
  ORDER_PAYMENT_ACCEPTED: (data) => ({ kind: 'ORDER', id: typeof data.orderId === 'string' ? data.orderId : null }),
  ORDER_AUTO_CANCELLED: (data) => ({ kind: 'ORDER', id: typeof data.orderId === 'string' ? data.orderId : null }),
  SUPPORT_REQUESTED: (data) => ({ kind: 'CONVERSATION', id: typeof data.conversationId === 'string' ? data.conversationId : null }),
  SUPPORT_ASSIGNED: (data) => ({ kind: 'CONVERSATION', id: typeof data.conversationId === 'string' ? data.conversationId : null }),
  PAYMENT_REVIEW_REQUIRED: (data) => ({ kind: 'PAYMENT', id: typeof data.transactionId === 'string' ? data.transactionId : null }),
};

export function mapNotification(row: {
  id: unknown;
  title: unknown;
  content: unknown;
  is_read: unknown;
  created_at: unknown;
  read_at: unknown;
  type: unknown;
  data: unknown;
}): NotificationDto {
  const type = String(row.type);
  const data = typeof row.data === 'object' && row.data !== null ? (row.data as Record<string, unknown>) : {};
  const targetFn = KNOWN_TARGET_TYPES[type];
  const target = targetFn ? targetFn(data) : null;

  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    isRead: row.is_read === true,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    readAt: row.read_at instanceof Date ? row.read_at.toISOString() : typeof row.read_at === 'string' ? row.read_at : null,
    target,
  };
}
