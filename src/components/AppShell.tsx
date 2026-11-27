"use client";
import { OnboardingGate } from "@/components/OnboardingGate";
import { GloMark } from "./Logo";
import { FluidDrawer } from "./FluidDrawer";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Sparkles, Layers, Megaphone, BarChart3, Settings, Menu, X, LogOut, PlusCircle } from "lucide-react";

const NAV = [
  { href: "/book",      label: "Book",      icon: PlusCircle },
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
            className={`nav-item flex items-center gap-3 px-3 py-3 rounded-lg text-[15px] ${
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
        className={`nav-item flex items-center gap-3 px-3 py-3 rounded-lg text-[15px] ${
          settingsActive ? "bg-cy-400/10 text-cy-300" : "text-ink-200 hover:text-ink-50 hover:bg-bg-700/40"
        }`}
      >
        <Settings size={18} strokeWidth={1.8} />
        Settings
      </Link>
      <button
        type="button"
        onClick={onSignOut}
        className="nav-item w-full flex items-center gap-3 px-3 py-3 rounded-lg text-[15px] text-ink-300 hover:text-ink-50 hover:bg-bg-700/40"
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
    const { signOut: sbSignOut } = await import("@/lib/auth-client");
    try { await sbSignOut(); } catch {}
    document.cookie = "glo-owner=; Max-Age=0; path=/";
    window.location.href = "/sign-in";
  }

  return (
    <div className="min-h-screen md:flex">
      {/* MOBILE — top bar: translucent material, content scrolls underneath */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 glass-bar scroll-edge">
        <Link href="/" className="flex items-center press"><GloMark size={26} motion="spin" /></Link>
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          className="-mr-2 p-2 rounded-lg text-ink-100 hover:bg-bg-700/40 press"
        >
          <Menu size={22} strokeWidth={1.8} />
        </button>
      </header>

      {/* MOBILE — drawer: drag to dismiss, flick-aware, interruptible */}
      <FluidDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        className="w-72 max-w-[85vw] glass-panel border-r border-white/[0.06] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/" onClick={() => setDrawerOpen(false)} className="press"><GloMark size={30} motion="spin" /></Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="-mr-2 p-2 rounded-lg text-ink-100 hover:bg-bg-700/40 press"
          >
            <X size={22} strokeWidth={1.8} />
          </button>
        </div>
        <div className="hairline mx-5" />
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavItems pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
        </nav>
        <div className="hairline mx-5" />
        <div className="px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <FooterItems pathname={pathname} onNavigate={() => setDrawerOpen(false)} onSignOut={signOut} />
        </div>
      </FluidDrawer>

      {/* DESKTOP — persistent sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 border-r border-white/[0.05] glass-sidebar shrink-0 sticky top-0 h-screen">
        <div className="px-6 py-6 border-b border-line-900">
          <Link href="/" className="press"><GloMark size={32} motion="spin" /></Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItems pathname={pathname} />
        </nav>
        <div className="px-3 py-4 border-t border-line-900">
          <FooterItems pathname={pathname} onSignOut={signOut} />
        </div>
      </aside>

      <OnboardingGate />
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
