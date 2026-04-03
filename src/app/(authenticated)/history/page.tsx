"use client";

import { CalculationList } from "@/components/history/calculation-list";

export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-50">
        История расчётов
      </h1>
      <CalculationList />
    </div>
  );
}
