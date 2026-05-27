"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import { GloMark } from "@/components/Logo";
import { Loader2 } from "lucide-react";

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
    const res = await signUp.email({ name, email, password });
    setLoading(false);
    if (res?.error) {
      setError(res.error.message || "Couldn't create account");
      return;
    }
    router.push("/studio");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex justify-center mb-8"><GloMark size={36} /></Link>
        <div className="card p-7">
          <h1 className="text-xl font-semibold text-ink-50 mb-1">Create account</h1>
          <p className="text-sm text-ink-400 mb-6">Light up your first neighborhood.</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Name</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none focus:ring-2 focus:ring-cy-400/20"
                placeholder="Idan" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none focus:ring-2 focus:ring-cy-400/20"
                placeholder="you@brand.com" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Password</label>
              <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none focus:ring-2 focus:ring-cy-400/20"
                placeholder="At least 8 characters" />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={16} /> : "Create account"}
            </button>
          </form>
          <p className="text-sm text-ink-400 mt-5 text-center">
            Already have one? <Link href="/sign-in" className="text-cy-300 hover:text-cy-200">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
