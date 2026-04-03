"use client";

interface ItemCardStatusProps {
  tnvedCode: string;
  currency: string;
  exchangeRate: number | null;
}

export function ItemCardStatus({
  tnvedCode,
  currency,
  exchangeRate,
}: ItemCardStatusProps) {
  return (
    <div className="mt-3 flex items-center gap-3 border-t border-slate-800 pt-3 text-xs text-slate-500">
      {tnvedCode && (
        <span>
          Источник: <span className="text-slate-400">ТКС</span>
        </span>
      )}
      {currency && exchangeRate !== null && (
        <span>
          Курс {currency}:{" "}
          <span className="text-slate-400">{exchangeRate.toFixed(2)} ₽</span>
        </span>
      )}
      {tnvedCode && (
        <span className="ml-auto text-emerald-500">Код подтверждён</span>
      )}
    </div>
  );
}
