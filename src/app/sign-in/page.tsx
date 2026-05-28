"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import { GloMark } from "@/components/Logo";
import { Loader2 } from "lucide-react";

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

    // Try owner-bypass login first (single-user demo gate)
    const ownerRes = await fetch("/api/owner-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (ownerRes.ok) {
      router.push(nextUrl);
      return;
    }

    // Fall back to Better-Auth (DB-backed)
    const res = await signIn.email({ email, password });
    setLoading(false);
    if (res?.error) {
      setError(res.error.message || "Invalid credentials");
      return;
    }
    router.push(nextUrl);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none focus:ring-2 focus:ring-cy-400/20 placeholder-ink-500"
          placeholder="you@brand.com" />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Password</label>
        <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none focus:ring-2 focus:ring-cy-400/20 placeholder-ink-500"
          placeholder="••••••••" />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center disabled:opacity-50">
        {loading ? <Loader2 className="animate-spin" size={16} /> : "Sign in"}
      </button>
    </form>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex justify-center mb-8"><GloMark size={36} motion="assemble" /></Link>
        <div className="card p-7">
          <h1 className="text-xl font-semibold text-ink-50 mb-1">Sign in</h1>
          <p className="text-sm text-ink-400 mb-6">Welcome back to your campaigns.</p>
          <Suspense fallback={<div className="text-sm text-ink-400">Loading...</div>}>
            <SignInForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
