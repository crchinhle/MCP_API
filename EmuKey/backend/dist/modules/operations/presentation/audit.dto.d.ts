export declare class AuditQueryDto {
    page: number;
    action?: string;
    outcome?: string;
}
export declare class AuditEntryDto {
    id: string;
    action: string;
    outcome: string;
    actorUserId: string | null;
    actorRole: string | null;
    targetType: string | null;
    targetId: string | null;
    reason: string | null;
    createdAt: string;
}
export declare class AuditPageDto {
    items: AuditEntryDto[];
    hasMore: boolean;
    page: number;
}
