"use client";
import { GloMark } from "./Logo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Layers, Megaphone, BarChart3, Settings } from "lucide-react";

const NAV = [
  { href: "/studio",     label: "Studio",     icon: Sparkles },
  { href: "/library",    label: "Library",    icon: Layers },
  { href: "/campaigns",  label: "Campaigns",  icon: Megaphone },
  { href: "/dashboard",  label: "Dashboard",  icon: BarChart3 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r border-line-900 bg-bg-900/40 backdrop-blur-sm flex flex-col">
        <div className="px-6 py-6 border-b border-line-900">
          <Link href="/" className="block"><GloMark size={32} /></Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-cy-400/10 text-cy-300 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.2)]"
                    : "text-ink-300 hover:text-ink-100 hover:bg-bg-700/40"
                }`}
              >
                <Icon size={16} strokeWidth={1.8} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-line-900 space-y-1">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-ink-300 hover:text-ink-100 hover:bg-bg-700/40"
          >
            <Settings size={16} strokeWidth={1.8} />
            Settings
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
