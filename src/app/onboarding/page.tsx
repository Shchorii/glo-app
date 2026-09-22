"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth-client";
import { GloMark } from "@/components/Logo";

const CATEGORIES = ["Restaurant or café", "Retail store", "Fitness or wellness", "Beauty or salon", "Health or clinic",
  "Real estate", "Events or entertainment", "Professional services", "Other"];
const BUDGETS = ["Under $500", "$500 to $2,000", "$2,000 to $10,000", "$10,000+", "Not sure yet"];
const GOALS = ["More foot traffic", "Promote a launch or offer", "Get known in the area", "Fill an event", "Hiring", "Other"];
const LOCATIONS = ["1", "2 to 5", "6 to 20", "20+", "Online only"];
const SOURCES = ["Google search", "Social media", "Saw a Glo screen", "Friend or colleague", "Event", "Other"];

const input = "w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none focus:ring-2 focus:ring-cy-400/20 placeholder-ink-500";
const label = "block text-xs uppercase tracking-wider text-ink-400 mb-1.5";

function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)}
          className={`px-3 py-1.5 rounded-full text-sm border transition ${value === o
            ? "bg-cy-400/15 border-cy-400 text-cy-200" : "bg-bg-900 border-line-800 text-ink-200 hover:border-ink-400"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

type Form = {
  full_name: string; business_name: string; job_title: string; phone: string; website: string;
  business_category: string; business_zip: string; locations_count: string; monthly_budget: string;
  primary_goal: string; referral_source: string; marketing_opt_in: boolean; terms: boolean;
};

function OnboardingForm() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("next") || "/studio";
  const next = raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/onboarding") ? raw : "/studio";
  const { user, loading } = useSession();
  const [f, setF] = useState<Form>({
    full_name: "", business_name: "", job_title: "", phone: "", website: "", business_category: "",
    business_zip: "", locations_count: "", monthly_budget: "", primary_goal: "", referral_source: "",
    marketing_opt_in: false, terms: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  // Signed out → sign in first. Prefill what we already know (SSO name, earlier answers).
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace(`/sign-in?next=${encodeURIComponent(`/onboarding?next=${encodeURIComponent(next)}`)}`); return; }
    const sb = getSupabase();
    sb?.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.onboarded_at) { router.replace(next); return; }
      const meta = user.user_metadata ?? {};
      setF((p) => ({
        ...p,
        full_name: data?.full_name || meta.full_name || meta.name || "",
        business_name: data?.business_name || "",
        phone: data?.phone || "", website: data?.website || "", job_title: data?.job_title || "",
        business_category: data?.business_category || "", business_zip: data?.business_zip || "",
      }));
    });
  }, [user, loading, router, next]);

  const missing = [
    !f.full_name.trim() && "your name", !f.business_name.trim() && "business name",
    !f.business_category && "business type", !/^\d{5}$/.test(f.business_zip.trim()) && "a 5-digit ZIP",
    !f.monthly_budget && "monthly budget", !f.primary_goal && "main goal", !f.terms && "accepting the terms",
  ].filter(Boolean) as string[];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (missing.length) { setError(`Please add ${missing.join(", ")}.`); return; }
    const sb = getSupabase();
    if (!sb || !user) return;
    setSaving(true); setError(null);
    const now = new Date().toISOString();
    const site = f.website.trim();
    const { error } = await sb.from("profiles").update({
      full_name: f.full_name.trim(), business_name: f.business_name.trim(), job_title: f.job_title.trim() || null,
      phone: f.phone.trim() || null, website: site ? (/^https?:\/\//i.test(site) ? site : `https://${site}`) : null,
      business_category: f.business_category, business_zip: f.business_zip.trim(),
      locations_count: f.locations_count || null, monthly_budget: f.monthly_budget, primary_goal: f.primary_goal,
      referral_source: f.referral_source || null, marketing_opt_in: f.marketing_opt_in,
      terms_accepted_at: now, onboarded_at: now,
    }).eq("id", user.id);
    setSaving(false);
    if (error) { setError(error.message || "Could not save. Please try again."); return; }
    router.replace(next);
  }

  if (loading || !user) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-ink-400" size={20} /></div>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-ink-50">About you</h2>
        <div>
          <label className={label}>Full name *</label>
          <input className={input} value={f.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Dana Levi" autoComplete="name" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Your role</label>
            <input className={input} value={f.job_title} onChange={(e) => set("job_title", e.target.value)} placeholder="Owner, marketing lead..." autoComplete="organization-title" />
          </div>
          <div>
            <label className={label}>Phone</label>
            <input className={input} type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 123-4567" autoComplete="tel" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-ink-50">Your business</h2>
        <div>
          <label className={label}>Business name *</label>
          <input className={input} value={f.business_name} onChange={(e) => set("business_name", e.target.value)} placeholder="Johnny's Pizza" autoComplete="organization" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Website</label>
            <input className={input} value={f.website} onChange={(e) => set("website", e.target.value)} placeholder="yourbusiness.com" autoComplete="url" inputMode="url" />
          </div>
          <div>
            <label className={label}>Business ZIP *</label>
            <input className={input} value={f.business_zip} onChange={(e) => set("business_zip", e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="11211" inputMode="numeric" autoComplete="postal-code" />
          </div>
        </div>
        <div>
          <label className={label}>Business type *</label>
          <Chips options={CATEGORIES} value={f.business_category} onChange={(v) => set("business_category", v)} />
        </div>
        <div>
          <label className={label}>Number of locations</label>
          <Chips options={LOCATIONS} value={f.locations_count} onChange={(v) => set("locations_count", v)} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-ink-50">Your goals</h2>
        <div>
          <label className={label}>Main goal *</label>
          <Chips options={GOALS} value={f.primary_goal} onChange={(v) => set("primary_goal", v)} />
        </div>
        <div>
          <label className={label}>Monthly budget *</label>
          <Chips options={BUDGETS} value={f.monthly_budget} onChange={(v) => set("monthly_budget", v)} />
        </div>
        <div>
          <label className={label}>How did you hear about Glo?</label>
          <Chips options={SOURCES} value={f.referral_source} onChange={(v) => set("referral_source", v)} />
        </div>
      </section>

      <section className="space-y-3">
        <label className="flex items-start gap-3 text-sm text-ink-200 cursor-pointer">
          <input type="checkbox" checked={f.terms} onChange={(e) => set("terms", e.target.checked)} className="mt-0.5 accent-cyan-400" />
          <span>I agree to the <a href="https://we-are-glo.com/terms" target="_blank" rel="noreferrer" className="text-cy-300 hover:text-cy-200">Advertiser Terms</a> and <a href="https://we-are-glo.com/privacy" target="_blank" rel="noreferrer" className="text-cy-300 hover:text-cy-200">Privacy Policy</a>. *</span>
        </label>
        <label className="flex items-start gap-3 text-sm text-ink-200 cursor-pointer">
          <input type="checkbox" checked={f.marketing_opt_in} onChange={(e) => set("marketing_opt_in", e.target.checked)} className="mt-0.5 accent-cyan-400" />
          <span>Send me tips and offers by email. You can unsubscribe anytime.</span>
        </label>
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={saving} className="btn btn-primary w-full justify-center disabled:opacity-50">
        {saving ? <Loader2 className="animate-spin" size={16} /> : "Continue"}
      </button>
    </form>
  );
}

export default function OnboardingPage() {
  return (
    <div className="min-h-screen flex items-start sm:items-center justify-center px-5 py-10">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-6"><GloMark size={32} motion="assemble" /></div>
        <div className="card p-6 sm:p-7">
          <h1 className="text-xl font-semibold text-ink-50 mb-1">Tell us about your business</h1>
          <p className="text-sm text-ink-400 mb-6">One minute, so we can match you with the right screens nearby.</p>
          <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="animate-spin text-ink-400" size={20} /></div>}>
            <OnboardingForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
