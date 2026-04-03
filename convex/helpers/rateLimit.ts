import { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * Simple rate limiter using Convex DB.
 *
 * Checks the count of recent records in a table that match the given userId
 * within the specified time window. If the count exceeds the limit, throws
 * with a user-friendly message.
 *
 * This works by querying existing data (calculations, exports) — no separate
 * rate-limit table needed.
 */

interface RateLimitConfig {
  /** Max allowed actions within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Human-readable description for the error message */
  actionName: string;
}

/**
 * Check rate limit for calculations (max 10/min per user).
 * Call this BEFORE creating or running a calculation.
 */
export async function checkCalculationRateLimit(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<void> {
  await checkRateLimit(ctx, userId, "calculations", {
    maxRequests: 10,
    windowMs: 60_000, // 1 minute
    actionName: "расчёт",
  });
}

/**
 * Check rate limit for exports (max 5/hour per user).
 * Call this BEFORE creating an export.
 */
export async function checkExportRateLimit(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<void> {
  await checkRateLimit(ctx, userId, "exports", {
    maxRequests: 5,
    windowMs: 3_600_000, // 1 hour
    actionName: "экспорт",
  });
}

async function checkRateLimit(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  table: "calculations" | "exports",
  config: RateLimitConfig,
): Promise<void> {
  const cutoff = Date.now() - config.windowMs;

  // Query recent records by this user
  const recent = await ctx.db
    .query(table)
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .filter((q) => q.gte(q.field("_creationTime"), cutoff))
    .collect();

  if (recent.length >= config.maxRequests) {
    const windowDesc =
      config.windowMs >= 3_600_000
        ? `${Math.round(config.windowMs / 3_600_000)} ч.`
        : `${Math.round(config.windowMs / 60_000)} мин.`;

    throw new Error(
      `Превышен лимит: максимум ${config.maxRequests} ${config.actionName} за ${windowDesc}. Попробуйте позже.`,
    );
  }
}
