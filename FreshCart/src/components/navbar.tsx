import { useEffect, useState } from 'react';
import { router, usePathname } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/app-text';
import NotificationWrapper from '@/components/notification-wrapper';
import { useCart } from '@/contexts/cart-context';
import { useNavigationState } from '@/contexts/navigation-context';
import { useDashboardRole } from '@/hooks/use-dashboard-role';
import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';
import { supabase } from '@/lib/supabase';

const GREEN = '#138a39';

export default function Navbar() {
  const pathname = usePathname();
  const isWide = useResponsiveBreakpoint(1200);
  const isDesktop = useResponsiveBreakpoint(760);
  const { query, setQuery, district, setAuthRequest } = useNavigationState();
  const { itemCount } = useCart();
  const dashboardRole = useDashboardRole();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setAuthenticated(Boolean(session?.user));
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      if (active) setAuthenticated(Boolean(data.session?.user));
    }).catch((error: unknown) => {
      if (active) console.error('Unable to verify navigation authentication.', error);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  function showHome(clearSearch = false) {
    if (clearSearch) setQuery('');
    if (pathname !== '/') router.push('/');
  }

  function requestAuth(mode: 'login' | 'signup') {
    setAuthRequest(mode);
    if (pathname !== '/') router.push('/');
  }

  const links: { label: string; selected: boolean; onPress: () => void }[] = [
    { label: 'Home', selected: pathname === '/', onPress: () => showHome(true) },
    { label: 'Categories', selected: false, onPress: () => showHome(true) },
    { label: 'Offers', selected: false, onPress: () => showHome(true) },
    { label: 'Cart', selected: pathname === '/cart', onPress: () => router.push('/cart') },
    ...(authenticated && !dashboardRole
      ? [{ label: 'My Orders', selected: pathname === '/orders', onPress: () => router.push('/orders') }]
      : []),
    {
      label: 'Profile',
      selected: pathname === '/profile',
      onPress: () => authenticated ? router.push('/profile') : requestAuth('login'),
    },
  ];
  if (pathname === '/shop') {
    links.splice(1, 0, { label: 'Shop', selected: true, onPress: () => {} });
  }
  if (dashboardRole) {
    links.push({
      label: dashboardRole === 'admin' ? 'Dashboard' : 'Business Studio',
      selected: pathname === '/admin' || pathname === '/analytics' || pathname === '/products',
      onPress: () => router.push(dashboardRole === 'admin' ? '/admin' : '/products'),
    });
  }
  if (dashboardRole === 'business') {
    links.push({
      label: 'Incoming Orders',
      selected: pathname === '/incoming-orders',
      onPress: () => router.push('/incoming-orders'),
    });
  }

  const navigation = (
    <View style={styles.navLinks}>
      {links.map((link) => (
        <Pressable
          key={link.label}
          accessibilityRole="link"
          accessibilityState={{ selected: link.selected }}
          onPress={link.onPress}
          style={[styles.navItem, link.selected && styles.navItemActive]}>
          <Text style={[styles.navText, link.selected && styles.navTextActive]}>{link.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  const search = (
    <View style={[styles.searchBar, isWide && styles.searchBarWide]}>
      <TextInput
        accessibilityLabel="Search shops"
        placeholder="Search shops..."
        placeholderTextColor="#8b958d"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => showHome()}
        returnKeyType="search"
        style={styles.searchInput}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Search shops" onPress={() => showHome()} style={styles.searchButton}>
        <Text style={styles.searchIcon}>⌕</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.topStrip}>
        <Text style={styles.topText}>🌿  Freshness at your doorstep!</Text>
        {isDesktop ? <Text style={styles.topText}>🚚  Free delivery on orders above ₹499</Text> : null}
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityRole="link" accessibilityLabel="FreshCart home" onPress={() => showHome(true)} style={styles.brand}>
            <Text style={styles.brandLeaf}>🌿</Text>
            <View>
              <Text style={styles.brandName}>FreshCart</Text>
              <Text style={styles.brandTagline}>Groceries made easy</Text>
            </View>
          </Pressable>
          {isWide ? navigation : null}
          {isWide ? search : null}
          <View style={styles.actions}>
            {isDesktop ? <Text numberOfLines={1} style={styles.location}>⌖ {district || 'Kerala'}</Text> : null}
            {authenticated ? (
              <NotificationWrapper />
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel="Open customer and business registration" onPress={() => requestAuth('signup')} style={styles.signupButton}>
                <View style={styles.personHead} />
                <View style={styles.personShoulders} />
              </Pressable>
            )}
            <Pressable accessibilityRole="button" accessibilityLabel={`Open cart, ${itemCount} items`} onPress={() => router.push('/cart')} style={styles.cartButton}>
              <Text style={styles.cartIcon}>🛒</Text>
              <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{itemCount}</Text></View>
            </Pressable>
          </View>
        </View>
        {!isWide ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compactNav}>
              {navigation}
            </ScrollView>
            {search}
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#fbfcfb', zIndex: 1 },
  topStrip: { width: '100%', minHeight: 34, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: GREEN },
  topText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  content: { width: '100%', maxWidth: 1320, alignSelf: 'center', paddingHorizontal: 20 },
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandLeaf: { fontSize: 34 },
  brandName: { color: '#07552c', fontSize: 21, fontWeight: '800', letterSpacing: -0.5 },
  brandTagline: { color: '#68756b', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  navLinks: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compactNav: { paddingBottom: 8 },
  navItem: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 22 },
  navItemActive: { backgroundColor: GREEN },
  navText: { color: '#26392c', fontSize: 12, fontWeight: '600' },
  navTextActive: { color: '#ffffff', fontWeight: '700' },
  searchBar: { height: 44, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#dce4dd', borderRadius: 24, backgroundColor: '#ffffff', paddingLeft: 17, paddingRight: 4, marginBottom: 10 },
  searchBarWide: { flex: 1, minWidth: 130, maxWidth: 650, marginBottom: 0 },
  searchInput: { flex: 1, minWidth: 0, fontFamily: 'Poppins_400Regular', color: '#253129', fontSize: 14 },
  searchButton: { width: 36, height: 36, borderRadius: 20, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  searchIcon: { color: '#ffffff', fontSize: 27, lineHeight: 31 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  location: { maxWidth: 105, color: '#26392c', fontSize: 12, fontWeight: '600' },
  signupButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#cfe2d1', backgroundColor: '#f0f8ee' },
  personHead: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#38824b' },
  personShoulders: { width: 15, height: 8, marginTop: 2, borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: '#38824b' },
  cartButton: { padding: 8 },
  cartIcon: { fontSize: 23 },
  cartBadge: { position: 'absolute', right: 0, top: 0, minWidth: 17, height: 17, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: GREEN },
  cartBadgeText: { color: '#ffffff', fontSize: 9, fontWeight: '700' },
});
