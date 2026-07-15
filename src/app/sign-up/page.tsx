"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { AuthShell, AuthField, AuthSubmitButton } from "@/components/AuthForm";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const sb = getSupabase();
    if (!sb) { setLoading(false); setError("Sign-up is not configured in this build."); return; }
    const { error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name } } });
    setLoading(false);
    if (error) { setError(error.message || "Could not create account"); return; }
    router.push("/studio");
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="Light up your first neighborhood."
      footer={
        <p className="text-sm text-ink-400 mt-5 text-center">
          Already have one? <Link href="/sign-in" className="text-cy-300 hover:text-cy-200">Sign in</Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <AuthField label="Name" type="text" required value={name}
          onChange={(e) => setName(e.target.value)} placeholder="Idan" />
        <AuthField label="Email" type="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@brand.com" />
        <AuthField label="Password" type="password" required minLength={6} value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <AuthSubmitButton loading={loading} label="Create account" />
      </form>
    </AuthShell>
  );
}
