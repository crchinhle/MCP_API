import { NavigationContext } from '@react-navigation/native';
import { useContext, useEffect, useRef } from 'react';

/**
 * Refetches data when a mounted screen regains navigation focus.
 * Safely acts as a no-op when rendered outside a NavigationContainer.
 */
export function useSafeFocusRefresh(onFocusRefresh: () => void): void {
  const navigation = useContext(NavigationContext);
  const callbackRef = useRef(onFocusRefresh);
  const skippedInitialRef = useRef(false);

  callbackRef.current = onFocusRefresh;

  useEffect(() => {
    if (!navigation?.addListener) return undefined;
    const unsubscribe = navigation.addListener('focus', () => {
      if (!skippedInitialRef.current) {
        skippedInitialRef.current = true;
        return;
      }
      callbackRef.current();
    });
    return unsubscribe;
  }, [navigation]);
}
