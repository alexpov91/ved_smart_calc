import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getUserId } from "./helpers/auth";

export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return profile ?? null;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    companyName: v.optional(v.string()),
    inn: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      throw new Error("Profile already exists");
    }

    return await ctx.db.insert("userProfiles", {
      userId,
      name: args.name,
      companyName: args.companyName,
      inn: args.inn,
      role: "user",
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    name: v.optional(v.string()),
    companyName: v.optional(v.string()),
    inn: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("Profile not found");
    }

    const updates: Record<string, string> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.companyName !== undefined) updates.companyName = args.companyName;
    if (args.inn !== undefined) updates.inn = args.inn;

    await ctx.db.patch(profile._id, updates);
  },
});
