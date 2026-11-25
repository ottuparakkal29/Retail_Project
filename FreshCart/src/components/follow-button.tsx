import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/app-text';
import { useFollows } from '@/contexts/follow-context';
import { useNavigationState } from '@/contexts/navigation-context';

export function FollowButton({ businessId, shopName }: { businessId: string; shopName: string }) {
  const { userId, isCustomer, followed, loading, error, busyId, refresh, toggle } = useFollows();
  const { setAuthRequest } = useNavigationState();
  const isFollowing = followed.has(businessId);
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${isFollowing ? 'Unfollow' : 'Follow'} ${shopName}`}
        accessibilityState={{ selected: isFollowing, disabled: loading || Boolean(busyId), busy: busyId === businessId }}
        disabled={loading || Boolean(busyId)}
        onPress={(event) => {
          event.stopPropagation();
          if (!userId) {
            setAuthRequest('login');
            router.push('/');
          } else if (error) {
            void refresh();
          } else if (isCustomer) {
            void toggle(businessId);
          }
        }}
        style={[styles.button, isFollowing && styles.following, (loading || busyId) && styles.disabled]}>
        <Text style={[styles.text, isFollowing && styles.followingText]}>
          {loading ? 'Loading…' : busyId === businessId ? 'Saving…' : error ? 'Retry follow' : isFollowing ? 'Following ✓' : 'Follow +'}
        </Text>
      </Pressable>
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : userId && !loading && !isCustomer ? (
        <Text style={styles.error}>Customer account required to follow.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'flex-start', marginTop: 10, maxWidth: '100%' },
  button: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#138a39' },
  following: { backgroundColor: '#eaf5eb', borderWidth: 1, borderColor: '#9ac9a2' },
  text: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
  followingText: { color: '#07552c' },
  disabled: { opacity: 0.6 },
  error: { color: '#a42d26', fontSize: 11, marginTop: 4 },
});
