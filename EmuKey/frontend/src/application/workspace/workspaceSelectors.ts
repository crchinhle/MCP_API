import type {
  OrderRecord,
  OrderStatus,
  VerificationRecord,
} from '../../domain/workspace';

export type OrderStatusFilter = OrderStatus | 'all';

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('vi');
}

export function filterOrders(
  items: readonly OrderRecord[],
  query: string,
  status: OrderStatusFilter,
): readonly OrderRecord[] {
  const normalizedQuery = normalize(query);

  return items.filter((order) => {
    const matchesQuery = [
      order.id,
      order.buyerReference,
      order.product,
      order.plan,
    ].some((value) => normalize(value).includes(normalizedQuery));
    return matchesQuery && (status === 'all' || order.status === status);
  });
}

export function findVerification(
  items: readonly VerificationRecord[],
  code: string,
): VerificationRecord | undefined {
  const normalizedCode = normalize(code);
  return items.find((record) => normalize(record.code) === normalizedCode);
}
