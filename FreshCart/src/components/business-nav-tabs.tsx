import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/app-text';
import { Palette } from '@/constants/palette';

// Switches between the Business Studio pages on narrow screens, where the sidebar is hidden.
export function BusinessNavTabs({ active }: { active: 'products' | 'orders' | 'updates' }) {
  return (
    <View accessibilityRole="tablist" style={styles.tabs}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'products' }}
        onPress={() => active !== 'products' && router.replace('/products')}
        style={[styles.tab, active === 'products' && styles.tabActive]}>
        <Text style={[styles.tabText, active === 'products' && styles.tabTextActive]}>Products</Text>
      </Pressable>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'updates' }}
        onPress={() => active !== 'updates' && router.replace('/shop-updates')}
        style={[styles.tab, active === 'updates' && styles.tabActive]}>
        <Text style={[styles.tabText, active === 'updates' && styles.tabTextActive]}>
          Updates
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'orders' }}
        onPress={() => active !== 'orders' && router.replace('/incoming-orders')}
        style={[styles.tab, active === 'orders' && styles.tabActive]}>
        <Text style={[styles.tabText, active === 'orders' && styles.tabTextActive]}>
          Incoming orders
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderWidth: 1,
    borderColor: '#e3ebe1',
    borderRadius: 14,
    backgroundColor: Palette.surface,
  },
  tab: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: Palette.green,
  },
  tabText: {
    color: '#425146',
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#ffffff',
  },
});
