"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { AuthShell, AuthField, AuthSubmitButton } from "@/components/AuthForm";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextUrl = params.get("next") || "/studio";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const sb = getSupabase();
    if (!sb) { setLoading(false); setError("Sign-in is not configured in this build."); return; }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message || "Invalid credentials"); return; }
    router.push(nextUrl);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <AuthField label="Email" type="email" required value={email}
        onChange={(e) => setEmail(e.target.value)} placeholder="you@brand.com" />
      <AuthField label="Password" type="password" required minLength={6} value={password}
        onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <AuthSubmitButton loading={loading} label="Sign in" />
    </form>
  );
}

export default function SignInPage() {
  return (
    <AuthShell title="Sign in" subtitle="Welcome back to your campaigns.">
      <Suspense fallback={<div className="text-sm text-ink-400">Loading...</div>}>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
