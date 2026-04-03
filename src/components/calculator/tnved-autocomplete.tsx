"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export interface TnvedSelection {
  code: string;
  name: string;
  tariff: {
    dutyRate: number;
    dutyType: string;
    vatRate: number;
  } | null;
}

interface TnvedAutocompleteProps {
  value: string;
  onSelect: (selection: TnvedSelection) => void;
  onChange: (value: string) => void;
}

export function TnvedAutocomplete({
  value,
  onSelect,
  onChange,
}: TnvedAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const debouncedValue = useDebounce(value, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useQuery(
    api.tnvedCatalog.searchLocal,
    debouncedValue.length >= 2 ? { query: debouncedValue, limit: 10 } : "skip"
  );

  const isLoading = debouncedValue.length >= 2 && results === undefined;
  const showDropdown = open && debouncedValue.length >= 2;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Код или название"
        className="h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-sm text-slate-50 placeholder:text-slate-500 outline-none transition-colors focus:border-emerald-500"
      />

      {showDropdown && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 shadow-lg">
          {isLoading && (
            <div className="px-3 py-2 text-sm text-slate-400">Поиск...</div>
          )}
          {results && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-500">
              Ничего не найдено
            </div>
          )}
          {results?.map((item: { _id: string; code: string; nameShort: string; nameFull: string; tariff: { dutyRate: number; dutyType: string; vatRate: number } | null }) => (
            <button
              key={item._id}
              type="button"
              className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-700 transition-colors"
              onClick={() => {
                onSelect({
                  code: item.code,
                  name: item.nameShort,
                  tariff: item.tariff
                    ? {
                        dutyRate: item.tariff.dutyRate,
                        dutyType: item.tariff.dutyType,
                        vatRate: item.tariff.vatRate,
                      }
                    : null,
                });
                onChange(item.code);
                setOpen(false);
              }}
            >
              <span className="font-bold text-slate-50 shrink-0">
                {item.code}
              </span>
              <span className="text-slate-300 truncate flex-1">
                {item.nameShort}
              </span>
              {item.tariff && (
                <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs font-medium text-emerald-400">
                  {item.tariff.dutyRate}%
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
