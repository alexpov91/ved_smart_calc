"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { TnvedAutocomplete, type TnvedSelection } from "./tnved-autocomplete";
import { ItemCardStatus } from "./item-card-status";
import { Copy, X } from "lucide-react";

export interface ItemData {
  productName: string;
  tnvedCode: string;
  tnvedName: string;
  tnvedTariff: TnvedSelection["tariff"];
  invoiceValue: string;
  currency: string;
  incoterms: string;
  country: string;
  weightNet: string;
  weightGross: string;
  quantity: string;
  unit: string;
}

export function createEmptyItem(): ItemData {
  return {
    productName: "",
    tnvedCode: "",
    tnvedName: "",
    tnvedTariff: null,
    invoiceValue: "",
    currency: "USD",
    incoterms: "FOB",
    country: "CN",
    weightNet: "",
    weightGross: "",
    quantity: "",
    unit: "шт",
  };
}

interface ItemCardProps {
  item: ItemData;
  index: number;
  onChange: (item: ItemData) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  canRemove: boolean;
}

const labelClass = "mb-1 block text-xs uppercase tracking-wider text-slate-500";
const inputClass =
  "h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-sm text-slate-50 placeholder:text-slate-500 outline-none transition-colors focus:border-emerald-500";
const selectClass =
  "h-8 w-full appearance-none rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-sm text-slate-50 outline-none transition-colors focus:border-emerald-500";

export function ItemCard({
  item,
  index,
  onChange,
  onDuplicate,
  onRemove,
  canRemove,
}: ItemCardProps) {
  const meta = useQuery(api.referenceData.getCalculationMeta);
  const exchangeRateData = useQuery(
    api.exchangeRates.getCurrent,
    item.currency ? { currency: item.currency } : "skip"
  );

  function updateField<K extends keyof ItemData>(key: K, value: ItemData[K]) {
    onChange({ ...item, [key]: value });
  }

  function handleTnvedSelect(selection: TnvedSelection) {
    onChange({
      ...item,
      tnvedCode: selection.code,
      tnvedName: selection.name,
      tnvedTariff: selection.tariff,
    });
  }

  const exchangeRate = exchangeRateData?.rate ?? null;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">
          Позиция {index + 1}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDuplicate}
            className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
            title="Дублировать"
          >
            <Copy className="h-4 w-4" />
          </button>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-red-400 transition-colors"
              title="Удалить"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        {/* Product name - full width */}
        <div className="col-span-2">
          <label className={labelClass}>Название товара</label>
          <input
            type="text"
            value={item.productName}
            onChange={(e) => updateField("productName", e.target.value)}
            placeholder="Введите название товара"
            className={inputClass}
          />
        </div>

        {/* TNVED - full width */}
        <div className="col-span-2">
          <label className={labelClass}>Код ТНВЭД</label>
          <TnvedAutocomplete
            value={item.tnvedCode}
            onChange={(val) => updateField("tnvedCode", val)}
            onSelect={handleTnvedSelect}
          />
          {item.tnvedName && (
            <p className="mt-1 text-xs text-slate-500 truncate">
              {item.tnvedName}
            </p>
          )}
        </div>

        {/* Invoice value */}
        <div>
          <label className={labelClass}>Стоимость</label>
          <input
            type="number"
            value={item.invoiceValue}
            onChange={(e) => updateField("invoiceValue", e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className={inputClass}
          />
        </div>

        {/* Currency */}
        <div>
          <label className={labelClass}>Валюта</label>
          <div className="flex items-center gap-2">
            <select
              value={item.currency}
              onChange={(e) => updateField("currency", e.target.value)}
              className={selectClass}
            >
              {meta?.currencies.map((c: string) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {exchangeRate !== null && (
              <span className="shrink-0 text-xs text-slate-500 whitespace-nowrap">
                {exchangeRate.toFixed(2)} ₽
              </span>
            )}
          </div>
        </div>

        {/* Incoterms */}
        <div>
          <label className={labelClass}>Инкотермс</label>
          <select
            value={item.incoterms}
            onChange={(e) => updateField("incoterms", e.target.value)}
            className={selectClass}
          >
            {meta?.incoterms.map((i: string) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>

        {/* Country */}
        <div>
          <label className={labelClass}>Страна</label>
          <select
            value={item.country}
            onChange={(e) => updateField("country", e.target.value)}
            className={selectClass}
          >
            {meta?.countries.map((c: { code: string; name: string }) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Weight net */}
        <div>
          <label className={labelClass}>Вес нетто, кг</label>
          <input
            type="number"
            value={item.weightNet}
            onChange={(e) => updateField("weightNet", e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className={inputClass}
          />
        </div>

        {/* Weight gross */}
        <div>
          <label className={labelClass}>Вес брутто, кг</label>
          <input
            type="number"
            value={item.weightGross}
            onChange={(e) => updateField("weightGross", e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className={inputClass}
          />
        </div>

        {/* Quantity */}
        <div>
          <label className={labelClass}>Количество</label>
          <input
            type="number"
            value={item.quantity}
            onChange={(e) => updateField("quantity", e.target.value)}
            placeholder="0"
            min="0"
            step="1"
            className={inputClass}
          />
        </div>

        {/* Unit */}
        <div>
          <label className={labelClass}>Ед. измерения</label>
          <select
            value={item.unit}
            onChange={(e) => updateField("unit", e.target.value)}
            className={selectClass}
          >
            {meta?.units.map((u: string) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status line */}
      <ItemCardStatus
        tnvedCode={item.tnvedCode}
        currency={item.currency}
        exchangeRate={exchangeRate}
      />
    </div>
  );
}
