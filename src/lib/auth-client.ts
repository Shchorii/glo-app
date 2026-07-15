"use client";
import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: Error | null;
};

/** Reactive Supabase session. loading=true until the first auth event resolves. */
export function useSession(): AuthState {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: isSupabaseConfigured,
    error: null,
  });

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let active = true;
    sb.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setState({ session: null, user: null, loading: false, error });
          return;
        }
        setState({
          session: data.session,
          user: data.session?.user ?? null,
          loading: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          session: null,
          user: null,
          loading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setState({ session, user: session?.user ?? null, loading: false, error: null });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Sign-out is not configured in this build.");
  const { error } = await sb.auth.signOut();
  if (error) throw error;
}
