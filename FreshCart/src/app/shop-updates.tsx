import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/app-text';
import { BusinessNavTabs } from '@/components/business-nav-tabs';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { getErrorMessage } from '@/lib/errors';
import { fetchBusinessContext } from '@/lib/orders';
import { type ShopUpdate, type UpdateType, UPDATE_TYPES, updateTypeLabel } from '@/lib/shop-updates';
import { supabase } from '@/lib/supabase';

const TAGS = ['Onam', 'Vishu', 'Eid', 'Christmas', 'Weekend Sale'];

export default function ShopUpdatesScreen() {
  const [business, setBusiness] = useState<{ id: string; name: string } | null>(null);
  const [posts, setPosts] = useState<ShopUpdate[]>([]);
  const [followers, setFollowers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<UpdateType>('daily_update');
  const [tag, setTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<ShopUpdate | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      setBusiness(null);
      setPosts([]);
      setTitle('');
      setDescription('');
      setTag('');
      setTimeout(() => { if (active) setReload((n) => n + 1); }, 0);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      setBusiness(null);
      try {
        const context = await fetchBusinessContext();
        if (context.kind !== 'ready') {
          if (active) setError('Sign in with an approved business account to manage updates.');
          return;
        }
        const countResult = await supabase.from('shop_followers').select('id', { count: 'exact', head: true }).eq('business_id', context.businessId);
        if (countResult.error) throw countResult.error;
        const rows: ShopUpdate[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error: postError } = await supabase.from('shop_updates')
            .select('id, business_id, title, description, update_type, festival_tag, image_url, valid_until, is_active, created_at')
            .eq('business_id', context.businessId).order('created_at', { ascending: false })
            .order('id').range(offset, offset + 499);
          if (postError) throw postError;
          rows.push(...((data ?? []) as ShopUpdate[]));
          if (!data || data.length < 500) break;
        }
        if (active) {
          setBusiness({ id: context.businessId, name: context.businessName });
          setPosts(rows);
          setFollowers(countResult.count ?? 0);
        }
      } catch (err) {
        if (active) setError(getErrorMessage(err, 'Unable to load your updates.'));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  // Reload intentionally re-runs the focused screen's request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]));

  async function createPost() {
    if (!business || busy) return;
    if (!title.trim()) {
      setError('Please enter a title.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data, error: saveError } = await supabase.from('shop_updates').insert({
        business_id: business.id, title: title.trim(), description: description.trim() || null,
        update_type: type, festival_tag: tag || null, is_active: true,
      }).select('id, business_id, title, description, update_type, festival_tag, image_url, valid_until, is_active, created_at').single();
      if (saveError) throw saveError;
      setPosts((previous) => [data as ShopUpdate, ...previous]);
      setTitle('');
      setDescription('');
      setTag('');
      setType('daily_update');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to post your update.'));
    } finally {
      setBusy(false);
    }
  }

  async function changePost(post: ShopUpdate, remove: boolean) {
    if (!business || busy) return;
    setBusy(true);
    setError('');
    try {
      const query = supabase.from('shop_updates');
      const result = remove
        ? await query.delete().eq('id', post.id).eq('business_id', business.id).select('id')
        : await query.update({ is_active: !post.is_active }).eq('id', post.id).eq('business_id', business.id)
          .select('id, business_id, title, description, update_type, festival_tag, image_url, valid_until, is_active, created_at');
      if (result.error) throw result.error;
      if (!result.data?.length) throw new Error('The update was not changed. Refresh and check your permissions.');
      if (remove) setPosts((previous) => previous.filter((item) => item.id !== post.id));
      else setPosts((previous) => previous.map((item) => item.id === post.id ? { ...item, is_active: !post.is_active } : item));
      setDeleting(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to change this update.'));
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <BusinessNavTabs active="updates" />
        <Text style={styles.eyebrow}>BUSINESS STUDIO</Text>
        <Text style={styles.title}>Today&apos;s Update</Text>
        <Text style={styles.subtitle}>{business ? `${business.name} · ${followers} followers` : 'Share news with your customers.'}</Text>
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        {loading ? <Text style={styles.subtitle}>Loading your updates…</Text> : !business ? (
          <View style={styles.row}>
            <Pressable onPress={() => setReload((n) => n + 1)}><Text style={styles.link}>Try again</Text></Pressable>
            <Pressable onPress={() => router.replace('/')}><Text style={styles.link}>Back to home</Text></Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.section}>Create an update</Text>
              <Text style={styles.label}>Title *</Text>
              <TextInput accessibilityLabel="Update title" value={title} onChangeText={setTitle}
                placeholder="Fresh organic vegetables arrived!" placeholderTextColor="#8b958d" style={styles.input} />
              <Text style={styles.label}>Update type</Text>
              <View style={styles.row}>
                {UPDATE_TYPES.map((item) => (
                  <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: type === item.value }}
                    onPress={() => setType(item.value)} style={[styles.chip, type === item.value && styles.chipSelected]}>
                    <Text style={[styles.chipText, type === item.value && styles.chipTextSelected]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Festival or sale tag (optional)</Text>
              <View style={styles.row}>
                {TAGS.map((item) => (
                  <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: tag === item }}
                    onPress={() => setTag(tag === item ? '' : item)} style={[styles.chip, tag === item && styles.chipSelected]}>
                    <Text style={[styles.chipText, tag === item && styles.chipTextSelected]}>{item}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Description (optional)</Text>
              <TextInput accessibilityLabel="Update description" value={description} onChangeText={setDescription}
                placeholder="Tell customers more…" placeholderTextColor="#8b958d" multiline style={[styles.input, styles.descriptionInput]} />
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void createPost()} style={[styles.primary, busy && styles.disabled]}>
                <Text style={styles.primaryText}>{busy ? 'Saving…' : 'Post update'}</Text>
              </Pressable>
            </View>
            <Text style={styles.section}>Your posts</Text>
            {posts.length === 0 ? <Text style={styles.subtitle}>You haven&apos;t posted an update yet.</Text> : posts.map((post) => (
              <View key={post.id} style={styles.card}>
                <Text style={styles.meta}>{updateTypeLabel(post.update_type)}{post.festival_tag ? ` · ${post.festival_tag}` : ''} · {post.is_active ? 'Active' : 'Inactive'}</Text>
                <Text style={styles.postTitle}>{post.title}</Text>
                {post.description ? <Text style={styles.subtitle}>{post.description}</Text> : null}
                {post.valid_until ? <Text style={styles.subtitle}>Valid until {new Date(post.valid_until).toLocaleString()}</Text> : null}
                <View style={styles.row}>
                  <Pressable disabled={busy} onPress={() => void changePost(post, false)} style={styles.chip}>
                    <Text style={styles.chipText}>{post.is_active ? 'Deactivate' : 'Activate'}</Text>
                  </Pressable>
                  <Pressable disabled={busy} onPress={() => setDeleting(post)} style={styles.chip}>
                    <Text style={styles.error}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
      <ConfirmDialog visible={Boolean(deleting)} title="Delete update?" message="This update will be permanently removed."
        confirmLabel="Delete" destructive loading={busy} onCancel={() => setDeleting(null)}
        onConfirm={() => { if (deleting) void changePost(deleting, true); }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7faf6' },
  page: { width: '100%', maxWidth: 850, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 110, gap: 12 },
  eyebrow: { color: '#138a39', fontWeight: '700', fontSize: 11, marginTop: 8 },
  title: { color: '#17331e', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#68756b', fontSize: 13 },
  section: { color: '#17331e', fontSize: 17, fontWeight: '800' },
  card: { padding: 18, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3ebe1', gap: 9 },
  label: { color: '#425146', fontWeight: '700', fontSize: 12, marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#dce4dd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#17331e', fontFamily: 'Poppins_400Regular', fontSize: 13 },
  descriptionInput: { minHeight: 75, textAlignVertical: 'top' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#cfe2d1', backgroundColor: '#ffffff' },
  chipSelected: { backgroundColor: '#138a39', borderColor: '#138a39' },
  chipText: { color: '#07552c', fontSize: 12, fontWeight: '700' },
  chipTextSelected: { color: '#ffffff' },
  primary: { alignSelf: 'flex-start', borderRadius: 22, backgroundColor: '#138a39', paddingHorizontal: 20, paddingVertical: 11, marginTop: 5 },
  primaryText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.6 },
  meta: { color: '#138a39', fontSize: 11, fontWeight: '700' },
  postTitle: { color: '#17331e', fontSize: 15, fontWeight: '700' },
  error: { color: '#a42d26', fontSize: 12 },
  link: { color: '#138a39', fontSize: 13, fontWeight: '700' },
});
