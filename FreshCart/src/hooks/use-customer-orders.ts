import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  cancelPendingOrder,
  fetchCustomerOrders,
  fetchCustomerProfile,
  getOrderErrorMessage,
  subscribeToOrderChanges,
  type Order,
  type OrderFeedback,
} from '@/lib/orders';
import { supabase } from '@/lib/supabase';

// Safety net for when realtime is unavailable or the orders table is not published to it.
const REFRESH_INTERVAL_MS = 30_000;

export type CustomerOrdersStatus = 'loading' | 'signed-out' | 'ready' | 'error';

export function useCustomerOrders() {
  const [status, setStatus] = useState<CustomerOrdersStatus>('loading');
  const [orders, setOrders] = useState<Order[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<OrderFeedback | null>(null);
  const loadSequenceRef = useRef(0);
  const loadedRef = useRef(false);

  // Only the most recently started load may update state, so a slow response never overwrites newer data.
  const load = useCallback(async (manual = false) => {
    const sequence = ++loadSequenceRef.current;
    const isCurrent = () => sequence === loadSequenceRef.current;
    if (manual) setRefreshing(true);

    try {
      const profile = await fetchCustomerProfile();
      if (!isCurrent()) return;
      if (!profile) {
        loadedRef.current = true;
        setOrders([]);
        setCustomerId(null);
        setError('');
        setStatus('signed-out');
        return;
      }

      const nextOrders = await fetchCustomerOrders(profile.id);
      if (!isCurrent()) return;
      loadedRef.current = true;
      setOrders(nextOrders);
      setCustomerId(profile.id);
      setError('');
      setUpdatedAt(new Date());
      setStatus('ready');
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
      // Supabase calls made synchronously inside this callback can deadlock the auth client.
      setTimeout(() => {
        if (active) void load();
      }, 0);
    });
    return () => {
      active = false;
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

  useFocusEffect(
    useCallback(() => {
      if (!customerId) return;
      return subscribeToOrderChanges(`customer_id=eq.${customerId}`, () => void load());
    }, [customerId, load]),
  );

  const cancelOrder = useCallback(
    async (orderId: string) => {
      setCancellingId(orderId);
      setFeedback(null);
      try {
        const outcome = await cancelPendingOrder(orderId);
        if (outcome === 'cancelled') {
          setOrders((current) =>
            current.map((order) => (order.id === orderId ? { ...order, status: 'cancelled' } : order)),
          );
          setFeedback({ tone: 'success', text: 'Your order was cancelled.' });
        } else {
          setFeedback({
            tone: 'error',
            text: 'The shop has already responded to this order, so it can no longer be cancelled.',
          });
        }
        await load();
      } catch (cancelError) {
        setFeedback({
          tone: 'error',
          text: getOrderErrorMessage(cancelError, 'Unable to cancel this order. Please try again.'),
        });
      } finally {
        setCancellingId(null);
      }
    },
    [load],
  );

  const refresh = useCallback(() => load(true), [load]);
  const dismissFeedback = useCallback(() => setFeedback(null), []);

  return {
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
  };
}
