import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

type AnyCtx = QueryCtx | MutationCtx;

export async function assertCalculationOwner(
  ctx: AnyCtx,
  calculationId: Id<"calculations">,
  userId: string
) {
  const calc = await ctx.db.get(calculationId);
  if (!calc || calc.userId !== userId) {
    throw new Error("Calculation not found or access denied");
  }
  return calc;
}
