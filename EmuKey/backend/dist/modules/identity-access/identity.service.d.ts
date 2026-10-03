import type { AuthPrincipal, IdentityUser, UserState } from './identity.types.js';
export interface PasswordRepository {
    activateCustomer(id: string): Promise<IdentityUser | null>;
    bumpSessionVersion(id: string, action?: string): Promise<void>;
    changeStateByAdmin(targetId: string, status: UserState, actorId: string, actorRole: string, reason: string): Promise<IdentityUser>;
    createCustomer(input: {
        customerType: 'BUSINESS' | 'INDIVIDUAL' | 'STUDENT';
        displayName: string;
        email: string;
        passwordHash: string;
    }): Promise<IdentityUser | null>;
    findByEmail(email: string): Promise<IdentityUser | null>;
    findById(id: string): Promise<IdentityUser | null>;
    listUsers(query?: string): Promise<IdentityUser[]>;
    recordFailedLogin(email: string, threshold: number, lockedUntil: Date): Promise<void>;
    touchLogin(id: string): Promise<void>;
    unlockExpired(id: string): Promise<IdentityUser | null>;
    updatePassword(id: string, passwordHash: string): Promise<void>;
    updateProfile(id: string, actorRole: string, fields: Record<string, string | null>): Promise<IdentityUser | null>;
}
export interface IdentityRedis {
    del(key: string): Promise<number>;
    eval(script: string, numKeys: number, ...args: (number | string)[]): Promise<unknown>;
    expire(key: string, ttl: number): Promise<number>;
    get(key: string): Promise<string | null>;
    incr(key: string): Promise<number>;
    set(key: string, value: string, mode: 'EX', ttl: number): Promise<unknown>;
}
export interface IdentityTokenDelivery {
    sendLicensingActionVerification?(email: string, token: string, action: string): Promise<void>;
    sendEmailVerification(email: string, token: string): Promise<void>;
    sendPasswordReset(email: string, token: string): Promise<void>;
}
export declare class IdentityService {
    private readonly repo;
    private readonly redis;
    private readonly secret;
    private readonly delivery;
    private readonly accessTtl;
    constructor(repo: PasswordRepository, redis: IdentityRedis, secret: Uint8Array, delivery?: IdentityTokenDelivery, accessTtl?: number);
    private digest;
    private issueOneTime;
    private consume;
    private rateLimit;
    register(input: {
        customerType: 'BUSINESS' | 'INDIVIDUAL' | 'STUDENT';
        displayName: string;
        email: string;
        password: string;
    }): Promise<{
        accepted: boolean;
    }>;
    resendVerification(emailValue: string): Promise<void>;
    verifyEmail(token: string): Promise<void>;
    issueLicensingActionVerification(userId: string, licenseId: string, action: string, deviceId?: string): Promise<void>;
    resolveLicensingActionVerification(token: string | undefined, userId: string): Promise<{
        action: string;
        deviceId: string | null;
        licenseId: string;
        expiresAt: string;
    }>;
    consumeLicensingActionVerification(token: string | undefined, userId: string, licenseId: string, action: string, deviceId?: string): Promise<void>;
    forgotPassword(email: string): Promise<void>;
    resetPassword(token: string, password: string): Promise<void>;
    changePassword(userId: string, currentPassword: string, password: string): Promise<void>;
    verifyCurrentPassword(userId: string, password: string): Promise<boolean>;
    login(email: string, password: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            address: string | null;
            customerType: "INDIVIDUAL" | "STUDENT" | "BUSINESS" | null;
            displayName: string;
            email: string;
            emailVerifiedAt: Date | null;
            id: string;
            organizationName: string | null;
            phone: string | null;
            role: "SYSTEM_ADMIN" | "PROVIDER_ADMIN" | "CUSTOMER" | "SUPPORT_STAFF";
            sessionVersion: number;
            status: "PENDING_EMAIL_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
        };
    }>;
    issue(user: IdentityUser, familyId?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            address: string | null;
            customerType: "INDIVIDUAL" | "STUDENT" | "BUSINESS" | null;
            displayName: string;
            email: string;
            emailVerifiedAt: Date | null;
            id: string;
            organizationName: string | null;
            phone: string | null;
            role: "SYSTEM_ADMIN" | "PROVIDER_ADMIN" | "CUSTOMER" | "SUPPORT_STAFF";
            sessionVersion: number;
            status: "PENDING_EMAIL_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
        };
    }>;
    private consumeRefresh;
    refresh(raw: string | undefined): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            address: string | null;
            customerType: "INDIVIDUAL" | "STUDENT" | "BUSINESS" | null;
            displayName: string;
            email: string;
            emailVerifiedAt: Date | null;
            id: string;
            organizationName: string | null;
            phone: string | null;
            role: "SYSTEM_ADMIN" | "PROVIDER_ADMIN" | "CUSTOMER" | "SUPPORT_STAFF";
            sessionVersion: number;
            status: "PENDING_EMAIL_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
        };
    }>;
    logout(raw: string | undefined): Promise<void>;
    revokeUserSessions(userId: string): Promise<void>;
    authenticate(token: string): Promise<AuthPrincipal>;
    profile(id: string): Promise<{
        address: string | null;
        customerType: "INDIVIDUAL" | "STUDENT" | "BUSINESS" | null;
        displayName: string;
        email: string;
        emailVerifiedAt: Date | null;
        id: string;
        organizationName: string | null;
        phone: string | null;
        role: "SYSTEM_ADMIN" | "PROVIDER_ADMIN" | "CUSTOMER" | "SUPPORT_STAFF";
        sessionVersion: number;
        status: "PENDING_EMAIL_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
    }>;
    listUsers(query?: string): Promise<{
        address: string | null;
        customerType: "INDIVIDUAL" | "STUDENT" | "BUSINESS" | null;
        displayName: string;
        email: string;
        emailVerifiedAt: Date | null;
        id: string;
        organizationName: string | null;
        phone: string | null;
        role: "SYSTEM_ADMIN" | "PROVIDER_ADMIN" | "CUSTOMER" | "SUPPORT_STAFF";
        sessionVersion: number;
        status: "PENDING_EMAIL_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
    }[]>;
    updateProfile(actor: AuthPrincipal, fields: Record<string, string | null>): Promise<{
        address: string | null;
        customerType: "INDIVIDUAL" | "STUDENT" | "BUSINESS" | null;
        displayName: string;
        email: string;
        emailVerifiedAt: Date | null;
        id: string;
        organizationName: string | null;
        phone: string | null;
        role: "SYSTEM_ADMIN" | "PROVIDER_ADMIN" | "CUSTOMER" | "SUPPORT_STAFF";
        sessionVersion: number;
        status: "PENDING_EMAIL_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
    }>;
    changeAccountState(targetId: string, status: UserState, actor: AuthPrincipal, reason: string): Promise<{
        address: string | null;
        customerType: "INDIVIDUAL" | "STUDENT" | "BUSINESS" | null;
        displayName: string;
        email: string;
        emailVerifiedAt: Date | null;
        id: string;
        organizationName: string | null;
        phone: string | null;
        role: "SYSTEM_ADMIN" | "PROVIDER_ADMIN" | "CUSTOMER" | "SUPPORT_STAFF";
        sessionVersion: number;
        status: "PENDING_EMAIL_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
    }>;
    publicUser(user: IdentityUser): {
        address: string | null;
        customerType: "INDIVIDUAL" | "STUDENT" | "BUSINESS" | null;
        displayName: string;
        email: string;
        emailVerifiedAt: Date | null;
        id: string;
        organizationName: string | null;
        phone: string | null;
        role: "SYSTEM_ADMIN" | "PROVIDER_ADMIN" | "CUSTOMER" | "SUPPORT_STAFF";
        sessionVersion: number;
        status: "PENDING_EMAIL_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
    };
    private invalidCredentials;
    private invalidSession;
}
