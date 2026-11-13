import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/app-text';
import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';
import { supabase } from '@/lib/supabase';

type SentBusinessMessage = {
  notification_id: string;
  business_profile_id: string;
  business_name: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

const salesByBusinessType = [
  { type: 'Manufacturer', orders: 148, productsSold: 1240, revenue: 186000, color: '#318b48' },
  { type: 'Retailer', orders: 312, productsSold: 1875, revenue: 242500, color: '#5aa667' },
  { type: 'Wholesaler', orders: 96, productsSold: 3280, revenue: 394000, color: '#8ac276' },
  { type: 'Distributor', orders: 74, productsSold: 2960, revenue: 518000, color: '#c0dc9c' },
];

const monthlyOrders = [
  { month: 'Jun', count: 82 },
  { month: 'Jul', count: 108 },
  { month: 'Aug', count: 96 },
  { month: 'Sep', count: 142 },
  { month: 'Oct', count: 168 },
  { month: 'Nov', count: 204 },
];

const chartMax = Math.max(...monthlyOrders.map((item) => item.count));
const maxOrdersByType = Math.max(...salesByBusinessType.map((item) => item.orders));

export default function AnalyticsScreen() {
  const isWide = useResponsiveBreakpoint(850);
  const [detailsWidth, setDetailsWidth] = useState(0);
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const [adminAccess, setAdminAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [accessError, setAccessError] = useState('');
  const [sentMessages, setSentMessages] = useState<SentBusinessMessage[]>([]);
  const [sentMessagesLoading, setSentMessagesLoading] = useState(true);
  const [sentMessagesError, setSentMessagesError] = useState('');

  const loadSentMessages = useCallback(async () => {
    setSentMessagesLoading(true);
    setSentMessagesError('');
    try {
      const { data, error } = await supabase.rpc('admin_list_business_notifications');
      if (error) throw error;
      setSentMessages((data ?? []) as SentBusinessMessage[]);
    } catch (error) {
      setSentMessagesError(getErrorMessage(error, 'Unable to load sent messages.'));
    } finally {
      setSentMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function verifyAdmin() {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) {
          if (active) setAdminAccess('denied');
          router.replace('/');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('auth_user_id', userData.user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (profile?.role !== 'admin') {
          if (active) setAdminAccess('denied');
          router.replace('/');
          return;
        }

        if (active) setAdminAccess('allowed');
        void loadSentMessages();
      } catch (error) {
        if (active) {
          setAccessError(error instanceof Error ? error.message : 'Unable to verify admin access.');
          setAdminAccess('denied');
        }
      }
    }

    void verifyAdmin();
    return () => {
      active = false;
    };
  }, [loadSentMessages]);

  const totals = salesByBusinessType.reduce(
    (result, partner) => ({
      orders: result.orders + partner.orders,
      productsSold: result.productsSold + partner.productsSold,
      revenue: result.revenue + partner.revenue,
    }),
    { orders: 0, productsSold: 0, revenue: 0 },
  );

  if (adminAccess !== 'allowed') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.accessGate}>
          <Text style={styles.accessTitle}>
            {adminAccess === 'checking' ? 'Verifying admin access…' : 'Admin access required'}
          </Text>
          {accessError ? <Text style={styles.accessMessage}>{accessError}</Text> : null}
          <Pressable onPress={() => router.replace('/')} style={styles.accessButton}>
            <Text style={styles.accessButtonText}>Back to storefront</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.appFrame}>
        {isWide ? (
          <View style={styles.sidebar}>
            <View>
              <View style={styles.brand}>
                <View style={styles.brandMark}><Text style={styles.brandMarkText}>F</Text></View>
                <View>
                  <Text style={styles.brandName}>FreshCart</Text>
                  <Text style={styles.brandCaption}>ADMIN PANEL</Text>
                </View>
              </View>
              <View style={styles.sidebarMenu}>
                <SidebarItem label="Dashboard" icon="⌂" onPress={() => router.replace('/admin')} />
                <SidebarItem label="Analytics" icon="▤" active onPress={() => router.replace('/analytics')} />
              </View>
            </View>
            <View style={styles.sidebarBottom}>
              <View style={styles.sidebarPromo}>
                <Text style={styles.promoBasket}>🛒</Text>
                <Text style={styles.promoTitle}>FreshCart</Text>
                <Text style={styles.promoSubtitle}>Good things grow together.</Text>
              </View>
              <Pressable onPress={() => router.replace('/')} style={styles.backToStore}>
                <Text style={styles.backIcon}>↪</Text>
                <Text style={styles.backText}>Back to storefront</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.pageScroll}
          showsVerticalScrollIndicator={false}>
          <View style={[styles.content, isWide && styles.contentWide]}>
            <View style={styles.topbar}>
            {isWide ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace('/admin')}
                style={styles.backButton}>
                <Text style={styles.backButtonIcon}>‹</Text>
                <Text style={styles.backButtonText}>Partner management</Text>
              </Pressable>
            ) : (
              <View style={styles.mobileHeaderBrand}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="More dashboard options"
                  accessibilityState={{ expanded: mobileMenuVisible }}
                  onPress={() => setMobileMenuVisible(true)}
                  style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
                  <Text style={styles.menuDots}>⋮</Text>
                </Pressable>
                <View style={styles.compactBrand}>
                  <View style={styles.compactMark}><Text style={styles.compactMarkText}>F</Text></View>
                  <Text style={styles.compactBrandName}>FreshCart</Text>
                </View>
              </View>
            )}
            <View style={styles.adminProfile}>
              <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>A</Text></View>
              <Text style={styles.profileName}>Admin</Text>
              </View>
            </View>

            <View style={styles.pageHeading}>
              <View>
                <Text style={styles.eyebrow}>FRESHCART SALES</Text>
                <Text style={styles.title}>Sales analytics</Text>
                <Text style={styles.subtitle}>Orders and products sold across each business type.</Text>
              </View>
              <View style={styles.sampleBadge}>
                <Text style={styles.sampleBadgeText}>DEMO DATA</Text>
              </View>
            </View>

            <View style={styles.metricGrid}>
              <MetricCard label="Total orders" value={totals.orders} detail="Orders across all business types" color="#268342" />
              <MetricCard label="Products sold" value={totals.productsSold} detail="Units included in those orders" color="#547eaf" />
              <MetricCard label="Sales revenue" value={totals.revenue} detail="Illustrative demo total (₹)" color="#268342" />
              <MetricCard label="Business types" value={salesByBusinessType.length} detail="Included in the sales breakdown" color="#d29832" />
            </View>

            <View style={[styles.chartGrid, isWide && styles.chartGridWide]}>
              <View style={[styles.chartCard, isWide && styles.chartCardHalf]}>
                <View style={styles.cardHeading}>
                  <View>
                    <Text style={styles.cardTitle}>Orders by business type</Text>
                    <Text style={styles.cardSubtitle}>Compare completed orders by seller role</Text>
                  </View>
                  <Text style={styles.chartIcon}>▥</Text>
                </View>
                <View style={styles.barChart}>
                  {salesByBusinessType.map((partner) => (
                    <View key={partner.type} style={styles.barItem}>
                      <Text style={styles.barValue}>{partner.orders}</Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: `${Math.max((partner.orders / maxOrdersByType) * 100, 8)}%`,
                              backgroundColor: partner.color,
                            },
                          ]}
                        />
                      </View>
                      <Text numberOfLines={1} style={styles.barLabel}>{partner.type}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.chartLegend}>
                  <View style={styles.legendDot} />
                  <Text style={styles.legendText}>Orders</Text>
                </View>
              </View>

              <View style={[styles.chartCard, isWide && styles.chartCardHalf]}>
                <View style={styles.cardHeading}>
                  <View>
                    <Text style={styles.cardTitle}>Monthly order trend</Text>
                    <Text style={styles.cardSubtitle}>Orders recorded per month</Text>
                  </View>
                  <Text style={styles.chartIcon}>⌁</Text>
                </View>
                <View style={styles.monthlyChart}>
                  {monthlyOrders.map((item) => (
                    <View key={item.month} style={styles.monthlyBarItem}>
                      <Text style={styles.monthlyBarValue}>{item.count}</Text>
                      <View style={styles.monthlyBarTrack}>
                        <View
                          style={[
                            styles.monthlyBar,
                            { height: `${(item.count / chartMax) * 100}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.monthlyBarLabel}>{item.month}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.chartLegend}>
                  <View style={[styles.legendDot, styles.trendLegendDot]} />
                  <Text style={styles.legendText}>Orders per month</Text>
                </View>
              </View>
            </View>

            <View
              onLayout={(event) => setDetailsWidth(event.nativeEvent.layout.width)}
              style={styles.detailsCard}>
              <View style={styles.cardHeading}>
                <View>
                  <Text style={styles.cardTitle}>Sales by business type</Text>
                  <Text style={styles.cardSubtitle}>Order count and units sold</Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.detailTableScroll}>
                <View
                  style={[
                    styles.detailTable,
                    { width: Math.max(detailsWidth - 32, 560) },
                  ]}>
                  <View style={[styles.detailRow, styles.detailHeader]}>
                    <Text style={[styles.detailCell, styles.detailHeaderText, styles.typeCell]}>Business type</Text>
                    <Text style={[styles.detailCell, styles.detailHeaderText]}>Orders</Text>
                    <Text style={[styles.detailCell, styles.detailHeaderText]}>Products sold</Text>
                  </View>
                  {salesByBusinessType.map((partner) => (
                    <View key={partner.type} style={styles.detailRow}>
                      <Text style={[styles.detailCell, styles.typeCell]}>{partner.type}</Text>
                      <Text style={styles.detailCell}>{partner.orders}</Text>
                      <Text style={styles.detailCell}>{partner.productsSold}</Text>
                    </View>
                  ))}
                  <View style={[styles.detailRow, styles.totalRow]}>
                    <Text style={[styles.detailCell, styles.typeCell, styles.totalText]}>Total</Text>
                    <Text style={[styles.detailCell, styles.totalText]}>{totals.orders}</Text>
                    <Text style={[styles.detailCell, styles.totalText]}>{totals.productsSold}</Text>
                  </View>
                </View>
              </ScrollView>
            </View>

            <View style={styles.sentMessagesCard}>
              <View style={styles.sentMessagesHeader}>
                <View style={styles.sentMessagesHeading}>
                  <Text style={styles.cardTitle}>Information sent to businesses</Text>
                  <Text style={styles.cardSubtitle}>
                    Manual messages delivered from the admin dashboard.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Refresh sent business messages"
                  disabled={sentMessagesLoading}
                  onPress={() => void loadSentMessages()}
                  style={({ pressed }) => [
                    styles.sentMessagesRefresh,
                    pressed && styles.pressed,
                    sentMessagesLoading && styles.disabledButton,
                  ]}>
                  <Text style={styles.sentMessagesRefreshText}>
                    {sentMessagesLoading ? 'Loading…' : '↻ Refresh'}
                  </Text>
                </Pressable>
              </View>
              {sentMessagesError ? (
                <Text accessibilityLiveRegion="polite" style={styles.sentMessagesError}>
                  {sentMessagesError}
                </Text>
              ) : sentMessagesLoading ? (
                <Text style={styles.sentMessagesEmpty}>Loading sent messages…</Text>
              ) : sentMessages.length === 0 ? (
                <Text style={styles.sentMessagesEmpty}>No manual messages sent yet.</Text>
              ) : (
                <View style={styles.sentMessagesList}>
                  {sentMessages.map((item) => (
                    <View key={item.notification_id} style={styles.sentMessageRow}>
                      <View style={styles.sentMessageIcon}>
                        <Text style={styles.sentMessageIconText}>✉</Text>
                      </View>
                      <View style={styles.sentMessageCopy}>
                        <View style={styles.sentMessageTitleRow}>
                          <Text style={styles.sentMessageBusiness}>{item.business_name}</Text>
                          <Text style={styles.sentMessageDate}>
                            {new Date(item.created_at).toLocaleString()}
                          </Text>
                        </View>
                        <Text style={styles.sentMessageTitle}>{item.title}</Text>
                        <Text style={styles.sentMessageBody}>{item.message}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <Text style={styles.disclaimer}>
              These figures are illustrative demo data, not real sales. Connect order records and seller business types to show live results.
            </Text>
          </View>
        </ScrollView>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setMobileMenuVisible(false)}
        transparent
        visible={mobileMenuVisible}>
        <View style={styles.drawerBackdrop}>
          <View style={styles.mobileDrawer}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerBrand}>
                <View style={styles.brandMark}><Text style={styles.brandMarkText}>F</Text></View>
                <View>
                  <Text style={styles.brandName}>FreshCart</Text>
                  <Text style={styles.brandCaption}>ADMIN PANEL</Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close navigation menu"
                onPress={() => setMobileMenuVisible(false)}
                style={styles.drawerClose}>
                <Text style={styles.drawerCloseText}>×</Text>
              </Pressable>
            </View>
            <Text style={styles.drawerSectionLabel}>MENU</Text>
            <View style={styles.drawerMenu}>
              <SidebarItem
                label="Dashboard"
                icon="⌂"
                onPress={() => {
                  setMobileMenuVisible(false);
                  router.replace('/admin');
                }}
              />
              <SidebarItem label="Analytics" icon="▤" active onPress={() => setMobileMenuVisible(false)} />
            </View>
            <View style={styles.drawerBottom}>
              <View style={styles.sidebarPromo}>
                <Text style={styles.promoBasket}>🛒</Text>
                <Text style={styles.promoTitle}>FreshCart</Text>
                <Text style={styles.promoSubtitle}>Good things grow together.</Text>
              </View>
              <Pressable
                onPress={() => router.replace('/')}
                style={styles.backToStore}>
                <Text style={styles.backIcon}>↪</Text>
                <Text style={styles.backText}>Back to storefront</Text>
              </Pressable>
            </View>
          </View>
          <Pressable
            accessibilityLabel="Close navigation menu"
            onPress={() => setMobileMenuVisible(false)}
            style={styles.drawerScrim}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MetricCard({
  color,
  detail,
  label,
  value,
}: {
  color: string;
  detail: string;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricAccent, { backgroundColor: color }]} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

function SidebarItem({
  active = false,
  icon,
  label,
  onPress,
}: {
  active?: boolean;
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.sidebarItem, active && styles.sidebarItemActive, pressed && styles.pressed]}>
      <Text style={[styles.sidebarIcon, active && styles.sidebarIconActive]}>{icon}</Text>
      <Text style={[styles.sidebarLabel, active && styles.sidebarLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f7f4',
  },
  accessGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  accessTitle: {
    color: '#17331e',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  accessMessage: {
    color: '#9b4033',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
  accessButton: {
    marginTop: 18,
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: '#138a39',
  },
  accessButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  appFrame: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 218,
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 18,
    borderRightWidth: 1,
    borderRightColor: '#e7ede7',
    backgroundColor: '#ffffff',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 9,
    paddingBottom: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#edf0ed',
  },
  brandMark: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#dcf1d6',
  },
  brandMarkText: {
    color: '#1b7539',
    fontSize: 22,
    fontWeight: '900',
  },
  brandName: {
    color: '#176a35',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandCaption: {
    color: '#7d8b7e',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 2,
  },
  sidebarMenu: {
    flex: 1,
    paddingTop: 17,
  },
  sidebarBottom: {
    gap: 13,
  },
  sidebarPromo: {
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 15,
    backgroundColor: '#eff9e9',
  },
  promoBasket: {
    fontSize: 28,
  },
  promoTitle: {
    color: '#28713b',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  promoSubtitle: {
    color: '#789078',
    fontSize: 8,
    marginTop: 3,
  },
  drawerBottom: {
    gap: 13,
  },
  sidebarItem: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 11,
    marginBottom: 4,
    borderRadius: 10,
  },
  sidebarItemActive: {
    backgroundColor: '#e9f8e5',
  },
  sidebarIcon: {
    width: 20,
    color: '#526456',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  sidebarIconActive: {
    color: '#21823d',
  },
  sidebarLabel: {
    color: '#425146',
    fontSize: 11,
    fontWeight: '600',
  },
  sidebarLabelActive: {
    color: '#216a35',
    fontWeight: '800',
  },
  backToStore: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
  },
  backIcon: {
    color: '#546357',
    fontSize: 17,
  },
  backText: {
    color: '#536156',
    fontSize: 10,
    fontWeight: '600',
  },
  pageScroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 34,
  },
  content: {
    width: '100%',
    paddingHorizontal: 15,
  },
  contentWide: {
    maxWidth: 1360,
    paddingHorizontal: 28,
  },
  topbar: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e7ece7',
  },
  mobileHeaderBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  menuButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5ebe5',
    backgroundColor: '#ffffff',
  },
  menuDots: {
    color: '#3e5a44',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
  },
  compactBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactMark: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#dcf1d6',
  },
  compactMarkText: {
    color: '#1b7539',
    fontSize: 18,
    fontWeight: '900',
  },
  compactBrandName: {
    color: '#176a35',
    fontSize: 15,
    fontWeight: '900',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 40,
  },
  backButtonIcon: {
    color: '#28713b',
    fontSize: 25,
    lineHeight: 28,
  },
  backButtonText: {
    color: '#536357',
    fontSize: 11,
    fontWeight: '700',
  },
  adminProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  profileAvatar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#238b42',
  },
  profileAvatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  profileName: {
    color: '#35443a',
    fontSize: 10,
    fontWeight: '700',
  },
  drawerBackdrop: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(20,37,24,0.42)',
  },
  mobileDrawer: {
    width: 285,
    maxWidth: '84%',
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 18,
    backgroundColor: '#ffffff',
    justifyContent: 'space-between',
    shadowColor: '#172c1c',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#edf0ed',
  },
  drawerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  drawerClose: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dfe9df',
    backgroundColor: '#f0f7ee',
  },
  drawerCloseText: {
    color: '#3e7048',
    fontSize: 24,
    lineHeight: 28,
  },
  drawerSectionLabel: {
    color: '#98a39a',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 20,
    marginBottom: 9,
    paddingHorizontal: 11,
  },
  drawerMenu: {
    flex: 1,
  },
  drawerScrim: {
    flex: 1,
  },
  pageHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 24,
    marginBottom: 17,
  },
  eyebrow: {
    color: '#528359',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: 5,
  },
  title: {
    color: '#24382a',
    fontSize: 25,
    fontWeight: '900',
  },
  subtitle: {
    color: '#758278',
    fontSize: 10,
    marginTop: 4,
  },
  sampleBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#fff3da',
  },
  sampleBadgeText: {
    color: '#986d27',
    fontSize: 8,
    fontWeight: '800',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 130,
    minHeight: 112,
    overflow: 'hidden',
    padding: 14,
    borderWidth: 1,
    borderColor: '#e7ece7',
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  metricAccent: {
    position: 'absolute',
    width: 3,
    left: 0,
    top: 0,
    bottom: 0,
  },
  metricLabel: {
    color: '#718076',
    fontSize: 9,
    fontWeight: '600',
  },
  metricValue: {
    color: '#26392c',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 5,
  },
  metricDetail: {
    color: '#929d94',
    fontSize: 8,
    marginTop: 3,
  },
  chartGrid: {
    gap: 12,
    marginTop: 14,
  },
  chartGridWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  chartCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#e7ece7',
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  chartCardHalf: {
    flex: 1,
    minWidth: 0,
  },
  cardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    color: '#293b2f',
    fontSize: 12,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: '#87938a',
    fontSize: 9,
    marginTop: 4,
  },
  chartIcon: {
    color: '#43804e',
    fontSize: 22,
  },
  barChart: {
    height: 194,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingHorizontal: 2,
  },
  barItem: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    gap: 6,
  },
  barValue: {
    color: '#526157',
    fontSize: 9,
    fontWeight: '700',
  },
  barTrack: {
    width: '48%',
    maxWidth: 40,
    height: 132,
    justifyContent: 'flex-end',
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    backgroundColor: '#f1f5f1',
  },
  bar: {
    width: '100%',
    minHeight: 10,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
  barLabel: {
    width: '100%',
    color: '#66746a',
    fontSize: 8,
    textAlign: 'center',
  },
  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5aa667',
  },
  trendLegendDot: {
    backgroundColor: '#278c50',
  },
  legendText: {
    color: '#829087',
    fontSize: 8,
  },
  monthlyChart: {
    height: 180,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: 4,
    marginTop: 14,
  },
  monthlyBarItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
  },
  monthlyBarValue: {
    color: '#55715b',
    fontSize: 8,
    fontWeight: '700',
  },
  monthlyBarTrack: {
    width: '70%',
    maxWidth: 34,
    height: 130,
    justifyContent: 'flex-end',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: '#f1f5f1',
  },
  monthlyBar: {
    width: '100%',
    minHeight: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: '#278c50',
  },
  monthlyBarLabel: {
    color: '#87938a',
    fontSize: 8,
    textAlign: 'center',
  },
  detailsCard: {
    marginTop: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e7ece7',
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  sentMessagesCard: {
    marginTop: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e7ece7',
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  sentMessagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 13,
  },
  sentMessagesHeading: {
    flex: 1,
  },
  sentMessagesRefresh: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#eaf5eb',
  },
  sentMessagesRefreshText: {
    color: '#28713b',
    fontSize: 9,
    fontWeight: '700',
  },
  sentMessagesList: {
    gap: 9,
  },
  sentMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 11,
    borderRadius: 11,
    backgroundColor: '#f7faf6',
    borderWidth: 1,
    borderColor: '#edf1ec',
  },
  sentMessageIcon: {
    width: 29,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#eaf4fb',
  },
  sentMessageIconText: {
    color: '#347292',
    fontSize: 13,
  },
  sentMessageCopy: {
    flex: 1,
    minWidth: 0,
  },
  sentMessageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sentMessageBusiness: {
    flex: 1,
    color: '#2b3d30',
    fontSize: 10,
    fontWeight: '800',
  },
  sentMessageDate: {
    color: '#89958b',
    fontSize: 8,
    textAlign: 'right',
  },
  sentMessageTitle: {
    color: '#50705a',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 3,
  },
  sentMessageBody: {
    color: '#66746a',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
  },
  sentMessagesEmpty: {
    color: '#87938a',
    fontSize: 10,
    paddingVertical: 16,
    textAlign: 'center',
  },
  sentMessagesError: {
    color: '#a43b34',
    fontSize: 10,
    paddingVertical: 12,
  },
  disabledButton: {
    opacity: 0.55,
  },
  detailTable: {
    marginTop: 13,
  },
  detailTableScroll: {
    width: '100%',
  },
  detailRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#edf0ed',
  },
  detailHeader: {
    backgroundColor: '#f5f8f5',
  },
  detailCell: {
    flex: 0.7,
    color: '#66746a',
    fontSize: 9,
    textAlign: 'center',
  },
  typeCell: {
    flex: 1.6,
    textAlign: 'left',
    paddingLeft: 9,
  },
  detailHeaderText: {
    color: '#617066',
    fontWeight: '800',
  },
  totalRow: {
    borderBottomWidth: 0,
    backgroundColor: '#f6faf5',
  },
  totalText: {
    color: '#2c4832',
    fontWeight: '800',
  },
  disclaimer: {
    color: '#8a958d',
    fontSize: 8,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  pressed: {
    opacity: 0.76,
  },
});
