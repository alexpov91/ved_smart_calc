import { action, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const TARGET_CURRENCIES = ["USD", "EUR", "CNY", "TRY", "GBP"];
const CBR_URL = "https://www.cbr.ru/scripts/XML_daily.asp";

type FetchResult =
  | { saved: number; error: string }
  | { saved: number; date: string; currencies: string[] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAndSaveRates(ctx: any): Promise<FetchResult> {
  let xml: string;
  try {
    const response = await fetch(CBR_URL);
    if (!response.ok) {
      return { saved: 0, error: `HTTP ${response.status} ${response.statusText}` };
    }
    xml = await response.text();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { saved: 0, error: `Network error: ${message}` };
  }

  // Extract date from <ValCurs Date="DD.MM.YYYY"
  const dateMatch = xml.match(/<ValCurs[^>]+Date="(\d{2})\.(\d{2})\.(\d{4})"/);
  if (!dateMatch) {
    return { saved: 0, error: "Could not parse date from XML" };
  }
  const date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;

  const rates: Array<{
    currency: string;
    rate: number;
    unitRate: number;
    nominal: number;
  }> = [];

  for (const code of TARGET_CURRENCIES) {
    // Match the full <Valute> block for this currency
    const regex = new RegExp(
      `<Valute[^>]*>\\s*<NumCode>[^<]*</NumCode>\\s*<CharCode>${code}</CharCode>\\s*<Nominal>(\\d+)</Nominal>\\s*<Name>[^<]*</Name>\\s*<Value>([^<]+)</Value>\\s*<VunitRate>[^<]*</VunitRate>\\s*</Valute>`,
    );
    const match = xml.match(regex);
    if (!match) {
      // Try a simpler regex that's more tolerant of XML structure variations
      const simpleRegex = new RegExp(
        `<CharCode>${code}</CharCode>[\\s\\S]*?<Nominal>(\\d+)</Nominal>[\\s\\S]*?<Value>([^<]+)</Value>`,
      );
      const simpleMatch = xml.match(simpleRegex);
      if (!simpleMatch) continue;
      const nominal = parseInt(simpleMatch[1], 10);
      const rate = parseFloat(simpleMatch[2].replace(",", "."));
      rates.push({
        currency: code,
        rate,
        unitRate: rate / nominal,
        nominal,
      });
      continue;
    }
    const nominal = parseInt(match[1], 10);
    const rate = parseFloat(match[2].replace(",", "."));
    rates.push({
      currency: code,
      rate,
      unitRate: rate / nominal,
      nominal,
    });
  }

  if (rates.length === 0) {
    return { saved: 0, error: "No target currencies found in XML" };
  }

  const saved = await ctx.runMutation(internal.cbr.saveRates, {
    rates: rates.map((r) => ({
      currency: r.currency,
      rate: r.rate,
      unitRate: r.unitRate,
      nominal: r.nominal,
    })),
    date,
    source: "CBR_XML_DAILY" as const,
  });

  return { saved, date, currencies: rates.map((r) => r.currency) };
}

export const fetchRatesCron = internalAction({
  args: {},
  handler: async (ctx) => {
    return await fetchAndSaveRates(ctx);
  },
});

export const fetchRates = action({
  args: {},
  handler: async (ctx) => {
    return await fetchAndSaveRates(ctx);
  },
});

export const saveRates = internalMutation({
  args: {
    rates: v.array(
      v.object({
        currency: v.string(),
        rate: v.number(),
        unitRate: v.number(),
        nominal: v.number(),
      }),
    ),
    date: v.string(),
    source: v.union(v.literal("CBR"), v.literal("CBR_XML_DAILY")),
  },
  handler: async (ctx, args) => {
    let saved = 0;
    for (const rate of args.rates) {
      const existing = await ctx.db
        .query("exchangeRates")
        .withIndex("by_currency_date", (q) =>
          q.eq("currency", rate.currency).eq("date", args.date),
        )
        .first();

      if (!existing) {
        await ctx.db.insert("exchangeRates", {
          currency: rate.currency,
          rate: rate.rate,
          unitRate: rate.unitRate,
          nominal: rate.nominal,
          date: args.date,
          source: args.source,
          fetchedAt: Date.now(),
        });
        saved++;
      }
    }
    return saved;
  },
});
