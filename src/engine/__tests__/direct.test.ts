import { describe, it, expect } from "vitest";
import { calculateDirect } from "../direct";
import type {
  CalculationInput,
  NormalizedItem,
  TariffSnapshot,
  FxSnapshot,
  CustomsFeeScale,
  ShipmentLogistics,
} from "../types";

/* ─── helpers ─── */

function makeItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id: "item1",
    tnvedCode: "8211100000",
    productName: "Cutlery",
    invoiceValue: 4500,
    currency: "USD",
    incoterms: "FOB",
    country: "CN",
    weightNet: 200,
    weightGross: 220,
    quantity: 1000,
    unit: "pcs",
    ...overrides,
  };
}

function makeTariff(overrides: Partial<TariffSnapshot> = {}): TariffSnapshot {
  return {
    tnvedCode: "8211100000",
    dutyType: "advalorem",
    dutyRate: 12,
    vatRate: 22,
    needsCertification: false,
    needsMarking: false,
    source: "TKS",
    fetchedAt: Date.now(),
    ...overrides,
  };
}

const USD_RATE: FxSnapshot = { currency: "USD", unitRate: 84.38, date: "2025-01-15" };
const EUR_RATE: FxSnapshot = { currency: "EUR", unitRate: 93.44, date: "2025-01-15" };

const DEFAULT_FEE_SCALE: CustomsFeeScale[] = [
  { minValue: 0, maxValue: 200000, fee: 1067 },
  { minValue: 200001, maxValue: 450000, fee: 2462 },
  { minValue: 450001, maxValue: 1200000, fee: 5012 },
  { minValue: 1200001, maxValue: 2700000, fee: 10012 },
  { minValue: 2700001, maxValue: 4200000, fee: 15512 },
  { minValue: 4200001, maxValue: 5500000, fee: 20012 },
  { minValue: 5500001, maxValue: 7000000, fee: 23012 },
  { minValue: 7000001, maxValue: 8000000, fee: 25012 },
  { minValue: 8000001, maxValue: 9000000, fee: 27012 },
  { minValue: 9000001, maxValue: 10000000, fee: 30012 },
  { minValue: 10000001, maxValue: Infinity, fee: 100000 },
];

function emptyLogistics(): ShipmentLogistics {
  return {
    freight: 0,
    freightCurrency: "USD",
  };
}

/* ─── Test 1: Single item, advalorem duty (cutlery from China) ─── */

describe("calculateDirect", () => {
  it("Test 1: single item advalorem duty, no freight/insurance", () => {
    const input: CalculationInput = {
      items: [makeItem()],
      tariffs: new Map([["8211100000", makeTariff()]]),
      fxRates: new Map([["USD", USD_RATE]]),
      eurRate: EUR_RATE,
      customsFeeScale: DEFAULT_FEE_SCALE,
      antidumping: new Map(),
      excise: new Map(),
      logistics: emptyLogistics(),
      distributionMethod: "by_weight",
    };

    const result = calculateDirect(input);

    expect(result.errors).toHaveLength(0);

    const item = result.itemResults[0];
    // customsValue = 4500 * 84.38 = 379710
    expect(item.customsValue).toBe(379710);
    // duty = 379710 * 12% = 45565.2
    expect(item.duty).toBe(45565.2);
    expect(item.antidumping).toBe(0);
    expect(item.excise).toBe(0);
    // VAT = (379710 + 45565.2) * 22% = 93560.544 -> 93560.54
    expect(item.vat).toBe(93560.54);
    // fee scale 200001-450000 -> 2462
    expect(item.customsFee).toBe(2462);
    // totalCustoms = 45565.2 + 0 + 0 + 93560.54 + 2462 = 141587.74
    expect(item.totalCustoms).toBe(141587.74);
    // landedCost = customsValue + totalCustoms = 379710 + 141587.74 = 521297.74
    expect(item.landedCost).toBe(521297.74);
    // landedCostPerUnit = 521297.74 / 1000 = 521.30 (rounded to 2 dp)
    expect(item.landedCostPerUnit).toBeCloseTo(521.3, 2);
  });

  /* ─── Test 2: Combined duty (shoes) ─── */

  it("Test 2: combined duty, takes max of advalorem vs specific", () => {
    const item = makeItem({
      id: "shoes1",
      tnvedCode: "6403510000",
      productName: "Shoes",
      invoiceValue: 20000,
      currency: "EUR",
      incoterms: "FOB",
      country: "CN",
      quantity: 1000,
      unit: "pair",
      weightGross: 3000,
    });

    const tariff = makeTariff({
      tnvedCode: "6403510000",
      dutyType: "combined",
      dutyRate: 10,
      dutySpecific: 1.5,
      dutyUnit: "pair",
      vatRate: 22,
    });

    const input: CalculationInput = {
      items: [item],
      tariffs: new Map([["6403510000", tariff]]),
      fxRates: new Map([["EUR", EUR_RATE]]),
      eurRate: EUR_RATE,
      customsFeeScale: DEFAULT_FEE_SCALE,
      antidumping: new Map(),
      excise: new Map(),
      logistics: emptyLogistics(),
      distributionMethod: "by_weight",
    };

    const result = calculateDirect(input);
    expect(result.errors).toHaveLength(0);

    const r = result.itemResults[0];
    // customsValue = 20000 * 93.44 = 1868800
    expect(r.customsValue).toBe(1868800);
    // advalorem = 1868800 * 10% = 186880
    // specific  = 1000 * 1.5 * 93.44 = 140160
    // combined  = max(186880, 140160) = 186880
    expect(r.duty).toBe(186880);
    // VAT = (1868800 + 186880) * 22% = 2055680 * 0.22 = 452249.6
    expect(r.vat).toBe(452249.6);
  });

  /* ─── Test 3: Multi-item with freight allocation by weight ─── */

  it("Test 3: multi-item with freight allocated by weight", () => {
    const item1 = makeItem({
      id: "a",
      tnvedCode: "CODE_A",
      invoiceValue: 3000,
      currency: "USD",
      incoterms: "FOB",
      weightGross: 100,
      quantity: 500,
    });

    const item2 = makeItem({
      id: "b",
      tnvedCode: "CODE_B",
      invoiceValue: 7000,
      currency: "USD",
      incoterms: "FOB",
      weightGross: 400,
      quantity: 2000,
    });

    const tariffA = makeTariff({ tnvedCode: "CODE_A", dutyRate: 10, vatRate: 20 });
    const tariffB = makeTariff({ tnvedCode: "CODE_B", dutyRate: 5, vatRate: 20 });

    const input: CalculationInput = {
      items: [item1, item2],
      tariffs: new Map([
        ["CODE_A", tariffA],
        ["CODE_B", tariffB],
      ]),
      fxRates: new Map([["USD", USD_RATE]]),
      eurRate: EUR_RATE,
      customsFeeScale: DEFAULT_FEE_SCALE,
      antidumping: new Map(),
      excise: new Map(),
      logistics: {
        freight: 5000,
        freightCurrency: "USD",
      },
      distributionMethod: "by_weight",
    };

    const result = calculateDirect(input);
    expect(result.errors).toHaveLength(0);

    // Freight = 5000 USD, distributed by weight: total weight = 500
    // item a: 100/500 * 5000 = 1000 USD freight
    // item b: 400/500 * 5000 = 4000 USD freight
    // Insurance: none
    // FOB -> CIF: add freight + insurance
    // item a CIF = 3000 + 1000 + 0 = 4000 USD -> 4000 * 84.38 = 337520 RUB
    // item b CIF = 7000 + 4000 + 0 = 11000 USD -> 11000 * 84.38 = 928180 RUB
    const a = result.itemResults[0];
    const b = result.itemResults[1];

    expect(a.customsValue).toBe(337520);
    expect(b.customsValue).toBe(928180);

    // Total customs value = 337520 + 928180 = 1265700
    // Fee scale: 1200001-2700000 -> 10012
    // Fee allocated by customs value:
    // a share: 337520 / 1265700 * 10012 ≈ 2669.82
    // b share: 10012 - 2669.82 = 7342.18
    expect(result.totals.customsFee).toBe(10012);

    // duty a = 337520 * 10% = 33752
    expect(a.duty).toBe(33752);
    // duty b = 928180 * 5% = 46409
    expect(b.duty).toBe(46409);
  });

  /* ─── Test 4: Antidumping duty ─── */

  it("Test 4: antidumping duty added on top of regular duty", () => {
    const item = makeItem({
      id: "ad1",
      tnvedCode: "7306300000",
      invoiceValue: 10000,
      currency: "USD",
    });

    const tariff = makeTariff({
      tnvedCode: "7306300000",
      dutyRate: 15,
      vatRate: 20,
    });

    const input: CalculationInput = {
      items: [item],
      tariffs: new Map([["7306300000", tariff]]),
      fxRates: new Map([["USD", USD_RATE]]),
      eurRate: EUR_RATE,
      customsFeeScale: DEFAULT_FEE_SCALE,
      antidumping: new Map([["ad1", { rate: 25.2, country: "CN" }]]),
      excise: new Map(),
      logistics: emptyLogistics(),
      distributionMethod: "by_weight",
    };

    const result = calculateDirect(input);
    expect(result.errors).toHaveLength(0);

    const r = result.itemResults[0];
    // customsValue = 10000 * 84.38 = 843800
    expect(r.customsValue).toBe(843800);
    // duty = 843800 * 15% = 126570
    expect(r.duty).toBe(126570);
    // antidumping = 843800 * 25.2% = 212637.6
    expect(r.antidumping).toBe(212637.6);
    // VAT base includes antidumping: (843800 + 126570 + 212637.6) * 20% = 1183007.6 * 0.20 = 236601.52
    expect(r.vat).toBe(236601.52);
  });

  /* ─── Test 5: Missing tariff produces error ─── */

  it("Test 5: missing tariff produces error, does not crash", () => {
    const item = makeItem({
      id: "missing1",
      tnvedCode: "9999999999",
    });

    const input: CalculationInput = {
      items: [item],
      tariffs: new Map(), // no tariff for this code
      fxRates: new Map([["USD", USD_RATE]]),
      eurRate: EUR_RATE,
      customsFeeScale: DEFAULT_FEE_SCALE,
      antidumping: new Map(),
      excise: new Map(),
      logistics: emptyLogistics(),
      distributionMethod: "by_weight",
    };

    const result = calculateDirect(input);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].itemId).toBe("missing1");
    expect(result.errors[0].code).toBe("MISSING_TARIFF");
    // Should still have itemResults array (possibly empty or with zero item)
    expect(result.itemResults).toBeDefined();
  });

  /* ─── Test 6: Warnings for certification/marking ─── */

  it("Test 6: generates CERT_REQUIRED warning when needsCertification", () => {
    const item = makeItem({
      id: "cert1",
      tnvedCode: "8501100000",
    });

    const tariff = makeTariff({
      tnvedCode: "8501100000",
      dutyRate: 5,
      vatRate: 20,
      needsCertification: true,
      needsMarking: true,
    });

    const input: CalculationInput = {
      items: [item],
      tariffs: new Map([["8501100000", tariff]]),
      fxRates: new Map([["USD", USD_RATE]]),
      eurRate: EUR_RATE,
      customsFeeScale: DEFAULT_FEE_SCALE,
      antidumping: new Map(),
      excise: new Map(),
      logistics: emptyLogistics(),
      distributionMethod: "by_weight",
    };

    const result = calculateDirect(input);
    expect(result.errors).toHaveLength(0);

    const certWarning = result.warnings.find((w) => w.code === "CERT_REQUIRED");
    expect(certWarning).toBeDefined();
    expect(certWarning!.itemId).toBe("cert1");

    const markingWarning = result.warnings.find((w) => w.code === "MARKING_REQUIRED");
    expect(markingWarning).toBeDefined();
    expect(markingWarning!.itemId).toBe("cert1");
  });
});
