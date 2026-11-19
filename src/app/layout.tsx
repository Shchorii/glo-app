import type { Metadata } from "next";
import { SupportChat } from "@/components/SupportChat";
import { FloatingCreatives } from "@/components/FloatingCreatives";
import { Analytics } from "@/components/Analytics";
import { FunnelTracker } from "@/components/FunnelTracker";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Glo Campaign Manager", template: "%s · Glo Campaign Manager" },
  description: "Light up every screen they watch — cross-screen campaigns, live in 60 seconds.",
  metadataBase: new URL("https://app.we-are-glo.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Analytics />
        <FunnelTracker />
        <div className="ambient-bg" />
        <div className="grid-bg" />
        <FloatingCreatives />
        {children}
        <SupportChat />
      </body>
    </html>
  );
}
