import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useCart } from '../../../application/cart/cartContext';
import { useCatalogProduct } from '../../../application/catalog/useCatalog';
import { PlanOptionCard } from '../../components/PlanOptionCard';
import { AppHeader } from '../../components/layout/AppHeader';
import { BottomActionBar } from '../../components/layout/BottomActionBar';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppIcon } from '../../components/ui/AppIcon';
import { AppText } from '../../components/ui/AppText';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { formatPlanDisplayName, formatVnd } from '../../formatters';
import { colors, radius, sizes, spacing, typography } from '../../theme/tokens';

const DURATION_OPTIONS = [1, 2, 3, 6, 12] as const;
const MAX_DEVICES = 2_147_483_647;

export interface PurchaseConfigurationScreenProps {
  readonly productId: string;
  readonly initialPlanId?: string;
  readonly draftId?: string;
  readonly initialDeviceQuantity?: number;
  readonly initialDurationMonths?: 1 | 2 | 3 | 6 | 12;
  readonly initialAction?: 'cart' | 'checkout';
  readonly onBack: () => void;
  readonly onSavedToCart: () => void;
  readonly onContinueReview: (params: {
    draftId?: string;
    productId: string;
    planId: string;
    productName: string;
    planName: string;
    priceVnd: number;
    deviceQuantity: number;
    durationMonths: 1 | 2 | 3 | 6 | 12;
    customized: boolean;
  }) => void;
}

export function PurchaseConfigurationScreen({
  productId,
  initialPlanId,
  draftId,
  initialDeviceQuantity,
  initialDurationMonths,
  initialAction,
  onBack,
  onSavedToCart,
  onContinueReview,
}: PurchaseConfigurationScreenProps) {
  const { product, loading, error, reload } = useCatalogProduct(productId);
  const { saveDraft } = useCart();

  const [selectedPlanId, setSelectedPlanId] = useState(initialPlanId ?? '');
  const [deviceInput, setDeviceInput] = useState(
    initialDeviceQuantity ? String(initialDeviceQuantity) : '',
  );
  const [durationMonths, setDurationMonths] = useState<1 | 2 | 3 | 6 | 12 | undefined>(
    initialDurationMonths,
  );
  const [devicesTouched, setDevicesTouched] = useState(false);
  const [savingCart, setSavingCart] = useState(false);
  const defaultsAppliedRef = useRef(Boolean(initialDeviceQuantity && initialDurationMonths));

  const selectedPlan = useMemo(
    () =>
      product?.plans.find((p) => p.id === selectedPlanId) ??
      (product?.plans.length === 1 ? product.plans[0] : undefined),
    [product, selectedPlanId],
  );

  useEffect(() => {
    if (!selectedPlan || defaultsAppliedRef.current) return;
    defaultsAppliedRef.current = true;
    if (!initialDeviceQuantity) {
      setDeviceInput(String(selectedPlan.maxActiveDevices));
    }
    if (!initialDurationMonths) {
      const fallback = DURATION_OPTIONS.includes(selectedPlan.durationMonths as 1 | 2 | 3 | 6 | 12)
        ? (selectedPlan.durationMonths as 1 | 2 | 3 | 6 | 12)
        : 12;
      setDurationMonths(fallback);
    }
  }, [initialDeviceQuantity, initialDurationMonths, selectedPlan]);

  const parsedDevices = /^\d+$/.test(deviceInput.trim())
    ? Number(deviceInput.trim())
    : NaN;
  const devicesValid =
    Number.isSafeInteger(parsedDevices) &&
    parsedDevices >= 1 &&
    parsedDevices <= MAX_DEVICES;

  const chosenMonths = durationMonths ?? 12;
  const validConfig = Boolean(selectedPlan && devicesValid && DURATION_OPTIONS.includes(chosenMonths));

  const showBlankError = deviceInput.trim().length === 0 && devicesTouched;
  const showFormatError = deviceInput.trim().length > 0 && !devicesValid;
  const deviceError = showBlankError
    ? 'Vui lòng nhập số thiết bị (tối thiểu 1).'
    : showFormatError
      ? `Số thiết bị phải là số nguyên từ 1 đến ${MAX_DEVICES.toLocaleString('vi-VN')}.`
      : null;

  const selectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    const plan = product?.plans.find((item) => item.id === planId);
    if (plan) {
      setDeviceInput(String(plan.maxActiveDevices));
      if (DURATION_OPTIONS.includes(plan.durationMonths as 1 | 2 | 3 | 6 | 12)) {
        setDurationMonths(plan.durationMonths as 1 | 2 | 3 | 6 | 12);
      }
    }
  };

  const adjustDevices = (delta: number) => {
    const current = devicesValid ? parsedDevices : selectedPlan?.maxActiveDevices ?? 1;
    const next = Math.min(MAX_DEVICES, Math.max(1, current + delta));
    setDeviceInput(String(next));
  };

  if (loading && !product) {
    return (
      <Screen header={<AppHeader onBack={onBack} title="Cấu hình mua" />}>
        <FeedbackState mode="loading" title="Đang tải thông tin gói..." />
      </Screen>
    );
  }

  if (error && !product) {
    return (
      <Screen header={<AppHeader onBack={onBack} title="Cấu hình mua" />}>
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void reload()}
          title={error}
        />
      </Screen>
    );
  }

  if (!product || product.plans.length === 0) {
    return (
      <Screen header={<AppHeader onBack={onBack} title="Cấu hình mua" />}>
        <FeedbackState
          actionLabel="Quay lại"
          mode="empty"
          onAction={onBack}
          title="Sản phẩm hoặc gói không còn khả dụng"
        />
      </Screen>
    );
  }

  const handleSaveCart = async () => {
    if (!selectedPlan || !devicesValid || savingCart) return;
    setSavingCart(true);
    try {
      const saved = await saveDraft({
        ...(draftId ? { id: draftId } : {}),
        productId: product.id,
        productName: product.name,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        deviceQuantity: parsedDevices,
        durationMonths: chosenMonths,
        referencePriceVnd: selectedPlan.priceVnd,
      });
      if (saved) onSavedToCart();
    } finally {
      setSavingCart(false);
    }
  };

  const handleContinue = () => {
    if (!selectedPlan || !devicesValid) return;
    const customized =
      parsedDevices !== selectedPlan.maxActiveDevices ||
      chosenMonths !== selectedPlan.durationMonths;
    onContinueReview({
      ...(draftId ? { draftId } : {}),
      productId: product.id,
      planId: selectedPlan.id,
      productName: product.name,
      planName: selectedPlan.name,
      priceVnd: selectedPlan.priceVnd,
      deviceQuantity: parsedDevices,
      durationMonths: chosenMonths,
      customized,
    });
  };

  const isCartIntent = initialAction === 'cart';
  const minusDisabled = devicesValid && parsedDevices <= 1;
  const isCustomConfig = Boolean(
    selectedPlan &&
      devicesValid &&
      (parsedDevices !== selectedPlan.maxActiveDevices ||
        chosenMonths !== selectedPlan.durationMonths),
  );

  const saveCartButton = (
    <AppButton
      disabled={!validConfig}
      label="Lưu vào giỏ"
      loading={savingCart}
      onPress={() => {
        setDevicesTouched(true);
        void handleSaveCart();
      }}
      size="large"
      style={styles.barButton}
      variant={isCartIntent ? 'primary' : 'secondary'}
    />
  );

  const continueButton = (
    <AppButton
      disabled={!validConfig}
      label="Xem lại & tạo đơn"
      onPress={() => {
        setDevicesTouched(true);
        handleContinue();
      }}
      size="large"
      style={styles.barButton}
      variant={isCartIntent ? 'secondary' : 'primary'}
    />
  );

  return (
    <Screen
      keyboardAware
      footer={
        <BottomActionBar
          primary={isCartIntent ? saveCartButton : continueButton}
          secondary={isCartIntent ? continueButton : saveCartButton}
          summaryLabel={
            selectedPlan
              ? isCustomConfig && devicesValid
                ? `Giá gốc ${formatPlanDisplayName(selectedPlan.name)}: ${formatVnd(selectedPlan.priceVnd)} · Tổng (${parsedDevices} thiết bị · ${chosenMonths} tháng) xác nhận ở bước sau`
                : `${formatPlanDisplayName(selectedPlan.name)} · cấu hình tiêu chuẩn`
              : 'Chọn gói'
          }
          summaryValue={
            selectedPlan && !isCustomConfig ? formatVnd(selectedPlan.priceVnd) : undefined
          }
        />
      }
      header={<AppHeader onBack={onBack} title={isCartIntent ? 'Cấu hình lưu vào giỏ' : 'Cấu hình gói mua'} />}
    >
      <View style={styles.productBanner}>
        <AppText variant="cardTitle">{product.name}</AppText>
        <AppText tone="secondary" variant="secondary">
          {isCartIntent
            ? 'Bạn đã chọn thêm vào giỏ hàng — kiểm tra cấu hình rồi nhấn "Lưu vào giỏ".'
            : 'Chọn gói, số thiết bị và thời hạn trước khi xem lại đơn.'}
        </AppText>
      </View>

      {initialPlanId && !selectedPlan ? (
        <InlineNotice
          message="Gói được chọn trước đó không còn khả dụng. Vui lòng chọn lại gói bên dưới."
          tone="warning"
        />
      ) : null}

      <View style={styles.section}>
        <AppText accessibilityRole="header" variant="sectionTitle">
          1. Chọn gói
        </AppText>
        {product.plans.map((plan) => (
          <PlanOptionCard
            key={plan.id}
            onSelect={selectPlan}
            plan={plan}
            selected={selectedPlan?.id === plan.id}
          />
        ))}
      </View>

      {selectedPlan ? (
        <SurfaceCard>
          <AppText accessibilityRole="header" variant="sectionTitle">
            2. Số thiết bị & thời hạn
          </AppText>

          <View style={styles.fieldGroup}>
            <AppText tone="secondary" variant="secondarySemibold">
              Số thiết bị tối đa
            </AppText>
            <View style={styles.stepperRow}>
              <Pressable
                accessibilityLabel="Giảm số thiết bị"
                accessibilityRole="button"
                disabled={minusDisabled}
                onPress={() => adjustDevices(-1)}
                style={[styles.stepperBtn, minusDisabled ? styles.stepperBtnDisabled : null]}
              >
                <AppIcon
                  name="minus"
                  size={sizes.iconMd}
                  tone={minusDisabled ? 'disabled' : 'default'}
                />
              </Pressable>
              <TextInput
                accessibilityLabel="Số thiết bị"
                cursorColor={colors.primary}
                keyboardType="number-pad"
                onBlur={() => setDevicesTouched(true)}
                onChangeText={setDeviceInput}
                placeholderTextColor={colors.muted}
                selectionColor={colors.primary}
                style={[styles.stepperInput, deviceError ? styles.stepperInputError : null]}
                value={deviceInput}
              />
              <Pressable
                accessibilityLabel="Tăng số thiết bị"
                accessibilityRole="button"
                onPress={() => adjustDevices(1)}
                style={styles.stepperBtn}
              >
                <AppIcon name="plus" size={sizes.iconMd} tone="default" />
              </Pressable>
            </View>
            {deviceError ? (
              <AppText accessibilityRole="alert" tone="error" variant="secondary">
                {deviceError}
              </AppText>
            ) : deviceInput.trim().length === 0 ? (
              <AppText tone="muted" variant="secondary">
                Nhập số nguyên từ 1 trở lên hoặc dùng nút +/-.
              </AppText>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <AppText tone="secondary" variant="secondarySemibold">
              Thời hạn (tháng)
            </AppText>
            <View style={styles.chipsRow}>
              {DURATION_OPTIONS.map((months) => {
                const active = chosenMonths === months;
                return (
                  <Pressable
                    key={months}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => setDurationMonths(months)}
                    style={[styles.monthChip, active ? styles.monthChipActive : null]}
                  >
                    <AppText
                      tone={active ? 'info' : 'secondary'}
                      variant={active ? 'secondarySemibold' : 'secondary'}
                    >
                      {months} tháng
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </SurfaceCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  productBanner: {
    gap: spacing.xxs,
  },
  barButton: {
    flex: 1,
  },
  section: {
    gap: spacing.sm,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  stepperRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  stepperBtn: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSelected,
    borderColor: colors.control,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    justifyContent: 'center',
    minHeight: sizes.minHitTarget,
    minWidth: sizes.minHitTarget,
  },
  stepperBtnDisabled: {
    backgroundColor: colors.surfaceDisabled,
    borderColor: colors.disabledBorder,
  },
  stepperInput: {
    ...typography.bodySemibold,
    backgroundColor: colors.surface,
    borderColor: colors.control,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    color: colors.text,
    flex: 1,
    minHeight: sizes.controlHeight,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
  },
  stepperInputError: {
    borderColor: colors.errorText,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  monthChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.control,
    borderRadius: radius.pill,
    borderWidth: sizes.borderWidth,
    justifyContent: 'center',
    minHeight: sizes.minHitTarget,
    paddingHorizontal: spacing.md,
  },
  monthChipActive: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.primary,
  },
});
