"use client";

interface ResultsLandedCostProps {
  landedCost: number;
  landedCostPerUnit: number;
  totalQuantity: number;
}

function formatRub(value: number): string {
  return value.toLocaleString("ru-RU") + " \u20BD";
}

export function ResultsLandedCost({
  landedCost,
  landedCostPerUnit,
}: ResultsLandedCostProps) {
  return (
    <div className="rounded-lg border border-amber-700 bg-slate-900 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
        Полная себестоимость
      </p>
      <p className="mt-2 text-3xl font-bold text-amber-400">
        {formatRub(landedCost)}
      </p>
      <p className="mt-1 text-sm text-slate-400">
        {formatRub(landedCostPerUnit)} за единицу
      </p>
    </div>
  );
}
