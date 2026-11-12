import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type DashboardRole = 'admin' | 'business';

export function useDashboardRole() {
  const [dashboardRole, setDashboardRole] = useState<DashboardRole | null>(null);

  useEffect(() => {
    let active = true;
    let requestId = 0;

    async function checkAccess(userId: string | null) {
      const currentRequest = ++requestId;
      if (!userId) {
        setDashboardRole(null);
        return;
      }

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('auth_user_id', userId)
          .maybeSingle();
        if (profileError) throw profileError;

        if (profile?.role === 'admin') {
          if (active && currentRequest === requestId) setDashboardRole('admin');
          return;
        }

        if (profile?.role !== 'business') {
          if (active && currentRequest === requestId) setDashboardRole(null);
          return;
        }

        const { data: business, error: businessError } = await supabase
          .from('business_profiles')
          .select('approval_status')
          .eq('user_id', profile.id)
          .maybeSingle();
        if (businessError) throw businessError;

        if (active && currentRequest === requestId) {
          setDashboardRole(business?.approval_status === 'approved' ? 'business' : null);
        }
      } catch (error) {
        if (active && currentRequest === requestId) {
          setDashboardRole(null);
          console.error('Unable to verify dashboard navigation access.', error);
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void checkAccess(session?.user.id ?? null), 0);
    });

    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        await checkAccess(data.session?.user.id ?? null);
      } catch (error) {
        if (active) {
          setDashboardRole(null);
          console.error('Unable to load dashboard navigation access.', error);
        }
      }
    })();

    return () => {
      active = false;
      requestId += 1;
      subscription.unsubscribe();
    };
  }, []);

  return dashboardRole;
}
