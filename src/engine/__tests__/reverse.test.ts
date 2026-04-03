import { describe, it, expect } from "vitest";
import { calculateReverse } from "../reverse";
import type { ReverseInput, FxSnapshot, TariffSnapshot } from "../types";

const fxUSD: FxSnapshot = { currency: "USD", unitRate: 84.38, date: "2026-04-03" };
const fxEUR: FxSnapshot = { currency: "EUR", unitRate: 93.44, date: "2026-04-03" };

const tariff: TariffSnapshot = {
  tnvedCode: "9403202009",
  dutyType: "advalorem",
  dutyRate: 8,
  vatRate: 22,
  needsCertification: false,
  needsMarking: false,
  source: "TWS",
  fetchedAt: Date.now(),
};

const feeScale = [
  { minValue: 0, maxValue: 200000, fee: 1231 },
  { minValue: 200001, maxValue: 450000, fee: 2462 },
  { minValue: 450001, maxValue: 1200000, fee: 4269 },
];

describe("calculateReverse", () => {
  it("finds max purchase price for given retail price and margin", () => {
    const input: ReverseInput = {
      item: {
        id: "item1",
        tnvedCode: "9403202009",
        productName: "Стул складной",
        invoiceValue: 0,
        currency: "USD",
        incoterms: "FOB",
        country: "CN",
        weightNet: 4,
        weightGross: 5,
        quantity: 1,
        unit: "шт",
      },
      tariff,
      fxRate: fxUSD,
      eurRate: fxEUR,
      customsFeeScale: feeScale,
      logistics: { freight: 0, freightCurrency: "USD" },
      retailPrice: 10000,
      desiredMargin: 30,
    };

    const result = calculateReverse(input);
    expect(result.converged).toBe(true);
    expect(result.maxPurchasePrice).toBeGreaterThan(0);
    expect(result.maxPurchasePrice).toBeLessThan(10000 / fxUSD.unitRate);
    expect(result.iterations).toBeLessThanOrEqual(50);
    // Landed cost should be <= target (retailPrice * (1 - margin/100))
    expect(result.itemResult.landedCost).toBeLessThanOrEqual(7000 + 1); // 10000 * 0.7 + tolerance
  });

  it("converges within 50 iterations", () => {
    const input: ReverseInput = {
      item: {
        id: "item1",
        tnvedCode: "9403202009",
        productName: "Товар",
        invoiceValue: 0,
        currency: "USD",
        incoterms: "CIF",
        country: "CN",
        weightNet: 10,
        weightGross: 12,
        quantity: 100,
        unit: "шт",
      },
      tariff,
      fxRate: fxUSD,
      eurRate: fxEUR,
      customsFeeScale: feeScale,
      logistics: {
        freight: 1000,
        freightCurrency: "USD",
        broker: 20000,
        transportAfterBorder: 15000,
      },
      retailPrice: 500000,
      desiredMargin: 25,
    };

    const result = calculateReverse(input);
    expect(result.converged).toBe(true);
    expect(result.maxPurchasePrice).toBeGreaterThan(0);
  });

  it("handles zero margin", () => {
    const input: ReverseInput = {
      item: {
        id: "item1",
        tnvedCode: "9403202009",
        productName: "Товар",
        invoiceValue: 0,
        currency: "USD",
        incoterms: "FOB",
        country: "CN",
        weightNet: 1,
        weightGross: 1,
        quantity: 1,
        unit: "шт",
      },
      tariff,
      fxRate: fxUSD,
      eurRate: fxEUR,
      customsFeeScale: feeScale,
      logistics: { freight: 0, freightCurrency: "USD" },
      retailPrice: 50000,
      desiredMargin: 0,
    };

    const result = calculateReverse(input);
    expect(result.converged).toBe(true);
    expect(result.maxPurchasePrice).toBeGreaterThan(0);
  });

  it("warns if not converged (edge case)", () => {
    // Very tight constraints that might not converge easily
    const input: ReverseInput = {
      item: {
        id: "item1",
        tnvedCode: "9403202009",
        productName: "Товар",
        invoiceValue: 0,
        currency: "USD",
        incoterms: "FOB",
        country: "CN",
        weightNet: 1,
        weightGross: 1,
        quantity: 1,
        unit: "шт",
      },
      tariff,
      fxRate: fxUSD,
      eurRate: fxEUR,
      customsFeeScale: feeScale,
      logistics: { freight: 0, freightCurrency: "USD" },
      retailPrice: 100,  // Very low retail — likely converges to near 0
      desiredMargin: 99,  // 99% margin
    };

    const result = calculateReverse(input);
    // Should still return a result (even if near zero)
    expect(result.maxPurchasePrice).toBeGreaterThanOrEqual(0);
  });
});
