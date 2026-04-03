"use client";

import type { CalculationOutput } from "@/engine/types";
import type { Id } from "../../../convex/_generated/dataModel";
import { ResultsStatusBadge } from "./results-status-badge";
import { ResultsSummary } from "./results-summary";
import { ResultsLandedCost } from "./results-landed-cost";
import { ResultsBreakdown } from "./results-breakdown";
import { ResultsWarnings } from "./results-warnings";
import { ExportButtons } from "./export-buttons";

interface ResultsPanelProps {
  calculation: CalculationOutput | null;
  calculationId?: Id<"calculations"> | null;
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
  status: "draft" | "calculating" | "completed";
  isDirty: boolean;
  totalQuantity: number;
  onSave?: () => void;
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-800 ${className ?? "h-24"}`}
    />
  );
}

export function ResultsPanel({
  calculation,
  calculationId,
  logistics,
  status,
  isDirty,
  totalQuantity,
  onSave,
}: ResultsPanelProps) {
  const isCalculating = status === "calculating";
  const hasTotals = calculation !== null;

  return (
    <div className="lg:sticky lg:top-[72px] lg:h-[calc(100vh-72px)] overflow-y-auto p-4">
      <div className="space-y-4">
        {/* Status badge */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">Результаты</h2>
          <ResultsStatusBadge status={status} isDirty={isDirty} />
        </div>

        {/* Calculating skeleton */}
        {isCalculating && (
          <div className="space-y-4">
            <SkeletonBlock className="h-28" />
            <SkeletonBlock className="h-28" />
            <SkeletonBlock className="h-48" />
          </div>
        )}

        {/* Empty state */}
        {!isCalculating && !hasTotals && (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-700">
            <p className="text-sm text-slate-500">Нет результатов</p>
          </div>
        )}

        {/* Results */}
        {!isCalculating && hasTotals && (
          <>
            <ResultsSummary
              totalCustoms={calculation.totals.totalCustoms}
              customsValue={calculation.totals.customsValue}
            />

            <ResultsLandedCost
              landedCost={calculation.totals.landedCost}
              landedCostPerUnit={
                totalQuantity > 0
                  ? calculation.totals.landedCost / totalQuantity
                  : 0
              }
              totalQuantity={totalQuantity}
            />

            <ResultsBreakdown
              totals={calculation.totals}
              logistics={{
                ...logistics,
                // Override freight/insurance with RUB values from engine results
                freight: calculation.itemResults.reduce(
                  (sum, r) => sum + (r.allocatedFreight ?? 0),
                  0,
                ) || undefined,
                insurance: calculation.itemResults.reduce(
                  (sum, r) => sum + (r.allocatedInsurance ?? 0),
                  0,
                ) || undefined,
              }}
            />

            {calculation.warnings.length > 0 && (
              <ResultsWarnings warnings={calculation.warnings} />
            )}

            <ExportButtons
              calculationId={calculationId}
              onSave={onSave}
              canExportFiles={status === "completed"}
            />
          </>
        )}
      </div>
    </div>
  );
}
