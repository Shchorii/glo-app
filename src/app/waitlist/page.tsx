"use client";
import { WAITLIST_ENDPOINT } from "@/lib/endpoints";
import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GloMark } from "@/components/Logo";
import { Loader2, CheckCircle2 } from "lucide-react";

const ADVERTISER_TYPES = ["Individual", "Business"] as const;

const BUSINESS_SIZES = ["Solo", "1-10", "11-50", "50+"] as const;


const selectCls =
  "w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/20 appearance-none";
const inputCls =
  "w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/20";
const labelCls = "block text-xs uppercase tracking-wider text-ink-400 mb-1.5";

function WaitlistForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [advertiserType, setAdvertiserType] = useState("");
  const [businessSize, setBusinessSize] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [campaignId, setCampaignId] = useState("organic");

  useEffect(() => {
    const c = searchParams.get("campaign");
    if (c) setCampaignId(c);
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(WAITLIST_ENDPOINT ?? "/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          phone: phone || undefined,
          advertiser_type: advertiserType,
          business_size: businessSize
          campaign_id: campaignId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error || "Something went wrong"
        );
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="w-full max-w-sm text-center space-y-6">
        <Link href="/" className="flex justify-center">
          <GloMark size={36} motion="assemble" />
        </Link>
        <div className="card p-8 space-y-4">
          <CheckCircle2 className="mx-auto text-lime-400" size={48} />
          <h1 className="text-2xl font-semibold text-ink-50">
            You&apos;re on the waitlist!
          </h1>
          <p className="text-sm text-ink-300">We&apos;ll be in touch.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <Link href="/" className="flex justify-center mb-8">
        <GloMark size={36} motion="assemble" />
      </Link>
      <div className="card p-7">
        <h1 className="text-xl font-semibold text-ink-50 mb-1">
          Join the waitlist
        </h1>
        <p className="text-sm text-ink-400 mb-6">
          Be first to light up your neighborhood with Glo.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls}
              placeholder="+1 (555) 000-0000"
            />
          </div>
          <div>
            <label className={labelCls}>I am a… *</label>
            <select
              required
              value={advertiserType}
              onChange={(e) => setAdvertiserType(e.target.value)}
              className={selectCls}
            >
              <option value="" disabled>
                Select type
              </option>
              {ADVERTISER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Business size *</label>
            <select
              required
              value={businessSize}
              onChange={(e) => setBusinessSize(e.target.value)}
              className={selectCls}
            >
              <option value="" disabled>
                Select size
              </option>
              {BUSINESS_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-lime w-full justify-center disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              "Get early access"
            )}
          </button>
        </form>
        <p className="text-xs text-ink-500 mt-5 text-center">
          No spam — just early access when we launch in your area.
        </p>
      </div>
    </div>
  );
}

export default function WaitlistPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <Suspense>
        <WaitlistForm />
      </Suspense>
    </div>
  );
}
