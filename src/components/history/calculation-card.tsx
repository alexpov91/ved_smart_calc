"use client";

import Link from "next/link";

interface CalculationCardProps {
  id: string;
  title?: string;
  mode: string;
  status: string;
  createdAt: number;
  itemCount?: number;
  totals?: {
    totalCustoms: number;
    landedCost: number;
  };
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value: number): string {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CalculationCard({
  id,
  title,
  mode,
  status,
  createdAt,
  itemCount,
  totals,
}: CalculationCardProps) {
  const modeBadge =
    mode === "reverse" ? (
      <span className="inline-block rounded-full bg-amber-600/20 px-2 py-0.5 text-xs font-medium text-amber-400">
        Обратный
      </span>
    ) : (
      <span className="inline-block rounded-full bg-emerald-600/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
        Прямой
      </span>
    );

  let statusBadge: React.ReactNode;
  if (status === "calculating") {
    statusBadge = (
      <span className="inline-block rounded-full bg-blue-600/20 px-2 py-0.5 text-xs font-medium text-blue-400 animate-pulse">
        Расчёт...
      </span>
    );
  } else if (status === "completed") {
    statusBadge = (
      <span className="inline-block rounded-full bg-emerald-600/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
        Готово
      </span>
    );
  } else if (status === "error") {
    statusBadge = (
      <span className="inline-block rounded-full bg-red-600/20 px-2 py-0.5 text-xs font-medium text-red-400">
        Ошибка
      </span>
    );
  } else {
    statusBadge = (
      <span className="inline-block rounded-full bg-slate-600/20 px-2 py-0.5 text-xs font-medium text-slate-400">
        Черновик
      </span>
    );
  }

  return (
    <Link
      href={`/calculator?id=${id}`}
      className="block rounded-lg border border-slate-800 bg-slate-900 p-4 transition-colors hover:bg-slate-800"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-slate-100">
            {title || "Без названия"}
          </h3>
          <p className="mt-1 text-xs text-slate-500">{formatDate(createdAt)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {modeBadge}
          {statusBadge}
        </div>
      </div>

      {totals && status === "completed" && (
        <div className="mt-3 flex gap-6 border-t border-slate-800 pt-3">
          <div>
            <p className="text-xs text-slate-500">Таможенные платежи</p>
            <p className="text-sm font-medium text-slate-200">
              {formatMoney(totals.totalCustoms)} ₽
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Landed Cost</p>
            <p className="text-sm font-medium text-emerald-400">
              {formatMoney(totals.landedCost)} ₽
            </p>
          </div>
        </div>
      )}

      {itemCount !== undefined && (
        <p className="mt-2 text-xs text-slate-500">
          {itemCount} {itemCount === 1 ? "позиция" : itemCount < 5 ? "позиции" : "позиций"}
        </p>
      )}
    </Link>
  );
}
