import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";

export const searchTnved = action({
  args: { query: v.string() },
  handler: async (_ctx, { query }) => {
    // STUB: Replace with real TKS API when credentials available
    // Caching policy: stale-while-revalidate
    // fresh < 24h -> cache, stale >= 24h -> cache + bg refresh, miss -> TKS, error -> last cache + warning
    console.log(`[TKS STUB] search: ${query}`);
    return { results: [] as string[], source: "TKS_STUB" as const };
  },
});

export const getTariff = action({
  args: { tnvedCode: v.string() },
  handler: async (_ctx, { tnvedCode }) => {
    // STUB: Replace with real TKS API
    console.log(`[TKS STUB] tariff: ${tnvedCode}`);
    return { tariff: null, source: "TKS_STUB" as const };
  },
});

export const refreshStaleTariffs = internalAction({
  args: {},
  handler: async () => {
    // STUB: Would query tnvedTariffs older than 7 days and refresh from TKS
    console.log("[TKS STUB] refreshStaleTariffs — no-op until TKS credentials available");
  },
});
