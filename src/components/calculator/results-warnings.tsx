"use client";

import { Info, AlertTriangle, AlertCircle } from "lucide-react";
import type { Warning } from "@/engine/types";

interface ResultsWarningsProps {
  warnings: Warning[];
}

const levelConfig = {
  info: {
    bg: "bg-blue-950",
    border: "border-blue-400",
    text: "text-blue-400",
    Icon: Info,
  },
  warning: {
    bg: "bg-amber-950",
    border: "border-amber-400",
    text: "text-amber-400",
    Icon: AlertTriangle,
  },
  critical: {
    bg: "bg-red-950",
    border: "border-red-400",
    text: "text-red-400",
    Icon: AlertCircle,
  },
};

export function ResultsWarnings({ warnings }: ResultsWarningsProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((w, i) => {
        const cfg = levelConfig[w.level];
        const IconComponent = cfg.Icon;
        return (
          <div
            key={`${w.code}-${i}`}
            className={`flex items-start gap-3 rounded-lg border ${cfg.border} ${cfg.bg} p-3`}
          >
            <IconComponent className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.text}`} />
            <div className="min-w-0 text-sm">
              <p className={cfg.text}>{w.message}</p>
              {w.itemId && (
                <p className="mt-0.5 text-xs text-slate-500">
                  Позиция: {w.itemId}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
