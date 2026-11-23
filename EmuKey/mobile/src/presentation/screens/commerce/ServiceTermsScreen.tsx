import { useCheckoutOrder } from '../../../application/orders/useCheckout';
import { orderStatusLabel } from '../../../application/orders/orderPresentation';
import { TermsAcceptance } from '../../components/TermsAcceptance';
import { AppHeader } from '../../components/layout/AppHeader';
import { BottomActionBar } from '../../components/layout/BottomActionBar';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { AppText } from '../../components/ui/AppText';
import { formatVnd } from '../../formatters';

export interface ServiceTermsScreenProps {
  readonly orderId: string;
  readonly onBack: () => void;
  readonly onAccepted: (orderId: string) => void;
}

export function ServiceTermsScreen({
  orderId,
  onBack,
  onAccepted,
}: ServiceTermsScreenProps) {
  const {
    order,
    terms,
    termsState,
    accepted,
    setAccepted,
    busy,
    error,
    loadTerms,
    resumeOrder,
    acceptTerms,
  } = useCheckoutOrder(orderId);

  if (!order && busy) {
    return (
      <Screen header={<AppHeader onBack={onBack} title="Điều khoản dịch vụ" />}>
        <FeedbackState mode="loading" title="Đang tải đơn hàng..." />
      </Screen>
    );
  }

  if (!order && error) {
    return (
      <Screen header={<AppHeader onBack={onBack} title="Điều khoản dịch vụ" />}>
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void resumeOrder(orderId)}
          title={error}
        />
      </Screen>
    );
  }

  const waitingTerms = order?.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE';
  const payableOrPaid =
    order?.orderStatus === 'WAITING_PAYMENT' ||
    order?.orderStatus === 'PAYMENT_ACCEPTED';

  const handleConfirm = async () => {
    if (payableOrPaid && order) {
      onAccepted(order.id);
      return;
    }
    const updated = await acceptTerms();
    if (updated) onAccepted(updated.id);
  };

  return (
    <Screen
      footer={
        order && (waitingTerms || payableOrPaid) ? (
          <BottomActionBar
            primary={
              <AppButton
                disabled={
                  waitingTerms
                    ? busy || termsState !== 'ready' || !accepted
                    : false
                }
                label={
                  payableOrPaid ? 'Đến trang thanh toán' : 'Đồng ý và tiếp tục'
                }
                loading={busy}
                onPress={() => void handleConfirm()}
                size="large"
              />
            }
            summaryLabel={order.orderNumber}
            summaryValue={formatVnd(order.priceVndSnapshot)}
          />
        ) : undefined
      }
      header={<AppHeader onBack={onBack} title="Điều khoản dịch vụ" />}
    >
      {order ? (
        <SurfaceCard>
          <AppText variant="cardTitle">{order.productNameSnapshot}</AppText>
          <AppText tone="secondary" variant="secondary">
            {order.planNameSnapshot} · {order.orderNumber}
          </AppText>
        </SurfaceCard>
      ) : null}

      {order && !waitingTerms ? (
        <InlineNotice
          actionLabel={payableOrPaid ? 'Xem thanh toán' : undefined}
          message={
            payableOrPaid
              ? 'Đơn hàng đã xác nhận điều khoản. Bạn có thể tiếp tục sang thanh toán.'
              : `Trạng thái hiện tại: ${orderStatusLabel(order.orderStatus)}.`
          }
          onAction={payableOrPaid ? () => onAccepted(order.id) : undefined}
          tone={payableOrPaid ? 'info' : 'warning'}
        />
      ) : (
        <TermsAcceptance
          accepted={accepted}
          disabled={busy}
          onChangeAccepted={setAccepted}
          onRetry={() => {
            if (order) void loadTerms(order.id);
          }}
          state={termsState}
          terms={terms}
        />
      )}

      {error ? <InlineNotice message={error} tone="error" /> : null}
    </Screen>
  );
}
