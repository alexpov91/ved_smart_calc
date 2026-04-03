import { v } from "convex/values";
import { query } from "./_generated/server";

export const getScale = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().slice(0, 10);

    const allFees = await ctx.db
      .query("customsFees")
      .withIndex("by_validFrom_minValue")
      .collect();

    return allFees.filter(
      (entry) =>
        entry.validFrom <= today &&
        (entry.validTo === undefined || entry.validTo >= today),
    );
  },
});

export const getFeeForValue = query({
  args: { customsValue: v.number() },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().slice(0, 10);

    const allFees = await ctx.db
      .query("customsFees")
      .withIndex("by_validFrom_minValue")
      .collect();

    const scale = allFees.filter(
      (entry) =>
        entry.validFrom <= today &&
        (entry.validTo === undefined || entry.validTo >= today),
    );

    const match = scale.find(
      (entry) =>
        args.customsValue >= entry.minValue &&
        args.customsValue <= entry.maxValue,
    );

    return match ? match.fee : 73860;
  },
});
