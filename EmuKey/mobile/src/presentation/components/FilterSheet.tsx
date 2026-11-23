import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, sizes, spacing } from '../theme/tokens';
import { AppButton } from './ui/AppButton';
import { AppIcon } from './ui/AppIcon';
import { AppText } from './ui/AppText';

export interface FilterOption {
  readonly value: string;
  readonly label: string;
}

export interface FilterSheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly options: readonly FilterOption[];
  readonly selectedValue: string;
  readonly onSelect: (value: string) => void;
  readonly onReset: () => void;
  readonly onClose: () => void;
}

export function FilterSheet({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onReset,
  onClose,
}: FilterSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable accessibilityRole="none" onPress={onClose} style={styles.backdrop}>
        <Pressable
          onPress={() => undefined}
          style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]}
        >
          <View style={styles.header}>
            <AppText accessibilityRole="header" variant="sectionTitle">
              {title}
            </AppText>
            <Pressable
              accessibilityLabel="Đóng bộ lọc"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <AppIcon name="close" size={sizes.iconMd} tone="secondary" />
            </Pressable>
          </View>
          <ScrollView style={styles.optionsList}>
            {options.map((option) => {
              const selected = option.value === selectedValue;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                  style={[styles.optionRow, selected ? styles.optionSelected : null]}
                >
                  <AppText
                    tone={selected ? 'info' : 'default'}
                    variant={selected ? 'bodySemibold' : 'body'}
                  >
                    {option.label}
                  </AppText>
                  {selected ? (
                    <AppIcon name="check" size={sizes.iconSm} tone="info" />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.footer}>
            <AppButton
              label="Đặt lại"
              onPress={() => {
                onReset();
                onClose();
              }}
              style={styles.footerBtn}
              variant="secondary"
            />
            <AppButton
              label="Đóng"
              onPress={onClose}
              style={styles.footerBtn}
              variant="primary"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: colors.overlayBackdrop,
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    gap: spacing.md,
    maxHeight: '75%',
    padding: spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: sizes.minHitTarget,
    minWidth: sizes.minHitTarget,
  },
  optionsList: {
    flexGrow: 0,
  },
  optionRow: {
    alignItems: 'center',
    borderRadius: radius.control,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: sizes.minHitTarget,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  optionSelected: {
    backgroundColor: colors.infoSurface,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  footerBtn: {
    flex: 1,
  },
});
