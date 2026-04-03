import type {
  CalculationInput,
  CalculationOutput,
  ItemResult,
  Warning,
  EngineError,
} from "./types";
import { adjustForIncoterms, convertToRub } from "./normalize";
import { allocateLogistics } from "./allocate";
import { generateWarnings } from "./warnings";

/** Round to 2 decimal places */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Look up the customs fee from the fee scale based on total customs value.
 */
function lookupCustomsFee(
  totalCustomsValue: number,
  scale: { minValue: number; maxValue: number; fee: number }[]
): number {
  for (const band of scale) {
    if (totalCustomsValue >= band.minValue && totalCustomsValue <= band.maxValue) {
      return band.fee;
    }
  }
  // If above all bands, return the last band's fee
  return scale[scale.length - 1].fee;
}

/**
 * Main direct calculation engine.
 * Computes customs duties, VAT, fees, and landed cost for imported goods.
 */
export function calculateDirect(input: CalculationInput): CalculationOutput {
  const {
    items,
    tariffs,
    fxRates,
    eurRate,
    customsFeeScale,
    antidumping,
    excise,
    logistics,
    distributionMethod,
  } = input;

  const errors: EngineError[] = [];
  const warnings: Warning[] = [];
  const itemResults: ItemResult[] = [];

  // ── Step 1: Calculate customs value per item ──

  // First, allocate freight by weight or value.
  // For freight allocation we need weights/values before CIF conversion,
  // so we use gross weight or invoice value directly.
  const freightAllocItems = items.map((item) => ({
    id: item.id,
    weightGross: item.weightGross,
    // For by_value allocation of freight, use invoice value as proxy
    customsValue: item.invoiceValue,
  }));

  const freightShares = allocateLogistics(
    freightAllocItems,
    logistics.freight,
    distributionMethod
  );

  // Calculate insurance amounts per item
  // If insuranceAuto, insurance = 0.5% of invoice value per item (in freight currency)
  // If absolute, allocate like freight
  let insuranceShares: Map<string, number>;
  if (logistics.insuranceAuto) {
    insuranceShares = new Map();
    for (const item of items) {
      // Auto insurance: 0.5% of invoice value in original currency
      // We need it in freight currency for CIF adjustment. Since freight and invoice
      // may differ in currency, we calculate in item's currency and use that.
      insuranceShares.set(item.id, r2(item.invoiceValue * 0.005));
    }
  } else if (logistics.insurance != null && logistics.insurance > 0) {
    const insAllocItems = items.map((item) => ({
      id: item.id,
      weightGross: item.weightGross,
      customsValue: item.invoiceValue,
    }));
    insuranceShares = allocateLogistics(insAllocItems, logistics.insurance, distributionMethod);
  } else {
    insuranceShares = new Map();
    for (const item of items) {
      insuranceShares.set(item.id, 0);
    }
  }

  // Per-item customs value calculation
  interface ItemIntermediate {
    itemId: string;
    customsValue: number; // RUB
    tariffFound: boolean;
  }

  const intermediates: ItemIntermediate[] = [];

  for (const item of items) {
    // Get tariff
    const tariff = tariffs.get(item.tnvedCode);
    if (!tariff) {
      errors.push({
        code: "MISSING_TARIFF",
        message: `Tariff not found for TNVED code ${item.tnvedCode}`,
        itemId: item.id,
      });
      intermediates.push({ itemId: item.id, customsValue: 0, tariffFound: false });
      continue;
    }

    // Get FX rate for item currency
    const fxRate = fxRates.get(item.currency);
    if (!fxRate) {
      errors.push({
        code: "MISSING_FX_RATE",
        message: `FX rate not found for currency ${item.currency}`,
        itemId: item.id,
      });
      intermediates.push({ itemId: item.id, customsValue: 0, tariffFound: false });
      continue;
    }

    // Freight share for this item (in freight currency)
    const freightShare = freightShares.get(item.id) ?? 0;
    const insuranceShare = insuranceShares.get(item.id) ?? 0;

    // Convert freight to item's currency if different
    // For simplicity: if freight currency == item currency, use directly.
    // Otherwise convert: freightInItemCurr = freightShare * freightFxRate / itemFxRate
    let freightInItemCurrency = freightShare;
    let insuranceInItemCurrency = insuranceShare;

    if (logistics.freightCurrency !== item.currency && freightShare > 0) {
      const freightFx = fxRates.get(logistics.freightCurrency);
      if (freightFx) {
        // Convert: freightShare (in freightCurrency) -> RUB -> itemCurrency
        freightInItemCurrency = r2((freightShare * freightFx.unitRate) / fxRate.unitRate);
      }
    }

    // Insurance from insuranceAuto is already in item's currency
    // Insurance from absolute allocation is in freight currency
    if (!logistics.insuranceAuto && logistics.freightCurrency !== item.currency && insuranceShare > 0) {
      const freightFx = fxRates.get(logistics.freightCurrency);
      if (freightFx) {
        insuranceInItemCurrency = r2((insuranceShare * freightFx.unitRate) / fxRate.unitRate);
      }
    }

    // Adjust for incoterms -> CIF equivalent (in item's original currency)
    const cifValue = adjustForIncoterms({
      invoiceValue: item.invoiceValue,
      incoterms: item.incoterms,
      freightToBorder: freightInItemCurrency,
      insurance: insuranceInItemCurrency,
    });

    // Convert to RUB
    const customsValue = convertToRub(cifValue, fxRate.unitRate);

    intermediates.push({ itemId: item.id, customsValue, tariffFound: true });
  }

  // ── Step 2: Total customs value ──
  const totalCustomsValue = intermediates.reduce((sum, i) => sum + i.customsValue, 0);

  // ── Step 3: Customs fee (shipment-level) ──
  const totalCustomsFee = lookupCustomsFee(totalCustomsValue, customsFeeScale);

  // ── Step 4: Allocate fee proportionally by customs value ──
  const feeAllocItems = intermediates
    .filter((i) => i.tariffFound)
    .map((i) => ({
      id: i.itemId,
      weightGross: 0,
      customsValue: i.customsValue,
    }));

  const feeShares = allocateLogistics(feeAllocItems, totalCustomsFee, "by_value");

  // ── Step 5: Per-item duty, VAT, totals ──
  for (const item of items) {
    const intermediate = intermediates.find((i) => i.itemId === item.id);
    if (!intermediate || !intermediate.tariffFound) continue;

    const tariff = tariffs.get(item.tnvedCode)!;
    const customsValue = intermediate.customsValue;

    // Calculate duty
    let duty = 0;
    if (tariff.dutyType === "advalorem") {
      duty = r2(customsValue * (tariff.dutyRate / 100));
    } else if (tariff.dutyType === "specific") {
      duty = r2(item.quantity * (tariff.dutySpecific ?? 0) * eurRate.unitRate);
    } else if (tariff.dutyType === "combined") {
      const advalorem = r2(customsValue * (tariff.dutyRate / 100));
      const specific = r2(item.quantity * (tariff.dutySpecific ?? 0) * eurRate.unitRate);
      duty = Math.max(advalorem, specific);
    }

    // Antidumping
    const adMatch = antidumping.get(item.id);
    const antidumpingDuty = adMatch ? r2(customsValue * (adMatch.rate / 100)) : 0;

    // Excise
    const exciseMatch = excise.get(item.id);
    const exciseDuty = exciseMatch ? r2(item.quantity * exciseMatch.ratePerUnit) : 0;

    // VAT: base = customsValue + duty + antidumping + excise
    const vatBase = customsValue + duty + antidumpingDuty + exciseDuty;
    const vat = r2(vatBase * (tariff.vatRate / 100));

    // Fee share
    const feeShare = feeShares.get(item.id) ?? 0;

    // Total customs payments
    const totalCustoms = r2(duty + antidumpingDuty + exciseDuty + vat + feeShare);

    // Landed cost: customsValue + totalCustomsPayments + domesticCosts share
    const domesticCosts =
      (logistics.broker ?? 0) +
      (logistics.certification ?? 0) +
      (logistics.marking ?? 0) +
      (logistics.bankCommission ?? 0) +
      (logistics.svh ?? 0) +
      (logistics.transportAfterBorder ?? 0);

    // Count items with tariff found for domestic cost splitting
    const validItemCount = intermediates.filter((i) => i.tariffFound).length;
    const domesticShare = r2(domesticCosts / validItemCount);

    const landedCost = r2(customsValue + totalCustoms + domesticShare);
    const landedCostPerUnit = r2(landedCost / item.quantity);

    // Compute allocated freight/insurance in RUB for snapshot
    const freightShare = freightShares.get(item.id) ?? 0;
    const insuranceShare = insuranceShares.get(item.id) ?? 0;
    const freightFx = fxRates.get(logistics.freightCurrency);
    const allocatedFreightRub = freightFx
      ? Math.round(freightShare * freightFx.unitRate * 100) / 100
      : freightShare;
    const allocatedInsuranceRub = logistics.insuranceAuto
      ? Math.round(insuranceShare * (fxRates.get(item.currency)?.unitRate ?? 1) * 100) / 100
      : freightFx
        ? Math.round(insuranceShare * freightFx.unitRate * 100) / 100
        : insuranceShare;

    itemResults.push({
      itemId: item.id,
      customsValue,
      duty,
      antidumping: antidumpingDuty,
      excise: exciseDuty,
      vat,
      customsFee: feeShare,
      totalCustoms,
      landedCost,
      landedCostPerUnit,
      allocatedFreight: allocatedFreightRub,
      allocatedInsurance: allocatedInsuranceRub,
    });

    // Generate warnings
    const itemWarnings = generateWarnings({
      itemId: item.id,
      tariff,
      staleTariff: false,
      fxDateMismatch: false,
    });
    warnings.push(...itemWarnings);
  }

  // ── Step 6: Aggregate totals ──
  const totals = {
    customsValue: r2(itemResults.reduce((s, r) => s + r.customsValue, 0)),
    duty: r2(itemResults.reduce((s, r) => s + r.duty, 0)),
    antidumping: r2(itemResults.reduce((s, r) => s + r.antidumping, 0)),
    excise: r2(itemResults.reduce((s, r) => s + r.excise, 0)),
    vat: r2(itemResults.reduce((s, r) => s + r.vat, 0)),
    customsFee: totalCustomsFee,
    totalCustoms: r2(itemResults.reduce((s, r) => s + r.totalCustoms, 0)),
    landedCost: r2(itemResults.reduce((s, r) => s + r.landedCost, 0)),
  };

  return {
    itemResults,
    totals,
    warnings,
    errors,
  };
}
