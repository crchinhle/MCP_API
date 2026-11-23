import type { ReactNode, RefObject } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '../../theme/tokens';

export interface ScreenProps {
  readonly children: ReactNode;
  readonly scroll?: 'none' | 'scroll';
  readonly scrollRef?: RefObject<ScrollView | null>;
  readonly keyboardAware?: boolean;
  readonly edges?: readonly Edge[];
  readonly header?: ReactNode;
  readonly footer?: ReactNode;
  readonly refreshing?: boolean;
  readonly onRefresh?: () => void;
  readonly padded?: boolean;
  readonly contentContainerStyle?: StyleProp<ViewStyle>;
  readonly style?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  scroll = 'scroll',
  scrollRef,
  keyboardAware = false,
  edges = [],
  header,
  footer,
  refreshing = false,
  onRefresh,
  padded = true,
  contentContainerStyle,
  style,
}: ScreenProps) {
  const paddingStyle = padded ? styles.padded : null;

  const body =
    scroll === 'scroll' ? (
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, paddingStyle, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={onRefresh}
              refreshing={refreshing}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    ) : (
      <View style={[styles.flexBody, paddingStyle, contentContainerStyle]}>
        {children}
      </View>
    );

  return (
    <SafeAreaView edges={[...edges]} style={[styles.root, style]}>
      {header}
      {keyboardAware ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardWrap}
        >
          {body}
          {footer}
        </KeyboardAvoidingView>
      ) : (
        <>
          {body}
          {footer}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  keyboardWrap: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    gap: spacing.md,
  },
  flexBody: {
    flex: 1,
    gap: spacing.md,
  },
  padded: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
});
