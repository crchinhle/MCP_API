export declare const ROLES: readonly ["SYSTEM_ADMIN", "PROVIDER_ADMIN", "CUSTOMER", "SUPPORT_STAFF"];
export type Role = (typeof ROLES)[number];
export declare const USER_STATES: readonly ["PENDING_EMAIL_VERIFICATION", "ACTIVE", "LOCKED", "DISABLED"];
export type UserState = (typeof USER_STATES)[number];
export interface IdentityUser {
    id: string;
    email: string;
    passwordHash: string;
    displayName: string;
    role: Role;
    status: UserState;
    sessionVersion: number;
    customerType: 'BUSINESS' | 'INDIVIDUAL' | 'STUDENT' | null;
    emailVerifiedAt: Date | null;
    organizationName: string | null;
    phone: string | null;
    address: string | null;
    failedLoginCount: number;
    lockedUntil: Date | null;
}
export interface AuthPrincipal {
    sub: string;
    role: Role;
    sessionVersion: number;
}
