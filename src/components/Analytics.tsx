"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

// Dedicated "Glo App" GA4 property (G-L1WPV7E16V), separate from the
// marketing "GLO" property so app usage reports stand on their own.
const GA_MEASUREMENT_ID = "G-L1WPV7E16V";
// Glo Google Ads account 714-725-0150. Sign-up conversion fires from FunnelTracker.
export const GOOGLE_ADS_ID = "AW-18584979940";
export const GOOGLE_ADS_SIGNUP_LABEL = "R1F0CMHK1LsdEOSTgZ5F";

/** Query params that can carry personal data (the welcome email link has ?email=). Never sent to Google. */
const PII_PARAMS = ["email", "e"];

function cleanQuery(query: string): string {
  const q = new URLSearchParams(query);
  PII_PARAMS.forEach((k) => q.delete(k));
  return q.toString();
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== "function") return;
    const query = cleanQuery(searchParams?.toString() || "");
    const pagePath = query ? `${pathname}?${query}` : pathname;
    gtag("event", "page_view", {
      page_path: pagePath,
      page_location: window.location.origin + pagePath,
      page_title: document.title,
    });
  }, [pathname, searchParams]);

  return null;
}

export function Analytics() {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          (function(){
            var tz=''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch(e) {}
            var eu = /^Europe\//.test(tz);
            var adsOff = navigator.globalPrivacyControl === true || eu;
            gtag('consent', 'default', {
              analytics_storage: eu ? 'denied' : 'granted',
              ad_storage: adsOff ? 'denied' : 'granted',
              ad_user_data: adsOff ? 'denied' : 'granted',
              ad_personalization: adsOff ? 'denied' : 'granted'
            });
            try {
              var u = new URL(location.href);
              ${JSON.stringify(PII_PARAMS)}.forEach(function(k){ u.searchParams.delete(k); });
              gtag('set', { page_location: u.toString() });
            } catch(e) {}
          })();
          gtag('js', new Date());
          gtag('set', 'linker', { domains: ['we-are-glo.com', 'app.we-are-glo.com'], accept_incoming: true });
          gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
          gtag('config', '${GOOGLE_ADS_ID}');
        `}
      </Script>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
    </>
  );
}
