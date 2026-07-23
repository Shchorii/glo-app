import { describe, expect, it } from "vitest";
import { getStats } from "@/lib/scans";

describe("getStats", () => {
  it("returns the seeded campaign statistics by default", async () => {
    await expect(getStats()).resolves.toEqual({ scans: 1284, redemptions: 312 });
  });

  it("returns zeroed statistics for an unknown campaign code", async () => {
    await expect(getStats("UNKNOWN")).resolves.toEqual({ scans: 0, redemptions: 0 });
  });
});
