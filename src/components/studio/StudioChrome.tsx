"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function StudioChrome({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
      <Link href="/studio" className="inline-flex items-center gap-1.5 text-sm text-ink-300 hover:text-ink-50 mb-5">
        <ArrowLeft size={15} /> Studio
      </Link>
      <div className="mb-6">
        <p className="chip mb-3">{kicker}</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-ink-50 tracking-tight">{title}</h1>
        <p className="text-ink-400 mt-1.5 text-sm">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
