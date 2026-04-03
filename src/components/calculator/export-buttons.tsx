"use client";

import { useState, useCallback, useEffect } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Loader2 } from "lucide-react";

interface ExportButtonsProps {
  calculationId?: Id<"calculations"> | null;
  onSave?: () => void;
  loadingSave?: boolean;
}

interface ExportBtnProps {
  label: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
}

function ExportBtn({ label, onClick, loading, disabled }: ExportBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled || !onClick}
      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200 disabled:opacity-50"
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {label}
    </button>
  );
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function ExportButtons({
  calculationId,
  onSave,
  loadingSave,
}: ExportButtonsProps) {
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingXlsx, setLoadingXlsx] = useState(false);
  const [pdfExportId, setPdfExportId] = useState<Id<"exports"> | null>(null);
  const [xlsxExportId, setXlsxExportId] = useState<Id<"exports"> | null>(null);

  const requestPdf = useAction(api.exports.requestPdf);
  const requestXlsx = useAction(api.exports.requestXlsx);

  // Watch export status reactively
  const pdfDownload = useQuery(
    api.exports.getDownloadUrl,
    pdfExportId ? { exportId: pdfExportId } : "skip",
  );
  const xlsxDownload = useQuery(
    api.exports.getDownloadUrl,
    xlsxExportId ? { exportId: xlsxExportId } : "skip",
  );

  // Auto-download when PDF becomes ready
  useEffect(() => {
    if (pdfDownload?.url && pdfDownload?.filename && loadingPdf) {
      triggerDownload(pdfDownload.url, pdfDownload.filename);
      setLoadingPdf(false);
      setPdfExportId(null);
    }
  }, [pdfDownload, loadingPdf]);

  // Auto-download when Excel becomes ready
  useEffect(() => {
    if (xlsxDownload?.url && xlsxDownload?.filename && loadingXlsx) {
      triggerDownload(xlsxDownload.url, xlsxDownload.filename);
      setLoadingXlsx(false);
      setXlsxExportId(null);
    }
  }, [xlsxDownload, loadingXlsx]);

  const handleExportPdf = useCallback(async () => {
    if (!calculationId) return;
    setLoadingPdf(true);
    try {
      const exportId = await requestPdf({ calculationId });
      setPdfExportId(exportId);
    } catch (err) {
      console.error("PDF export failed:", err);
      setLoadingPdf(false);
    }
  }, [calculationId, requestPdf]);

  const handleExportXlsx = useCallback(async () => {
    if (!calculationId) return;
    setLoadingXlsx(true);
    try {
      const exportId = await requestXlsx({ calculationId });
      setXlsxExportId(exportId);
    } catch (err) {
      console.error("Excel export failed:", err);
      setLoadingXlsx(false);
    }
  }, [calculationId, requestXlsx]);

  const canExport = !!calculationId;

  return (
    <div className="flex gap-2">
      <ExportBtn
        label="PDF"
        onClick={canExport ? handleExportPdf : undefined}
        loading={loadingPdf}
        disabled={!canExport}
      />
      <ExportBtn
        label="Excel"
        onClick={canExport ? handleExportXlsx : undefined}
        loading={loadingXlsx}
        disabled={!canExport}
      />
      <ExportBtn
        label="Сохранить"
        onClick={onSave}
        loading={loadingSave}
      />
    </div>
  );
}
