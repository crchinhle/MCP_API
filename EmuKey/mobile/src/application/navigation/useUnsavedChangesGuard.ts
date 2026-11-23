import {
  useIsFocused,
  useNavigation,
  usePreventRemove,
  type NavigationAction,
} from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

export interface UseUnsavedChangesGuardOptions {
  readonly enabled: boolean;
  readonly isFocused?: boolean;
  readonly onBack?: () => void;
  readonly onRequestDiscard: () => void;
  readonly onBlurReset?: () => void;
}

/**
 * Protects a focused screen with unsaved edits using React Navigation's
 * native-stack-compatible `usePreventRemove` alongside focus-scoped Android
 * hardware Back handling.
 *
 * Must be called unconditionally inside a NavigationContainer screen.
 */
export function useUnsavedChangesGuard({
  enabled,
  isFocused,
  onBack,
  onRequestDiscard,
  onBlurReset,
}: UseUnsavedChangesGuardOptions) {
  const navigation = useNavigation();
  const navFocused = useIsFocused();
  const effectiveFocused = typeof isFocused === 'boolean' ? isFocused : navFocused;

  const [discarding, setDiscarding] = useState(false);
  const pendingActionRef = useRef<NavigationAction | null>(null);
  const requestDiscardRef = useRef(onRequestDiscard);
  const blurResetRef = useRef(onBlurReset);

  requestDiscardRef.current = onRequestDiscard;
  blurResetRef.current = onBlurReset;

  const shouldPrevent = Boolean(enabled && effectiveFocused && !discarding);

  usePreventRemove(shouldPrevent, ({ data }) => {
    pendingActionRef.current = data.action;
    requestDiscardRef.current();
  });

  useEffect(() => {
    if (!effectiveFocused || !enabled) {
      pendingActionRef.current = null;
      setDiscarding(false);
      if (!effectiveFocused) {
        blurResetRef.current?.();
      }
    }
  }, [effectiveFocused, enabled]);

  useEffect(() => {
    if (!shouldPrevent || !onBack) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      requestDiscardRef.current();
      return true;
    });
    return () => subscription?.remove?.();
  }, [onBack, shouldPrevent]);

  useEffect(() => {
    if (!discarding) return;
    const pendingAction = pendingActionRef.current;
    pendingActionRef.current = null;
    if (pendingAction) {
      navigation.dispatch(pendingAction);
    } else {
      onBack?.();
    }
  }, [discarding, navigation, onBack]);

  const cancelDiscard = useCallback(() => {
    pendingActionRef.current = null;
    setDiscarding(false);
  }, []);

  const confirmDiscard = useCallback(() => {
    setDiscarding(true);
  }, []);

  return {
    cancelDiscard,
    confirmDiscard,
    isFocused: effectiveFocused,
  };
}
