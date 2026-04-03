"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CalculationCard } from "./calculation-card";

export function CalculationList() {
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const result = useQuery(api.calculations.listMy, { limit: 20, cursor });

  if (result === undefined) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
      </div>
    );
  }

  const { items, nextCursor } = result;

  if (items.length === 0 && cursor === undefined) {
    return (
      <p className="py-12 text-center text-sm text-slate-500">
        Нет сохранённых расчётов
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((calc: { _id: string; title?: string; mode: string; status: string; createdAt: number; totals?: Record<string, number> }) => (
        <CalculationCard
          key={calc._id}
          id={calc._id}
          title={calc.title}
          mode={calc.mode}
          status={calc.status}
          createdAt={calc.createdAt}
          totals={
            calc.totals as
              | { totalCustoms: number; landedCost: number }
              | undefined
          }
        />
      ))}

      {nextCursor !== undefined && (
        <button
          type="button"
          onClick={() => setCursor(nextCursor)}
          className="w-full rounded-lg border border-slate-700 py-2 text-sm text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-300"
        >
          Загрузить ещё
        </button>
      )}
    </div>
  );
}
