import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { requestJson } from '../auth/authContext';
import type {
  CheckoutSessionDto,
  CreateOrderDto,
  OrderDto,
  OrderTermsDto,
  PaymentHistoryDto,
  PaymentReviewDto,
  ReviewPaymentDto,
  RenewalPreviewDto,
} from '../../infrastructure/api/generated';

export type OrderSummary = OrderDto;
export type OrderDetail = OrderDto;
export type PaymentAttempt = CheckoutSessionDto;

export function useRenewalPreview(licenseId: string) {
  return useQuery({
    queryKey: ['orders', 'renewal-preview', licenseId],
    queryFn: () => requestJson<RenewalPreviewDto>(`/orders/renewal-preview/${encodeURIComponent(licenseId)}`),
    enabled: Boolean(licenseId),
    refetchInterval: 15_000,
  });
}

export function usePaymentReviews(enabled = true) {
  return useQuery({ enabled, queryKey: ['payments', 'review'], queryFn: () => requestJson<PaymentReviewDto[]>('/payments/review') });
}

export function useReviewPayment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReviewPaymentDto }) => requestJson<PaymentReviewDto>(`/payments/review/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['payments'] }); },
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: () => requestJson<OrderSummary[]>('/orders'),
    refetchInterval: (query) => query.state.data?.some((order) =>
      ['WAITING_SERVICE_TERMS_ACCEPTANCE', 'WAITING_PAYMENT'].includes(order.orderStatus)) ? 15_000 : false,
  });
}

export function usePaymentHistory(enabled = true, poll = false) {
  return useQuery({
    enabled,
    queryKey: ['payments', 'history'],
    queryFn: () => requestJson<PaymentHistoryDto[]>('/payments/history'),
    refetchInterval: poll ? 2_000 : false,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => requestJson<OrderDetail>(`/orders/${encodeURIComponent(id)}`),
    enabled: Boolean(id),
    // Keep the return page in sync until the payment callback projects the
    // accepted state. Downstream chain state is polled by useOrderLicense.
    refetchInterval: (query) => {
      const order = query.state.data;
      if (['WAITING_SERVICE_TERMS_ACCEPTANCE', 'WAITING_PAYMENT'].includes(order?.orderStatus ?? '')) return 2_000;
      // Keep observing this renewal command (including reorg/recovery), not the original ISSUE.
      return order?.orderType === 'RENEWAL' && order.orderStatus === 'PAYMENT_ACCEPTED' ? 2_000 : false;
    },
  });
}

export function useOrderTerms(id: string) {
  return useQuery({
    queryKey: ['orders', id, 'terms'],
    queryFn: () =>
      requestJson<OrderTermsDto>(`/orders/${encodeURIComponent(id)}/service-terms`),
    enabled: Boolean(id),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useOrderMutations() {
  const queryClient = useQueryClient();
  // Retain an uncertain operation's key until its response is acknowledged.
  const pendingCreates = useRef(new Map<string, string>());
  const refresh = (order?: OrderSummary) => {
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
    if (order)
      void queryClient.invalidateQueries({ queryKey: ['orders', order.id] });
  };
  return {
    create: useMutation({
      mutationFn: async (body: CreateOrderDto) => {
        const operation = JSON.stringify(body);
        const idempotencyKey = pendingCreates.current.get(operation) ?? crypto.randomUUID();
        pendingCreates.current.set(operation, idempotencyKey);
        const order = await requestJson<OrderDetail>('/orders', {
          method: 'POST',
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(body),
        });
        pendingCreates.current.delete(operation);
        return order;
      },
      onSuccess: refresh,
    }),
    acceptServiceTerms: useMutation({
      mutationFn: ({ order, terms }: { order: OrderDetail; terms: Pick<OrderTermsDto, 'version' | 'hash'> }) =>
        requestJson<OrderDetail>(
          `/orders/${encodeURIComponent(order.id)}/accept-service-terms`,
          {
            method: 'POST',
            body: JSON.stringify({
              accepted: true,
              version: terms.version,
              hash: terms.hash,
            }),
          },
        ),
      onSuccess: refresh,
    }),
    checkout: useMutation({
      mutationFn: (id: string) =>
        requestJson<PaymentAttempt>(
          `/orders/${encodeURIComponent(id)}/checkout`,
          {
            method: 'POST',
          },
        ),
    }),
    cancel: useMutation({
      mutationFn: (id: string) =>
        requestJson<OrderDetail>(`/orders/${encodeURIComponent(id)}/cancel`, {
          method: 'POST',
        }),
      onSuccess: refresh,
    }),
  };
}

export function orderStatusLabel(
  order: Pick<OrderSummary, 'orderStatus'>,
): string {
  if (order.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE')
    return 'Chờ đồng ý điều khoản';
  if (order.orderStatus === 'WAITING_PAYMENT') return 'Chờ thanh toán';
  if (order.orderStatus === 'PAYMENT_ACCEPTED') return 'Đã nhận thanh toán';
  if (order.orderStatus === 'CANCELLED') return 'Đã hủy';
  return 'Đã hết hạn';
}

export function orderStatusTone(
  order: Pick<OrderSummary, 'orderStatus'>,
): 'success' | 'warning' | 'error' | 'neutral' {
  if (order.orderStatus === 'PAYMENT_ACCEPTED') return 'success';
  if (order.orderStatus === 'CANCELLED' || order.orderStatus === 'EXPIRED')
    return 'error';
  if (order.orderStatus === 'WAITING_PAYMENT') return 'warning';
  return 'neutral';
}
