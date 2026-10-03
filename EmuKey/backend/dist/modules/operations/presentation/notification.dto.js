var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class NotificationDto {
    id;
    title;
    content;
    isRead;
    createdAt;
    readAt;
    target;
}
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], NotificationDto.prototype, "id", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], NotificationDto.prototype, "title", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], NotificationDto.prototype, "content", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Boolean)
], NotificationDto.prototype, "isRead", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], NotificationDto.prototype, "createdAt", void 0);
__decorate([
    ApiPropertyOptional({ format: 'date-time', nullable: true, type: String }),
    __metadata("design:type", Object)
], NotificationDto.prototype, "readAt", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: Object }),
    __metadata("design:type", Object)
], NotificationDto.prototype, "target", void 0);
const KNOWN_TARGET_TYPES = {
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
export function mapNotification(row) {
    const type = String(row.type);
    const data = typeof row.data === 'object' && row.data !== null ? row.data : {};
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
//# sourceMappingURL=notification.dto.js.map