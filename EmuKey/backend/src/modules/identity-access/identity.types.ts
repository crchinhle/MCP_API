export const ROLES = ['SYSTEM_ADMIN', 'PROVIDER_ADMIN', 'CUSTOMER', 'SUPPORT_STAFF'] as const;
export type Role = (typeof ROLES)[number];
export const USER_STATES = ['PENDING_EMAIL_VERIFICATION', 'ACTIVE', 'LOCKED', 'DISABLED'] as const;
export type UserState = (typeof USER_STATES)[number];

export interface IdentityUser {
  id: string; email: string; passwordHash: string; displayName: string; role: Role;
  status: UserState; sessionVersion: number;
  customerType: 'BUSINESS' | 'INDIVIDUAL' | 'STUDENT' | null;
  emailVerifiedAt: Date | null;
  organizationName: string | null; phone: string | null; address: string | null;
  failedLoginCount: number; lockedUntil: Date | null;
}

export interface AuthPrincipal { sub: string; role: Role; sessionVersion: number; }
