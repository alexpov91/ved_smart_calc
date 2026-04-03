import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Search the TNVED catalog by code prefix (digits) or by name (text).
 */
export const searchLocal = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const q = args.query.trim();

    if (q.length < 2) {
      return [];
    }

    let catalogEntries;

    if (/^\d+$/.test(q)) {
      // Prefix search by code
      catalogEntries = await ctx.db
        .query("tnvedCatalog")
        .withIndex("by_code", (idx) =>
          idx.gte("code", q).lt("code", q + "\uffff"),
        )
        .take(limit);
    } else {
      // Full-text search by name — search both indexes, merge, deduplicate
      const [byShort, byFull] = await Promise.all([
        ctx.db
          .query("tnvedCatalog")
          .withSearchIndex("search_name", (s) => s.search("nameShort", q))
          .take(limit),
        ctx.db
          .query("tnvedCatalog")
          .withSearchIndex("search_full", (s) => s.search("nameFull", q))
          .take(limit),
      ]);

      // Deduplicate by _id
      const seen = new Set<string>();
      const merged = [];
      for (const entry of [...byShort, ...byFull]) {
        const id = entry._id.toString();
        if (!seen.has(id)) {
          seen.add(id);
          merged.push(entry);
        }
      }
      catalogEntries = merged.slice(0, limit);
    }

    // Enrich each entry with its current tariff
    const results = await Promise.all(
      catalogEntries.map(async (entry) => {
        const tariff = await ctx.db
          .query("tnvedTariffs")
          .withIndex("by_code", (idx) => idx.eq("tnvedCode", entry.code))
          .order("desc")
          .first();

        return { ...entry, tariff: tariff ?? null };
      }),
    );

    return results;
  },
});

/**
 * Get a single TNVED catalog entry by exact code, enriched with tariff.
 */
export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("tnvedCatalog")
      .withIndex("by_code", (idx) => idx.eq("code", args.code))
      .first();

    if (!entry) {
      return null;
    }

    const tariff = await ctx.db
      .query("tnvedTariffs")
      .withIndex("by_code", (idx) => idx.eq("tnvedCode", entry.code))
      .order("desc")
      .first();

    return { ...entry, tariff: tariff ?? null };
  },
});
