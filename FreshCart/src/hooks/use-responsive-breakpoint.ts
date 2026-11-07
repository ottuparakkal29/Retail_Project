import { useCallback, useSyncExternalStore } from 'react';
import { Dimensions, Platform } from 'react-native';

const getServerSnapshot = () => false;

export function useResponsiveBreakpoint(minWidth: number) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (Platform.OS === 'web') {
        const mediaQuery = window.matchMedia(`(min-width: ${minWidth}px)`);
        mediaQuery.addEventListener('change', onChange);
        return () => mediaQuery.removeEventListener('change', onChange);
      }

      const subscription = Dimensions.addEventListener('change', onChange);
      return () => subscription.remove();
    },
    [minWidth],
  );
  const getSnapshot = useCallback(() => {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' && window.matchMedia(`(min-width: ${minWidth}px)`).matches;
    }

    return Dimensions.get('window').width >= minWidth;
  }, [minWidth]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
