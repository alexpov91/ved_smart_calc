import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

/**
 * Resolve the best tariff for a given TNVED code.
 *
 * Priority:
 * 1. Filter by effectiveDate within [validFrom, validTo]
 * 2. Prefer source "TKS" over "TWS"
 * 3. Among same source, pick most recent by fetchedAt
 * 4. Fallback: most recent by validFrom (caller should warn)
 */
export const getResolvedTariff = internalQuery({
  args: {
    tnvedCode: v.string(),
    effectiveDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const effectiveDate =
      args.effectiveDate ?? new Date().toISOString().slice(0, 10);

    // Get all tariffs for this code
    const allTariffs = await ctx.db
      .query("tnvedTariffs")
      .withIndex("by_code", (q) => q.eq("tnvedCode", args.tnvedCode))
      .collect();

    if (allTariffs.length === 0) {
      return null;
    }

    // Filter by date validity
    const valid = allTariffs.filter(
      (t) =>
        t.validFrom <= effectiveDate &&
        (t.validTo === undefined || t.validTo >= effectiveDate),
    );

    if (valid.length > 0) {
      // Prefer TKS over TWS, then most recent fetchedAt
      valid.sort((a, b) => {
        if (a.source !== b.source) {
          return a.source === "TKS" ? -1 : 1;
        }
        return b.fetchedAt - a.fetchedAt;
      });
      return { ...valid[0], _fallback: false };
    }

    // Fallback: most recent by validFrom
    allTariffs.sort((a, b) => {
      if (a.validFrom !== b.validFrom) {
        return a.validFrom > b.validFrom ? -1 : 1;
      }
      return b.fetchedAt - a.fetchedAt;
    });

    return { ...allTariffs[0], _fallback: true };
  },
});
