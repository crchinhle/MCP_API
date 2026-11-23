import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { checkoutDocument } from '../../../application/orders/sepayHelpers';
import type { MobileCheckoutSession } from '../../../infrastructure/api/client';
import { AppHeader } from '../../components/layout/AppHeader';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { colors, spacing } from '../../theme/tokens';

export interface PaymentGatewayScreenProps {
  readonly checkout: MobileCheckoutSession;
  readonly onBack: () => void;
  readonly onShouldStartLoadUrl: (url: string) => boolean;
}

export function PaymentGatewayScreen({
  checkout,
  onBack,
  onShouldStartLoadUrl,
}: PaymentGatewayScreenProps) {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription?.remove?.();
  }, [onBack]);

  const handleRetryPage = () => {
    setLoadError(null);
    setLoading(true);
    setReloadKey((current) => current + 1);
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <AppHeader
        onBack={onBack}
        title="Cổng thanh toán SePay"
        trailing={
          <AppButton
            label="Về trạng thái đơn hàng"
            onPress={onBack}
            variant="tertiary"
          />
        }
      />

      {loading && !loadError ? (
        <View accessibilityRole="progressbar" style={styles.loadingBar}>
          <ActivityIndicator color={colors.primary} size="small" />
          <AppText tone="secondary" variant="secondary">
            Đang tải trang thanh toán SePay...
          </AppText>
        </View>
      ) : null}

      {loadError ? (
        <View style={styles.errorPanel}>
          <InlineNotice
            message={`${loadError} Lỗi hiển thị trang không đồng nghĩa thanh toán thất bại; hãy kiểm tra lại trạng thái đơn hàng nếu bạn đã chuyển tiền.`}
            title="Chưa tải được trang cổng thanh toán"
            tone="warning"
          />
          <View style={styles.errorActions}>
            <AppButton
              fullWidth
              label="Tải lại trang thanh toán"
              onPress={handleRetryPage}
              size="large"
            />
            <AppButton
              fullWidth
              label="Về trạng thái đơn hàng"
              onPress={onBack}
              variant="secondary"
            />
          </View>
        </View>
      ) : (
        <WebView
          key={reloadKey}
          ref={webViewRef}
          javaScriptEnabled
          onError={() => {
            setLoading(false);
            setLoadError('Mất kết nối hoặc không thể mở cổng thanh toán.');
          }}
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode >= 400) {
              setLoading(false);
              setLoadError(
                `Cổng thanh toán trả về lỗi hiển thị (mã ${event.nativeEvent.statusCode}).`,
              );
            }
          }}
          onLoadEnd={() => setLoading(false)}
          onLoadStart={() => {
            setLoading(true);
            setLoadError(null);
          }}
          onShouldStartLoadWithRequest={(request) => {
            if (onShouldStartLoadUrl(request.url)) {
              return false;
            }
            return (
              request.url === 'about:blank' || request.url.startsWith('https://')
            );
          }}
          originWhitelist={['*']}
          source={{ html: checkoutDocument(checkout) }}
          style={styles.webView}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  loadingBar: {
    alignItems: 'center',
    backgroundColor: colors.infoSurface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  errorPanel: {
    flex: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  errorActions: {
    gap: spacing.sm,
  },
  webView: {
    flex: 1,
  },
});
