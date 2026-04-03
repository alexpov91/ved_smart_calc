"use client";

export type CalcMode = "direct" | "reverse";

interface ModeSwitcherProps {
  mode: CalcMode;
  onModeChange: (mode: CalcMode) => void;
}

export function ModeSwitcher({ mode, onModeChange }: ModeSwitcherProps) {
  return (
    <div className="inline-flex rounded-lg bg-slate-900 p-1">
      <button
        type="button"
        onClick={() => onModeChange("direct")}
        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          mode === "direct"
            ? "bg-emerald-500 font-semibold text-slate-950"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        Прямой расчёт
      </button>
      <button
        type="button"
        onClick={() => onModeChange("reverse")}
        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          mode === "reverse"
            ? "bg-emerald-500 font-semibold text-slate-950"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        Обратный расчёт
      </button>
    </div>
  );
}
