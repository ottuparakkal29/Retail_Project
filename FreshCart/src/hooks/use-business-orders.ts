import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  applyBusinessAction,
  fetchBusinessContext,
  fetchBusinessOrders,
  getOrderErrorMessage,
  getStatusMeta,
  subscribeToOrderChanges,
  type BusinessAction,
  type Order,
  type OrderFeedback,
} from '@/lib/orders';
import { supabase } from '@/lib/supabase';

// Safety net for when realtime is unavailable or the orders table is not published to it.
const REFRESH_INTERVAL_MS = 30_000;
// A new order row arrives before its items; reload shortly after until the items show up.
const ITEMS_SETTLE_WINDOW_MS = 60_000;
const ITEMS_SETTLE_DELAY_MS = 2_500;
const ITEMS_SETTLE_ATTEMPTS = 4;

export type BusinessOrdersStatus =
  | 'loading'
  | 'signed-out'
  | 'not-business'
  | 'not-approved'
  | 'ready'
  | 'error';

type Business = { id: string; name: string };

export function useBusinessOrders() {
  const [status, setStatus] = useState<BusinessOrdersStatus>('loading');
  const [business, setBusiness] = useState<Business | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<OrderFeedback | null>(null);
  const loadSequenceRef = useRef(0);
  const loadedRef = useRef(false);
  const businessRef = useRef<Business | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const settleAttemptsRef = useRef(0);

  // Only the most recently started load may update state, so a slow response never overwrites newer data.
  const load = useCallback(async (manual = false) => {
    const sequence = ++loadSequenceRef.current;
    const isCurrent = () => sequence === loadSequenceRef.current;
    if (manual) setRefreshing(true);

    try {
      if (!businessRef.current) {
        const context = await fetchBusinessContext();
        if (!isCurrent()) return;
        if (context.kind !== 'ready') {
          loadedRef.current = true;
          setOrders([]);
          setBusiness(null);
          setError('');
          setStatus(context.kind);
          return;
        }
        businessRef.current = { id: context.businessId, name: context.businessName };
        setBusiness(businessRef.current);
      }

      const nextOrders = await fetchBusinessOrders(businessRef.current.id);
      if (!isCurrent()) return;
      loadedRef.current = true;
      setOrders(nextOrders);
      setError('');
      setUpdatedAt(new Date());
      setStatus('ready');

      const waitingForItems = nextOrders.some(
        (order) =>
          order.items.length === 0 &&
          Date.now() - new Date(order.createdAt).getTime() < ITEMS_SETTLE_WINDOW_MS,
      );
      clearTimeout(settleTimerRef.current);
      if (!waitingForItems) {
        settleAttemptsRef.current = 0;
      } else if (settleAttemptsRef.current < ITEMS_SETTLE_ATTEMPTS) {
        settleAttemptsRef.current += 1;
        settleTimerRef.current = setTimeout(() => void load(), ITEMS_SETTLE_DELAY_MS);
      }
    } catch (loadError) {
      if (!isCurrent()) return;
      const message = getOrderErrorMessage(loadError, 'Unable to load your orders. Please try again.');
      setError(message);
      if (!loadedRef.current) setStatus('error');
    } finally {
      if (isCurrent()) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      businessRef.current = null;
      // Supabase calls made synchronously inside this callback can deadlock the auth client.
      setTimeout(() => {
        if (active) void load();
      }, 0);
    });
    return () => {
      active = false;
      clearTimeout(settleTimerRef.current);
      subscription.unsubscribe();
    };
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), REFRESH_INTERVAL_MS);
      return () => clearInterval(timer);
    }, [load]),
  );

  const businessId = business?.id ?? null;
  useFocusEffect(
    useCallback(() => {
      if (!businessId) return;
      return subscribeToOrderChanges(`business_id=eq.${businessId}`, () => void load());
    }, [businessId, load]),
  );

  // Resolves true when the change was applied, so callers can close their own dialogs.
  const runAction = useCallback(
    async (order: Order, action: BusinessAction, rejectionReason?: string) => {
      setUpdatingId(order.id);
      setFeedback(null);
      try {
        const result = await applyBusinessAction(order, action, rejectionReason);
        if (!result.ok) {
          setFeedback({ tone: 'error', text: result.message });
          if (result.stale) void load();
          return false;
        }

        setOrders((current) =>
          current.map((item) =>
            item.id === order.id
              ? {
                  ...item,
                  status: result.status,
                  paymentStatus: result.paymentStatus,
                  rejectionReason: result.rejectionReason,
                }
              : item,
          ),
        );
        setFeedback({
          tone: 'success',
          text: `Order ${order.orderNumber} is now ${getStatusMeta(result.status).label.toLowerCase()}.`,
        });
        return true;
      } finally {
        setUpdatingId(null);
      }
    },
    [load],
  );

  const refresh = useCallback(() => load(true), [load]);
  const dismissFeedback = useCallback(() => setFeedback(null), []);

  return {
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
  };
}
