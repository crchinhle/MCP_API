export function formatVnd(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  return `${Math.round(amount).toLocaleString('vi-VN')} ₫`;
}

export function formatDateVi(value: string | null | undefined): string {
  if (!value) return 'Chưa xác định';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Chưa xác định';
  return parsed.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTimeVi(value: string | null | undefined): string {
  if (!value) return 'Chưa xác định';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Chưa xác định';
  const datePart = parsed.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = parsed.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${datePart} · ${timePart}`;
}

export function formatLast4(last4: string | null | undefined): string {
  return last4 ? `•••• ${last4}` : 'Chưa xác định';
}

export function formatUnreadBadge(count: number): string | undefined {
  if (!Number.isFinite(count) || count <= 0) return undefined;
  return count > 99 ? '99+' : String(Math.floor(count));
}

export function formatPlanDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'Gói đã chọn';
  return /^gói\b/i.test(trimmed) ? trimmed : `Gói ${trimmed}`;
}

export function getInitials(displayName: string | null | undefined, email?: string | null): string {
  const source = (displayName ?? '').trim() || (email ?? '').trim();
  if (!source) return 'EK';
  const parts = source.split(/\s+/).filter(Boolean);
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (parts.length >= 2 && first && last) {
    return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
