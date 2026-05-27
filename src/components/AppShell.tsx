"use client";
import { GloMark } from "./Logo";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Sparkles, Layers, Megaphone, BarChart3, Settings, Menu, X, LogOut } from "lucide-react";

const NAV = [
  { href: "/studio",    label: "Studio",    icon: Sparkles },
  { href: "/library",   label: "Library",   icon: Layers },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
];

function NavItems({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg text-[15px] transition-colors ${
              active
                ? "bg-cy-400/10 text-cy-300 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.2)]"
                : "text-ink-200 hover:text-ink-50 hover:bg-bg-700/40"
            }`}
          >
            <Icon size={18} strokeWidth={1.8} />
            {label}
          </Link>
        );
      })}
    </>
  );
}

function FooterItems({ pathname, onNavigate, onSignOut }: { pathname: string; onNavigate?: () => void; onSignOut: () => void }) {
  const settingsActive = pathname === "/settings" || pathname.startsWith("/settings/");
  return (
    <div className="space-y-1">
      <Link
        href="/settings"
        onClick={onNavigate}
        className={`flex items-center gap-3 px-3 py-3 rounded-lg text-[15px] ${
          settingsActive ? "bg-cy-400/10 text-cy-300" : "text-ink-200 hover:text-ink-50 hover:bg-bg-700/40"
        }`}
      >
        <Settings size={18} strokeWidth={1.8} />
        Settings
      </Link>
      <button
        type="button"
        onClick={onSignOut}
        className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-[15px] text-ink-300 hover:text-ink-50 hover:bg-bg-700/40"
      >
        <LogOut size={18} strokeWidth={1.8} />
        Sign out
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (drawerOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  async function signOut() {
    await fetch("/api/owner-logout", { method: "POST" });
    // Also clear better-auth session if any (no-op if not signed in there)
    try { await fetch("/api/auth/sign-out", { method: "POST" }); } catch {}
    router.push("/sign-in");
  }

  return (
    <div className="min-h-screen md:flex">
      {/* MOBILE — top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-bg-950/80 backdrop-blur border-b border-line-900">
        <Link href="/" className="flex items-center"><GloMark size={26} /></Link>
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          className="-mr-2 p-2 rounded-lg text-ink-100 hover:bg-bg-700/40"
        >
          <Menu size={22} strokeWidth={1.8} />
        </button>
      </header>

      {/* MOBILE — drawer overlay */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-bg-950/70 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}

      {/* MOBILE — drawer panel */}
      <aside
        className={`md:hidden fixed top-0 left-0 z-50 h-full w-72 max-w-[85vw] bg-bg-900 border-r border-line-900 flex flex-col transform transition-transform duration-200 ease-out ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-line-900">
          <Link href="/" onClick={() => setDrawerOpen(false)}><GloMark size={30} /></Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="-mr-2 p-2 rounded-lg text-ink-100 hover:bg-bg-700/40"
          >
            <X size={22} strokeWidth={1.8} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavItems pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
        </nav>
        <div className="px-3 py-4 border-t border-line-900">
          <FooterItems pathname={pathname} onNavigate={() => setDrawerOpen(false)} onSignOut={signOut} />
        </div>
      </aside>

      {/* DESKTOP — persistent sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 border-r border-line-900 bg-bg-900/40 backdrop-blur-sm shrink-0">
        <div className="px-6 py-6 border-b border-line-900">
          <Link href="/"><GloMark size={32} /></Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItems pathname={pathname} />
        </nav>
        <div className="px-3 py-4 border-t border-line-900">
          <FooterItems pathname={pathname} onSignOut={signOut} />
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
