import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/app-text';
import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';
import { supabase } from '@/lib/supabase';

type NotificationRecord = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const typeStyles: Record<string, { accent: string; background: string; icon: string }> = {
  business_approved: { accent: '#16813b', background: '#eff9f0', icon: '✓' },
  business_rejected: { accent: '#c84238', background: '#fff1ef', icon: '!' },
  admin_message: { accent: '#9b6b10', background: '#fff8e8', icon: '✦' },
};

export default function NotificationWrapper() {
  const isWide = useResponsiveBreakpoint(760);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications],
  );

  useEffect(() => {
    let active = true;
    let requestId = 0;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function connectToUser(nextUserId: string | null) {
      const currentRequest = ++requestId;
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }

      setUserId(nextUserId);
      setProfileId(null);
      setNotifications([]);
      setOpen(false);
      setErrorMessage('');
      setLoading(Boolean(nextUserId));

      if (!nextUserId) {
        setLoading(false);
        return;
      }

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .or(`auth_user_id.eq.${nextUserId},id.eq.${nextUserId}`)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!profile) throw new Error('Your notification profile could not be found.');
        if (!active || currentRequest !== requestId) return;

        const ownProfileId = profile.id;
        setProfileId(ownProfileId);
        channel = supabase
          .channel(`notifications:${ownProfileId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${ownProfileId}`,
            },
            (payload) => {
              const incoming = payload.new as NotificationRecord;
              if (!active || currentRequest !== requestId) return;
              setNotifications((current) =>
                current.some((notification) => notification.id === incoming.id)
                  ? current
                  : [incoming, ...current],
              );
            },
          )
          .subscribe((status) => {
            if (
              active &&
              currentRequest === requestId &&
              (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
            ) {
              setErrorMessage('Live notifications are temporarily unavailable.');
            }
          });

        const { data, error } = await supabase
          .from('notifications')
          .select('id, user_id, title, message, type, is_read, metadata, created_at')
          .eq('user_id', ownProfileId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (active && currentRequest === requestId) {
          setNotifications((current) => {
            const fetched = (data ?? []) as NotificationRecord[];
            const fetchedIds = new Set(fetched.map((notification) => notification.id));
            const realtimeItems = current.filter(
              (notification) => !fetchedIds.has(notification.id),
            );
            return [...realtimeItems, ...fetched];
          });
        }
      } catch (error) {
        if (active && currentRequest === requestId) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Unable to load your notifications.',
          );
        }
      } finally {
        if (active && currentRequest === requestId) setLoading(false);
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void connectToUser(session?.user.id ?? null), 0);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      void connectToUser(data.session?.user.id ?? null);
    }).catch((error: unknown) => {
      if (active) {
        setLoading(false);
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to verify your account.',
        );
      }
    });

    return () => {
      active = false;
      requestId += 1;
      subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  async function markAsRead(notificationId: string) {
    if (!profileId) return;
    setUpdating(true);
    setErrorMessage('');
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', profileId)
        .eq('is_read', false);
      if (error) throw error;
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? { ...notification, is_read: true }
            : notification,
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to mark the notification as read.',
      );
    } finally {
      setUpdating(false);
    }
  }

  async function markAllAsRead() {
    if (!profileId || unreadCount === 0) return;
    setUpdating(true);
    setErrorMessage('');
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profileId)
        .eq('is_read', false);
      if (error) throw error;
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, is_read: true })),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to mark notifications as read.',
      );
    } finally {
      setUpdating(false);
    }
  }

  if (!userId) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Notifications, ${unreadCount} unread`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}>
        <Text style={styles.bellIcon}>🔔</Text>
        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal
        animationType={isWide ? 'fade' : 'slide'}
        transparent
        visible={open}
        onRequestClose={() => setOpen(false)}>
        <View style={[styles.overlay, isWide && styles.webOverlay]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close notifications"
            onPress={() => setOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.panel, isWide && styles.webPanel]}>
            <View style={styles.panelHeading}>
              <View>
                <Text style={styles.panelTitle}>Notifications</Text>
                <Text style={styles.panelSubtitle}>
                  {unreadCount ? `${unreadCount} unread message${unreadCount === 1 ? '' : 's'}` : 'You’re all caught up'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close notifications"
                onPress={() => setOpen(false)}
                style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={updating || unreadCount === 0}
              onPress={() => void markAllAsRead()}
              style={({ pressed }) => [
                styles.markAllButton,
                (updating || unreadCount === 0) && styles.disabledButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.markAllText}>Mark all as read</Text>
            </Pressable>

            {errorMessage ? (
              <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                {errorMessage}
              </Text>
            ) : null}

            {loading ? (
              <Text style={styles.emptyText}>Loading notifications…</Text>
            ) : notifications.length === 0 ? (
              <Text style={styles.emptyText}>No notifications yet.</Text>
            ) : (
              <ScrollView
                contentContainerStyle={styles.notificationList}
                showsVerticalScrollIndicator={false}>
                {notifications.map((notification) => {
                  const decision = notification.metadata?.decision;
                  const type =
                    notification.type === 'admin_message' && decision === 'approved'
                      ? 'business_approved'
                      : notification.type === 'admin_message' && decision === 'rejected'
                        ? 'business_rejected'
                        : notification.type;
                  const tone = typeStyles[type] ?? typeStyles.admin_message;

                  return (
                    <Pressable
                      key={notification.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${notification.title}${notification.is_read ? '' : ', unread'}`}
                      disabled={notification.is_read || updating}
                      onPress={() => void markAsRead(notification.id)}
                      style={[
                        styles.notificationCard,
                        { borderLeftColor: tone.accent, backgroundColor: tone.background },
                        notification.is_read && styles.readCard,
                      ]}>
                      <View style={[styles.notificationIcon, { backgroundColor: tone.accent }]}>
                        <Text style={styles.notificationIconText}>{tone.icon}</Text>
                      </View>
                      <View style={styles.notificationCopy}>
                        <View style={styles.notificationTitleRow}>
                          <Text style={styles.notificationTitle}>{notification.title}</Text>
                          {!notification.is_read ? <View style={styles.unreadDot} /> : null}
                        </View>
                        <Text style={styles.notificationMessage}>{notification.message}</Text>
                        <Text style={styles.notificationDate}>
                          {new Date(notification.created_at).toLocaleString()}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#cfe2d1',
    backgroundColor: '#f0f8ee',
  },
  bellIcon: {
    color: '#146b32',
    fontSize: 21,
    lineHeight: 27,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#df5147',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20,40,27,0.42)',
  },
  webOverlay: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  panel: {
    maxHeight: '86%',
    minHeight: 290,
    paddingHorizontal: 20,
    paddingTop: 19,
    paddingBottom: 28,
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    backgroundColor: '#ffffff',
  },
  webPanel: {
    width: 390,
    maxHeight: 560,
    minHeight: 260,
    marginTop: 62,
    marginRight: 22,
    paddingBottom: 18,
    borderRadius: 18,
    shadowColor: '#18351f',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  panelHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: {
    color: '#203128',
    fontSize: 18,
    fontWeight: '800',
  },
  panelSubtitle: {
    color: '#78867b',
    fontSize: 10,
    marginTop: 2,
  },
  closeButton: {
    width: 31,
    height: 31,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f0',
  },
  closeButtonText: {
    color: '#68756b',
    fontSize: 21,
    lineHeight: 26,
  },
  markAllButton: {
    alignSelf: 'flex-start',
    marginTop: 15,
    marginBottom: 11,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 9,
    backgroundColor: '#eaf5eb',
  },
  markAllText: {
    color: '#147034',
    fontSize: 10,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  notificationList: {
    gap: 9,
    paddingBottom: 4,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 11,
    borderLeftWidth: 3,
    borderRadius: 12,
  },
  readCard: {
    opacity: 0.72,
  },
  notificationIcon: {
    width: 25,
    height: 25,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationIconText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  notificationCopy: {
    flex: 1,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
    color: '#27362b',
    fontSize: 11,
    fontWeight: '800',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#138a39',
  },
  notificationMessage: {
    color: '#58665b',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  notificationDate: {
    color: '#879188',
    fontSize: 8,
    marginTop: 6,
  },
  emptyText: {
    color: '#7b877d',
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 28,
  },
  errorText: {
    color: '#a43b34',
    fontSize: 10,
    lineHeight: 15,
    paddingVertical: 6,
  },
  pressed: {
    opacity: 0.78,
  },
});
