import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors } from '../../theme/tokens';

export interface KeyboardScreenProps {
  readonly children: ReactNode;
  readonly edges?: readonly Edge[];
  readonly header?: ReactNode;
  readonly keyboardVerticalOffset?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export function KeyboardScreen({
  children,
  edges = [],
  header,
  keyboardVerticalOffset = Platform.OS === 'ios' ? 64 : 0,
  style,
}: KeyboardScreenProps) {
  return (
    <SafeAreaView edges={[...edges]} style={[styles.root, style]}>
      {header}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={styles.flex}
      >
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
});
