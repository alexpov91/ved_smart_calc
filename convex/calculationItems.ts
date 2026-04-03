import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getUserId } from "./helpers/auth";
import { assertCalculationOwner } from "./helpers/ownership";

// ── Queries ──────────────────────────────────────────────────────────

export const byCalculation = query({
  args: { calculationId: v.id("calculations") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    // Verify parent calculation belongs to current user
    await assertCalculationOwner(ctx, args.calculationId, userId);

    const items = await ctx.db
      .query("calculationItems")
      .withIndex("by_calculationId", (q) =>
        q.eq("calculationId", args.calculationId),
      )
      .collect();

    // Sort by order field
    items.sort((a, b) => a.order - b.order);
    return items;
  },
});

// ── Mutations ────────────────────────────────────────────────────────

export const add = mutation({
  args: {
    calculationId: v.id("calculations"),
    tnvedCode: v.string(),
    productName: v.string(),
    invoiceValue: v.number(),
    currency: v.string(),
    incoterms: v.string(),
    country: v.string(),
    weightNet: v.number(),
    weightGross: v.number(),
    quantity: v.number(),
    unit: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    await assertCalculationOwner(ctx, args.calculationId, userId);

    // Determine next order value
    const existing = await ctx.db
      .query("calculationItems")
      .withIndex("by_calculationId", (q) =>
        q.eq("calculationId", args.calculationId),
      )
      .collect();

    const maxOrder =
      existing.length > 0
        ? Math.max(...existing.map((item) => item.order))
        : 0;

    return await ctx.db.insert("calculationItems", {
      calculationId: args.calculationId,
      order: maxOrder + 1,
      tnvedCode: args.tnvedCode,
      productName: args.productName,
      invoiceValue: args.invoiceValue,
      currency: args.currency,
      incoterms: args.incoterms,
      country: args.country,
      weightNet: args.weightNet,
      weightGross: args.weightGross,
      quantity: args.quantity,
      unit: args.unit,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("calculationItems"),
    tnvedCode: v.optional(v.string()),
    productName: v.optional(v.string()),
    invoiceValue: v.optional(v.number()),
    currency: v.optional(v.string()),
    incoterms: v.optional(v.string()),
    country: v.optional(v.string()),
    weightNet: v.optional(v.number()),
    weightGross: v.optional(v.number()),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");

    // Check ownership through parent calculation
    await assertCalculationOwner(ctx, item.calculationId, userId);

    const { id: _id, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }

    await ctx.db.patch(args.id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("calculationItems") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");

    await assertCalculationOwner(ctx, item.calculationId, userId);
    await ctx.db.delete(args.id);
  },
});

export const duplicate = mutation({
  args: { id: v.id("calculationItems") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");

    await assertCalculationOwner(ctx, item.calculationId, userId);

    // Get max order for this calculation
    const siblings = await ctx.db
      .query("calculationItems")
      .withIndex("by_calculationId", (q) =>
        q.eq("calculationId", item.calculationId),
      )
      .collect();

    const maxOrder = Math.max(...siblings.map((s) => s.order));

    return await ctx.db.insert("calculationItems", {
      calculationId: item.calculationId,
      order: maxOrder + 1,
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
  },
});
