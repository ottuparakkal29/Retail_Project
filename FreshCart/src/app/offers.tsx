import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/app-text';
import { KeralaLocationSelectors } from '@/components/kerala-location-selectors';
import { useFollows } from '@/contexts/follow-context';
import { useNavigationState } from '@/contexts/navigation-context';
import { useKeralaLocations } from '@/hooks/use-kerala-locations';
import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';
import { getErrorMessage } from '@/lib/errors';
import { filterShopUpdates, joinShopUpdates, type FeedItem, type ShopUpdate, type UpdateShop, updateTypeLabel } from '@/lib/shop-updates';
import { supabase } from '@/lib/supabase';

export default function OffersScreen() {
  const { district, setDistrict, taluk, setTaluk, village, setVillage, setAuthRequest } = useNavigationState();
  const { locations, loading: locationsLoading, error: locationsError } = useKeralaLocations();
  const { userId, isCustomer, followed, loading: followsLoading, error: followsError, refresh } = useFollows();
  const isTablet = useResponsiveBreakpoint(600);
  const [filter, setFilter] = useState<'all' | 'followed'>('all');
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    async function load() {
      setLoading(true);
      setError('');
      try {
        const rows: ShopUpdate[] = [];
        const asOf = new Date().toISOString();
        for (let offset = 0; ; offset += 500) {
          const { data, error: updateError } = await supabase.from('shop_updates')
            .select('id, business_id, title, description, update_type, festival_tag, image_url, valid_until, is_active, created_at')
            .eq('is_active', true).or(`valid_until.is.null,valid_until.gte.${asOf}`)
            .order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
          if (updateError) throw updateError;
          rows.push(...((data ?? []) as ShopUpdate[]));
          if (!data || data.length < 500) break;
        }
        const ids = [...new Set(rows.map((item) => item.business_id))];
        const shops: UpdateShop[] = [];
        for (let offset = 0; offset < ids.length; offset += 100) {
          const { data, error: shopError } = await supabase.from('business_profiles')
            .select('id, business_name, district, taluk, village')
            .eq('approval_status', 'approved').in('id', ids.slice(offset, offset + 100));
          if (shopError) throw shopError;
          shops.push(...((data ?? []) as UpdateShop[]));
        }
        const joined = joinShopUpdates(rows, shops);
        if (active) setItems(joined);
      } catch (err) {
        if (active) setError(getErrorMessage(err, 'Unable to load shop updates.'));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; clearInterval(timer); };
  // Reload intentionally re-runs the focused screen's request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]));

  const visible = filterShopUpdates(items, {
    district, taluk, village, followed: filter === 'followed' ? followed : null, now,
  });

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.eyebrow}>SHOP LOCAL</Text>
        <Text style={styles.title}>Today&apos;s Updates</Text>
        <Text style={styles.subtitle}>Discover news, arrivals and offers from local shops.</Text>
        <View style={styles.filters}>
          <KeralaLocationSelectors locations={locations} district={district} taluk={taluk} village={village}
            onDistrictChange={setDistrict} onTalukChange={setTaluk} onVillageChange={setVillage}
            includeAllOptions direction={isTablet ? 'row' : 'column'} disabled={locationsLoading || Boolean(locationsError)} />
          {locationsError ? <Text style={styles.error}>Unable to load locations: {locationsError}</Text> : null}
        </View>
        <View style={styles.chips}>
          {([['all', 'All Nearby Shops'], ['followed', 'Followed Shops']] as const).map(([value, label]) => (
            <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }}
              onPress={() => setFilter(value)} style={[styles.chip, filter === value && styles.chipSelected]}>
              <Text style={[styles.chipText, filter === value && styles.chipTextSelected]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {loading ? <Text style={styles.subtitle}>Loading updates…</Text> : error ? (
          <View><Text style={styles.error}>{error}</Text><Pressable onPress={() => setReload((n) => n + 1)}><Text style={styles.link}>Try again</Text></Pressable></View>
        ) : filter === 'followed' && followsLoading ? <Text style={styles.subtitle}>Loading followed shops…</Text>
          : filter === 'followed' && followsError ? (
            <View><Text style={styles.error}>{followsError}</Text><Pressable onPress={() => void refresh()}><Text style={styles.link}>Try again</Text></Pressable></View>
          ) : filter === 'followed' && !userId ? (
            <View><Text style={styles.subtitle}>Sign in to see updates from followed shops.</Text>
              <Pressable onPress={() => { setAuthRequest('login'); router.push('/'); }}><Text style={styles.link}>Sign in</Text></Pressable></View>
          ) : filter === 'followed' && !isCustomer ? <Text style={styles.subtitle}>A customer account is required to follow shops.</Text>
            : visible.length === 0 ? <Text style={styles.subtitle}>No updates found for these filters.</Text>
              : visible.map(({ update, shop }) => (
                <Pressable key={update.id} accessibilityRole="link" accessibilityLabel={`View ${shop.business_name}: ${update.title}`}
                  onPress={() => router.push({ pathname: '/shop', params: { id: shop.id } })} style={styles.card}>
                  <Text style={styles.badge}>{updateTypeLabel(update.update_type)}{update.festival_tag ? ` · ${update.festival_tag}` : ''}</Text>
                  <Text style={styles.cardTitle}>{update.title}</Text>
                  {update.description ? <Text style={styles.description}>{update.description}</Text> : null}
                  <Text style={styles.shop}>{shop.business_name} · {[shop.village, shop.taluk, shop.district].filter(Boolean).join(', ') || 'Kerala'}</Text>
                  <Text style={styles.link}>Visit shop →</Text>
                </Pressable>
              ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7faf6' },
  page: { width: '100%', maxWidth: 1050, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 28, paddingBottom: 110, gap: 14 },
  eyebrow: { color: '#138a39', fontWeight: '700', fontSize: 11 },
  title: { color: '#17331e', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#68756b', fontSize: 13 },
  filters: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e3ebe1' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: '#cfe2d1', backgroundColor: '#ffffff' },
  chipSelected: { backgroundColor: '#138a39', borderColor: '#138a39' },
  chipText: { color: '#07552c', fontSize: 12, fontWeight: '700' },
  chipTextSelected: { color: '#ffffff' },
  card: { padding: 18, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3ebe1', gap: 6 },
  badge: { color: '#138a39', fontSize: 11, fontWeight: '700' },
  cardTitle: { color: '#17331e', fontSize: 17, fontWeight: '800' },
  description: { color: '#425146', fontSize: 13 },
  shop: { color: '#68756b', fontSize: 12 },
  link: { color: '#138a39', fontWeight: '700', fontSize: 12, marginTop: 5 },
  error: { color: '#a42d26', fontSize: 12, marginTop: 5 },
});
