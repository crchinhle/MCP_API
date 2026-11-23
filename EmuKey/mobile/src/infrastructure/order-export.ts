import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { orderStatusLabel } from '../application/orders/orderPresentation';
import type { MobileOrderSummary } from './api/client';

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function escapeCsvCell(raw: string | number | boolean | null | undefined): string {
  const str = String(raw ?? '');
  const safe = FORMULA_TRIGGER.test(str) ? `'${str}` : str;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function buildOrdersCsv(orders: readonly MobileOrderSummary[]): string {
  const header = ['Mã đơn', 'Sản phẩm', 'Gói', 'Thành tiền (VND)', 'Trạng thái', 'Ngày tạo'];
  const rows = orders.map((order) => [
    order.orderNumber,
    order.productNameSnapshot,
    order.planNameSnapshot,
    String(order.priceVndSnapshot),
    orderStatusLabel(order.orderStatus),
    order.createdAt,
  ]);
  return [header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');
}

export async function exportOrdersCsv(
  orders: readonly MobileOrderSummary[],
): Promise<{ exported: boolean; count: number }> {
  if (!orders.length) {
    return { exported: false, count: 0 };
  }
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('SHARING_UNAVAILABLE');
  }
  const csv = buildOrdersCsv(orders);
  const file = new File(Paths.cache, 'emukey-orders.csv');
  file.write(`\uFEFF${csv}`);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Xuất danh sách đơn hàng EmuKey',
    UTI: 'public.comma-separated-values-text',
  });
  return { exported: true, count: orders.length };
}
