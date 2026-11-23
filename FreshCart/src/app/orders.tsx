import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/app-text';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CustomerOrderCard } from '@/components/customer-order-card';
import { SkeletonBlock, SkeletonGroup } from '@/components/skeleton';
import { Palette } from '@/constants/palette';
import { useNavigationState } from '@/contexts/navigation-context';
import { useCustomerOrders } from '@/hooks/use-customer-orders';
import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';
import type { Order } from '@/lib/orders';

export default function OrdersScreen() {
  const isDesktop = useResponsiveBreakpoint(760);
  const { setAuthRequest } = useNavigationState();
  const {
    status,
    orders,
    error,
    refreshing,
    updatedAt,
    cancellingId,
    feedback,
    dismissFeedback,
    refresh,
    cancelOrder,
  } = useCustomerOrders();
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);

  async function confirmCancel() {
    if (!orderToCancel) return;
    try {
      await cancelOrder(orderToCancel.id);
    } finally {
      setOrderToCancel(null);
    }
  }

  function signIn() {
    setAuthRequest('login');
    router.push('/');
  }

  let content;
  if (status === 'loading') {
    content = <OrdersSkeleton />;
  } else if (status === 'error') {
    content = (
      <StateCard
        actionLabel="Try again"
        icon="⚠"
        message={error || 'Unable to load your orders. Please try again.'}
        onAction={() => void refresh()}
        title="Couldn’t load your orders"
      />
    );
  } else if (status === 'signed-out') {
    content = (
      <StateCard
        actionLabel="Sign in"
        icon="🔒"
        message="Sign in to see the orders you have placed and track their status."
        onAction={signIn}
        title="Sign in to view your orders"
      />
    );
  } else if (orders.length === 0) {
    content = (
      <StateCard
        actionLabel="Start shopping"
        icon="🧾"
        message="When you place an order it will show up here, along with its status."
        onAction={() => router.replace('/')}
        title="No orders yet"
      />
    );
  } else {
    content = (
      <View style={styles.list}>
        {orders.map((order) => (
          <CustomerOrderCard
            key={order.id}
            cancelling={cancellingId === order.id}
            onCancel={setOrderToCancel}
            order={order}
          />
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.pageScroll, { paddingBottom: isDesktop ? 42 : 110 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/')}
              style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
              <Text style={styles.headerButtonText}>‹ Continue shopping</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/cart')}
              style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
              <Text style={styles.headerButtonText}>My cart</Text>
            </Pressable>
          </View>

          <View style={styles.heading}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>YOUR PURCHASES</Text>
              <Text style={styles.title}>My orders</Text>
              <Text style={styles.subtitle}>
                {status === 'ready' && orders.length
                  ? `${orders.length} ${orders.length === 1 ? 'order' : 'orders'}${
                      updatedAt
                        ? ` · updated ${updatedAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`
                        : ''
                    }`
                  : 'Track your orders from every shop.'}
              </Text>
            </View>
            {status === 'ready' || status === 'error' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Refresh orders"
                accessibilityState={{ busy: refreshing, disabled: refreshing }}
                disabled={refreshing}
                onPress={() => void refresh()}
                style={({ pressed }) => [styles.refreshButton, (pressed || refreshing) && styles.pressed]}>
                {refreshing ? (
                  <ActivityIndicator color={Palette.darkGreen} size="small" />
                ) : (
                  <Text style={styles.refreshText}>↻ Refresh</Text>
                )}
              </Pressable>
            ) : null}
          </View>

          {feedback ? (
            <Pressable
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              onPress={dismissFeedback}
              style={[styles.notice, feedback.tone === 'error' && styles.errorNotice]}>
              <Text style={[styles.noticeText, feedback.tone === 'error' && styles.errorNoticeText]}>
                {feedback.text}
              </Text>
              <Text style={[styles.noticeDismiss, feedback.tone === 'error' && styles.errorNoticeText]}>×</Text>
            </Pressable>
          ) : null}

          {status === 'ready' && error ? (
            <View style={[styles.notice, styles.errorNotice]}>
              <Text style={[styles.noticeText, styles.errorNoticeText]}>
                Couldn’t refresh your orders: {error}
              </Text>
            </View>
          ) : null}

          {content}
        </View>
      </ScrollView>

      <ConfirmDialog
        cancelLabel="Keep order"
        confirmLabel="Cancel order"
        destructive
        loading={orderToCancel !== null && cancellingId === orderToCancel.id}
        message={
          orderToCancel
            ? `Order ${orderToCancel.orderNumber} from ${orderToCancel.shopName} will be cancelled. This can’t be undone.`
            : ''
        }
        onCancel={() => setOrderToCancel(null)}
        onConfirm={() => void confirmCancel()}
        title="Cancel this order?"
        visible={orderToCancel !== null}
      />
    </SafeAreaView>
  );
}

function OrdersSkeleton() {
  return (
    <SkeletonGroup label="Loading your orders" style={styles.list}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.skeletonCard}>
          <SkeletonBlock height={16} width="40%" />
          <SkeletonBlock height={11} width="30%" />
          <SkeletonBlock height={11} width="80%" />
          <SkeletonBlock height={11} width="65%" />
        </View>
      ))}
    </SkeletonGroup>
  );
}

function StateCard({
  actionLabel,
  icon,
  message,
  onAction,
  title,
}: {
  actionLabel: string;
  icon: string;
  message: string;
  onAction: () => void;
  title: string;
}) {
  return (
    <View style={styles.stateCard}>
      <View style={styles.stateIconWrap}><Text style={styles.stateIcon}>{icon}</Text></View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        style={({ pressed }) => [styles.stateButton, pressed && styles.pressed]}>
        <Text style={styles.stateButtonText}>{actionLabel} →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f8f5',
  },
  pageScroll: {
    flexGrow: 1,
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 860,
    paddingHorizontal: 16,
  },
  header: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e5ece5',
  },
  headerButton: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#eaf5e9',
  },
  headerButtonText: {
    color: Palette.darkGreen,
    fontSize: 10,
    fontWeight: '700',
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 25,
    marginBottom: 17,
  },
  headingCopy: {
    flex: 1,
    minWidth: 0,
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
  refreshButton: {
    minWidth: 92,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#cfe2d1',
    borderRadius: 19,
    backgroundColor: '#ffffff',
  },
  refreshText: {
    color: Palette.darkGreen,
    fontSize: 11,
    fontWeight: '700',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#cfe2d1',
    borderRadius: 10,
    backgroundColor: '#eef8ec',
  },
  errorNotice: {
    borderColor: Palette.dangerBorder,
    backgroundColor: Palette.dangerBackground,
  },
  noticeText: {
    flex: 1,
    color: '#326643',
    fontSize: 11,
    lineHeight: 16,
  },
  errorNoticeText: {
    color: Palette.danger,
  },
  noticeDismiss: {
    color: '#326643',
    fontSize: 20,
  },
  list: {
    gap: 14,
  },
  skeletonCard: {
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 16,
    backgroundColor: Palette.surface,
  },
  stateCard: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 42,
    borderWidth: 1,
    borderColor: '#e7ece7',
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  stateIconWrap: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 33,
    backgroundColor: '#edf7e9',
  },
  stateIcon: {
    fontSize: 29,
  },
  stateTitle: {
    color: '#293b2f',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 14,
  },
  stateMessage: {
    maxWidth: 360,
    color: '#7d8a80',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 6,
  },
  stateButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 17,
    marginTop: 18,
    borderRadius: 22,
    backgroundColor: Palette.green,
  },
  stateButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.76,
  },
});
