import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/app-text';
import { Palette } from '@/constants/palette';
import { formatQuantity } from '@/lib/format';

type QuantityStepperProps = {
  quantity: number;
  productName: string;
  onDecrease: () => void;
  onIncrease: () => void;
  // True while a request for this product is in flight; blocks double taps.
  loading?: boolean;
  canIncrease?: boolean;
  fullWidth?: boolean;
};

export function QuantityStepper({
  quantity,
  productName,
  onDecrease,
  onIncrease,
  loading = false,
  canIncrease = true,
  fullWidth = false,
}: QuantityStepperProps) {
  return (
    <View style={[styles.stepper, fullWidth && styles.stepperFull]}>
      <Pressable
        accessibilityLabel={`Decrease quantity of ${productName}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: loading }}
        disabled={loading}
        hitSlop={4}
        onPress={onDecrease}
        style={({ pressed }) => [styles.button, (pressed || loading) && styles.dimmed]}>
        <Text style={styles.buttonText}>−</Text>
      </Pressable>
      <View style={[styles.valueWrap, fullWidth && styles.valueWrapFull]}>
        {loading ? (
          <ActivityIndicator color={Palette.green} size="small" />
        ) : (
          <Text accessibilityLiveRegion="polite" style={styles.value}>
            {formatQuantity(quantity)}
          </Text>
        )}
      </View>
      <Pressable
        accessibilityLabel={`Increase quantity of ${productName}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: loading || !canIncrease }}
        disabled={loading || !canIncrease}
        hitSlop={4}
        onPress={onIncrease}
        style={({ pressed }) => [
          styles.button,
          (pressed || loading || !canIncrease) && styles.dimmed,
        ]}>
        <Text style={styles.buttonText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    padding: 3,
    borderWidth: 1,
    borderColor: '#bfdcc4',
    borderRadius: 19,
    backgroundColor: '#f3faf2',
  },
  stepperFull: {
    alignSelf: 'stretch',
  },
  button: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: Palette.tintStrong,
  },
  buttonText: {
    color: Palette.darkGreen,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  valueWrap: {
    minWidth: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  valueWrapFull: {
    flex: 1,
  },
  value: {
    color: Palette.darkGreen,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  dimmed: {
    opacity: 0.45,
  },
});
