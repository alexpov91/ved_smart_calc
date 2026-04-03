import { v } from "convex/values";
import { query } from "./_generated/server";

export const check = query({
  args: { tnvedCode: v.string(), country: v.string() },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().slice(0, 10);

    const allDuties = await ctx.db.query("antidumpingDuties").collect();

    return allDuties.filter(
      (entry) =>
        args.tnvedCode.startsWith(entry.tnvedCodePattern) &&
        entry.country === args.country &&
        entry.validFrom <= today &&
        (entry.validTo === undefined || entry.validTo >= today),
    );
  },
});
