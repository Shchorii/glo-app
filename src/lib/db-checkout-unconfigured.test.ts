import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/endpoints", () => ({ CHECKOUT_ENDPOINT: null }));
vi.mock("@/lib/supabase", () => ({ getSupabase: vi.fn() }));

import { startCheckout } from "@/lib/db";
import { getSupabase } from "@/lib/supabase";

describe("startCheckout without an endpoint", () => {
  it("fails before accessing Supabase", async () => {
    await expect(startCheckout("campaign-1")).rejects.toThrow(
      "Checkout is not configured in this build.",
    );
    expect(getSupabase).not.toHaveBeenCalled();
  });
});
