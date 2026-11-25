import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

type FollowContextValue = {
  userId: string | null;
  isCustomer: boolean;
  followed: Set<string>;
  loading: boolean;
  error: string;
  busyId: string | null;
  refresh: () => Promise<void>;
  toggle: (businessId: string) => Promise<void>;
};

const FollowContext = createContext<FollowContextValue | null>(null);

export function FollowProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isCustomer, setIsCustomer] = useState(false);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const generation = useRef(0);
  const identity = useRef<string | null>(null);
  const busy = useRef(false);

  const load = useCallback(async (id: string | null) => {
    const request = ++generation.current;
    identity.current = id;
    setUserId(id);
    setIsCustomer(false);
    setFollowed(new Set());
    setError('');
    setLoading(true);
    try {
      if (!id) return;
      const { data: profile, error: profileError } = await supabase
        .from('profiles').select('role').eq('auth_user_id', id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) throw new Error('Your customer profile could not be found.');
      if (profile.role !== 'customer') return;
      const ids: string[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error: followError } = await supabase.from('shop_followers')
          .select('business_id').eq('customer_id', id).order('business_id').range(offset, offset + 499);
        if (followError) throw followError;
        ids.push(...(data ?? []).map((row) => row.business_id as string));
        if (!data || data.length < 500) break;
      }
      if (request === generation.current) {
        setIsCustomer(true);
        setFollowed(new Set(ids));
      }
    } catch (err) {
      if (request === generation.current) setError(getErrorMessage(err, 'Unable to load followed shops.'));
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;
      setTimeout(() => { if (active) void load(session?.user.id ?? null); }, 0);
    });
    return () => {
      active = false;
      generation.current += 1;
      subscription.unsubscribe();
    };
  }, [load]);

  const refresh = useCallback(() => load(identity.current), [load]);
  const toggle = useCallback(async (businessId: string) => {
    if (!userId || !isCustomer || busy.current) return;
    const request = generation.current;
    busy.current = true;
    setBusyId(businessId);
    setError('');
    try {
      const result = followed.has(businessId)
        ? await supabase.from('shop_followers').delete().eq('customer_id', userId).eq('business_id', businessId).select('business_id')
        : await supabase.from('shop_followers').insert({ customer_id: userId, business_id: businessId }).select('business_id');
      if (result.error) throw result.error;
      if (!result.data?.length) throw new Error('The follow change was not saved. Check your permissions.');
      if (request === generation.current) {
        setFollowed((previous) => {
          const next = new Set(previous);
          if (next.has(businessId)) next.delete(businessId);
          else next.add(businessId);
          return next;
        });
      }
    } catch (err) {
      if (request === generation.current) setError(getErrorMessage(err, 'Unable to change follow status.'));
    } finally {
      busy.current = false;
      setBusyId(null);
    }
  }, [userId, isCustomer, followed]);

  return (
    <FollowContext.Provider value={{ userId, isCustomer, followed, loading, error, busyId, refresh, toggle }}>
      {children}
    </FollowContext.Provider>
  );
}

export function useFollows() {
  const context = useContext(FollowContext);
  if (!context) throw new Error('useFollows must be used within FollowProvider');
  return context;
}
