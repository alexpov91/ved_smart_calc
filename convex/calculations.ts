import { v } from "convex/values";
import { query, mutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getUserId } from "./helpers/auth";
import { assertCalculationOwner } from "./helpers/ownership";

// ── Queries ──────────────────────────────────────────────────────────

export const getMy = query({
  args: { id: v.id("calculations") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const calc = await ctx.db.get(args.id);
    if (!calc || calc.userId !== userId) return null;
    return calc;
  },
});

export const listMy = query({
  args: {
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const limit = args.limit ?? 20;

    let q = ctx.db
      .query("calculations")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc");

    // Cursor-based pagination using _creationTime
    if (args.cursor !== undefined) {
      q = ctx.db
        .query("calculations")
        .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
        .order("desc")
        .filter((q_f) => q_f.lt(q_f.field("_creationTime"), args.cursor!));
    }

    const items = await q.take(limit + 1);
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? page[page.length - 1]._creationTime : undefined;

    return { items: page, nextCursor };
  },
});

export const getSummary = query({
  args: { id: v.id("calculations") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const calc = await ctx.db.get(args.id);
    if (!calc || calc.userId !== userId) return null;

    // Return header + totals only, no items
    return {
      _id: calc._id,
      _creationTime: calc._creationTime,
      userId: calc.userId,
      createdAt: calc.createdAt,
      mode: calc.mode,
      status: calc.status,
      title: calc.title,
      currencyMode: calc.currencyMode,
      calculationDate: calc.calculationDate,
      distributionMethod: calc.distributionMethod,
      totals: calc.totals,
      warnings: calc.warnings,
      errors: calc.errors,
    };
  },
});

// ── Mutations ────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    mode: v.union(v.literal("direct"), v.literal("reverse")),
    currencyMode: v.string(),
    logistics: v.object({
      freight: v.number(),
      freightCurrency: v.string(),
      insurance: v.optional(v.number()),
      insuranceAuto: v.optional(v.boolean()),
      broker: v.optional(v.number()),
      certification: v.optional(v.number()),
      marking: v.optional(v.number()),
      bankCommission: v.optional(v.number()),
      svh: v.optional(v.number()),
      transportAfterBorder: v.optional(v.number()),
    }),
    distributionMethod: v.union(
      v.literal("by_weight"),
      v.literal("by_value"),
    ),
    retailParams: v.optional(
      v.object({
        retailPrice: v.number(),
        desiredMargin: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    return await ctx.db.insert("calculations", {
      userId,
      createdAt: Date.now(),
      mode: args.mode,
      status: "draft",
      currencyMode: args.currencyMode,
      calculationDate: today,
      logistics: args.logistics,
      distributionMethod: args.distributionMethod,
      retailParams: args.retailParams,
      warnings: [],
      errors: [],
    });
  },
});

export const requestCalculation = mutation({
  args: { calculationId: v.id("calculations") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const calc = await assertCalculationOwner(ctx, args.calculationId, userId);

    // Reverse mode: reject if more than 1 item
    if (calc.mode === "reverse") {
      const items = await ctx.db
        .query("calculationItems")
        .withIndex("by_calculationId", (q) =>
          q.eq("calculationId", args.calculationId),
        )
        .collect();
      if (items.length > 1) {
        throw new Error(
          "Reverse mode calculations can only have one item",
        );
      }
    }

    await ctx.db.patch(args.calculationId, { status: "calculating" as const });

    // Schedule the async calculation action
    // TODO: internal.calculations.runCalculation will be implemented in Task 17
    await ctx.scheduler.runAfter(
      0,
      internal.calculations.runCalculation,
      { calculationId: args.calculationId },
    );
  },
});

export const updateLogistics = mutation({
  args: {
    calculationId: v.id("calculations"),
    logistics: v.object({
      freight: v.number(),
      freightCurrency: v.string(),
      insurance: v.optional(v.number()),
      insuranceAuto: v.optional(v.boolean()),
      broker: v.optional(v.number()),
      certification: v.optional(v.number()),
      marking: v.optional(v.number()),
      bankCommission: v.optional(v.number()),
      svh: v.optional(v.number()),
      transportAfterBorder: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    await assertCalculationOwner(ctx, args.calculationId, userId);
    await ctx.db.patch(args.calculationId, { logistics: args.logistics });
  },
});

export const updateMeta = mutation({
  args: {
    calculationId: v.id("calculations"),
    title: v.optional(v.string()),
    calculationDate: v.optional(v.string()),
    mode: v.optional(v.union(v.literal("direct"), v.literal("reverse"))),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    await assertCalculationOwner(ctx, args.calculationId, userId);

    const updates: Record<string, unknown> = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.calculationDate !== undefined)
      updates.calculationDate = args.calculationDate;
    if (args.mode !== undefined) updates.mode = args.mode;

    await ctx.db.patch(args.calculationId, updates);
  },
});

export const setDistributionMethod = mutation({
  args: {
    calculationId: v.id("calculations"),
    method: v.union(v.literal("by_weight"), v.literal("by_value")),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    await assertCalculationOwner(ctx, args.calculationId, userId);
    await ctx.db.patch(args.calculationId, {
      distributionMethod: args.method,
    });
  },
});

export const clone = mutation({
  args: { id: v.id("calculations") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const calc = await assertCalculationOwner(ctx, args.id, userId);

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Deep copy the calculation header, reset status/results
    const newCalcId = await ctx.db.insert("calculations", {
      userId,
      createdAt: Date.now(),
      mode: calc.mode,
      status: "draft",
      title: calc.title ? `${calc.title} (copy)` : undefined,
      currencyMode: calc.currencyMode,
      calculationDate: today,
      logistics: calc.logistics,
      distributionMethod: calc.distributionMethod,
      retailParams: calc.retailParams,
      warnings: [],
      errors: [],
    });

    // Deep copy all items, stripping snapshot/result fields
    const items = await ctx.db
      .query("calculationItems")
      .withIndex("by_calculationId", (q) => q.eq("calculationId", args.id))
      .collect();

    for (const item of items) {
      await ctx.db.insert("calculationItems", {
        calculationId: newCalcId,
        order: item.order,
        tnvedCode: item.tnvedCode,
        productName: item.productName,
        invoiceValue: item.invoiceValue,
        currency: item.currency,
        incoterms: item.incoterms,
        country: item.country,
        weightNet: item.weightNet,
        weightGross: item.weightGross,
        quantity: item.quantity,
        unit: item.unit,
      });
    }

    return newCalcId;
  },
});

export const remove = mutation({
  args: { id: v.id("calculations") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    await assertCalculationOwner(ctx, args.id, userId);

    // Delete all items first
    const items = await ctx.db
      .query("calculationItems")
      .withIndex("by_calculationId", (q) => q.eq("calculationId", args.id))
      .collect();

    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    await ctx.db.delete(args.id);
  },
});

// ── Internal Actions (placeholder for Task 17) ──────────────────────

export const runCalculation = internalAction({
  args: { calculationId: v.id("calculations") },
  handler: async (_ctx, _args) => {
    // TODO: Implement in Task 17
    throw new Error("runCalculation not yet implemented");
  },
});
