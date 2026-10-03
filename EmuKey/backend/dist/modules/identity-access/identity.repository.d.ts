import { Pool } from 'pg';
import { AuditWriter } from '../../platform/audit/audit-writer.js';
import type { IdentityUser, UserState } from './identity.types.js';
export declare class IdentityRepository {
    private readonly pool;
    private readonly audit;
    constructor(pool: Pool, audit?: AuditWriter);
    createCustomer(input: {
        customerType: 'BUSINESS' | 'INDIVIDUAL' | 'STUDENT';
        displayName: string;
        email: string;
        passwordHash: string;
    }): Promise<IdentityUser | null>;
    activateCustomer(id: string): Promise<IdentityUser | null>;
    findByEmail(email: string): Promise<IdentityUser | null>;
    findById(id: string): Promise<IdentityUser | null>;
    listUsers(query?: string): Promise<IdentityUser[]>;
    updatePassword(id: string, passwordHash: string): Promise<void>;
    recordFailedLogin(email: string, threshold: number, lockedUntil: Date): Promise<void>;
    unlockExpired(id: string): Promise<IdentityUser | null>;
    touchLogin(id: string): Promise<void>;
    bumpSessionVersion(id: string, action?: string): Promise<void>;
    changeStateByAdmin(targetId: string, status: UserState, actorId: string, actorRole: string, reason: string): Promise<IdentityUser>;
    updateProfile(id: string, actorRole: string, fields: Record<string, string | null>): Promise<IdentityUser | null>;
    private withTransaction;
}
