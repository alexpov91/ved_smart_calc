"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface LogisticsData {
  freight: string;
  freightCurrency: string;
  insurance: string;
  insuranceAuto: boolean;
  distributionMethod: string;
  broker: string;
  certification: string;
  marking: string;
  bankCommission: string;
  svh: string;
  transportAfterBorder: string;
}

export function createEmptyLogistics(): LogisticsData {
  return {
    freight: "",
    freightCurrency: "USD",
    insurance: "",
    insuranceAuto: true,
    distributionMethod: "by_weight",
    broker: "",
    certification: "",
    marking: "",
    bankCommission: "",
    svh: "",
    transportAfterBorder: "",
  };
}

interface LogisticsSectionProps {
  data: LogisticsData;
  onChange: (data: LogisticsData) => void;
}

const labelClass = "mb-1 block text-xs uppercase tracking-wider text-slate-500";
const inputClass =
  "h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-sm text-slate-50 placeholder:text-slate-500 outline-none transition-colors focus:border-emerald-500";
const selectClass =
  "h-8 w-full appearance-none rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-sm text-slate-50 outline-none transition-colors focus:border-emerald-500";

export function LogisticsSection({ data, onChange }: LogisticsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = useQuery(api.referenceData.getCalculationMeta);

  function updateField<K extends keyof LogisticsData>(
    key: K,
    value: LogisticsData[K]
  ) {
    onChange({ ...data, [key]: value });
  }

  // Build collapsed summary
  const summaryParts: string[] = [];
  if (data.freight) {
    summaryParts.push(
      `Фрахт: ${Number(data.freight).toLocaleString("ru-RU")} ${data.freightCurrency}`
    );
  }
  if (data.insuranceAuto) {
    summaryParts.push("Страховка: авто");
  } else if (data.insurance) {
    summaryParts.push(
      `Страховка: ${Number(data.insurance).toLocaleString("ru-RU")}`
    );
  }
  if (data.broker) {
    summaryParts.push(
      `Брокер: ${Number(data.broker).toLocaleString("ru-RU")} ₽`
    );
  }
  const summary = summaryParts.join(" \u00b7 ") || "Не заполнено";

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 p-4 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
        <span className="text-sm font-semibold text-slate-200">
          Логистика и доп. расходы
        </span>
        {!expanded && (
          <span className="ml-2 truncate text-xs text-slate-500">
            {summary}
          </span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-slate-800 p-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {/* Freight */}
            <div>
              <label className={labelClass}>Фрахт</label>
              <input
                type="number"
                value={data.freight}
                onChange={(e) => updateField("freight", e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className={inputClass}
              />
            </div>

            {/* Freight currency */}
            <div>
              <label className={labelClass}>Валюта фрахта</label>
              <select
                value={data.freightCurrency}
                onChange={(e) =>
                  updateField("freightCurrency", e.target.value)
                }
                className={selectClass}
              >
                {meta?.currencies.map((c: string) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Insurance */}
            <div className="col-span-2">
              <label className={labelClass}>Страховка</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={data.insuranceAuto}
                    onChange={(e) =>
                      updateField("insuranceAuto", e.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 accent-emerald-500"
                  />
                  Авто 0.5%
                </label>
                {!data.insuranceAuto && (
                  <input
                    type="number"
                    value={data.insurance}
                    onChange={(e) => updateField("insurance", e.target.value)}
                    placeholder="Сумма"
                    min="0"
                    step="0.01"
                    className={`${inputClass} flex-1`}
                  />
                )}
              </div>
            </div>

            {/* Distribution method */}
            <div className="col-span-2">
              <label className={labelClass}>Метод распределения</label>
              <select
                value={data.distributionMethod}
                onChange={(e) =>
                  updateField("distributionMethod", e.target.value)
                }
                className={selectClass}
              >
                {meta?.distributionMethods.map((m: { value: string; label: string }) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Broker */}
            <div>
              <label className={labelClass}>Брокер, ₽</label>
              <input
                type="number"
                value={data.broker}
                onChange={(e) => updateField("broker", e.target.value)}
                placeholder="0"
                min="0"
                className={inputClass}
              />
            </div>

            {/* Certification */}
            <div>
              <label className={labelClass}>Сертификация, ₽</label>
              <input
                type="number"
                value={data.certification}
                onChange={(e) => updateField("certification", e.target.value)}
                placeholder="0"
                min="0"
                className={inputClass}
              />
            </div>

            {/* Marking */}
            <div>
              <label className={labelClass}>Маркировка, ₽</label>
              <input
                type="number"
                value={data.marking}
                onChange={(e) => updateField("marking", e.target.value)}
                placeholder="0"
                min="0"
                className={inputClass}
              />
            </div>

            {/* Bank commission */}
            <div>
              <label className={labelClass}>Банк. комиссия, ₽</label>
              <input
                type="number"
                value={data.bankCommission}
                onChange={(e) => updateField("bankCommission", e.target.value)}
                placeholder="0"
                min="0"
                className={inputClass}
              />
            </div>

            {/* SVH */}
            <div>
              <label className={labelClass}>СВХ, ₽</label>
              <input
                type="number"
                value={data.svh}
                onChange={(e) => updateField("svh", e.target.value)}
                placeholder="0"
                min="0"
                className={inputClass}
              />
            </div>

            {/* Transport after border */}
            <div>
              <label className={labelClass}>Транспорт по РФ, ₽</label>
              <input
                type="number"
                value={data.transportAfterBorder}
                onChange={(e) =>
                  updateField("transportAfterBorder", e.target.value)
                }
                placeholder="0"
                min="0"
                className={inputClass}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
