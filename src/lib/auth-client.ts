"use client";
import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

/** Reactive Supabase session. loading=true until the first auth event resolves. */
export function useSession(): AuthState {
  const [state, setState] = useState<AuthState>({ session: null, user: null, loading: isSupabaseConfigured });

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      setState({ session: data.session, user: data.session?.user ?? null, loading: false });
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setState({ session, user: session?.user ?? null, loading: false });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return state;
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
}
