"use client";
import { useEffect } from "react";
import { SCAN_ENDPOINT } from "@/lib/endpoints";

export function ScanBeacon({ code }: { code: string }) {
  useEffect(() => {
    const key = `glo-scan-${code}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch (error) {
      console.warn("Could not read scan session state.", error);
    }
    if (!SCAN_ENDPOINT) return;
    void fetch(SCAN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      keepalive: true,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Scan beacon failed (${response.status})`);
        try {
          sessionStorage.setItem(key, "1");
        } catch (error) {
          console.warn("Could not save scan session state.", error);
        }
      })
      .catch((error: unknown) => {
        console.warn("Scan beacon request failed.", error);
      });
  }, [code]);
  return null;
}
