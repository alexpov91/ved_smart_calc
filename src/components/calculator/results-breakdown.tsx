"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface BreakdownRow {
  label: string;
  value: number | null;
  note?: string;
}

interface BreakdownGroupProps {
  title: string;
  rows: BreakdownRow[];
}

function formatRub(value: number): string {
  return value.toLocaleString("ru-RU") + " \u20BD";
}

function BreakdownGroup({ title, rows }: BreakdownGroupProps) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-slate-100"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {title}
      </button>
      {open && (
        <div className="space-y-0">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between border-b border-slate-800 py-2 text-sm"
            >
              <span className="text-slate-400">
                {row.label}
                {row.note && (
                  <span className="ml-1 text-xs text-slate-500">
                    ({row.note})
                  </span>
                )}
              </span>
              <span className="font-medium text-slate-50">
                {row.value != null && row.value !== 0
                  ? formatRub(row.value)
                  : "\u2014"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ResultsBreakdownProps {
  totals: {
    customsValue: number;
    duty: number;
    antidumping: number;
    excise: number;
    vat: number;
    customsFee: number;
  };
  logistics: {
    freight?: number;
    insurance?: number;
    transportAfterBorder?: number;
    broker?: number;
    certification?: number;
    marking?: number;
    bankCommission?: number;
    svh?: number;
  };
  dutyNote?: string;
  vatRate?: number;
}

export function ResultsBreakdown({
  totals,
  logistics,
  dutyNote,
  vatRate,
}: ResultsBreakdownProps) {
  const customsRows: BreakdownRow[] = [
    { label: "Таможенная стоимость", value: totals.customsValue },
    { label: "Пошлина", value: totals.duty, note: dutyNote },
    { label: "Антидемпинг", value: totals.antidumping },
    { label: "Акциз", value: totals.excise },
    {
      label: "НДС",
      value: totals.vat,
      note: vatRate != null ? `${vatRate}%` : undefined,
    },
    { label: "Таможенный сбор", value: totals.customsFee },
  ];

  const logisticsRows: BreakdownRow[] = [
    { label: "Фрахт до границы", value: logistics.freight ?? null },
    { label: "Страховка", value: logistics.insurance ?? null },
    {
      label: "Транспорт после границы",
      value: logistics.transportAfterBorder ?? null,
    },
  ];

  const servicesRows: BreakdownRow[] = [
    { label: "Брокер", value: logistics.broker ?? null },
    { label: "Сертификация", value: logistics.certification ?? null },
    { label: "Маркировка", value: logistics.marking ?? null },
    { label: "Банковская комиссия", value: logistics.bankCommission ?? null },
    { label: "СВХ", value: logistics.svh ?? null },
  ];

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 space-y-1">
      <BreakdownGroup title="Таможенные платежи" rows={customsRows} />
      <BreakdownGroup title="Логистика" rows={logisticsRows} />
      <BreakdownGroup title="Дополнительные услуги" rows={servicesRows} />
    </div>
  );
}
