"use client";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { GloMark } from "@/components/Logo";

const FIELD_CLS =
  "w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none focus:ring-2 focus:ring-cy-400/20 placeholder-ink-500";

/** Centered card layout shared by the sign-in and sign-up screens. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex justify-center mb-8">
          <GloMark size={36} motion="assemble" />
        </Link>
        <div className="card p-7">
          <h1 className="text-xl font-semibold text-ink-50 mb-1">{title}</h1>
          <p className="text-sm text-ink-400 mb-6">{subtitle}</p>
          {children}
          {footer}
        </div>
      </div>
    </div>
  );
}

/** Labeled text input styled for the auth cards. */
export function AuthField({
  label,
  ...input
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">{label}</label>
      <input {...input} className={FIELD_CLS} />
    </div>
  );
}

/** Full-width submit button with a loading spinner. */
export function AuthSubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center disabled:opacity-50">
      {loading ? <Loader2 className="animate-spin" size={16} /> : label}
    </button>
  );
}
