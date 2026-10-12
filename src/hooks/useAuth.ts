import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getCurrentAdmin } from '@/services/authService';
import type { Admin } from '@/types';

interface AuthState {
  session: Session | null;
  admin: Admin | null;
  loading: boolean;
}

export function useAuth(): AuthState & {
  refreshAdmin: () => Promise<void>;
} {
  const [state, setState] = useState<AuthState>({
    session: null,
    admin: null,
    loading: true,
  });

  const refreshAdmin = useCallback(async () => {
    const admin = await getCurrentAdmin();
    setState((prev) => ({ ...prev, admin }));
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;

      if (session) {
        const admin = await getCurrentAdmin();
        if (mounted) {
          setState({ session, admin, loading: false });
        }
      } else {
        if (mounted) {
          setState({ session: null, admin: null, loading: false });
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session) {
          const admin = await getCurrentAdmin();
          if (mounted) {
            setState({ session, admin, loading: false });
          }
        } else {
          if (mounted) {
            setState({ session: null, admin: null, loading: false });
          }
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { ...state, refreshAdmin };
}
