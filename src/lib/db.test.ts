import type { SupabaseClient } from "@supabase/supabase-js";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("@/lib/endpoints", () => ({
  CHECKOUT_ENDPOINT: "https://example.test/functions/v1/checkout",
}));
vi.mock("@/lib/supabase", () => ({ getSupabase: vi.fn() }));

import {
  cancelDraft,
  createCampaign,
  daysBetween,
  fmtUsd,
  getCampaign,
  listMyCampaigns,
  listScreens,
  signedCreativeUrl,
  startCheckout,
  uploadCreative,
  type NewCampaign,
} from "@/lib/db";
import { getSupabase } from "@/lib/supabase";

const getSupabaseMock = vi.mocked(getSupabase);

function useClient(client: object) {
  getSupabaseMock.mockReturnValue(client as unknown as SupabaseClient);
}

const campaignInput: NewCampaign = {
  name: "Summer launch",
  start_date: "2026-07-20",
  end_date: "2026-07-22",
  screen_ids: ["screen-1", "screen-2"],
  creative_id: "creative-1",
  total_usd: 240,
  dayparts: [],
  status: "draft",
};

beforeEach(() => {
  getSupabaseMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Supabase reads", () => {
  it("fails clearly when Supabase is not configured", async () => {
    getSupabaseMock.mockReturnValue(null);

    await expect(listScreens()).rejects.toThrow(
      "Supabase is not configured in this build.",
    );
  });

  it("lists available screens in price order and normalizes numeric prices", async () => {
    const priceOrder = vi.fn().mockResolvedValue({
      data: [
        { id: "screen-1", city: "New York", daily_price_usd: "39.50" },
        { id: "screen-2", city: "New York", daily_price_usd: 42 },
      ],
      error: null,
    });
    const cityOrder = vi.fn().mockReturnValue({ order: priceOrder });
    const eq = vi.fn().mockReturnValue({ order: cityOrder });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    useClient({ from });

    await expect(listScreens()).resolves.toEqual([
      { id: "screen-1", city: "New York", daily_price_usd: 39.5 },
      { id: "screen-2", city: "New York", daily_price_usd: 42 },
    ]);
    expect(from).toHaveBeenCalledWith("screens");
    expect(select).toHaveBeenCalledWith("*");
    expect(eq).toHaveBeenCalledWith("is_available", true);
    expect(cityOrder).toHaveBeenCalledWith("city");
    expect(priceOrder).toHaveBeenCalledWith("daily_price_usd");
  });

  it("propagates screen query errors", async () => {
    const priceOrder = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("screen query failed"),
    });
    const cityOrder = vi.fn().mockReturnValue({ order: priceOrder });
    const eq = vi.fn().mockReturnValue({ order: cityOrder });
    useClient({ from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) }) });

    await expect(listScreens()).rejects.toThrow("screen query failed");
  });

  it("normalizes campaign totals and counts linked screens", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        { id: "campaign-1", total_usd: "125.75", campaign_screens: [{ screen_id: "one" }] },
        { id: "campaign-2", total_usd: 80, campaign_screens: null },
      ],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ order });
    useClient({ from: vi.fn().mockReturnValue({ select }) });

    await expect(listMyCampaigns()).resolves.toMatchObject([
      { id: "campaign-1", total_usd: 125.75, screen_count: 1 },
      { id: "campaign-2", total_usd: 80, screen_count: 0 },
    ]);
    expect(select).toHaveBeenCalledWith("*, campaign_screens(screen_id)");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("propagates campaign list errors", async () => {
    const order = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("campaign query failed"),
    });
    useClient({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ order }),
      }),
    });

    await expect(listMyCampaigns()).rejects.toThrow("campaign query failed");
  });

  it("builds a campaign detail from nested screens and creative data", async () => {
    const creative = { id: "creative-1", storage_path: "user/creative.png" };
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "campaign-1",
        total_usd: "99.25",
        campaign_screens: [
          { screens: { id: "screen-1", daily_price_usd: "39" } },
          { screens: null },
        ],
        creatives: creative,
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    useClient({ from: vi.fn().mockReturnValue({ select }) });

    await expect(getCampaign("campaign-1")).resolves.toMatchObject({
      id: "campaign-1",
      total_usd: 99.25,
      screens: [{ id: "screen-1", daily_price_usd: 39 }],
      creative,
    });
    expect(eq).toHaveBeenCalledWith("id", "campaign-1");
  });

  it("returns null when a campaign does not exist", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    useClient({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      }),
    });

    await expect(getCampaign("missing")).resolves.toBeNull();
  });

  it("propagates campaign detail errors", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("detail query failed"),
    });
    useClient({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      }),
    });

    await expect(getCampaign("campaign-1")).rejects.toThrow("detail query failed");
  });
});

describe("campaign writes", () => {
  it("requires an authenticated user before creating a campaign", async () => {
    const from = vi.fn();
    useClient({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from,
    });

    await expect(createCampaign(campaignInput)).rejects.toThrow(
      "Sign in to book screens.",
    );
    expect(from).not.toHaveBeenCalled();
  });

  it("creates a campaign, defaults empty dayparts, and links its screens", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "campaign-1" },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const campaignInsert = vi.fn().mockReturnValue({ select });
    const linkInsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) =>
      table === "campaigns" ? { insert: campaignInsert } : { insert: linkInsert },
    );
    useClient({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from,
    });

    await expect(createCampaign(campaignInput)).resolves.toBe("campaign-1");
    expect(campaignInsert).toHaveBeenCalledWith({
      user_id: "user-1",
      name: "Summer launch",
      start_date: "2026-07-20",
      end_date: "2026-07-22",
      creative_id: "creative-1",
      total_usd: 240,
      dayparts: ["all_day"],
      status: "draft",
    });
    expect(linkInsert).toHaveBeenCalledWith([
      { campaign_id: "campaign-1", screen_id: "screen-1" },
      { campaign_id: "campaign-1", screen_id: "screen-2" },
    ]);
  });

  it("propagates campaign insert errors", async () => {
    const error = new Error("campaign insert failed");
    const single = vi.fn().mockResolvedValue({ data: null, error });
    useClient({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single }),
        }),
      }),
    });

    await expect(
      createCampaign({ ...campaignInput, dayparts: ["daytime"] }),
    ).rejects.toBe(error);
  });

  it("propagates campaign-screen link errors", async () => {
    const error = new Error("link insert failed");
    const from = vi.fn((table: string) =>
      table === "campaigns"
        ? {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "campaign-1" },
                  error: null,
                }),
              }),
            }),
          }
        : { insert: vi.fn().mockResolvedValue({ error }) },
    );
    useClient({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from,
    });

    await expect(
      createCampaign({ ...campaignInput, dayparts: ["evening"] }),
    ).rejects.toBe(error);
  });

  it("cancels a draft campaign", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    useClient({ from: vi.fn().mockReturnValue({ update }) });

    await expect(cancelDraft("campaign-1")).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledWith({ status: "cancelled" });
    expect(eq).toHaveBeenCalledWith("id", "campaign-1");
  });

  it("propagates cancellation errors", async () => {
    const error = new Error("cancel failed");
    const eq = vi.fn().mockResolvedValue({ error });
    useClient({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({ eq }),
      }),
    });

    await expect(cancelDraft("campaign-1")).rejects.toBe(error);
  });
});

describe("creative storage", () => {
  it("requires an authenticated user before uploading", async () => {
    const storageFrom = vi.fn();
    useClient({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      storage: { from: storageFrom },
    });

    await expect(
      uploadCreative(new Blob(["image"], { type: "image/png" }), {
        source: "upload",
        ext: "png",
      }),
    ).rejects.toThrow("Sign in to upload creatives.");
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it("uploads a blob and records its creative metadata", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000000",
    );
    const creative = {
      id: "creative-1",
      user_id: "user-1",
      storage_path: "user-1/00000000-0000-4000-8000-000000000000.png",
      source: "template",
    };
    const upload = vi.fn().mockResolvedValue({ error: null });
    const single = vi.fn().mockResolvedValue({ data: creative, error: null });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single }),
    });
    useClient({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      storage: { from: vi.fn().mockReturnValue({ upload }) },
      from: vi.fn().mockReturnValue({ insert }),
    });
    const blob = new Blob(["image"], { type: "image/png" });

    await expect(
      uploadCreative(blob, {
        source: "template",
        ext: "png",
        width: 1080,
        height: 1920,
        duration: 15,
      }),
    ).resolves.toBe(creative);
    expect(upload).toHaveBeenCalledWith(creative.storage_path, blob, {
      contentType: "image/png",
      upsert: false,
    });
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      storage_path: creative.storage_path,
      source: "template",
      width_px: 1080,
      height_px: 1920,
      duration_s: 15,
    });
  });

  it("propagates upload errors before inserting metadata", async () => {
    const error = new Error("upload failed");
    const from = vi.fn();
    useClient({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error }),
        }),
      },
      from,
    });

    await expect(
      uploadCreative(new Blob(["image"]), { source: "upload", ext: "jpg" }),
    ).rejects.toBe(error);
    expect(from).not.toHaveBeenCalled();
  });

  it("propagates creative metadata insert errors and supplies null optionals", async () => {
    const error = new Error("creative insert failed");
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error }),
      }),
    });
    useClient({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
        }),
      },
      from: vi.fn().mockReturnValue({ insert }),
    });

    await expect(
      uploadCreative(new Blob(["image"]), { source: "upload", ext: "jpg" }),
    ).rejects.toBe(error);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      width_px: null,
      height_px: null,
      duration_s: null,
    }));
  });

  it("returns signed URLs and converts signing failures to null", async () => {
    const createSignedUrl = vi.fn()
      .mockResolvedValueOnce({
        data: { signedUrl: "https://example.test/signed" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: new Error("signing failed"),
      });
    useClient({
      storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) },
    });

    await expect(signedCreativeUrl("user/creative.png")).resolves.toBe(
      "https://example.test/signed",
    );
    await expect(signedCreativeUrl("user/missing.png")).resolves.toBeNull();
    expect(createSignedUrl).toHaveBeenCalledWith("user/creative.png", 3600);
  });
});

describe("checkout", () => {
  it("requires an authenticated session", async () => {
    useClient({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    });

    await expect(startCheckout("campaign-1")).rejects.toThrow("Sign in to pay.");
  });

  it("posts the campaign and returns the Stripe redirect URL", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    useClient({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "access-token" } },
        }),
      },
    });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ url: "https://checkout.stripe.test/session" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(startCheckout("campaign-1")).resolves.toBe(
      "https://checkout.stripe.test/session",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/functions/v1/checkout",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer access-token",
          apikey: "anon-key",
        },
        body: JSON.stringify({ campaign_id: "campaign-1" }),
      },
    );
  });

  it("uses an API error message when checkout fails", async () => {
    useClient({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "access-token" } },
        }),
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ error: "Campaign is already paid." }), {
          status: 409,
        }),
      ),
    );

    await expect(startCheckout("campaign-1")).rejects.toThrow(
      "Campaign is already paid.",
    );
  });

  it("falls back to the response status for invalid error bodies", async () => {
    useClient({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "access-token" } },
        }),
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response("not json", { status: 502 }),
      ),
    );

    await expect(startCheckout("campaign-1")).rejects.toThrow(
      "Checkout failed (502)",
    );
  });
});

describe("formatting helpers", () => {
  it("counts campaign dates inclusively in UTC", () => {
    expect(daysBetween("2026-07-20", "2026-07-20")).toBe(1);
    expect(daysBetween("2026-07-20", "2026-07-22")).toBe(3);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(3);
  });

  it("returns zero for invalid or reversed date ranges", () => {
    expect(daysBetween("invalid", "2026-07-20")).toBe(0);
    expect(daysBetween("2026-07-22", "2026-07-20")).toBe(0);
  });

  it("formats whole-dollar campaign totals", () => {
    expect(fmtUsd(1234.49)).toBe("$1,234");
    expect(fmtUsd(1234.5)).toBe("$1,235");
  });
});
