import { describe, it, expect } from "vitest";
import { allocateLogistics } from "../allocate";

describe("allocateLogistics", () => {
  const items = [
    { id: "a", weightGross: 100, customsValue: 500000 },
    { id: "b", weightGross: 300, customsValue: 500000 },
  ];

  it("distributes by weight proportionally", () => {
    const result = allocateLogistics(items, 40000, "by_weight");
    expect(result.get("a")).toBe(10000);
    expect(result.get("b")).toBe(30000);
  });

  it("distributes by value proportionally (equal values = equal split)", () => {
    const result = allocateLogistics(items, 40000, "by_value");
    expect(result.get("a")).toBe(20000);
    expect(result.get("b")).toBe(20000);
  });

  it("handles single item (gets everything)", () => {
    const single = [{ id: "a", weightGross: 100, customsValue: 500000 }];
    const result = allocateLogistics(single, 40000, "by_weight");
    expect(result.get("a")).toBe(40000);
  });

  it("handles empty items", () => {
    const result = allocateLogistics([], 40000, "by_weight");
    expect(result.size).toBe(0);
  });

  it("handles zero total weight (equal split fallback)", () => {
    const zeroWeight = [
      { id: "a", weightGross: 0, customsValue: 500000 },
      { id: "b", weightGross: 0, customsValue: 500000 },
    ];
    const result = allocateLogistics(zeroWeight, 40000, "by_weight");
    expect(result.get("a")).toBe(20000);
    expect(result.get("b")).toBe(20000);
  });

  it("last item gets remainder to avoid rounding errors", () => {
    const three = [
      { id: "a", weightGross: 1, customsValue: 100 },
      { id: "b", weightGross: 1, customsValue: 100 },
      { id: "c", weightGross: 1, customsValue: 100 },
    ];
    const result = allocateLogistics(three, 10000, "by_weight");
    const total = (result.get("a") ?? 0) + (result.get("b") ?? 0) + (result.get("c") ?? 0);
    expect(total).toBe(10000); // no rounding loss
  });

  it("handles zero amount", () => {
    const result = allocateLogistics(items, 0, "by_weight");
    expect(result.get("a")).toBe(0);
    expect(result.get("b")).toBe(0);
  });
});
