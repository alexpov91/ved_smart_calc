"use client";

interface ResultsSummaryProps {
  totalCustoms: number;
  customsValue: number;
}

function formatRub(value: number): string {
  return value.toLocaleString("ru-RU") + " \u20BD";
}

export function ResultsSummary({ totalCustoms, customsValue }: ResultsSummaryProps) {
  const pct = customsValue > 0 ? ((totalCustoms / customsValue) * 100).toFixed(1) : "0.0";

  return (
    <div className="rounded-lg border border-emerald-700 bg-slate-900 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
        Итого таможенные платежи
      </p>
      <p className="mt-2 text-3xl font-bold text-emerald-400">
        {formatRub(totalCustoms)}
      </p>
      <p className="mt-1 text-sm text-slate-400">
        {pct}% от таможенной стоимости
      </p>
    </div>
  );
}
