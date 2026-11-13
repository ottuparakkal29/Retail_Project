import { useEffect, useState } from 'react';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  type TabListProps,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import { usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/app-text';
import { useCart } from '@/contexts/cart-context';
import { useDashboardRole } from '@/hooks/use-dashboard-role';
import { supabase } from '@/lib/supabase';

const tabIcons = {
  Home: '⌂',
  Cart: '🛍',
  Dashboard: '▦',
  Products: '▣',
} as const;

type TabLabel = keyof typeof tabIcons | 'Profile';

export default function AppTabs() {
  const dashboardRole = useDashboardRole();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      if (active) setIsAuthenticated(Boolean(data.session?.user));
    }).catch((error: unknown) => {
      if (active) console.error('Unable to verify navigation authentication.', error);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <Tabs>
      <TabSlot style={styles.tabSlot} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton label="Home">Home</TabButton>
          </TabTrigger>
          <TabTrigger name="cart" href="/cart" asChild>
            <TabButton label="Cart">Cart</TabButton>
          </TabTrigger>
          {dashboardRole ? (
            <TabTrigger
              name="dashboard"
              href={dashboardRole === 'admin' ? '/admin' : '/products'}
              asChild>
              <TabButton label={dashboardRole === 'admin' ? 'Dashboard' : 'Products'}>
                {dashboardRole === 'admin' ? 'Dashboard' : 'Products'}
              </TabButton>
            </TabTrigger>
          ) : null}
          {isAuthenticated ? (
            <TabTrigger name="profile" href="/profile" asChild>
              <TabButton label="Profile">Profile</TabButton>
            </TabTrigger>
          ) : null}
          <TabTrigger name="analytics" href="/analytics" style={styles.hiddenTrigger} />
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

function TabButton({
  children,
  isFocused,
  label,
  ...props
}: TabTriggerSlotProps & { label: TabLabel }) {
  const { ref, ...pressableProps } = props;
  void ref;
  const { itemCount } = useCart();
  const pathname = usePathname();
  const selected = isFocused || (label === 'Dashboard' && pathname === '/analytics');

  return (
    <Pressable
      {...pressableProps}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        {label === 'Profile' ? (
          <View style={styles.profileIcon}>
            <View style={[styles.profileHead, selected && styles.selectedProfileIcon]} />
            <View style={[styles.profileShoulders, selected && styles.selectedProfileIcon]} />
          </View>
        ) : (
          <Text style={[styles.tabIcon, selected && styles.selectedIcon]}>{tabIcons[label]}</Text>
        )}
        {label === 'Cart' && itemCount > 0 ? (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{itemCount > 9 ? '9+' : itemCount}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.tabLabel, selected && styles.selectedLabel]}>{children}</Text>
    </Pressable>
  );
}

function CustomTabList(props: TabListProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      {...props}
      style={[styles.tabListContainer, { bottom: Math.max(10, insets.bottom + 8) }]}>
      <View style={styles.innerContainer}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenTrigger: {
    display: 'none',
  },
  tabSlot: {
    flex: 1,
  },
  tabListContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  innerContainer: {
    width: '100%',
    maxWidth: 480,
    minHeight: 66,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e9efe9',
    shadowColor: '#18351f',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  pressed: {
    opacity: 0.78,
  },
  tabButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconWrap: {
    width: 34,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    color: '#79867b',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
  },
  selectedIcon: {
    color: '#138a39',
  },
  profileIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 1,
  },
  profileHead: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#79867b',
  },
  profileShoulders: {
    width: 15,
    height: 8,
    marginTop: 2,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: '#79867b',
  },
  selectedProfileIcon: {
    backgroundColor: '#138a39',
  },
  tabLabel: {
    color: '#78837a',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '500',
  },
  selectedLabel: {
    color: '#138a39',
    fontWeight: '700',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e45d4d',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '700',
  },
});
