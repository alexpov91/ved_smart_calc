import { v } from "convex/values";
import { query, mutation, internalAction, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { getUserId } from "./helpers/auth";
import { assertCalculationOwner } from "./helpers/ownership";
import { calculateDirect } from "../src/engine/direct";
import { calculateReverse } from "../src/engine/reverse";
import type {
  CalculationInput,
  ReverseInput,
  NormalizedItem,
  TariffSnapshot,
  FxSnapshot,
  CustomsFeeScale,
  AntidumpingMatch,
  ExciseMatch,
  ShipmentLogistics,
  ItemResult,
  Warning,
  EngineError,
} from "../src/engine/types";

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
    retailParams: v.optional(
      v.object({
        retailPrice: v.number(),
        desiredMargin: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    await assertCalculationOwner(ctx, args.calculationId, userId);

    const updates: Record<string, unknown> = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.calculationDate !== undefined)
      updates.calculationDate = args.calculationDate;
    if (args.mode !== undefined) updates.mode = args.mode;
    if (args.retailParams !== undefined) updates.retailParams = args.retailParams;

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

// ── Internal Queries ────────────────────────────────────────────────

/**
 * Fetches all data needed for a calculation run in one query.
 * Used by the runCalculation action to gather inputs for the engine.
 */
export const getCalculationData = internalQuery({
  args: { calculationId: v.id("calculations") },
  handler: async (ctx, args) => {
    // 1. Fetch calculation
    const calculation = await ctx.db.get(args.calculationId);
    if (!calculation) throw new Error("Calculation not found");

    // 2. Fetch all items
    const items = await ctx.db
      .query("calculationItems")
      .withIndex("by_calculationId", (q) =>
        q.eq("calculationId", args.calculationId),
      )
      .collect();
    items.sort((a, b) => a.order - b.order);

    const effectiveDate = calculation.calculationDate ?? new Date().toISOString().slice(0, 10);

    // 3. Resolve tariffs for each unique tnvedCode
    const uniqueTnvedCodes = [...new Set(items.map((i) => i.tnvedCode))];
    const tariffEntries: Array<{ code: string; tariff: Record<string, unknown> | null }> = [];
    for (const code of uniqueTnvedCodes) {
      const allTariffs = await ctx.db
        .query("tnvedTariffs")
        .withIndex("by_code", (q) => q.eq("tnvedCode", code))
        .collect();

      let resolved: (typeof allTariffs[0] & { _fallback: boolean }) | null = null;
      if (allTariffs.length > 0) {
        const valid = allTariffs.filter(
          (t) =>
            t.validFrom <= effectiveDate &&
            (t.validTo === undefined || t.validTo >= effectiveDate),
        );
        if (valid.length > 0) {
          valid.sort((a, b) => {
            if (a.source !== b.source) return a.source === "TKS" ? -1 : 1;
            return b.fetchedAt - a.fetchedAt;
          });
          resolved = { ...valid[0], _fallback: false };
        } else {
          allTariffs.sort((a, b) => {
            if (a.validFrom !== b.validFrom) return a.validFrom > b.validFrom ? -1 : 1;
            return b.fetchedAt - a.fetchedAt;
          });
          resolved = { ...allTariffs[0], _fallback: true };
        }
      }
      tariffEntries.push({ code, tariff: resolved });
    }

    // 4. Collect all currencies needed (item currencies + freightCurrency)
    const currencySet = new Set(items.map((i) => i.currency));
    if (calculation.logistics?.freightCurrency) {
      currencySet.add(calculation.logistics.freightCurrency);
    }
    currencySet.add("EUR"); // Always need EUR for specific duties

    const fxEntries: Array<{ currency: string; rate: number | null; unitRate: number | null; date: string; warning: string | null }> = [];
    for (const currency of currencySet) {
      // Try exact match
      const exact = await ctx.db
        .query("exchangeRates")
        .withIndex("by_currency_date", (q) =>
          q.eq("currency", currency).eq("date", effectiveDate),
        )
        .first();

      if (exact) {
        fxEntries.push({ currency, rate: exact.rate, unitRate: exact.unitRate, date: exact.date, warning: null });
      } else {
        // Fallback: nearest previous date
        const nearest = await ctx.db
          .query("exchangeRates")
          .withIndex("by_currency_date", (q) =>
            q.eq("currency", currency).lt("date", effectiveDate),
          )
          .order("desc")
          .first();

        if (nearest) {
          fxEntries.push({
            currency,
            rate: nearest.rate,
            unitRate: nearest.unitRate,
            date: nearest.date,
            warning: `Курс на ${effectiveDate} не найден, использован курс на ${nearest.date}`,
          });
        } else {
          fxEntries.push({ currency, rate: null, unitRate: null, date: effectiveDate, warning: `Курс ${currency} не найден` });
        }
      }
    }

    // 5. Customs fee scale
    const today = new Date().toISOString().slice(0, 10);
    const allFees = await ctx.db
      .query("customsFees")
      .withIndex("by_validFrom_minValue")
      .collect();
    const feeScale = allFees.filter(
      (entry) =>
        entry.validFrom <= today &&
        (entry.validTo === undefined || entry.validTo >= today),
    );

    // 6. Antidumping duties for each item
    const allAntidumping = await ctx.db.query("antidumpingDuties").collect();
    const antidumpingMatches: Array<{ itemId: string; matches: typeof allAntidumping }> = [];
    for (const item of items) {
      const matches = allAntidumping.filter(
        (entry) =>
          item.tnvedCode.startsWith(entry.tnvedCodePattern) &&
          entry.country === item.country &&
          entry.validFrom <= today &&
          (entry.validTo === undefined || entry.validTo >= today),
      );
      antidumpingMatches.push({ itemId: item._id, matches });
    }

    // 7. Excise tariffs for each item
    const allExcise = await ctx.db.query("exciseTariffs").collect();
    const exciseMatches: Array<{ itemId: string; matches: typeof allExcise }> = [];
    for (const item of items) {
      const matches = allExcise.filter(
        (entry) =>
          item.tnvedCode.startsWith(entry.tnvedCodePattern) &&
          entry.validFrom <= today &&
          (entry.validTo === undefined || entry.validTo >= today),
      );
      exciseMatches.push({ itemId: item._id, matches });
    }

    return {
      calculation,
      items,
      tariffEntries,
      fxEntries,
      feeScale: feeScale.map((f) => ({ minValue: f.minValue, maxValue: f.maxValue, fee: f.fee })),
      antidumpingMatches,
      exciseMatches,
    };
  },
});

// ── Internal Actions ────────────────────────────────────────────────

export const runCalculation = internalAction({
  args: { calculationId: v.id("calculations") },
  handler: async (ctx, args) => {
    try {
      // 1. Fetch all needed data via internal query
      const data = await ctx.runQuery(internal.calculations.getCalculationData, {
        calculationId: args.calculationId,
      });

      const { calculation, items, tariffEntries, fxEntries, feeScale, antidumpingMatches, exciseMatches } = data;

      if (items.length === 0) {
        await ctx.runMutation(internal.calculations.applyResult, {
          calculationId: args.calculationId,
          itemResults: [],
          totals: {
            customsValue: 0, duty: 0, antidumping: 0,
            excise: 0, vat: 0, customsFee: 0,
            totalCustoms: 0, landedCost: 0,
          },
          warnings: [],
          errors: [{ code: "NO_ITEMS", message: "Нет позиций для расчёта" }],
          itemSnapshots: [],
          hasErrors: true,
        });
        return;
      }

      // 2. Build tariff map
      const tariffs = new Map<string, TariffSnapshot>();
      const tariffWarnings: Warning[] = [];
      for (const entry of tariffEntries) {
        if (!entry.tariff) continue;
        const t = entry.tariff as Record<string, unknown>;
        tariffs.set(entry.code, {
          tnvedCode: entry.code,
          dutyType: t.dutyType as "advalorem" | "specific" | "combined",
          dutyRate: t.dutyRate as number,
          dutySpecific: t.dutySpecific as number | undefined,
          dutyUnit: t.dutyUnit as string | undefined,
          vatRate: t.vatRate as number,
          needsCertification: t.needsCertification as boolean,
          needsMarking: t.needsMarking as boolean,
          source: t.source as "TKS" | "TWS",
          fetchedAt: t.fetchedAt as number,
        });
        if ((t as Record<string, unknown>)._fallback) {
          tariffWarnings.push({
            code: "TARIFF_FALLBACK",
            level: "warning",
            message: `Тариф для кода ${entry.code} на дату расчёта не найден, использован ближайший`,
          });
        }
      }

      // 3. Build FX rate map
      const fxRates = new Map<string, FxSnapshot>();
      const fxWarnings: Warning[] = [];
      const fxErrors: EngineError[] = [];
      for (const entry of fxEntries) {
        if (entry.unitRate == null) {
          fxErrors.push({
            code: "MISSING_FX_RATE",
            message: entry.warning ?? `Курс ${entry.currency} не найден`,
          });
          continue;
        }
        fxRates.set(entry.currency, {
          currency: entry.currency,
          unitRate: entry.unitRate,
          date: entry.date,
        });
        if (entry.warning) {
          fxWarnings.push({
            code: "FX_DATE_MISMATCH",
            level: "warning",
            message: entry.warning,
          });
        }
      }

      // EUR rate
      const eurRate = fxRates.get("EUR");
      if (!eurRate) {
        await ctx.runMutation(internal.calculations.applyResult, {
          calculationId: args.calculationId,
          itemResults: [],
          totals: {
            customsValue: 0, duty: 0, antidumping: 0,
            excise: 0, vat: 0, customsFee: 0,
            totalCustoms: 0, landedCost: 0,
          },
          warnings: [...tariffWarnings, ...fxWarnings],
          errors: [{ code: "MISSING_EUR_RATE", message: "Курс EUR не найден — невозможно рассчитать специфические пошлины" }, ...fxErrors],
          itemSnapshots: [],
          hasErrors: true,
        });
        return;
      }

      // 4. Build customs fee scale
      const customsFeeScale: CustomsFeeScale[] = feeScale;

      // 5. Build antidumping/excise maps (keyed by item id, using _id as string)
      const antidumpingMap = new Map<string, AntidumpingMatch>();
      for (const entry of antidumpingMatches) {
        if (entry.matches.length > 0) {
          // Take the first (most specific) match
          const m = entry.matches[0];
          antidumpingMap.set(entry.itemId, {
            rate: m.rate,
            country: m.country,
          });
        }
      }

      const exciseMap = new Map<string, ExciseMatch>();
      for (const entry of exciseMatches) {
        if (entry.matches.length > 0) {
          const m = entry.matches[0];
          exciseMap.set(entry.itemId, {
            ratePerUnit: m.ratePerUnit,
            unit: m.unit,
            productCategory: m.productCategory,
          });
        }
      }

      // 6. Build normalized items (using _id as string for itemId)
      const normalizedItems: NormalizedItem[] = items.map((item) => ({
        id: item._id,
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
      }));

      // 7. Build logistics
      const logistics: ShipmentLogistics = {
        freight: calculation.logistics.freight,
        freightCurrency: calculation.logistics.freightCurrency,
        insurance: calculation.logistics.insurance,
        insuranceAuto: calculation.logistics.insuranceAuto,
        broker: calculation.logistics.broker,
        certification: calculation.logistics.certification,
        marking: calculation.logistics.marking,
        bankCommission: calculation.logistics.bankCommission,
        svh: calculation.logistics.svh,
        transportAfterBorder: calculation.logistics.transportAfterBorder,
      };

      // 8. Run engine
      let engineItemResults: ItemResult[];
      let engineTotals: {
        customsValue: number; duty: number; antidumping: number;
        excise: number; vat: number; customsFee: number;
        totalCustoms: number; landedCost: number;
      };
      let engineWarnings: Warning[];
      let engineErrors: EngineError[];

      if (calculation.mode === "reverse") {
        // Reverse mode: single item
        const item = normalizedItems[0];
        const tariff = tariffs.get(item.tnvedCode);
        const fxRate = fxRates.get(item.currency);

        if (!tariff || !fxRate) {
          const missingErrors: EngineError[] = [];
          if (!tariff) missingErrors.push({ code: "MISSING_TARIFF", message: `Тариф для кода ${item.tnvedCode} не найден`, itemId: item.id });
          if (!fxRate) missingErrors.push({ code: "MISSING_FX_RATE", message: `Курс ${item.currency} не найден`, itemId: item.id });

          await ctx.runMutation(internal.calculations.applyResult, {
            calculationId: args.calculationId,
            itemResults: [],
            totals: {
              customsValue: 0, duty: 0, antidumping: 0,
              excise: 0, vat: 0, customsFee: 0,
              totalCustoms: 0, landedCost: 0,
            },
            warnings: [...tariffWarnings, ...fxWarnings],
            errors: [...missingErrors, ...fxErrors],
            itemSnapshots: [],
            hasErrors: true,
          });
          return;
        }

        if (!calculation.retailParams) {
          await ctx.runMutation(internal.calculations.applyResult, {
            calculationId: args.calculationId,
            itemResults: [],
            totals: {
              customsValue: 0, duty: 0, antidumping: 0,
              excise: 0, vat: 0, customsFee: 0,
              totalCustoms: 0, landedCost: 0,
            },
            warnings: [],
            errors: [{ code: "MISSING_RETAIL_PARAMS", message: "Для обратного расчёта необходимы параметры розничной цены и маржи" }],
            itemSnapshots: [],
            hasErrors: true,
          });
          return;
        }

        const reverseInput: ReverseInput = {
          item,
          tariff,
          fxRate,
          eurRate,
          customsFeeScale,
          antidumping: antidumpingMap.get(item.id),
          excise: exciseMap.get(item.id),
          logistics,
          retailPrice: calculation.retailParams.retailPrice,
          desiredMargin: calculation.retailParams.desiredMargin,
        };

        const reverseOutput = calculateReverse(reverseInput);

        engineItemResults = [reverseOutput.itemResult];
        engineTotals = {
          customsValue: reverseOutput.itemResult.customsValue,
          duty: reverseOutput.itemResult.duty,
          antidumping: reverseOutput.itemResult.antidumping,
          excise: reverseOutput.itemResult.excise,
          vat: reverseOutput.itemResult.vat,
          customsFee: reverseOutput.itemResult.customsFee,
          totalCustoms: reverseOutput.itemResult.totalCustoms,
          landedCost: reverseOutput.itemResult.landedCost,
        };
        engineWarnings = reverseOutput.warnings;
        engineErrors = [];

        if (!reverseOutput.converged) {
          engineWarnings.push({
            code: "REVERSE_NOT_CONVERGED",
            level: "critical",
            message: `Обратный расчёт не сошёлся за ${reverseOutput.iterations} итераций`,
          });
        }
      } else {
        // Direct mode
        if (fxErrors.length > 0) {
          // If critical FX rates are missing, fail early
          const missingItemCurrencies = items.filter((i) => !fxRates.has(i.currency));
          if (missingItemCurrencies.length > 0 || !fxRates.has(calculation.logistics.freightCurrency)) {
            await ctx.runMutation(internal.calculations.applyResult, {
              calculationId: args.calculationId,
              itemResults: [],
              totals: {
                customsValue: 0, duty: 0, antidumping: 0,
                excise: 0, vat: 0, customsFee: 0,
                totalCustoms: 0, landedCost: 0,
              },
              warnings: [...tariffWarnings, ...fxWarnings],
              errors: fxErrors,
              itemSnapshots: [],
              hasErrors: true,
            });
            return;
          }
        }

        const directInput: CalculationInput = {
          items: normalizedItems,
          tariffs,
          fxRates,
          eurRate,
          customsFeeScale,
          antidumping: antidumpingMap,
          excise: exciseMap,
          logistics,
          distributionMethod: calculation.distributionMethod,
        };

        const output = calculateDirect(directInput);
        engineItemResults = output.itemResults;
        engineTotals = output.totals;
        engineWarnings = output.warnings;
        engineErrors = output.errors;
      }

      // 9. Build per-item snapshots for applyResult
      const allWarnings = [...tariffWarnings, ...fxWarnings, ...engineWarnings];
      const allErrors = [...fxErrors, ...engineErrors];

      const itemSnapshots = items.map((item) => {
        const tariff = tariffs.get(item.tnvedCode);
        const fxRate = fxRates.get(item.currency);
        const adMatch = antidumpingMap.get(item._id);
        const result = engineItemResults.find((r) => r.itemId === item._id);

        return {
          itemId: item._id,
          appliedDutyType: tariff?.dutyType ?? undefined,
          appliedDutyRate: tariff?.dutyRate ?? undefined,
          appliedVatRate: tariff?.vatRate ?? undefined,
          appliedExchangeRate: fxRate?.unitRate ?? undefined,
          appliedExchangeDate: fxRate?.date ?? undefined,
          appliedCustomsFee: result?.customsFee ?? undefined,
          appliedAntidumpingRate: adMatch?.rate ?? undefined,
          tariffSource: tariff?.source ?? undefined,
          tariffFetchedAt: tariff?.fetchedAt ?? undefined,
          allocatedFreight: undefined as number | undefined,
          allocatedInsurance: undefined as number | undefined,
          allocationMethod: calculation.distributionMethod,
          result: result ? {
            customsValue: result.customsValue,
            duty: result.duty,
            antidumping: result.antidumping,
            excise: result.excise,
            vat: result.vat,
            customsFee: result.customsFee,
            totalCustoms: result.totalCustoms,
            landedCost: result.landedCost,
            landedCostPerUnit: result.landedCostPerUnit,
          } : undefined,
        };
      });

      // 10. Apply results
      const hasCriticalErrors = allErrors.length > 0 && engineItemResults.length === 0;
      await ctx.runMutation(internal.calculations.applyResult, {
        calculationId: args.calculationId,
        itemResults: engineItemResults,
        totals: engineTotals,
        warnings: allWarnings,
        errors: allErrors,
        itemSnapshots,
        hasErrors: hasCriticalErrors,
      });
    } catch (error: unknown) {
      // Catch unexpected errors and mark calculation as error
      const message = error instanceof Error ? error.message : String(error);
      try {
        await ctx.runMutation(internal.calculations.applyResult, {
          calculationId: args.calculationId,
          itemResults: [],
          totals: {
            customsValue: 0, duty: 0, antidumping: 0,
            excise: 0, vat: 0, customsFee: 0,
            totalCustoms: 0, landedCost: 0,
          },
          warnings: [],
          errors: [{ code: "UNEXPECTED_ERROR", message }],
          itemSnapshots: [],
          hasErrors: true,
        });
      } catch {
        // If even saving the error fails, nothing more we can do
        console.error("Failed to save calculation error:", message);
      }
    }
  },
});

// ── Internal Mutations ──────────────────────────────────────────────

export const applyResult = internalMutation({
  args: {
    calculationId: v.id("calculations"),
    itemResults: v.array(v.object({
      itemId: v.string(),
      customsValue: v.number(),
      duty: v.number(),
      antidumping: v.number(),
      excise: v.number(),
      vat: v.number(),
      customsFee: v.number(),
      totalCustoms: v.number(),
      landedCost: v.number(),
      landedCostPerUnit: v.number(),
    })),
    totals: v.object({
      customsValue: v.number(),
      duty: v.number(),
      antidumping: v.number(),
      excise: v.number(),
      vat: v.number(),
      customsFee: v.number(),
      totalCustoms: v.number(),
      landedCost: v.number(),
    }),
    warnings: v.array(v.object({
      code: v.string(),
      level: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
      message: v.string(),
      itemId: v.optional(v.string()),
    })),
    errors: v.array(v.object({
      code: v.string(),
      message: v.string(),
      itemId: v.optional(v.string()),
    })),
    itemSnapshots: v.array(v.object({
      itemId: v.id("calculationItems"),
      appliedDutyType: v.optional(v.string()),
      appliedDutyRate: v.optional(v.number()),
      appliedVatRate: v.optional(v.number()),
      appliedExchangeRate: v.optional(v.number()),
      appliedExchangeDate: v.optional(v.string()),
      appliedCustomsFee: v.optional(v.number()),
      appliedAntidumpingRate: v.optional(v.number()),
      tariffSource: v.optional(v.string()),
      tariffFetchedAt: v.optional(v.number()),
      allocatedFreight: v.optional(v.number()),
      allocatedInsurance: v.optional(v.number()),
      allocationMethod: v.optional(v.string()),
      result: v.optional(v.object({
        customsValue: v.number(),
        duty: v.number(),
        antidumping: v.number(),
        excise: v.number(),
        vat: v.number(),
        customsFee: v.number(),
        totalCustoms: v.number(),
        landedCost: v.number(),
        landedCostPerUnit: v.number(),
      })),
    })),
    hasErrors: v.boolean(),
  },
  handler: async (ctx, args) => {
    // 1. Patch each calculationItem with snapshot + result
    for (const snapshot of args.itemSnapshots) {
      await ctx.db.patch(snapshot.itemId, {
        appliedDutyType: snapshot.appliedDutyType,
        appliedDutyRate: snapshot.appliedDutyRate,
        appliedVatRate: snapshot.appliedVatRate,
        appliedExchangeRate: snapshot.appliedExchangeRate,
        appliedExchangeDate: snapshot.appliedExchangeDate,
        appliedCustomsFee: snapshot.appliedCustomsFee,
        appliedAntidumpingRate: snapshot.appliedAntidumpingRate,
        tariffSource: snapshot.tariffSource,
        tariffFetchedAt: snapshot.tariffFetchedAt,
        allocatedFreight: snapshot.allocatedFreight,
        allocatedInsurance: snapshot.allocatedInsurance,
        allocationMethod: snapshot.allocationMethod,
        result: snapshot.result,
      });
    }

    // 2. Patch the calculation
    await ctx.db.patch(args.calculationId, {
      status: args.hasErrors ? "error" as const : "completed" as const,
      totals: args.totals,
      warnings: args.warnings,
      errors: args.errors,
    });
  },
});
