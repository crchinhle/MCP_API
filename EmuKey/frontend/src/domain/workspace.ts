export type StatusTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'realtime'
  | 'module'
  | 'commerce';

export interface NavigationItem {
  readonly label: string;
  readonly ariaLabel?: string;
  readonly to: string;
  readonly end?: boolean;
}

export interface RoleShellConfig {
  readonly role:
    | 'CUSTOMER'
    | 'PROVIDER_ADMIN'
    | 'SUPPORT_STAFF'
    | 'SYSTEM_ADMIN';
  readonly account?: string;
  readonly items: readonly NavigationItem[];
}

export function roleSettingsPath(role: string): string {
  if (role === 'PROVIDER_ADMIN') return '/provider/profile';
  if (role === 'SUPPORT_STAFF') return '/support/profile';
  if (role === 'SYSTEM_ADMIN') return '/system/console/profile';
  return '/buyer/profile';
}

export function roleHomePath(role: string): string {
  if (role === 'PROVIDER_ADMIN') return '/provider';
  if (role === 'SUPPORT_STAFF') return '/support';
  if (role === 'SYSTEM_ADMIN') return '/system/console';
  return '/buyer';
}

export type OrderStatus =
  'awaiting-payment' | 'complete';

export interface OrderRecord {
  readonly id: string;
  readonly buyerReference: string;
  readonly product: string;
  readonly plan: string;
  readonly devices: number;
  readonly total: number;
  readonly status: OrderStatus;
  readonly statusLabel: string;
}

export interface LicenseDevice {
  readonly id: string;
  readonly platform: string;
  readonly status: string;
}

export interface LicenseRecord {
  readonly id: string;
  readonly product: string;
  readonly plan: string;
  readonly used: number;
  readonly total: number;
  readonly expiresAt: string;
  readonly status: 'active' | 'expiring' | 'revoked';
  readonly statusLabel: string;
  readonly devices: readonly LicenseDevice[];
}

export interface ConversationMessage {
  readonly id: string;
  readonly author: 'Buyer' | 'Support' | 'AI';
  readonly body: string;
}

export interface ConversationRecord {
  readonly id: string;
  readonly buyerReference: string;
  readonly subject: string;
  readonly preview: string;
  readonly status: string;
  readonly tone: StatusTone;
  readonly product: string;
  readonly orderId: string;
  readonly payment: string;
  readonly usedDevices: number;
  readonly totalDevices: number;
  readonly messages: readonly ConversationMessage[];
}

export interface KnowledgeDocument {
  readonly id: string;
  readonly name: string;
  readonly meta: string;
  readonly status: string;
  readonly tone: StatusTone;
}

export interface JobRecord {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly tone: StatusTone;
  readonly helper: string;
}

export interface AuditEvent {
  readonly id: string;
  readonly time: string;
  readonly actor: string;
  readonly action: string;
  readonly resource: string;
  readonly ip: string;
  readonly requestId: string;
  readonly tone: StatusTone;
}

export interface VerificationRecord {
  readonly code: string;
  readonly licenseId: string;
  readonly product: string;
  readonly provider: string;
  readonly validity: string;
  readonly devices: number;
  readonly createdAt: string;
  readonly blockNumber: string;
  readonly planCommitment: string;
}

export interface MetricRecord {
  readonly label: string;
  readonly value: string;
  readonly tone: StatusTone;
  readonly helper?: string;
}

export interface RevenuePoint {
  readonly month: string;
  readonly value: number;
}
