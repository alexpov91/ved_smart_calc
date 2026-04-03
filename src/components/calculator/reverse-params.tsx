"use client";

interface ReverseParamsProps {
  retailPrice: string;
  desiredMargin: string;
  onRetailPriceChange: (value: string) => void;
  onDesiredMarginChange: (value: string) => void;
}

export function ReverseParams({
  retailPrice,
  desiredMargin,
  onRetailPriceChange,
  onDesiredMarginChange,
}: ReverseParamsProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-300">
        Параметры обратного расчёта
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs text-slate-400">
            Розничная цена (₽)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={retailPrice}
            onChange={(e) => onRetailPriceChange(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">
            Желаемая маржа (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={desiredMargin}
            onChange={(e) => onDesiredMarginChange(e.target.value)}
            placeholder="0.0"
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>
    </div>
  );
}
