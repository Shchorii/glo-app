import { describe, expect, it } from "vitest";
import { DAYPARTS, daypartMultiplier, daypartSummary } from "@/lib/dayparts";

describe("daypartMultiplier", () => {
  it("treats empty and all-day selections as the full daily rate", () => {
    expect(daypartMultiplier([])).toBe(1);
    expect(daypartMultiplier(["morning_rush", "all_day"])).toBe(1);
  });

  it("adds known slot shares without counting duplicates", () => {
    expect(daypartMultiplier(["morning_rush", "late_night"])).toBeCloseTo(0.5);
    expect(daypartMultiplier(["daytime", "daytime"])).toBeCloseTo(0.4);
  });

  it("caps combined slot pricing at the full daily rate", () => {
    expect(daypartMultiplier(DAYPARTS.map(({ id }) => id))).toBe(1);
  });

  it("ignores unknown slots and falls back to the daily rate when none are valid", () => {
    expect(daypartMultiplier(["daytime", "unknown"])).toBeCloseTo(0.4);
    expect(daypartMultiplier(["unknown"])).toBe(1);
  });
});

describe("daypartSummary", () => {
  it("labels empty and all-day selections consistently", () => {
    expect(daypartSummary([])).toBe("All day");
    expect(daypartSummary(["all_day", "daytime"])).toBe("All day");
  });

  it("formats known slots in catalog order", () => {
    expect(daypartSummary(["late_night", "morning_rush"])).toBe(
      "Morning rush 7-9am, Late night 10pm-12am",
    );
  });

  it("omits unknown slots", () => {
    expect(daypartSummary(["unknown", "evening"])).toBe("Evening 7-10pm");
    expect(daypartSummary(["unknown"])).toBe("");
  });
});
