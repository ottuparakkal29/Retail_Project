import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/app-text';
import { BusinessNavTabs } from '@/components/business-nav-tabs';
import { BusinessOrderCard } from '@/components/business-order-card';
import { RejectOrderDialog } from '@/components/reject-order-dialog';
import { SkeletonBlock, SkeletonGroup } from '@/components/skeleton';
import { Palette } from '@/constants/palette';
import { useBusinessOrders, type BusinessOrdersStatus } from '@/hooks/use-business-orders';
import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';
import {
  getBusinessTab,
  type BusinessAction,
  type BusinessOrderTab,
  type Order,
} from '@/lib/orders';

const GREEN = Palette.green;
const DARK = '#17331e';
const MUTED = '#718073';

const TABS: { key: BusinessOrderTab; label: string; emptyTitle: string; emptyMessage: string }[] = [
  {
    key: 'new',
    label: 'New',
    emptyTitle: 'No new orders',
    emptyMessage: 'New customer orders appear here as soon as they are placed.',
  },
  {
    key: 'active',
    label: 'Active',
    emptyTitle: 'No active orders',
    emptyMessage: 'Orders you have accepted and are preparing or delivering show up here.',
  },
  {
    key: 'closed',
    label: 'Completed',
    emptyTitle: 'No completed orders yet',
    emptyMessage: 'Delivered, rejected and cancelled orders are kept here for reference.',
  },
];

const GATE_MESSAGES: Partial<Record<BusinessOrdersStatus, { title: string; message: string }>> = {
  'signed-out': {
    title: 'Sign in to manage orders',
    message: 'Sign in with your approved business account to see incoming orders.',
  },
  'not-business': {
    title: 'Business account required',
    message: 'Incoming orders are only available to approved business accounts.',
  },
  'not-approved': {
    title: 'Approval pending',
    message: 'Your business account needs to be approved before you can receive orders.',
  },
};

export default function IncomingOrdersScreen() {
  const isWide = useResponsiveBreakpoint(850);
  const {
    status,
    business,
    orders,
    error,
    refreshing,
    updatedAt,
    updatingId,
    feedback,
    dismissFeedback,
    refresh,
    runAction,
  } = useBusinessOrders();
  const [tab, setTab] = useState<BusinessOrderTab>('new');
  const [rejecting, setRejecting] = useState<{ order: Order; action: BusinessAction } | null>(null);

  const counts = useMemo(() => {
    const result: Record<BusinessOrderTab, number> = { new: 0, active: 0, closed: 0 };
    for (const order of orders) result[getBusinessTab(order.status)] += 1;
    return result;
  }, [orders]);
  const visibleOrders = useMemo(
    () => orders.filter((order) => getBusinessTab(order.status) === tab),
    [orders, tab],
  );
  const activeTab = TABS.find((item) => item.key === tab) ?? TABS[0];

  function handleAction(order: Order, action: BusinessAction) {
    if (action.needsReason) setRejecting({ order, action });
    else void runAction(order, action);
  }

  async function confirmReject(reason: string) {
    if (!rejecting) return;
    const applied = await runAction(rejecting.order, rejecting.action, reason);
    if (applied) setRejecting(null);
  }

  const gate = GATE_MESSAGES[status];
  if (gate) {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
        <View style={styles.gate}>
          <Text style={styles.gateTitle}>{gate.title}</Text>
          <Text style={styles.gateMessage}>{gate.message}</Text>
          <Pressable onPress={() => router.replace('/')} style={styles.gateButton}>
            <Text style={styles.gateButtonText}>Back to storefront</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  let content;
  if (status === 'loading') {
    content = <OrdersSkeleton />;
  } else if (status === 'error') {
    content = (
      <View style={styles.stateCard}>
        <Text style={styles.stateTitle}>Couldn’t load your orders</Text>
        <Text style={styles.stateMessage}>{error || 'Please try again.'}</Text>
        <Pressable onPress={() => void refresh()} style={styles.stateButton}>
          <Text style={styles.stateButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  } else if (visibleOrders.length === 0) {
    content = (
      <View style={styles.stateCard}>
        <View style={styles.stateIcon}><Text style={styles.stateIconText}>🧾</Text></View>
        <Text style={styles.stateTitle}>{activeTab.emptyTitle}</Text>
        <Text style={styles.stateMessage}>{activeTab.emptyMessage}</Text>
      </View>
    );
  } else {
    content = (
      <View style={styles.list}>
        {visibleOrders.map((order) => (
          <BusinessOrderCard
            key={order.id}
            busy={updatingId === order.id}
            onAction={handleAction}
            order={order}
          />
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <View style={styles.appFrame}>
        {isWide ? (
          <View style={styles.sidebar}>
            <View>
              <View style={styles.sidebarBrand}>
                <View style={styles.leafMark}>
                  <Text style={styles.leafMarkText}>F</Text>
                </View>
                <View>
                  <Text style={styles.sidebarBrandName}>FreshCart</Text>
                  <Text style={styles.sidebarBrandCaption}>BUSINESS PANEL</Text>
                </View>
              </View>
              <View style={styles.sidebarMenu}>
                <SidebarItem icon="✦" label="Today's Update" onPress={() => router.replace('/shop-updates')} />
                <SidebarItem icon="▣" label="Products" onPress={() => router.replace('/products')} />
                <SidebarItem active icon="🧾" label="Incoming orders" onPress={() => undefined} />
              </View>
            </View>
            <Pressable onPress={() => router.replace('/')} style={styles.logoutButton}>
              <Text style={styles.logoutIcon}>↪</Text>
              <Text style={styles.logoutLabel}>Back to storefront</Text>
            </Pressable>
          </View>
        ) : null}

        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={[styles.page, isWide && styles.pageWide]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.topbar}>
            {!isWide ? (
              <Pressable onPress={() => router.replace('/')} style={styles.brand}>
                <View style={styles.brandMark}><Text style={styles.brandMarkText}>F</Text></View>
                <View>
                  <Text style={styles.brandName}>FreshCart</Text>
                  <Text style={styles.brandCaption}>BUSINESS STUDIO</Text>
                </View>
              </Pressable>
            ) : (
              <Text style={styles.pageLabel}>Order management</Text>
            )}
            <Pressable onPress={() => router.replace('/')} style={styles.storeLink}>
              <Text style={styles.storeLinkText}>← Storefront</Text>
            </Pressable>
          </View>

          {!isWide ? <BusinessNavTabs active="orders" /> : null}

          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>CUSTOMER ORDERS</Text>
              <Text style={styles.title}>Incoming orders</Text>
              <Text style={styles.subtitle}>
                {business
                  ? `Review and fulfil orders placed with ${business.name}.`
                  : 'Review and fulfil orders placed with your shop.'}
              </Text>
            </View>
            <View style={styles.refreshWrap}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Refresh orders"
                accessibilityState={{ busy: refreshing, disabled: refreshing }}
                disabled={refreshing}
                onPress={() => void refresh()}
                style={({ pressed }) => [styles.refreshButton, (pressed || refreshing) && styles.pressed]}>
                {refreshing ? (
                  <ActivityIndicator color={GREEN} size="small" />
                ) : (
                  <Text style={styles.refreshText}>↻ Refresh</Text>
                )}
              </Pressable>
              {updatedAt ? (
                <Text style={styles.updatedText}>
                  Updated {updatedAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                </Text>
              ) : null}
            </View>
          </View>

          {feedback ? (
            <Pressable
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              onPress={dismissFeedback}
              style={[styles.notice, feedback.tone === 'error' && styles.noticeError]}>
              <Text style={[styles.noticeText, feedback.tone === 'error' && styles.noticeErrorText]}>
                {feedback.text}
              </Text>
              <Text style={[styles.noticeDismiss, feedback.tone === 'error' && styles.noticeErrorText]}>×</Text>
            </Pressable>
          ) : null}
          {status === 'ready' && error ? (
            <View style={[styles.notice, styles.noticeError]}>
              <Text style={[styles.noticeText, styles.noticeErrorText]}>
                Couldn’t refresh your orders: {error}
              </Text>
            </View>
          ) : null}

          <View accessibilityRole="tablist" style={styles.tabs}>
            {TABS.map((item) => {
              const selected = tab === item.key;
              const highlight = item.key === 'new' && counts.new > 0;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setTab(item.key)}
                  style={[styles.tab, selected && styles.tabSelected]}>
                  <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{item.label}</Text>
                  <View
                    style={[
                      styles.tabCount,
                      selected && styles.tabCountSelected,
                      highlight && !selected && styles.tabCountHighlight,
                    ]}>
                    <Text
                      style={[
                        styles.tabCountText,
                        selected && styles.tabCountTextSelected,
                        highlight && !selected && styles.tabCountTextHighlight,
                      ]}>
                      {status === 'ready' ? counts[item.key] : '–'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {content}
        </ScrollView>
      </View>

      <RejectOrderDialog
        loading={rejecting !== null && updatingId === rejecting.order.id}
        onCancel={() => setRejecting(null)}
        onConfirm={(reason) => void confirmReject(reason)}
        orderNumber={rejecting?.order.orderNumber ?? null}
      />
    </SafeAreaView>
  );
}

function OrdersSkeleton() {
  return (
    <SkeletonGroup label="Loading incoming orders" style={styles.list}>
      {[0, 1].map((index) => (
        <View key={index} style={styles.skeletonCard}>
          <SkeletonBlock height={16} width="35%" />
          <SkeletonBlock height={11} width="25%" />
          <SkeletonBlock height={60} radius={12} />
          <SkeletonBlock height={11} width="70%" />
          <SkeletonBlock height={44} radius={22} />
        </View>
      ))}
    </SkeletonGroup>
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
  const [interacting, setInteracting] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onHoverIn={() => setInteracting(true)}
      onHoverOut={() => setInteracting(false)}
      onFocus={() => setInteracting(true)}
      onBlur={() => setInteracting(false)}
      style={({ pressed }) => [
        styles.sidebarItem,
        (active || interacting) && styles.sidebarItemActive,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.sidebarItemIcon, (active || interacting) && styles.sidebarItemIconActive]}>{icon}</Text>
      <Text style={[styles.sidebarItemText, (active || interacting) && styles.sidebarItemTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f8f3' },
  appFrame: { flex: 1, flexDirection: 'row' },
  mainScroll: { flex: 1 },
  page: { flexGrow: 1, padding: 18, paddingBottom: 110, gap: 18 },
  pageWide: { width: '100%', paddingHorizontal: 28, paddingTop: 18, paddingBottom: 48, maxWidth: 1100, alignSelf: 'center' },
  sidebar: { width: 218, paddingHorizontal: 15, paddingVertical: 18, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#e7ede7', justifyContent: 'space-between' },
  sidebarBrand: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 9, paddingBottom: 25, borderBottomWidth: 1, borderBottomColor: '#edf0ed' },
  leafMark: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#dcf1d6', alignItems: 'center', justifyContent: 'center' },
  leafMarkText: { color: '#1b7539', fontSize: 22, fontWeight: '900' },
  sidebarBrandName: { color: '#176a35', fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
  sidebarBrandCaption: { color: '#7d8b7e', fontSize: 8, fontWeight: '700', letterSpacing: 1.1, marginTop: 2 },
  sidebarMenu: { paddingTop: 17 },
  sidebarItem: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 11, marginBottom: 4, borderRadius: 10 },
  sidebarItemActive: { backgroundColor: '#e9f8e5' },
  sidebarItemIcon: { width: 20, color: '#526456', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  sidebarItemIconActive: { color: '#21823d' },
  sidebarItemText: { color: '#425146', fontSize: 11, fontWeight: '600' },
  sidebarItemTextActive: { color: '#216a35', fontWeight: '800' },
  logoutButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
  logoutIcon: { color: '#546357', fontSize: 17 },
  logoutLabel: { color: '#536156', fontSize: 10, fontWeight: '600' },
  pageLabel: { color: DARK, fontSize: 14, fontWeight: '700' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottomWidth: 1, borderColor: '#e7ede5' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 40, height: 40, borderRadius: 13, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  brandName: { color: DARK, fontSize: 16, fontWeight: '800' },
  brandCaption: { color: GREEN, fontSize: 9, fontWeight: '800', letterSpacing: 1.3 },
  storeLink: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e3ebe1' },
  storeLinkText: { color: DARK, fontSize: 12, fontWeight: '600' },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headingCopy: { flex: 1, minWidth: 0, gap: 4 },
  eyebrow: { color: GREEN, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: DARK, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: MUTED, fontSize: 12, lineHeight: 19 },
  refreshWrap: { alignItems: 'flex-end', gap: 5 },
  refreshButton: { minWidth: 96, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce7dc' },
  refreshText: { color: DARK, fontSize: 12, fontWeight: '700' },
  updatedText: { color: '#8a958c', fontSize: 9 },
  pressed: { opacity: 0.8 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#e6f4e8', borderWidth: 1, borderColor: '#cde6cf' },
  noticeError: { backgroundColor: '#fff0ed', borderColor: '#f2d1ca' },
  noticeText: { flex: 1, color: '#276b38', fontSize: 12, lineHeight: 18 },
  noticeErrorText: { color: '#a34232' },
  noticeDismiss: { color: '#276b38', fontSize: 20 },
  tabs: { flexDirection: 'row', gap: 8, padding: 4, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e3ebe1' },
  tab: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 8, borderRadius: 12 },
  tabSelected: { backgroundColor: GREEN },
  tabText: { color: '#425146', fontSize: 12, fontWeight: '700' },
  tabTextSelected: { color: '#fff' },
  tabCount: { minWidth: 22, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center', borderRadius: 11, backgroundColor: '#eaf0ea' },
  tabCountSelected: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabCountHighlight: { backgroundColor: '#e45d4d' },
  tabCountText: { color: '#4a5a4e', fontSize: 10, fontWeight: '800' },
  tabCountTextSelected: { color: '#fff' },
  tabCountTextHighlight: { color: '#fff' },
  list: { gap: 14 },
  skeletonCard: { gap: 12, padding: 16, borderWidth: 1, borderColor: Palette.border, borderRadius: 16, backgroundColor: Palette.surface },
  stateCard: { alignItems: 'center', paddingHorizontal: 22, paddingVertical: 40, gap: 6, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e9eee7' },
  stateIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#eaf6eb', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stateIconText: { fontSize: 24 },
  stateTitle: { color: DARK, fontSize: 15, fontWeight: '800' },
  stateMessage: { maxWidth: 320, color: MUTED, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  stateButton: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, backgroundColor: GREEN },
  stateButtonText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  gateTitle: { color: DARK, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  gateMessage: { maxWidth: 340, color: MUTED, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  gateButton: { marginTop: 8, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 12, backgroundColor: GREEN },
  gateButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
