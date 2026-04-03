import { describe, it, expect } from "vitest";
import { generateWarnings } from "../warnings";
import type { TariffSnapshot } from "../types";

const baseTariff: TariffSnapshot = {
  tnvedCode: "9403202009",
  dutyType: "advalorem",
  dutyRate: 8,
  vatRate: 22,
  needsCertification: false,
  needsMarking: false,
  source: "TWS",
  fetchedAt: Date.now(),
};

describe("generateWarnings", () => {
  it("warns about certification when needed", () => {
    const tariff = { ...baseTariff, needsCertification: true };
    const warnings = generateWarnings({
      itemId: "item1",
      tariff,
      staleTariff: false,
      fxDateMismatch: false,
    });
    expect(warnings.some((w) => w.code === "CERT_REQUIRED")).toBe(true);
    expect(warnings.find((w) => w.code === "CERT_REQUIRED")?.level).toBe("info");
  });

  it("warns about marking when needed", () => {
    const tariff = { ...baseTariff, needsMarking: true };
    const warnings = generateWarnings({
      itemId: "item1",
      tariff,
      staleTariff: false,
      fxDateMismatch: false,
    });
    expect(warnings.some((w) => w.code === "MARKING_REQUIRED")).toBe(true);
  });

  it("warns about stale tariff", () => {
    const warnings = generateWarnings({
      itemId: "item1",
      tariff: baseTariff,
      staleTariff: true,
      fxDateMismatch: false,
    });
    expect(warnings.some((w) => w.code === "STALE_TARIFF")).toBe(true);
    expect(warnings.find((w) => w.code === "STALE_TARIFF")?.level).toBe("warning");
  });

  it("warns about FX date mismatch", () => {
    const warnings = generateWarnings({
      itemId: "item1",
      tariff: baseTariff,
      staleTariff: false,
      fxDateMismatch: true,
      fxWarning: "Курс на 2026-04-03 не найден, использован курс на 2026-04-02",
    });
    expect(warnings.some((w) => w.code === "FX_DATE_MISMATCH")).toBe(true);
    expect(warnings.find((w) => w.code === "FX_DATE_MISMATCH")?.level).toBe("warning");
  });

  it("returns empty array when no warnings needed", () => {
    const warnings = generateWarnings({
      itemId: "item1",
      tariff: baseTariff,
      staleTariff: false,
      fxDateMismatch: false,
    });
    expect(warnings).toHaveLength(0);
  });

  it("includes itemId in all warnings", () => {
    const tariff = { ...baseTariff, needsCertification: true, needsMarking: true };
    const warnings = generateWarnings({
      itemId: "item42",
      tariff,
      staleTariff: true,
      fxDateMismatch: true,
      fxWarning: "test",
    });
    expect(warnings.every((w) => w.itemId === "item42")).toBe(true);
  });

  it("can generate multiple warnings at once", () => {
    const tariff = { ...baseTariff, needsCertification: true, needsMarking: true };
    const warnings = generateWarnings({
      itemId: "item1",
      tariff,
      staleTariff: true,
      fxDateMismatch: false,
    });
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });
});
