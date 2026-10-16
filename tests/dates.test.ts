import assert from "node:assert/strict";
import test from "node:test";
import { clampFlight, localTodayISO } from "../src/lib/dates.ts";

test("localTodayISO uses local calendar fields", () => {
  const morning = new Date(2026, 9, 16, 1, 30, 0);
  assert.equal(localTodayISO(morning), "2026-10-16");
});

test("clampFlight shifts both ends and keeps the duration", () => {
  assert.deepEqual(clampFlight("2026-10-12", "2026-10-14", "2026-10-16"), {
    start: "2026-10-16",
    end: "2026-10-18",
    shifted: true,
  });
});

test("clampFlight leaves a flight that already starts today or later", () => {
  assert.deepEqual(clampFlight("2026-10-16", "2026-10-16", "2026-10-16"), {
    start: "2026-10-16",
    end: "2026-10-16",
    shifted: false,
  });
  assert.deepEqual(clampFlight("2026-10-20", "2026-10-22", "2026-10-16"), {
    start: "2026-10-20",
    end: "2026-10-22",
    shifted: false,
  });
});

test("clampFlight raises an end that is still before the start", () => {
  assert.deepEqual(clampFlight("2026-10-20", "2026-10-18", "2026-10-16"), {
    start: "2026-10-20",
    end: "2026-10-20",
    shifted: true,
  });
});

test("clampFlight ignores values that are not date-only strings", () => {
  assert.deepEqual(clampFlight("", "2026-10-14", "2026-10-16"), {
    start: "",
    end: "2026-10-14",
    shifted: false,
  });
});
