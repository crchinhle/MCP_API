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

export interface ProviderInvitationInput {
  email: string;
}

export interface ProviderOnboardingInput {
  displayName: string;
  organizationName: string;
}

export interface ProviderInvitationPreview { email: string; expiresAt: string; }

export interface ProviderInvitation extends ProviderInvitationInput {
  id: string;
  expiresAt: string;
  createdAt: string;
  sentAt: string | null;
  status: 'PENDING' | 'EXPIRED' | 'ACCEPTED';
}
