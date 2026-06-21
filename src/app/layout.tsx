import type { Metadata } from "next";
import { SupportChat } from "@/components/SupportChat";
import { FloatingCreatives } from "@/components/FloatingCreatives";
import { Analytics } from "@/components/Analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "Glo Campaign Manager",
  description: "Light up every screen they watch — neighborhood-precise cross-screen advertising.",
  metadataBase: new URL("https://app.we-are-glo.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Analytics />
        <div className="ambient-bg" />
        <div className="grid-bg" />
        <FloatingCreatives />
        {children}
        <SupportChat />
      </body>
    </html>
  );
}
