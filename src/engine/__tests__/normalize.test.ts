import { describe, it, expect } from "vitest";
import { adjustForIncoterms, convertToRub } from "../normalize";

describe("adjustForIncoterms", () => {
  it("FOB: adds freight and insurance to get CIF", () => {
    const result = adjustForIncoterms({
      invoiceValue: 50000,
      incoterms: "FOB",
      freightToBorder: 5000,
      insurance: 500,
    });
    expect(result).toBe(55500);
  });

  it("EXW: adds all transport costs", () => {
    const result = adjustForIncoterms({
      invoiceValue: 50000,
      incoterms: "EXW",
      freightToBorder: 7000,
      insurance: 500,
    });
    expect(result).toBe(57500);
  });

  it("CIF: returns invoice value unchanged", () => {
    const result = adjustForIncoterms({
      invoiceValue: 50000,
      incoterms: "CIF",
      freightToBorder: 5000,
      insurance: 500,
    });
    expect(result).toBe(50000);
  });

  it("CFR: adds only insurance", () => {
    const result = adjustForIncoterms({
      invoiceValue: 50000,
      incoterms: "CFR",
      freightToBorder: 5000,
      insurance: 500,
    });
    expect(result).toBe(50500);
  });

  it("CPT: adds only insurance", () => {
    const result = adjustForIncoterms({
      invoiceValue: 50000,
      incoterms: "CPT",
      freightToBorder: 0,
      insurance: 500,
    });
    expect(result).toBe(50500);
  });

  it("DAP: returns invoice value unchanged", () => {
    const result = adjustForIncoterms({
      invoiceValue: 50000,
      incoterms: "DAP",
      freightToBorder: 5000,
      insurance: 500,
    });
    expect(result).toBe(50000);
  });

  it("handles case-insensitive incoterms", () => {
    const result = adjustForIncoterms({
      invoiceValue: 50000,
      incoterms: "fob",
      freightToBorder: 5000,
      insurance: 500,
    });
    expect(result).toBe(55500);
  });
});

describe("convertToRub", () => {
  it("converts USD to RUB", () => {
    expect(convertToRub(1000, 84.38)).toBe(84380);
  });

  it("converts with precision to 2 decimal places", () => {
    expect(convertToRub(33.33, 84.38)).toBe(2812.39);
  });

  it("handles zero", () => {
    expect(convertToRub(0, 84.38)).toBe(0);
  });
});
