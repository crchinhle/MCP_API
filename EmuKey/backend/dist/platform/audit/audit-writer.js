var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
let AuditWriter = class AuditWriter {
    async write(client, event) {
        await client.query(`INSERT INTO audit_logs
        (actor_user_id, actor_role, action, target_type, target_id, reason, outcome, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
            event.actorUserId ?? null,
            event.actorRole ?? null,
            event.action,
            event.targetType,
            event.targetId ?? null,
            event.reason ?? null,
            event.outcome ?? 'SUCCESS',
            JSON.stringify(event.metadata ?? {}),
        ]);
    }
};
AuditWriter = __decorate([
    Injectable()
], AuditWriter);
export { AuditWriter };
//# sourceMappingURL=audit-writer.js.map