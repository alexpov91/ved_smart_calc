interface AllocatableItem {
  id: string;
  weightGross: number;
  customsValue: number;
}

export function allocateLogistics(
  items: AllocatableItem[],
  totalAmount: number,
  method: "by_weight" | "by_value"
): Map<string, number> {
  const result = new Map<string, number>();
  if (items.length === 0) return result;
  if (items.length === 1) {
    result.set(items[0].id, totalAmount);
    return result;
  }

  const totalBase = items.reduce(
    (sum, item) => sum + (method === "by_weight" ? item.weightGross : item.customsValue),
    0
  );

  if (totalBase === 0) {
    const perItem = Math.round((totalAmount / items.length) * 100) / 100;
    items.forEach((item) => result.set(item.id, perItem));
    return result;
  }

  let allocated = 0;
  items.forEach((item, index) => {
    const base = method === "by_weight" ? item.weightGross : item.customsValue;
    if (index === items.length - 1) {
      result.set(item.id, Math.round((totalAmount - allocated) * 100) / 100);
    } else {
      const share = Math.round((totalAmount * (base / totalBase)) * 100) / 100;
      result.set(item.id, share);
      allocated += share;
    }
  });

  return result;
}
