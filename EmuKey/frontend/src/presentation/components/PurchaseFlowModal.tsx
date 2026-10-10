import { Alert, Button, Checkbox, Modal, Radio, Spin } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';

import { describeApiError, useAuth } from '../../application/auth/authContext';
import { formatVnd } from '../../application/catalog/catalogQueries';
import {
  readCheckoutIntent,
  writeCheckoutIntent,
  type CheckoutIntent,
} from '../../application/orders/checkoutIntent';
import {
  type OrderDetail,
  useOrder,
  useOrderMutations,
  useOrderTerms,
} from '../../application/orders/orderQueries';
import { resolvePurchasableOffer, type DevicePlan, type Product } from '../../domain/product';
import type { CheckoutSessionDto } from '../../infrastructure/api/generated';
import { OrderSummary } from './OrderSummary';

export interface PurchaseFlowModalProps {
  readonly open: boolean;
  readonly product: Product;
  /** Exact offer chosen before opening the modal (Catalog / Compare). */
  readonly initialPlanId?: string;
  /** Order id to resume, e.g. from the `?orderId=` deep link. */
  readonly resumeOrderId?: string;
  readonly onClose: () => void;
  /** Lets the caller (Buyer Checkout fallback route) reflect the created order in its URL. */
  readonly onOrderPrepared?: (order: OrderDetail) => void;
}

type Stage = 'configuration' | 'terms' | 'status';

/**
 * PAY-12: a signed SePay handoff must be a real browser form POST. Building the
 * form here keeps the existing gateway contract (signed hidden fields, POST,
 * same-document navigation) while letting the purchase modal own the UX.
 * https://docs.sepay.vn/
 */
export function submitSignedCheckout(session: CheckoutSessionDto): HTMLFormElement {
  const form = document.createElement('form');
  form.method = 'post';
  form.action = session.checkoutUrl;
  form.target = '_self';
  form.style.display = 'none';
  for (const [name, value] of Object.entries(session.checkoutFields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  try {
    form.requestSubmit();
  } catch {
    // sandboxed browsers may not implement requestSubmit.
    form.submit();
  }
  return form;
}

function offerDetails(offer: DevicePlan): string {
  const parts = [`${offer.devices} thiết bị`];
  if (offer.durationMonths) parts.push(`${offer.durationMonths} tháng`);
  parts.push(formatVnd(offer.priceVnd));
  return parts.join(' · ');
}

/**
 * The order snapshot is the only authority for what the buyer pays. If the
 * Provider changed the catalog after the offer list was loaded, the exact plan
 * lookup fails or the snapshotted price no longer matches, and the buyer must
 * decide again instead of paying a stale configuration.
 */
function snapshotConflict(order: OrderDetail | undefined, offer: DevicePlan | undefined): string | null {
  if (!order) return null;
  if (!offer) return 'Gói đã chọn không còn được công bố. Hãy chọn lại cấu hình.';
  if (order.planId !== offer.id) return 'Gói đã chọn đã thay đổi so với lúc bắt đầu. Hãy xác nhận lại cấu hình.';
  if (order.priceVndSnapshot !== offer.priceVnd) return 'Giá của gói đã thay đổi so với lựa chọn trước đó. Hãy xác nhận lại cấu hình.';
  return null;
}

export function PurchaseFlowModal({
  open,
  product,
  initialPlanId,
  resumeOrderId,
  onClose,
  onOrderPrepared,
}: PurchaseFlowModalProps) {
  const { user } = useAuth();
  const mutations = useOrderMutations();
  const [stage, setStage] = useState<Stage>('configuration');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [order, setOrder] = useState<OrderDetail>();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentVersion, setIntentVersion] = useState(0);
  // Refresh the persisted intent only on an explicit open, not on render. The
  // version makes the order query follow a newly loaded intent without making
  // a successful create mutate its own effect dependencies.
  const intentRef = useRef<CheckoutIntent | null>(null);
  const [intentOrderId, setIntentOrderId] = useState('');
  const resumableOrderId = resumeOrderId ?? intentOrderId;
  const effectiveIntent = resumeOrderId
    ? null
    : intentRef.current?.productSlug === product.slug
      ? intentRef.current
      : null;
  const resumedOrder = useOrder(resumableOrderId);
  const terms = useOrderTerms(order?.id ?? '');
  const pending = mutations.create.isPending || mutations.acceptServiceTerms.isPending || mutations.checkout.isPending;

  const selectedOffer = useMemo(
    () => resolvePurchasableOffer(product.plans, selectedPlanId),
    [product.plans, selectedPlanId],
  );
  const conflict = snapshotConflict(order, selectedOffer);
  const orderStatus = order?.orderStatus;
  const needsConsent = orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE';
  const waitingPayment = orderStatus === 'WAITING_PAYMENT';
  const paymentAccepted = orderStatus === 'PAYMENT_ACCEPTED';
  const terminalOrder = orderStatus === 'CANCELLED' || orderStatus === 'EXPIRED';
  const termsReady = Boolean(terms.data) && !terms.isFetching && !terms.isError;

  useEffect(() => {
    if (!open) return;
    const intent = readCheckoutIntent(user?.id);
    intentRef.current = intent && intent.productSlug === product.slug ? intent : null;
    setIntentOrderId(intentRef.current?.orderId ?? '');
    setIntentVersion((version) => version + 1);
    setStage('configuration');
    setSelectedPlanId(
      resolvePurchasableOffer(product.plans, initialPlanId ?? intentRef.current?.planId)?.id ?? '',
    );
    setOrder(undefined);
    setAccepted(false);
    setError(null);
  }, [open, initialPlanId, product.plans, product.slug, user?.id]);

  // Resuming an order that the buyer already created must land on the step that
  // still needs their decision, without creating a second order.
  useEffect(() => {
    const intentOrderId = effectiveIntent?.orderId;
    const shouldResume = Boolean(resumeOrderId || intentOrderId);
    if (!open || !shouldResume || order || !resumedOrder.data) return;
    if (resumedOrder.data.id !== resumableOrderId) return;
    if (intentOrderId && resumedOrder.data.id !== intentOrderId) return;
    setOrder(resumedOrder.data);
    setSelectedPlanId(resumedOrder.data.planId);
    setStage(resumedOrder.data.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE' || resumedOrder.data.orderStatus === 'WAITING_PAYMENT' ? 'terms' : 'status');
  }, [open, resumeOrderId, resumableOrderId, effectiveIntent?.orderId, order, resumedOrder.data, intentVersion]);

  useEffect(() => {
    if (!order) return;
    setAccepted(order.orderStatus !== 'WAITING_SERVICE_TERMS_ACCEPTANCE' && Boolean(order.serviceTermsAcceptedAt));
  }, [order]);

  function close() {
    // A created order is never destroyed by closing; the intent keeps it
    // resumable from Orders / the checkout fallback route.
    intentRef.current = null;
    onClose();
  }

  function selectOffer(planId: string) {
    setSelectedPlanId(planId);
    setError(null);
  }

  async function continueToTerms() {
    if (!selectedOffer || pending) return;
    if (order?.planId === selectedOffer.id && !conflict) {
      setStage(order.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE' || order.orderStatus === 'WAITING_PAYMENT' ? 'terms' : 'status');
      return;
    }
    setError(null);
    try {
      // PAY-04 / PAY-12: the order is created only from this explicit action,
      // with an idempotency key owned by the mutation layer.
      const created = await mutations.create.mutateAsync({ planId: selectedOffer.id });
      setOrder(created);
      setStage(created.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE' || created.orderStatus === 'WAITING_PAYMENT' ? 'terms' : 'status');
      intentRef.current = { orderId: created.id, planId: created.planId, productSlug: product.slug };
      setIntentOrderId(created.id);
      writeCheckoutIntent(user?.id, {
        orderId: created.id,
        planId: created.planId,
        productSlug: product.slug,
      });
      onOrderPrepared?.(created);
      setStage('terms');
    } catch (cause) {
      setError(describeApiError(cause, 'Không thể chuẩn bị đơn hàng. Vui lòng thử lại.'));
    }
  }

  async function payThroughSePay() {
    if (!order || !terms.data || !termsReady || pending || (needsConsent && conflict)) return;
    if (needsConsent && !accepted) {
      setError('Bạn cần đồng ý đúng phiên bản điều khoản của đơn hàng trước khi thanh toán.');
      return;
    }
    setError(null);
    try {
      let payable = order;
      if (needsConsent) {
        payable = await mutations.acceptServiceTerms.mutateAsync({ order, terms: terms.data });
        setOrder(payable);
      }
      // Merges the former "Tạo yêu cầu thanh toán" step: the backend reuses an
      // unexpired PENDING attempt, so clicking twice cannot double-charge.
      const session = await mutations.checkout.mutateAsync(payable.id);
      submitSignedCheckout(session);
    } catch (cause) {
      setError(describeApiError(cause, 'Không thể chuẩn bị thanh toán. Đơn hàng vẫn được giữ để bạn thử lại.'));
    }
  }

  const singleOffer = product.plans.length === 1;
  const configurationFooter = (
    <div className="purchase-flow-modal__footer">
      <Button disabled={pending} onClick={close}>Đóng</Button>
      <Button
        disabled={!selectedOffer || pending || Boolean(resumableOrderId && resumedOrder.isPending)}
        loading={mutations.create.isPending}
        onClick={() => void continueToTerms()}
        type="primary"
      >
        Tiếp tục
      </Button>
    </div>
  );
  const termsFooter = (
    <div className="purchase-flow-modal__footer">
      <Button disabled={pending} onClick={() => setStage('configuration')}>Quay lại</Button>
      <Button
        disabled={!order || !termsReady || pending || (needsConsent && Boolean(conflict)) || (needsConsent && !accepted)}
        loading={mutations.acceptServiceTerms.isPending || mutations.checkout.isPending}
        onClick={() => void payThroughSePay()}
        type="primary"
      >
        {waitingPayment ? 'Tiếp tục thanh toán' : 'Thanh toán qua SePay'}
      </Button>
    </div>
  );
  const statusFooter = (
    <div className="purchase-flow-modal__footer">
      {terminalOrder ? <Button disabled={pending} onClick={() => { setOrder(undefined); setStage('configuration'); setAccepted(false); }}>Chọn gói khác</Button> : null}
      {order ? <Button href={`/buyer/orders/${encodeURIComponent(order.id)}/payment`} type="primary">{paymentAccepted ? 'Theo dõi cấp bản quyền' : 'Mở trạng thái đơn hàng'}</Button> : null}
      <Button disabled={pending} onClick={close}>Đóng</Button>
    </div>
  );

  return (
    <Modal
      centered
      className="purchase-flow-modal"
      closable={!pending}
      footer={stage === 'configuration' ? configurationFooter : stage === 'terms' ? termsFooter : statusFooter}
      mask={{ closable: !pending }}
      onCancel={() => { if (!pending) close(); }}
      open={open}
      title={stage === 'configuration' ? `Mua ${product.name}` : stage === 'terms' ? `Xác nhận ${product.name}` : `Trạng thái đơn hàng`}
      width={720}
    >
      <div aria-live="polite" className="purchase-flow-modal__content">
        {stage === 'configuration' ? (
          <>
            {product.plans.length === 0 ? (
              <Alert
                message="Sản phẩm chưa có cấu hình được công bố"
                description="Provider chưa công bố gói nào cho sản phẩm này. Vui lòng chọn sản phẩm khác."
                type="info"
              />
            ) : null}

            {singleOffer ? (
              <section aria-label="Cấu hình gói" className="purchase-flow-modal__offer-summary">
                <h3>{product.plans[0]!.label}</h3>
                <dl>
                  <div><dt>Số thiết bị</dt><dd>{product.plans[0]!.devices} thiết bị</dd></div>
                  {product.plans[0]!.durationMonths ? (
                    <div><dt>Thời hạn</dt><dd>{product.plans[0]!.durationMonths} tháng</dd></div>
                  ) : null}
                  <div><dt>Giá</dt><dd>{formatVnd(product.plans[0]!.priceVnd)}</dd></div>
                </dl>
              </section>
            ) : (
              <fieldset className="purchase-flow-modal__offers">
                <legend>Chọn cấu hình</legend>
                <Radio.Group
                  aria-label="Cấu hình gói"
                  className="purchase-flow-modal__offer-group"
                  onChange={(event) => selectOffer(event.target.value as string)}
                  value={selectedPlanId || undefined}
                >
                  {product.plans.map((offer) => (
                    <Radio className="purchase-flow-modal__offer" key={offer.id} value={offer.id}>
                      <span className="purchase-flow-modal__offer-name">{offer.label}</span>
                      <span className="purchase-flow-modal__offer-details">{offerDetails(offer)}</span>
                    </Radio>
                  ))}
                </Radio.Group>
              </fieldset>
            )}

            {selectedOffer?.entitlements ? <OfferEntitlements offer={selectedOffer} /> : null}

            {resumedOrder.isPending && resumableOrderId ? <Spin aria-label="Đang khôi phục đơn hàng" /> : null}
            {resumedOrder.isError && resumableOrderId ? (
              <Alert
                action={<Button onClick={() => void resumedOrder.refetch()}>Thử lại</Button>}
                message="Không thể khôi phục đơn hàng trước đó"
                description="Đơn cũ của bạn vẫn được giữ. Bạn có thể tiếp tục mua gói đang chọn."
                type="warning"
              />
            ) : null}
            {!selectedOffer && product.plans.length > 1 ? (
              <p className="muted-copy">Chọn một cấu hình để xem giá cuối cùng từ Provider.</p>
            ) : null}
            <p className="muted-copy">Bạn sẽ đọc và đồng ý điều khoản của đúng đơn hàng này ở bước tiếp theo.</p>
          </>
        ) : stage === 'terms' ? (
          <>
            {conflict ? (
              <Alert
                action={<Button onClick={() => setStage('configuration')}>Chọn lại cấu hình</Button>}
                message="Cấu hình của đơn không còn khớp với gói đã công bố"
                description={conflict}
                type="warning"
              />
            ) : null}
            {orderSummaryOf(order) ? <OrderSummary order={orderSummaryOf(order)!} /> : null}
            {terms.isPending ? <Spin aria-label="Đang tải điều khoản" /> : null}
            {terms.isError ? (
              <Alert
                action={<Button onClick={() => void terms.refetch()}>Thử lại</Button>}
                description="Đơn hàng đã được tạo và vẫn được giữ. Thử lại sẽ tải điều khoản của chính đơn này, không tạo đơn mới."
                message="Không thể tải điều khoản của đơn hàng"
                type="error"
              />
            ) : null}
            {terms.data ? (
              <section aria-label="Điều khoản dịch vụ" className="purchase-flow-modal__terms">
                <header>
                  <h3>Điều khoản dịch vụ</h3>
                  <p className="muted-copy">Phiên bản {terms.data.version} · Hash {terms.data.hash}</p>
                </header>
                <div className="purchase-flow-modal__terms-scroll" tabIndex={0}>
                  <pre>{terms.data.content}</pre>
                </div>
                {needsConsent ? (
                  <Checkbox
                    checked={accepted}
                    onChange={(event) => { setAccepted(event.target.checked); setError(null); }}
                  >
                    Tôi đã đọc và đồng ý với đúng phiên bản điều khoản của đơn hàng này
                  </Checkbox>
                ) : (
                  <p className="muted-copy">Điều khoản của đơn hàng này đã được chấp thuận.</p>
                )}
              </section>
            ) : null}
          </>
        ) : order ? (
          <>
            {paymentAccepted ? (
              <Alert
                showIcon
                type="info"
                message="Đơn hàng này đã được thanh toán"
                description="Hệ thống đang cập nhật trạng thái cấp bản quyền. Việc quay lại từ cổng thanh toán không thay thế xác nhận từ backend và blockchain."
              />
            ) : terminalOrder ? (
              <Alert
                showIcon
                type="warning"
                message={orderStatus === 'CANCELLED' ? 'Đơn hàng đã hủy' : 'Đơn hàng đã hết hạn'}
                description="Đơn này không thể thanh toán. Bạn có thể chọn lại gói để bắt đầu đơn hàng mới."
              />
            ) : (
              <Alert showIcon type="info" message="Trạng thái đơn hàng chưa hỗ trợ tiếp tục trong quy trình mua." description="Mở trang trạng thái để xem hướng xử lý an toàn." />
            )}
            {orderSummaryOf(order) ? <OrderSummary order={orderSummaryOf(order)!} /> : null}
          </>
        ) : null}

        {error ? <Alert message={error} role="alert" type="error" /> : null}
      </div>
    </Modal>
  );
}

function OfferEntitlements({ offer }: { readonly offer: DevicePlan }) {
  const entries = Object.entries(offer.entitlements ?? {})
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key === 'desktop' ? 'Ứng dụng máy tính' : key}${value === true ? '' : `: ${String(value)}`}`);
  if (entries.length === 0) return null;
  return (
    <section aria-label="Quyền lợi của gói" className="purchase-flow-modal__entitlements">
      <h3>Quyền lợi</h3>
      <ul>{entries.map((entry) => <li key={entry}>{entry}</li>)}</ul>
    </section>
  );
}

function orderSummaryOf(order: OrderDetail | undefined) {
  if (!order) return null;
  return {
    total: order.priceVndSnapshot,
    productName: order.productNameSnapshot,
    planName: order.planNameSnapshot,
    billingCycle: order.billingCycleSnapshot,
    durationMonths: order.durationMonthsSnapshot,
    maxActiveDevices: order.maxActiveDevicesSnapshot,
    entitlements: order.entitlementsSnapshot,
    orderNumber: order.orderNumber,
  };
}