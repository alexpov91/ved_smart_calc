"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Plus } from "lucide-react";
import { ModeSwitcher, type CalcMode } from "@/components/calculator/mode-switcher";
import { ItemCard, type ItemData, createEmptyItem } from "@/components/calculator/item-card";
import {
  LogisticsSection,
  type LogisticsData,
  createEmptyLogistics,
} from "@/components/calculator/logistics-section";
import { ActionBar } from "@/components/calculator/action-bar";
import { ResultsPanel } from "@/components/calculator/results-panel";
import type { CalculationOutput } from "@/engine/types";

// ── Helpers ────────────────────────────────────────────────────────────

/** Convert local LogisticsData (string fields) to the shape Convex expects */
function logisticsToConvex(l: LogisticsData) {
  return {
    freight: parseFloat(l.freight) || 0,
    freightCurrency: l.freightCurrency,
    insurance: parseFloat(l.insurance) || undefined,
    insuranceAuto: l.insuranceAuto || undefined,
    broker: parseFloat(l.broker) || undefined,
    certification: parseFloat(l.certification) || undefined,
    marking: parseFloat(l.marking) || undefined,
    bankCommission: parseFloat(l.bankCommission) || undefined,
    svh: parseFloat(l.svh) || undefined,
    transportAfterBorder: parseFloat(l.transportAfterBorder) || undefined,
  };
}

/** Convert a local ItemData (string fields) to Convex mutation args */
function itemToConvex(item: ItemData) {
  return {
    tnvedCode: item.tnvedCode,
    productName: item.productName,
    invoiceValue: parseFloat(item.invoiceValue) || 0,
    currency: item.currency,
    incoterms: item.incoterms,
    country: item.country,
    weightNet: parseFloat(item.weightNet) || 0,
    weightGross: parseFloat(item.weightGross) || 0,
    quantity: parseFloat(item.quantity) || 0,
    unit: item.unit,
  };
}

/** Convert Convex calculation item to local ItemData form state */
function convexItemToLocal(ci: {
  tnvedCode: string;
  productName: string;
  invoiceValue: number;
  currency: string;
  incoterms: string;
  country: string;
  weightNet: number;
  weightGross: number;
  quantity: number;
  unit: string;
}): ItemData {
  return {
    productName: ci.productName,
    tnvedCode: ci.tnvedCode,
    tnvedName: "",
    tnvedTariff: null,
    invoiceValue: ci.invoiceValue ? String(ci.invoiceValue) : "",
    currency: ci.currency,
    incoterms: ci.incoterms,
    country: ci.country,
    weightNet: ci.weightNet ? String(ci.weightNet) : "",
    weightGross: ci.weightGross ? String(ci.weightGross) : "",
    quantity: ci.quantity ? String(ci.quantity) : "",
    unit: ci.unit,
  };
}

// ── Page Component ────────────────────────────────────────────────────

export default function CalculatorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");
  const calcId = id as Id<"calculations"> | null;

  // ── Convex queries ──────────────────────────────────────────────────
  const calculation = useQuery(
    api.calculations.getMy,
    calcId ? { id: calcId } : "skip",
  );
  const calcItems = useQuery(
    api.calculationItems.byCalculation,
    calcId ? { calculationId: calcId } : "skip",
  );

  // ── Convex mutations ────────────────────────────────────────────────
  const createCalc = useMutation(api.calculations.create);
  const requestCalc = useMutation(api.calculations.requestCalculation);
  const updateLogistics = useMutation(api.calculations.updateLogistics);
  const updateMeta = useMutation(api.calculations.updateMeta);
  const addItem = useMutation(api.calculationItems.add);
  const updateItemMut = useMutation(api.calculationItems.update);
  const removeItemMut = useMutation(api.calculationItems.remove);

  // ── Local form state ────────────────────────────────────────────────
  const [mode, setMode] = useState<CalcMode>("direct");
  const [items, setItems] = useState<ItemData[]>([createEmptyItem()]);
  const [logistics, setLogistics] = useState<LogisticsData>(
    createEmptyLogistics(),
  );
  const [isDirty, setIsDirty] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Track Convex item IDs so we can update existing items
  const [itemIds, setItemIds] = useState<(Id<"calculationItems"> | null)[]>([null]);

  // Prevent re-populating form when data reloads after our own save
  const hasLoadedRef = useRef(false);

  // ── Populate form from loaded Convex data ───────────────────────────
  useEffect(() => {
    if (!calcId || hasLoadedRef.current) return;
    if (calculation === undefined || calcItems === undefined) return; // still loading
    if (calculation === null) return; // not found

    setMode(calculation.mode as CalcMode);

    // Populate logistics
    const l = calculation.logistics;
    setLogistics({
      freight: l.freight ? String(l.freight) : "",
      freightCurrency: l.freightCurrency ?? "USD",
      insurance: l.insurance != null ? String(l.insurance) : "",
      insuranceAuto: l.insuranceAuto ?? true,
      distributionMethod: calculation.distributionMethod ?? "by_weight",
      broker: l.broker != null ? String(l.broker) : "",
      certification: l.certification != null ? String(l.certification) : "",
      marking: l.marking != null ? String(l.marking) : "",
      bankCommission: l.bankCommission != null ? String(l.bankCommission) : "",
      svh: l.svh != null ? String(l.svh) : "",
      transportAfterBorder:
        l.transportAfterBorder != null ? String(l.transportAfterBorder) : "",
    });

    // Populate items
    if (calcItems && calcItems.length > 0) {
      setItems(calcItems.map(convexItemToLocal));
      setItemIds(calcItems.map((ci) => ci._id));
    }

    setIsDirty(false);
    hasLoadedRef.current = true;
  }, [calcId, calculation, calcItems]);

  // ── Derive status from Convex data ──────────────────────────────────
  const convexStatus = calculation?.status as
    | "draft"
    | "calculating"
    | "completed"
    | "error"
    | undefined;
  const isCalculating = convexStatus === "calculating";

  // Build CalculationOutput from Convex data for the results panel
  const calcOutput: CalculationOutput | null =
    calculation?.totals && (convexStatus === "completed" || convexStatus === "error")
      ? {
          itemResults: [], // item-level results not shown in panel currently
          totals: calculation.totals as CalculationOutput["totals"],
          warnings: (calculation.warnings ?? []) as CalculationOutput["warnings"],
          errors: (calculation.errors ?? []) as CalculationOutput["errors"],
        }
      : null;

  // ── Status message auto-clear ───────────────────────────────────────
  useEffect(() => {
    if (!statusMessage) return;
    const t = setTimeout(() => setStatusMessage(null), 3000);
    return () => clearTimeout(t);
  }, [statusMessage]);

  // ── Event handlers ──────────────────────────────────────────────────

  const handleItemChange = useCallback((index: number, updated: ItemData) => {
    setItems((prev) => prev.map((item, i) => (i === index ? updated : item)));
    setIsDirty(true);
  }, []);

  const handleDuplicate = useCallback((index: number) => {
    setItems((prev) => {
      const copy = { ...prev[index] };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
    setItemIds((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, null); // new item has no Convex ID yet
      return next;
    });
    setIsDirty(true);
  }, []);

  const handleRemove = useCallback(
    async (index: number) => {
      const removedId = itemIds[index];
      setItems((prev) => prev.filter((_, i) => i !== index));
      setItemIds((prev) => prev.filter((_, i) => i !== index));
      setIsDirty(true);

      // If the item exists in Convex, remove it
      if (removedId) {
        try {
          await removeItemMut({ id: removedId });
        } catch {
          // Ignore — item may already be gone
        }
      }
    },
    [itemIds, removeItemMut],
  );

  const handleAddItem = useCallback(() => {
    setItems((prev) => [...prev, createEmptyItem()]);
    setItemIds((prev) => [...prev, null]);
    setIsDirty(true);
  }, []);

  const handleLogisticsChange = useCallback((data: LogisticsData) => {
    setLogistics(data);
    setIsDirty(true);
  }, []);

  const handleModeChange = useCallback((newMode: CalcMode) => {
    setMode(newMode);
    setIsDirty(true);
  }, []);

  // ── Save logic ──────────────────────────────────────────────────────

  /** Persist current form state. Returns the calculation ID. */
  const saveToConvex = useCallback(async (): Promise<Id<"calculations">> => {
    const logisticsPayload = logisticsToConvex(logistics);
    const distributionMethod =
      (logistics.distributionMethod as "by_weight" | "by_value") ?? "by_weight";

    if (calcId) {
      // ── Update existing calculation ────────────────────────────────
      await updateLogistics({
        calculationId: calcId,
        logistics: logisticsPayload,
      });
      await updateMeta({
        calculationId: calcId,
        mode,
      });

      // Sync items: update existing, add new
      const newItemIds = [...itemIds];
      for (let i = 0; i < items.length; i++) {
        const existingId = newItemIds[i];
        const payload = itemToConvex(items[i]);

        if (existingId) {
          // Update existing item
          await updateItemMut({ id: existingId, ...payload });
        } else {
          // Add new item
          const newId = await addItem({
            calculationId: calcId,
            ...payload,
          });
          newItemIds[i] = newId;
        }
      }
      setItemIds(newItemIds);

      setIsDirty(false);
      return calcId;
    } else {
      // ── Create new calculation ─────────────────────────────────────
      const newCalcId = await createCalc({
        mode,
        currencyMode: "USD",
        logistics: logisticsPayload,
        distributionMethod,
      });

      // Add all items
      const newItemIds: (Id<"calculationItems"> | null)[] = [];
      for (const item of items) {
        const itemId = await addItem({
          calculationId: newCalcId,
          ...itemToConvex(item),
        });
        newItemIds.push(itemId);
      }
      setItemIds(newItemIds);

      // Update URL without full page reload
      router.replace(`/calculator?id=${newCalcId}`);
      hasLoadedRef.current = true; // prevent re-load overwriting form state

      setIsDirty(false);
      return newCalcId;
    }
  }, [
    calcId,
    items,
    itemIds,
    logistics,
    mode,
    createCalc,
    addItem,
    updateItemMut,
    updateLogistics,
    updateMeta,
    router,
  ]);

  const handleSave = useCallback(async () => {
    try {
      await saveToConvex();
      setStatusMessage("Расчёт сохранён");
    } catch (err) {
      console.error("Save failed:", err);
      setStatusMessage("Ошибка сохранения");
    }
  }, [saveToConvex]);

  const handleCalculate = useCallback(async () => {
    try {
      const savedId = await saveToConvex();
      await requestCalc({ calculationId: savedId });
      // Status will reactively switch to "calculating" via useQuery
    } catch (err) {
      console.error("Calculation failed:", err);
      setStatusMessage("Ошибка запуска расчёта");
    }
  }, [saveToConvex, requestCalc]);

  // ── Ctrl+Enter hotkey ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleCalculate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleCalculate]);

  // ── Derive display status ───────────────────────────────────────────
  const displayStatus: "draft" | "calculating" | "completed" = isCalculating
    ? "calculating"
    : calcOutput
      ? "completed"
      : "draft";

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left column: Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Mode switcher */}
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-slate-50">
              {calcId ? "Редактирование расчёта" : "Новый расчёт"}
            </h1>
            <ModeSwitcher mode={mode} onModeChange={handleModeChange} />
          </div>

          {/* Status message */}
          {statusMessage && (
            <div className="rounded-lg border border-emerald-700/50 bg-emerald-900/20 px-4 py-2 text-sm text-emerald-300">
              {statusMessage}
            </div>
          )}

          {/* Item cards */}
          {items.map((item, index) => (
            <ItemCard
              key={index}
              item={item}
              index={index}
              onChange={(updated) => handleItemChange(index, updated)}
              onDuplicate={() => handleDuplicate(index)}
              onRemove={() => handleRemove(index)}
              canRemove={items.length > 1}
            />
          ))}

          {/* Add item button */}
          <button
            type="button"
            onClick={handleAddItem}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 py-3 text-sm text-slate-500 transition-colors hover:border-slate-500 hover:text-slate-300"
          >
            <Plus className="h-4 w-4" />
            Добавить позицию
          </button>

          {/* Logistics */}
          <LogisticsSection data={logistics} onChange={handleLogisticsChange} />

          {/* Action bar */}
          <ActionBar onClick={handleCalculate} loading={isCalculating} />
        </div>
      </div>

      {/* Right column: Results */}
      <div className="hidden w-[480px] shrink-0 border-l border-slate-800 bg-slate-900/50 lg:block">
        <ResultsPanel
          calculation={calcOutput}
          logistics={{
            freight: parseFloat(logistics.freight) || undefined,
            insurance: parseFloat(logistics.insurance) || undefined,
            transportAfterBorder:
              parseFloat(logistics.transportAfterBorder) || undefined,
            broker: parseFloat(logistics.broker) || undefined,
            certification: parseFloat(logistics.certification) || undefined,
            marking: parseFloat(logistics.marking) || undefined,
            bankCommission:
              parseFloat(logistics.bankCommission) || undefined,
            svh: parseFloat(logistics.svh) || undefined,
          }}
          status={displayStatus}
          isDirty={isDirty}
          totalQuantity={items.reduce(
            (sum, it) => sum + (parseFloat(it.quantity) || 0),
            0,
          )}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
