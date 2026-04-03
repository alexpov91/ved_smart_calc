import { v } from "convex/values";
import { query } from "./_generated/server";

export const check = query({
  args: { tnvedCode: v.string() },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().slice(0, 10);

    const allTariffs = await ctx.db.query("exciseTariffs").collect();

    return allTariffs.filter(
      (entry) =>
        args.tnvedCode.startsWith(entry.tnvedCodePattern) &&
        entry.validFrom <= today &&
        (entry.validTo === undefined || entry.validTo >= today),
    );
  },
});
