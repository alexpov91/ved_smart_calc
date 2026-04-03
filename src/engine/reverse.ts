import type { ReverseInput, ReverseOutput, Warning, CalculationInput } from "./types";
import { calculateDirect } from "./direct";

const TOLERANCE = 0.01;  // RUB
const MAX_ITERATIONS = 50;

export function calculateReverse(input: ReverseInput): ReverseOutput {
  const {
    item, tariff, fxRate, eurRate, customsFeeScale,
    antidumping, excise, logistics,
    retailPrice, desiredMargin,
  } = input;

  const warnings: Warning[] = [];
  const targetLandedCost = retailPrice * (1 - desiredMargin / 100);

  // Binary search for max purchase price in foreign currency
  let low = 0;
  let high = targetLandedCost / fxRate.unitRate;
  let bestPrice = 0;
  let bestResult = null;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS && (high - low) > TOLERANCE / fxRate.unitRate) {
    iterations++;
    const mid = (low + high) / 2;

    const testItem = { ...item, invoiceValue: mid };
    const directInput: CalculationInput = {
      items: [testItem],
      tariffs: new Map([[item.tnvedCode, tariff]]),
      fxRates: new Map([[item.currency, fxRate]]),
      eurRate,
      customsFeeScale,
      antidumping: antidumping ? new Map([[item.id, antidumping]]) : new Map(),
      excise: excise ? new Map([[item.id, excise]]) : new Map(),
      logistics,
      distributionMethod: "by_weight",
    };

    const result = calculateDirect(directInput);
    const landed = result.itemResults[0]?.landedCost ?? Infinity;

    if (landed <= targetLandedCost) {
      bestPrice = mid;
      bestResult = result;
      low = mid;
    } else {
      high = mid;
    }
  }

  const converged = (high - low) <= TOLERANCE / fxRate.unitRate;
  if (!converged) {
    warnings.push({
      code: "REVERSE_NOT_CONVERGED",
      level: "warning",
      message: `Обратный расчёт не сошёлся за ${MAX_ITERATIONS} итераций`,
    });
  }

  const defaultResult = {
    itemId: item.id, customsValue: 0, duty: 0, antidumping: 0,
    excise: 0, vat: 0, customsFee: 0, totalCustoms: 0,
    landedCost: 0, landedCostPerUnit: 0,
  };

  return {
    maxPurchasePrice: Math.round(bestPrice * 100) / 100,
    itemResult: bestResult?.itemResults[0] ?? defaultResult,
    warnings: [...(bestResult?.warnings ?? []), ...warnings],
    converged,
    iterations,
  };
}
