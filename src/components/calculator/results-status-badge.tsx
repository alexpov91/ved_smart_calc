"use client";

interface ResultsStatusBadgeProps {
  status: string;
  isDirty: boolean;
}

export function ResultsStatusBadge({ status, isDirty }: ResultsStatusBadgeProps) {
  let label: string;
  let classes: string;

  if (status === "calculating") {
    label = "Идёт расчёт...";
    classes = "bg-blue-600 text-white animate-pulse";
  } else if (isDirty) {
    label = "Требуется пересчёт";
    classes = "bg-amber-600 text-white";
  } else if (status === "completed") {
    label = "Актуально";
    classes = "bg-emerald-600 text-white";
  } else {
    label = "Черновик";
    classes = "bg-slate-600 text-slate-200";
  }

  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}
