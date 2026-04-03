"use client";

import { Loader2 } from "lucide-react";

interface ActionBarProps {
  onClick: () => void;
  loading: boolean;
}

export function ActionBar({ onClick, loading }: ActionBarProps) {
  return (
    <div className="sticky bottom-0 z-10 bg-slate-950 pt-4 pb-2">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Расчёт..." : "Рассчитать"}
      </button>
    </div>
  );
}
