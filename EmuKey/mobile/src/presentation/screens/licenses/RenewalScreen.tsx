import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useCheckoutOrder } from '../../../application/orders/useCheckout';
import { describeRequestError } from '../../../application/requestError';
import type { RootStackParamList } from '../../navigation/navigationTypes';
import {
  getOrder,
  getRenewalPreview,
  type MobileOrderDetail,
  type MobileRenewalPreview,
} from '../../../infrastructure/api/client';
import { KeyValueList } from '../../components/KeyValueList';
import { TermsAcceptance } from '../../components/TermsAcceptance';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { formatDateVi, formatVnd } from '../../formatters';
import { spacing } from '../../theme/tokens';

export interface RenewalScreenProps {
  readonly navigation: Pick<
    NativeStackNavigationProp<RootStackParamList>,
    'replace'
  > & {
    goBack?: () => void;
    navigate?: NativeStackNavigationProp<RootStackParamList>['navigate'];
  };
  readonly route: {
    params: {
      licenseId: string;
      originOrderId?: string;
      productName?: string;
    };
  };
}

export function RenewalScreen({ navigation, route }: RenewalScreenProps) {
  const { licenseId, originOrderId, productName } = route.params;
  const [sourceOrder, setSourceOrder] = useState<MobileOrderDetail | null>(null);
  const [sourceOrderError, setSourceOrderError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MobileRenewalPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const startLockRef = useRef(false);

  const {
    order: renewalOrder,
    terms,
    termsState,
    accepted,
    setAccepted,
    busy,
    error: checkoutError,
    loadTerms,
    prepareOrder,
    resumeOrder,
    acceptTerms,
    resetOrder,
  } = useCheckoutOrder();

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSourceOrderError(null);
    const [previewResult, orderResult] = await Promise.allSettled([
      getRenewalPreview(licenseId),
      originOrderId ? getOrder(originOrderId) : Promise.resolve(null),
    ]);

    if (previewResult.status === 'fulfilled') {
      setPreview(previewResult.value);
    } else {
      setLoadError(
        describeRequestError(
          previewResult.reason,
          'Không thể tải thông tin gia hạn. Vui lòng thử lại.',
          {
            notFound: 'Không tìm thấy bản quyền để gia hạn.',
            forbidden: 'Bạn không có quyền gia hạn bản quyền này.',
          },
        ),
      );
    }

    if (originOrderId) {
      if (orderResult.status === 'fulfilled') {
        setSourceOrder(orderResult.value);
        setSourceOrderError(null);
      } else {
        setSourceOrder(null);
        setSourceOrderError(
          describeRequestError(
            orderResult.reason,
            'Không thể tải thông tin đơn hàng gốc để đối chiếu gia hạn.',
            {
              notFound: 'Không tìm thấy đơn hàng gốc của bản quyền này.',
              forbidden: 'Bạn không có quyền truy cập đơn hàng gốc của bản quyền này.',
            },
          ),
        );
      }
    } else {
      setSourceOrder(null);
      setSourceOrderError(null);
    }

    setLoading(false);
  }, [licenseId, originOrderId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const startRenewal = async () => {
    if (!preview?.canRenew || loadError || busy || startLockRef.current) return;
    if (originOrderId && (!sourceOrder || sourceOrderError)) return;
    startLockRef.current = true;
    try {
      if (preview.pendingOrder) {
        await resumeOrder(preview.pendingOrder.id);
        return;
      }
      await prepareOrder({
        planId: preview.planId,
        targetLicenseId: licenseId,
      });
    } finally {
      startLockRef.current = false;
    }
  };

  const continueToPayment = async () => {
    const updated = await acceptTerms();
    if (updated) {
      navigation.replace('Payment', { orderId: updated.id });
    }
  };

  if (loading && !preview) {
    return (
      <Screen header={<AppHeader onBack={navigation.goBack} title="Gia hạn bản quyền" />}>
        <FeedbackState mode="loading" title="Đang tải thông tin gia hạn..." />
      </Screen>
    );
  }

  if (loadError && !preview) {
    return (
      <Screen header={<AppHeader onBack={navigation.goBack} title="Gia hạn bản quyền" />}>
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void loadPreview()}
          title={loadError}
        />
      </Screen>
    );
  }

  const displayPrice = renewalOrder?.priceVndSnapshot ?? preview?.priceVnd;
  const priceChanged = Boolean(
    renewalOrder && preview && renewalOrder.priceVndSnapshot !== preview.priceVnd,
  );
  const canStart = Boolean(
    preview?.canRenew &&
      !loadError &&
      (!originOrderId || (sourceOrder && !sourceOrderError)) &&
      !busy &&
      !loading,
  );

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title="Gia hạn bản quyền" />}>
      <SurfaceCard>
        <AppText accessibilityRole="header" variant="cardTitle">
          {preview?.productName ?? productName ?? 'Sản phẩm bản quyền'}
        </AppText>
        <AppText tone="secondary" variant="secondary">
          {preview?.planName ??
            sourceOrder?.planNameSnapshot ??
            (sourceOrderError ? 'Chưa tải được thông tin gói' : 'Đang tải gói hiện tại...')}
        </AppText>
        {typeof displayPrice === 'number' ? (
          <AppText tone="primary" variant="priceDetail">
            {formatVnd(displayPrice)}
          </AppText>
        ) : null}

        {preview ? (
          <KeyValueList
            rows={[
              { label: 'Thời gian gia hạn', value: `${preview.durationMonths} tháng` },
              {
                label: 'Hạn hiện tại',
                value: formatDateVi(preview.currentExpiresAt),
              },
              {
                label: 'Hạn dự kiến',
                value: formatDateVi(preview.estimatedExpiresAt),
              },
            ]}
          />
        ) : null}

        {priceChanged && renewalOrder ? (
          <InlineNotice
            message={`Giá đơn gia hạn (${formatVnd(renewalOrder.priceVndSnapshot)}) đã thay đổi so với dự kiến. Vui lòng xem lại trước khi đồng ý.`}
            tone="warning"
          />
        ) : null}

        {preview && !preview.canRenew ? (
          <InlineNotice
            actionLabel={navigation.navigate ? 'Liên hệ hỗ trợ' : undefined}
            message="Bản quyền đang tạm ngưng, đã thu hồi hoặc gói hiện không còn hỗ trợ gia hạn trực tiếp."
            onAction={
              navigation.navigate
                ? () =>
                    navigation.navigate?.('CustomerTabs', {
                      screen: 'AccountTab',
                      params: {
                        screen: 'CreateSupportRequest',
                        params: {
                          contextId: licenseId,
                          contextType: 'LICENSE',
                        },
                      },
                    })
                : undefined
            }
            tone="error"
          />
        ) : null}
      </SurfaceCard>

      {loadError && preview ? (
        <InlineNotice
          actionLabel="Thử lại"
          actionLoading={loading}
          message={`${loadError} Dữ liệu phía trên có thể đã cũ; vui lòng tải lại trước khi tiếp tục gia hạn.`}
          onAction={() => void loadPreview()}
          title="Không thể làm mới thông tin gia hạn"
          tone="error"
        />
      ) : null}

      {sourceOrderError ? (
        <InlineNotice
          actionLabel="Thử lại"
          actionLoading={loading}
          message={sourceOrderError}
          onAction={() => void loadPreview()}
          title="Chưa đối chiếu được đơn hàng gốc"
          tone="error"
        />
      ) : null}

      <InlineNotice
        message="Gia hạn giữ nguyên mã bản quyền và các thiết bị đang sử dụng. Hạn sử dụng chỉ được cộng dồn sau khi thanh toán và xác nhận blockchain."
        tone="info"
      />

      {!renewalOrder ? (
        <AppButton
          disabled={!canStart}
          fullWidth
          label={preview?.pendingOrder ? 'Tiếp tục đơn gia hạn' : 'Tạo đơn gia hạn'}
          loading={busy}
          onPress={() => void startRenewal()}
          size="large"
        />
      ) : renewalOrder.orderStatus !== 'WAITING_SERVICE_TERMS_ACCEPTANCE' ? (
        ['WAITING_PAYMENT', 'PAYMENT_ACCEPTED'].includes(renewalOrder.orderStatus) ? (
          <AppButton
            fullWidth
            label="Tiếp tục thanh toán"
            onPress={() => navigation.replace('Payment', { orderId: renewalOrder.id })}
            size="large"
          />
        ) : (
          <SurfaceCard>
            <InlineNotice
              message="Đơn gia hạn đã kết thúc. Vui lòng tải lại thông tin bản quyền."
              tone="warning"
            />
            <AppButton
              label="Tải lại thông tin gia hạn"
              onPress={() => {
                resetOrder();
                void loadPreview();
              }}
              variant="secondary"
            />
          </SurfaceCard>
        )
      ) : (
        <View style={styles.termsBlock}>
          <TermsAcceptance
            accepted={accepted}
            disabled={busy}
            onChangeAccepted={setAccepted}
            onRetry={() => void loadTerms(renewalOrder.id)}
            state={termsState}
            terms={terms}
            title="Điều khoản gia hạn"
          />
          <AppButton
            disabled={!accepted || !terms || termsState !== 'ready' || busy}
            fullWidth
            label="Tiếp tục thanh toán"
            loading={busy}
            onPress={() => void continueToPayment()}
            size="large"
          />
        </View>
      )}

      {checkoutError ? <InlineNotice message={checkoutError} tone="error" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  termsBlock: {
    gap: spacing.md,
  },
});
