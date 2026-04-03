import { v } from "convex/values";
import { query } from "./_generated/server";

export const getCurrent = query({
  args: { currency: v.string() },
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query("exchangeRates")
      .withIndex("by_currency_date", (q) => q.eq("currency", args.currency))
      .order("desc")
      .first();

    return latest ?? null;
  },
});

export const getByDate = query({
  args: { currency: v.string(), date: v.string() },
  handler: async (ctx, args) => {
    // Try exact match first
    const exact = await ctx.db
      .query("exchangeRates")
      .withIndex("by_currency_date", (q) =>
        q.eq("currency", args.currency).eq("date", args.date),
      )
      .first();

    if (exact) {
      return { rate: exact.rate, warning: null };
    }

    // Fallback: nearest previous date
    const nearest = await ctx.db
      .query("exchangeRates")
      .withIndex("by_currency_date", (q) =>
        q.eq("currency", args.currency).lt("date", args.date),
      )
      .order("desc")
      .first();

    if (nearest) {
      return {
        rate: nearest.rate,
        warning: `Курс на ${args.date} не найден, использован курс на ${nearest.date}`,
      };
    }

    return {
      rate: null,
      warning: `Курс ${args.currency} не найден`,
    };
  },
});
