import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const seedCustomsFees = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("customsFees").first();
    if (existing) {
      return "Already seeded";
    }

    const rows = [
      { minValue: 0, maxValue: 200000, fee: 1231 },
      { minValue: 200001, maxValue: 450000, fee: 2462 },
      { minValue: 450001, maxValue: 1200000, fee: 4269 },
      { minValue: 1200001, maxValue: 2700000, fee: 8538 },
      { minValue: 2700001, maxValue: 4200000, fee: 16524 },
      { minValue: 4200001, maxValue: 5500000, fee: 20000 },
      { minValue: 5500001, maxValue: 7000000, fee: 25000 },
      { minValue: 7000001, maxValue: 10000000, fee: 30000 },
      { minValue: 10000001, maxValue: 999999999999, fee: 73860 },
    ];

    for (const row of rows) {
      await ctx.db.insert("customsFees", {
        ...row,
        validFrom: "2026-01-01",
        source: "ПП РФ №1637",
        sourceDoc:
          "Постановление Правительства РФ от 28.11.2024 №1637",
      });
    }

    return `Seeded ${rows.length} customs fee rows`;
  },
});

export const seedExchangeRatesTest = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("exchangeRates")
      .withIndex("by_currency_date", (q) =>
        q.eq("currency", "USD").eq("date", "2026-04-03"),
      )
      .first();
    if (existing) {
      return "Already seeded";
    }

    const rates = [
      { currency: "USD", rate: 84.38, unitRate: 84.38, nominal: 1 },
      { currency: "EUR", rate: 93.44, unitRate: 93.44, nominal: 1 },
      { currency: "CNY", rate: 13.24, unitRate: 13.24, nominal: 1 },
      { currency: "TRY", rate: 2.45, unitRate: 2.45, nominal: 1 },
      { currency: "GBP", rate: 107.5, unitRate: 107.5, nominal: 1 },
    ];

    const now = Date.now();
    for (const r of rates) {
      await ctx.db.insert("exchangeRates", {
        ...r,
        date: "2026-04-03",
        source: "CBR" as const,
        fetchedAt: now,
      });
    }

    return `Seeded ${rates.length} exchange rates`;
  },
});

export const seedSampleTnved = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("tnvedCatalog").first();
    if (existing) {
      return "Already seeded";
    }

    const now = Date.now();

    const samples = [
      {
        catalog: {
          code: "9403202009",
          nameShort: "Мебель металлическая для кемпинга",
          nameFull: "Мебель металлическая прочая для кемпинга",
          examples: ["стул складной", "кровать кемпинговая", "стол походный"],
          searchTokens: ["мебель", "металл", "кемпинг", "стул", "складной"],
        },
        tariff: {
          dutyType: "advalorem" as const,
          dutyRate: 8,
          vatRate: 22 as const,
          needsCertification: true,
          needsMarking: false,
        },
      },
      {
        catalog: {
          code: "8215990000",
          nameShort: "Столовые приборы",
          nameFull:
            "Наборы из столовых и кухонных принадлежностей прочие",
          examples: ["вилки", "ложки", "ножи столовые"],
          searchTokens: ["столовые", "приборы", "вилки", "ложки"],
        },
        tariff: {
          dutyType: "advalorem" as const,
          dutyRate: 12,
          vatRate: 22 as const,
          needsCertification: false,
          needsMarking: false,
        },
      },
      {
        catalog: {
          code: "6403990000",
          nameShort: "Обувь с верхом из натуральной кожи",
          nameFull:
            "Обувь прочая с подошвой из резины и верхом из натуральной кожи",
          examples: ["ботинки", "туфли", "сапоги кожаные"],
          searchTokens: ["обувь", "кожа", "ботинки", "туфли"],
        },
        tariff: {
          dutyType: "combined" as const,
          dutyRate: 10,
          dutySpecific: 1.5,
          dutyUnit: "пара",
          vatRate: 22 as const,
          needsCertification: false,
          needsMarking: true,
        },
      },
      {
        catalog: {
          code: "9503001000",
          nameShort: "Игрушки трёхколёсные велосипеды",
          nameFull:
            "Трехколесные велосипеды, самокаты и аналогичные игрушки",
          examples: [
            "самокат детский",
            "велосипед детский",
            "педальная машина",
          ],
          searchTokens: ["игрушки", "велосипед", "самокат", "детский"],
        },
        tariff: {
          dutyType: "advalorem" as const,
          dutyRate: 7.5,
          vatRate: 10 as const,
          needsCertification: false,
          needsMarking: false,
        },
      },
    ];

    for (const s of samples) {
      await ctx.db.insert("tnvedCatalog", s.catalog);
      await ctx.db.insert("tnvedTariffs", {
        tnvedCode: s.catalog.code,
        source: "TWS" as const,
        ...s.tariff,
        validFrom: "2026-01-01",
        fetchedAt: now,
      });
    }

    return `Seeded ${samples.length} TNVED codes with tariffs`;
  },
});

// ── Batch load TNVED from scraped data ──────────────────────────────

export const seedTnvedBatch = mutation({
  args: {
    catalog: v.array(
      v.object({
        code: v.string(),
        nameShort: v.string(),
        nameFull: v.string(),
        examples: v.array(v.string()),
        searchTokens: v.array(v.string()),
      }),
    ),
    tariffs: v.array(
      v.object({
        tnvedCode: v.string(),
        source: v.union(v.literal("TKS"), v.literal("TWS"), v.literal("IFCG")),
        dutyType: v.union(
          v.literal("advalorem"),
          v.literal("specific"),
          v.literal("combined"),
        ),
        dutyRate: v.number(),
        dutySpecific: v.optional(v.number()),
        dutyUnit: v.optional(v.string()),
        vatRate: v.union(v.literal(22), v.literal(10), v.literal(0)),
        needsCertification: v.boolean(),
        needsMarking: v.boolean(),
        validFrom: v.string(),
        fetchedAt: v.number(),
        rawPayload: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let skippedDupes = 0;

    for (let i = 0; i < args.catalog.length; i++) {
      const cat = args.catalog[i];
      const tar = args.tariffs[i];

      // Check if code already exists in catalog
      const existingCatalog = await ctx.db
        .query("tnvedCatalog")
        .withIndex("by_code", (q) => q.eq("code", cat.code))
        .first();

      if (existingCatalog) {
        skippedDupes++;
        continue;
      }

      await ctx.db.insert("tnvedCatalog", cat);
      await ctx.db.insert("tnvedTariffs", tar);
      inserted++;
    }

    return `Inserted ${inserted}, skipped ${skippedDupes} dupes`;
  },
});

export const clearTnvedData = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear all catalog entries
    const catalogEntries = await ctx.db.query("tnvedCatalog").collect();
    for (const entry of catalogEntries) {
      await ctx.db.delete(entry._id);
    }

    // Clear all tariff entries
    const tariffEntries = await ctx.db.query("tnvedTariffs").collect();
    for (const entry of tariffEntries) {
      await ctx.db.delete(entry._id);
    }

    return `Deleted ${catalogEntries.length} catalog + ${tariffEntries.length} tariff entries`;
  },
});
