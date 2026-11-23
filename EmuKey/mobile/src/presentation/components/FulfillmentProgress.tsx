import { StyleSheet, View } from 'react-native';

import { colors, sizes, spacing, toneColors, type SemanticTone } from '../theme/tokens';
import { AppText } from './ui/AppText';
import { StatusBadge } from './ui/StatusBadge';

export interface FulfillmentStep {
  readonly label: string;
  readonly status: string;
  readonly tone: SemanticTone;
}

export interface FulfillmentProgressProps {
  readonly steps: readonly FulfillmentStep[];
}

export function FulfillmentProgress({ steps }: FulfillmentProgressProps) {
  if (!steps.length) return null;

  return (
    <View style={styles.list}>
      {steps.map((step, index) => {
        const dotPalette = toneColors[step.tone];
        return (
          <View key={`${step.label}-${index}`} style={styles.stepRow}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: dotPalette.background,
                    borderColor: dotPalette.text,
                  },
                ]}
              />
              {index < steps.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.stepContent}>
              <AppText variant="bodySemibold">{step.label}</AppText>
              <StatusBadge label={step.status} tone={step.tone} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rail: {
    alignItems: 'center',
    width: 18,
  },
  dot: {
    borderRadius: 8,
    borderWidth: 2,
    height: 14,
    marginTop: 4,
    width: 14,
  },
  line: {
    backgroundColor: colors.border,
    flex: 1,
    marginTop: spacing.xxs,
    minHeight: 16,
    width: sizes.borderWidth,
  },
  stepContent: {
    flex: 1,
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
});
