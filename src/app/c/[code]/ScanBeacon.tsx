"use client";
import { useEffect } from "react";

export function ScanBeacon({ code }: { code: string }) {
  useEffect(() => {
    const key = `glo-scan-${code}`;
    if (sessionStorage.getItem(key)) return; // count once per session
    sessionStorage.setItem(key, "1");
    fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      keepalive: true,
    }).catch(() => {});
  }, [code]);
  return null;
}
