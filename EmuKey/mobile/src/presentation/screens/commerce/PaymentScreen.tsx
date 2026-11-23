import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { usePaymentStatus } from '../../../application/orders/usePaymentStatus';
import type { RootStackParamList } from '../../navigation/navigationTypes';
import { orderStatusLabel, orderStatusTone } from '../../../application/orders/orderPresentation';
import { FulfillmentProgress, type FulfillmentStep } from '../../components/FulfillmentProgress';
import { KeyValueList } from '../../components/KeyValueList';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { formatDateTimeVi, formatDateVi, formatVnd } from '../../formatters';
import { PaymentGatewayScreen } from './PaymentGatewayScreen';

export interface PaymentScreenProps {
  readonly navigation: Pick<
    NativeStackNavigationProp<RootStackParamList>,
    'navigate'
  > & {
    goBack?: () => void;
  };
  readonly route: {
    params: { orderId: string };
  };
}

export function PaymentScreen({ navigation, route }: PaymentScreenProps) {
  const { orderId } = route.params;
  const {
    order,
    license,
    checkout,
    decision,
    hasOpenReview,
    loading,
    busy,
    error,
    licenseReady,
    licenseProgress,
    refresh,
    openCheckout,
    closeCheckout,
    handlePaymentReturn,
  } = usePaymentStatus(orderId, true);

  if (checkout) {
    return (
      <PaymentGatewayScreen
        checkout={checkout}
        onBack={closeCheckout}
        onShouldStartLoadUrl={handlePaymentReturn}
      />
    );
  }

  if (loading && !order) {
    return (
      <Screen header={<AppHeader onBack={navigation.goBack} title="Thanh toán đơn hàng" />}>
        <FeedbackState mode="loading" title="Đang tải đơn hàng..." />
      </Screen>
    );
  }

  if (!order && error) {
    return (
      <Screen header={<AppHeader onBack={navigation.goBack} title="Thanh toán đơn hàng" />}>
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void refresh()}
          title={error}
        />
      </Screen>
    );
  }

  const isRenewal = order?.orderType === 'RENEWAL';
  const waitingPayment = order?.orderStatus === 'WAITING_PAYMENT';
  const paymentAccepted = order?.orderStatus === 'PAYMENT_ACCEPTED';
  const isTerminal =
    order?.orderStatus === 'CANCELLED' || order?.orderStatus === 'EXPIRED';

  const openOrderSupport = () => {
    navigation.navigate('CustomerTabs', {
      screen: 'AccountTab',
      params: {
        screen: 'CreateSupportRequest',
        params: {
          contextId: order?.id ?? orderId,
          contextType: 'ORDER',
          contextLabel: order?.orderNumber,
          initialTitle: order?.orderNumber
            ? `Hỗ trợ đơn ${order.orderNumber}`
            : 'Hỗ trợ thanh toán đơn hàng',
        },
      },
    });
  };

  const timelineSteps: FulfillmentStep[] = order
    ? [
        {
          label: 'Điều khoản dịch vụ',
          status:
            order.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE'
              ? 'Chờ đồng ý'
              : 'Đã xác nhận',
          tone:
            order.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE'
              ? 'warning'
              : 'success',
        },
        {
          label: 'Thanh toán SePay',
          status: paymentAccepted
            ? 'Đã xác nhận'
            : hasOpenReview
              ? 'Đang kiểm tra giao dịch'
              : isTerminal
                ? orderStatusLabel(order.orderStatus)
                : 'Chờ thanh toán',
          tone: paymentAccepted
            ? 'success'
            : hasOpenReview
              ? 'warning'
              : isTerminal
                ? 'error'
                : 'info',
        },
        {
          label: isRenewal ? 'Gia hạn bản quyền' : 'Cấp bản quyền',
          status: licenseReady
            ? 'Hoàn tất'
            : paymentAccepted
              ? license?.providerDeliveryStatus === 'FAILED'
                ? 'Cần xử lý bàn giao'
                : 'Đang xử lý'
              : 'Chưa bắt đầu',
          tone: licenseReady
            ? 'success'
            : license?.providerDeliveryStatus === 'FAILED'
              ? 'warning'
              : paymentAccepted
                ? 'info'
                : 'neutral',
        },
        {
          label: isRenewal ? 'Sẵn sàng tiếp tục sử dụng' : 'Sẵn sàng nhận mã',
          status: licenseReady ? 'Sẵn sàng' : 'Chưa sẵn sàng',
          tone: licenseReady ? 'success' : 'neutral',
        },
      ]
    : [];

  return (
    <Screen
      header={
        <AppHeader
          onBack={navigation.goBack}
          title="Thanh toán đơn hàng"
          trailing={
            <AppButton
              icon="refresh"
              label="Làm mới"
              onPress={() => void refresh()}
              variant="tertiary"
            />
          }
        />
      }
    >
      <SurfaceCard>
        <AppText variant="cardTitle">
          {order?.orderNumber ?? 'Đang tải đơn hàng...'}
        </AppText>
        {order ? (
          <>
            <AppText tone="secondary" variant="secondary">
              {order.productNameSnapshot} · {order.planNameSnapshot}
            </AppText>
            <StatusBadge
              label={orderStatusLabel(order.orderStatus)}
              tone={orderStatusTone(order.orderStatus)}
            />
            <AppText tone="primary" variant="priceDetail">
              {formatVnd(order.priceVndSnapshot)}
            </AppText>
            <KeyValueList
              rows={[
                { label: 'Hạn thanh toán', value: formatDateTimeVi(order.paymentDueAt) },
              ]}
            />
          </>
        ) : (
          <AppText tone="secondary" variant="secondary">
            Đang tải trạng thái
          </AppText>
        )}
      </SurfaceCard>

      {order ? (
        <SurfaceCard>
          <AppText variant="cardTitle">Tiến trình xử lý</AppText>
          <FulfillmentProgress steps={timelineSteps} />
        </SurfaceCard>
      ) : null}

      {waitingPayment ? (
        hasOpenReview ? (
          <InlineNotice
            actionLabel="Liên hệ hỗ trợ"
            message="Giao dịch cần kiểm tra — không thanh toán lại. Liên hệ hỗ trợ kèm mã đơn để đối soát."
            onAction={openOrderSupport}
            title="Đang kiểm tra giao dịch"
            tone="warning"
          />
        ) : decision?.allowed || decision?.canResume ? (
          <SurfaceCard>
            <InlineNotice
              message="Nếu đã chuyển tiền, hãy chờ xác nhận và không thanh toán thêm."
              tone="info"
            />
            <AppButton
              fullWidth
              label={
                decision.canResume
                  ? 'Tiếp tục phiên thanh toán'
                  : 'Thanh toán trên SePay'
              }
              loading={busy}
              onPress={() => void openCheckout()}
              size="large"
            />
          </SurfaceCard>
        ) : decision?.customerNextAction === 'CONTACT_SUPPORT' ? (
          <SurfaceCard>
            <InlineNotice
              message="Đã có kết quả kiểm tra giao dịch. Đơn chưa được mở thanh toán lại; liên hệ hỗ trợ kèm mã đơn để tiếp tục."
              tone="warning"
            />
            <AppButton
              fullWidth
              label="Liên hệ hỗ trợ"
              onPress={openOrderSupport}
              variant="secondary"
            />
          </SurfaceCard>
        ) : (
          <InlineNotice
            message="Đang chờ xác nhận hoặc đối soát thanh toán. Không chuyển tiền thêm."
            tone="warning"
          />
        )
      ) : null}

      {paymentAccepted ? (
        <SurfaceCard>
          {licenseProgress ? (
            <InlineNotice
              message={licenseProgress}
              tone={license?.providerDeliveryStatus === 'FAILED' ? 'warning' : 'info'}
            />
          ) : null}
          <InlineNotice
            message={
              licenseReady
                ? isRenewal
                  ? `Gia hạn đã hoàn tất. Hạn mới: ${formatDateVi(order.renewalExpiresAt)}`
                  : 'Mở danh sách bản quyền để nhận mã hoặc xem mã đã lưu.'
                : licenseProgress
                  ? 'Thanh toán đã được ghi nhận. Bạn có thể quay về danh sách bản quyền và kiểm tra lại sau; không thanh toán lại.'
                  : 'Đã nhận thanh toán. Hệ thống đang chờ xác nhận bản quyền; không thanh toán lại.'
            }
            tone={licenseReady ? 'success' : 'info'}
          />
          <AppButton
            fullWidth
            label="Xem bản quyền của tôi"
            onPress={() => {
              const targetLicenseId = order.licenseId ?? order.targetLicenseId;
              if (targetLicenseId) {
                navigation.navigate('LicenseDetail', { licenseId: targetLicenseId });
              } else {
                navigation.navigate('Licenses');
              }
            }}
            size="large"
          />
        </SurfaceCard>
      ) : null}

      {isTerminal ? (
        <SurfaceCard>
          <InlineNotice
            message={
              order?.orderStatus === 'CANCELLED'
                ? 'Đơn hàng này đã được hủy và không thể thanh toán.'
                : 'Đơn hàng đã quá hạn thanh toán. Bạn có thể quay lại chọn gói để tạo đơn mới.'
            }
            tone="error"
          />
          <AppButton
            fullWidth
            label="Về đơn hàng"
            onPress={() =>
              navigation.navigate('CustomerTabs', {
                screen: 'OrdersTab',
                params: { screen: 'Orders' },
              })
            }
            variant="secondary"
          />
        </SurfaceCard>
      ) : null}

      {error ? <InlineNotice message={error} tone="error" /> : null}
    </Screen>
  );
}
