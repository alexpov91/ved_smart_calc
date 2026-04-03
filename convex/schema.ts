import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // 1. User business profiles (separated from auth)
  userProfiles: defineTable({
    userId: v.string(),
    name: v.string(),
    companyName: v.optional(v.string()),
    inn: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin")),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  // 2. TN VED code catalog
  tnvedCatalog: defineTable({
    code: v.string(),
    nameShort: v.string(),
    nameFull: v.string(),
    examples: v.array(v.string()),
    searchTokens: v.array(v.string()),
  })
    .index("by_code", ["code"])
    .searchIndex("search_name", { searchField: "nameShort" })
    .searchIndex("search_full", { searchField: "nameFull" }),

  // 3. Tariff data, versioned with source
  tnvedTariffs: defineTable({
    tnvedCode: v.string(),
    source: v.union(v.literal("TKS"), v.literal("TWS")),
    sourceModule: v.optional(v.string()),
    dutyType: v.union(
      v.literal("advalorem"),
      v.literal("specific"),
      v.literal("combined"),
    ),
    dutyRate: v.number(),
    dutySpecific: v.optional(v.number()),
    dutyUnit: v.optional(v.string()),
    vatRate: v.union(v.literal(22), v.literal(10), v.literal(0)),
    needsCertification: v.boolean(),
    needsMarking: v.boolean(),
    validFrom: v.string(),
    validTo: v.optional(v.string()),
    fetchedAt: v.number(),
    effectiveDate: v.optional(v.string()),
    payloadHash: v.optional(v.string()),
    rawPayload: v.optional(v.string()),
  })
    .index("by_code", ["tnvedCode"])
    .index("by_code_source", ["tnvedCode", "source"]),

  // 4. CBR exchange rates
  exchangeRates: defineTable({
    currency: v.string(),
    rate: v.number(),
    unitRate: v.number(),
    nominal: v.number(),
    date: v.string(),
    source: v.union(v.literal("CBR"), v.literal("CBR_XML_DAILY")),
    fetchedAt: v.number(),
  }).index("by_currency_date", ["currency", "date"]),

  // 5. Customs fee scale
  customsFees: defineTable({
    minValue: v.number(),
    maxValue: v.number(),
    fee: v.number(),
    validFrom: v.string(),
    validTo: v.optional(v.string()),
    source: v.optional(v.string()),
    sourceDoc: v.optional(v.string()),
  }).index("by_validFrom_minValue", ["validFrom", "minValue"]),

  // 6. Excise tax rates
  exciseTariffs: defineTable({
    tnvedCodePattern: v.string(),
    productCategory: v.string(),
    ratePerUnit: v.number(),
    unit: v.string(),
    validFrom: v.string(),
    validTo: v.optional(v.string()),
    source: v.optional(v.string()),
    sourceDoc: v.optional(v.string()),
  }).index("by_pattern", ["tnvedCodePattern"]),

  // 7. Antidumping duties
  antidumpingDuties: defineTable({
    tnvedCodePattern: v.string(),
    country: v.string(),
    rate: v.number(),
    validFrom: v.string(),
    validTo: v.optional(v.string()),
    source: v.optional(v.string()),
    sourceDoc: v.optional(v.string()),
  }).index("by_pattern_country", ["tnvedCodePattern", "country"]),

  // 8. Calculation headers
  calculations: defineTable({
    userId: v.string(),
    createdAt: v.number(),
    mode: v.union(v.literal("direct"), v.literal("reverse")),
    status: v.union(
      v.literal("draft"),
      v.literal("calculating"),
      v.literal("completed"),
      v.literal("error"),
      v.literal("archived"),
    ),
    title: v.optional(v.string()),
    currencyMode: v.string(),
    calculationDate: v.optional(v.string()),
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
    totals: v.optional(
      v.object({
        customsValue: v.number(),
        duty: v.number(),
        antidumping: v.number(),
        excise: v.number(),
        vat: v.number(),
        customsFee: v.number(),
        totalCustoms: v.number(),
        landedCost: v.number(),
      }),
    ),
    warnings: v.array(
      v.object({
        code: v.string(),
        level: v.union(
          v.literal("info"),
          v.literal("warning"),
          v.literal("critical"),
        ),
        message: v.string(),
        itemId: v.optional(v.string()),
      }),
    ),
    errors: v.array(
      v.object({
        code: v.string(),
        message: v.string(),
        itemId: v.optional(v.string()),
      }),
    ),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  // 9. Calculation line items
  calculationItems: defineTable({
    calculationId: v.id("calculations"),
    order: v.number(),
    // Input fields
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
    // Snapshot fields
    appliedDutyType: v.optional(v.string()),
    appliedDutyRate: v.optional(v.number()),
    appliedVatRate: v.optional(v.number()),
    appliedExchangeRate: v.optional(v.number()),
    appliedExchangeDate: v.optional(v.string()),
    appliedCustomsFee: v.optional(v.number()),
    appliedAntidumpingRate: v.optional(v.number()),
    tariffSource: v.optional(v.string()),
    tariffFetchedAt: v.optional(v.number()),
    // Allocation fields
    allocatedFreight: v.optional(v.number()),
    allocatedInsurance: v.optional(v.number()),
    allocationMethod: v.optional(v.string()),
    // Result
    result: v.optional(
      v.object({
        customsValue: v.number(),
        duty: v.number(),
        antidumping: v.number(),
        excise: v.number(),
        vat: v.number(),
        customsFee: v.number(),
        totalCustoms: v.number(),
        landedCost: v.number(),
        landedCostPerUnit: v.number(),
      }),
    ),
  }).index("by_calculationId", ["calculationId"]),

  // 10. Export file records
  exports: defineTable({
    calculationId: v.id("calculations"),
    userId: v.string(),
    type: v.union(v.literal("pdf"), v.literal("xlsx")),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
      v.literal("stale"),
    ),
    storageId: v.optional(v.string()),
    filename: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    sourceSnapshotHash: v.optional(v.string()),
    templateVersion: v.optional(v.string()),
    createdAt: v.number(),
    readyAt: v.optional(v.number()),
  }).index("by_calculationId", ["calculationId"]),
});
