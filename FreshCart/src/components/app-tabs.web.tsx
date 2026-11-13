import { useEffect, useState } from 'react';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { router, usePathname } from 'expo-router';
import { Pressable, View, StyleSheet } from 'react-native';

import { AppText as Text } from '@/components/app-text';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/contexts/cart-context';
import { useDashboardRole } from '@/hooks/use-dashboard-role';
import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';

type NavPath = '/' | '/cart' | '/profile' | '/products' | '/admin';

export default function AppTabs() {
  const dashboardRole = useDashboardRole();
  const isDesktop = useResponsiveBreakpoint(760);
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
      <View style={styles.appShell}>
        {isDesktop ? (
          <DesktopNavigation isAuthenticated={isAuthenticated} dashboardRole={dashboardRole} />
        ) : null}
        <TabSlot style={styles.tabSlot} />
      </View>
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

function DesktopNavigation({
  dashboardRole,
  isAuthenticated,
}: {
  dashboardRole: ReturnType<typeof useDashboardRole>;
  isAuthenticated: boolean;
}) {
  const pathname = usePathname();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [focusedItem, setFocusedItem] = useState<string | null>(null);
  const items: { label: string; path: NavPath }[] = [
    { label: 'Home', path: '/' },
    { label: 'Categories', path: '/' },
    { label: 'Offers', path: '/' },
    { label: 'Cart', path: '/cart' },
  ];
  if (isAuthenticated) items.push({ label: 'Profile', path: '/profile' });
  if (dashboardRole === 'business') {
    items.push({ label: 'Business Studio', path: '/products' });
  } else if (dashboardRole === 'admin') {
    items.push({ label: 'Dashboard', path: '/admin' });
  }

  function isActive(label: string, path: string) {
    if (path === '/') return label === 'Home' && pathname === '/';
    if (path === '/admin') return pathname === '/admin' || pathname === '/analytics';
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  return (
    <View style={styles.desktopNavigation}>
      <View style={styles.desktopNavigationInner}>
        <View style={styles.desktopNavLinks}>
          {items.map(({ label, path }) => {
            const active = isActive(label, path);
            const hovered = hoveredItem === label || focusedItem === label;
            return (
              <Pressable
                key={label}
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
                onPress={() => router.push(path)}
                onHoverIn={() => setHoveredItem(label)}
                onHoverOut={() =>
                  setHoveredItem((current) => current === label ? null : current)
                }
                onFocus={() => setFocusedItem(label)}
                onBlur={() =>
                  setFocusedItem((current) => current === label ? null : current)
                }
                style={({ pressed }) => [
                  styles.desktopNavItem,
                  active && styles.desktopNavItemActive,
                  hovered && !active && styles.desktopNavItemHovered,
                  pressed && styles.pressed,
                ]}>
                <Text
                  style={[
                    styles.desktopNavText,
                    active && styles.desktopNavTextActive,
                    hovered && !active && styles.desktopNavTextHovered,
                  ]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.deliveryNote}>🚚 Free delivery on orders above ₹499</Text>
      </View>
    </View>
  );
}

const tabIcons = {
  Home: '⌂',
  Cart: '🛍',
  Dashboard: '▦',
  Products: '▣',
  Profile: '',
} as const;

export function TabButton({
  children,
  isFocused,
  label,
  ...props
}: TabTriggerSlotProps & { label: keyof typeof tabIcons }) {
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

export function CustomTabList(props: TabListProps) {
  const isDesktop = useResponsiveBreakpoint(760);

  return (
    <View {...props} style={[styles.tabListContainer, isDesktop && styles.desktopTabList]}>
      <View style={styles.innerContainer}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
  },
  tabSlot: {
    flex: 1,
  },
  desktopNavigation: {
    width: '100%',
    minHeight: 54,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e8eee8',
    backgroundColor: '#ffffff',
  },
  desktopNavigationInner: {
    width: '100%',
    maxWidth: 1320,
    minHeight: 54,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  desktopNavLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  desktopNavItem: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  desktopNavItemActive: {
    backgroundColor: '#eaf5eb',
  },
  desktopNavItemHovered: {
    backgroundColor: '#f4f8f3',
  },
  desktopNavText: {
    color: '#59685c',
    fontSize: 11,
    fontWeight: '600',
  },
  desktopNavTextActive: {
    color: '#138a39',
    fontWeight: '800',
  },
  desktopNavTextHovered: {
    color: '#07552c',
  },
  deliveryNote: {
    color: '#607464',
    fontSize: 10,
    fontWeight: '600',
  },
  hiddenTrigger: {
    display: 'none',
  },
  tabListContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  desktopTabList: {
    display: 'none',
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
