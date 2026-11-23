import { useEffect, useState, type PropsWithChildren } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type SkeletonGroupProps = PropsWithChildren<{
  label: string;
  style?: StyleProp<ViewStyle>;
}>;

// One shared pulse for every SkeletonBlock inside, instead of one animation per block.
export function SkeletonGroup({ children, label, style }: SkeletonGroupProps) {
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const useNativeDriver = Platform.OS !== 'web';
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      style={[style, { opacity }]}>
      {children}
    </Animated.View>
  );
}

type SkeletonBlockProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export function SkeletonBlock({ width = '100%', height = 14, radius = 8, style }: SkeletonBlockProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.block, { width, height, borderRadius: radius }, style]}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: '#e3ebe3',
  },
});
