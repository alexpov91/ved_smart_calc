import { v } from "convex/values";
import {
  query,
  action,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getUserId } from "./helpers/auth";
import { assertCalculationOwner } from "./helpers/ownership";
import type { Id } from "./_generated/dataModel";

// ── Public Queries ──────────────────────────────────────────────────

export const listByCalculation = query({
  args: { calculationId: v.id("calculations") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    await assertCalculationOwner(ctx, args.calculationId, userId);

    return await ctx.db
      .query("exports")
      .withIndex("by_calculationId", (q) =>
        q.eq("calculationId", args.calculationId),
      )
      .collect();
  },
});

export const getStatus = query({
  args: { exportId: v.id("exports") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const exp = await ctx.db.get(args.exportId);
    if (!exp || exp.userId !== userId) {
      throw new Error("Export not found or access denied");
    }
    return {
      _id: exp._id,
      status: exp.status,
      filename: exp.filename,
      errorMessage: exp.errorMessage,
    };
  },
});

export const getDownloadUrl = query({
  args: { exportId: v.id("exports") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const exp = await ctx.db.get(args.exportId);
    if (!exp || exp.userId !== userId) {
      throw new Error("Export not found or access denied");
    }
    if (exp.status !== "ready" || !exp.storageId) {
      return null;
    }
    const url = await ctx.storage.getUrl(exp.storageId as Id<"_storage">);
    return { url, filename: exp.filename };
  },
});

// ── Internal Mutations ──────────────────────────────────────────────

export const createExport = internalMutation({
  args: {
    calculationId: v.id("calculations"),
    type: v.union(v.literal("pdf"), v.literal("xlsx")),
    userId: v.string(),
    sourceSnapshotHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("exports", {
      calculationId: args.calculationId,
      userId: args.userId,
      type: args.type,
      status: "pending",
      sourceSnapshotHash: args.sourceSnapshotHash,
      createdAt: Date.now(),
    });
  },
});

export const updateExport = internalMutation({
  args: {
    exportId: v.id("exports"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
      v.literal("stale"),
    ),
    storageId: v.optional(v.string()),
    filename: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    readyAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { exportId, ...updates } = args;
    // Filter out undefined values
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }
    await ctx.db.patch(exportId, patch);
  },
});

// ── Internal Query (fetch data for export generation) ───────────────

export const getExportData = internalQuery({
  args: { calculationId: v.id("calculations") },
  handler: async (ctx, args) => {
    const calculation = await ctx.db.get(args.calculationId);
    if (!calculation) throw new Error("Calculation not found");

    const items = await ctx.db
      .query("calculationItems")
      .withIndex("by_calculationId", (q) =>
        q.eq("calculationId", args.calculationId),
      )
      .collect();
    items.sort((a, b) => a.order - b.order);

    return { calculation, items };
  },
});

// ── Helper: build snapshot hash ─────────────────────────────────────

function buildSnapshotHash(
  calculation: { totals?: unknown; warnings?: unknown; status?: string },
  items: Array<{ result?: unknown }>,
): string {
  // Simple hash based on totals + item results
  const data = JSON.stringify({
    totals: calculation.totals,
    status: calculation.status,
    itemResults: items.map((i) => i.result),
  });
  // Simple string hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash.toString(36);
}

// ── Helper: format currency ─────────────────────────────────────────

function fmtRub(n: number): string {
  return n.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

// ── PDF Export Action ───────────────────────────────────────────────

export const requestPdf = action({
  args: { calculationId: v.id("calculations") },
  handler: async (ctx, args): Promise<Id<"exports">> => {
    // Auth: use getAuthUserId which works with any ctx that has .auth
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Rate limit: max 5 exports per hour
    const rateCheck = await ctx.runQuery(
      internal.exports.checkExportRateLimitInternal,
      { userId },
    );
    if (rateCheck.limited) {
      throw new Error(
        "Превышен лимит: максимум 5 экспорт за 1 ч. Попробуйте позже.",
      );
    }

    // 1. Load data
    const data = await ctx.runQuery(internal.exports.getExportData, {
      calculationId: args.calculationId,
    });
    const { calculation, items } = data;

    if (calculation.userId !== userId) {
      throw new Error("Access denied");
    }
    if (calculation.status !== "completed") {
      throw new Error("Calculation must be completed before exporting");
    }

    // 2. Check snapshot hash for dedup
    const snapshotHash = buildSnapshotHash(calculation, items);

    // Check existing exports
    const existingExports = await ctx.runQuery(
      internal.exports.getExistingExports,
      {
        calculationId: args.calculationId,
        type: "pdf",
      },
    );
    const existing = existingExports.find(
      (e: { sourceSnapshotHash?: string; status: string }) =>
        e.sourceSnapshotHash === snapshotHash && e.status === "ready",
    );
    if (existing) {
      return existing._id;
    }

    // 3. Create export record
    const exportId = await ctx.runMutation(internal.exports.createExport, {
      calculationId: args.calculationId,
      type: "pdf",
      userId,
      sourceSnapshotHash: snapshotHash,
    });

    await ctx.runMutation(internal.exports.updateExport, {
      exportId,
      status: "processing",
    });

    try {
      // 4. Generate PDF using jspdf
      const { jsPDF } = await import("jspdf");
      const { ROBOTO_REGULAR_BASE64 } = await import("./fonts/robotoRegular");
      const { ROBOTO_BOLD_BASE64 } = await import("./fonts/robotoBold");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Register fonts (Cyrillic-capable)
      doc.addFileToVFS("Roboto-Regular.ttf", ROBOTO_REGULAR_BASE64);
      doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
      doc.addFileToVFS("Roboto-Bold.ttf", ROBOTO_BOLD_BASE64);
      doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");

      // Color palette (light professional theme with site accents)
      const C = {
        heading: [15, 23, 42] as const,       // slate-900
        text: [30, 41, 59] as const,           // slate-800
        muted: [100, 116, 139] as const,       // slate-500
        light: [148, 163, 184] as const,       // slate-400
        emerald: [22, 163, 74] as const,       // emerald-600
        amber: [217, 119, 6] as const,         // amber-600
        tableBg: [240, 253, 244] as const,     // emerald-50
        stripeBg: [248, 250, 252] as const,    // slate-50
        border: [226, 232, 240] as const,      // slate-200
      };

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentW = pageW - margin * 2;
      let y = margin;

      const setFont = (style: "normal" | "bold" = "normal", size = 10) => {
        doc.setFont("Roboto", style);
        doc.setFontSize(size);
      };

      // Helper: add new page if needed
      const checkPage = (needed: number) => {
        if (y + needed > pageH - 15) {
          // Footer on current page
          addFooter();
          doc.addPage();
          y = margin;
        }
      };

      const addFooter = () => {
        setFont("normal", 7);
        doc.setTextColor(...C.light);
        doc.text(
          `VED Smart Calc  |  ${new Date().toISOString().slice(0, 10)}`,
          margin,
          pageH - 8,
        );
      };

      // Helper: draw a labeled value row
      const drawRow = (label: string, value: string, indent = 0) => {
        checkPage(5);
        setFont("normal", 9);
        doc.setTextColor(...C.text);
        doc.text(label, margin + 2 + indent, y);
        doc.text(value, pageW - margin - 2, y, { align: "right" });
        y += 5;
      };

      // ── Header ──
      setFont("bold", 20);
      doc.setTextColor(...C.heading);
      doc.text("VED Smart Calc", margin, y);
      y += 8;

      setFont("normal", 9);
      doc.setTextColor(...C.muted);
      const dateStr = calculation.calculationDate ?? new Date().toISOString().slice(0, 10);
      const modeStr = calculation.mode === "direct" ? "Прямой расчёт" : "Обратный расчёт";
      doc.text(`${dateStr}  \u2022  ${modeStr}`, margin, y);
      y += 4;
      if (calculation.title) {
        doc.setTextColor(...C.text);
        doc.text(calculation.title, margin, y);
        y += 4;
      }
      y += 2;

      // Green accent line
      doc.setDrawColor(...C.emerald);
      doc.setLineWidth(1);
      doc.line(margin, y, pageW - margin, y);
      y += 10;

      // ── Summary Boxes ──
      if (calculation.totals) {
        const t = calculation.totals;

        // Box: Итого таможенных платежей
        checkPage(20);
        doc.setDrawColor(...C.emerald);
        doc.setLineWidth(0.4);
        doc.roundedRect(margin, y, contentW, 16, 2, 2, "S");

        setFont("bold", 8);
        doc.setTextColor(...C.muted);
        doc.text("ИТОГО ТАМОЖЕННЫХ ПЛАТЕЖЕЙ", margin + 4, y + 5);

        setFont("bold", 16);
        doc.setTextColor(...C.amber);
        doc.text(`${fmtRub(t.totalCustoms)} \u20BD`, margin + 4, y + 12);

        setFont("normal", 8);
        doc.setTextColor(...C.muted);
        const pct = t.customsValue > 0 ? ((t.totalCustoms / t.customsValue) * 100).toFixed(1) : "0";
        doc.text(`${pct}% от таможенной стоимости`, pageW - margin - 4, y + 12, { align: "right" });
        y += 20;

        // Box: Полная себестоимость
        checkPage(20);
        doc.setDrawColor(...C.amber);
        doc.roundedRect(margin, y, contentW, 16, 2, 2, "S");

        setFont("bold", 8);
        doc.setTextColor(...C.muted);
        doc.text("ПОЛНАЯ СЕБЕСТОИМОСТЬ", margin + 4, y + 5);

        setFont("bold", 16);
        doc.setTextColor(...C.amber);
        doc.text(`${fmtRub(t.landedCost)} \u20BD`, margin + 4, y + 12);
        y += 20;

        // Detailed breakdown
        checkPage(50);
        setFont("bold", 10);
        doc.setTextColor(...C.heading);
        doc.text("ТАМОЖЕННЫЕ ПЛАТЕЖИ", margin, y);
        y += 6;

        // Thin line
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.2);
        doc.line(margin, y, pageW - margin, y);
        y += 4;

        drawRow("Таможенная стоимость", `${fmtRub(t.customsValue)} \u20BD`);
        drawRow("Пошлина", `${fmtRub(t.duty)} \u20BD`);
        if (t.antidumping > 0) drawRow("Антидемпинг", `${fmtRub(t.antidumping)} \u20BD`);
        if (t.excise > 0) drawRow("Акциз", `${fmtRub(t.excise)} \u20BD`);
        drawRow("НДС", `${fmtRub(t.vat)} \u20BD`);
        drawRow("Таможенный сбор", `${fmtRub(t.customsFee)} \u20BD`);
        y += 4;
      }

      // ── Items Table ──
      if (items.length > 0) {
        checkPage(16);
        setFont("bold", 10);
        doc.setTextColor(...C.heading);
        doc.text("ПОЗИЦИИ", margin, y);
        y += 7;

        // Table header
        const colWidths = [8, 22, 38, 22, 18, 18, 14, 14, 26];
        const headers = ["#", "ТН ВЭД", "Товар", "Там. стоим.", "Пошлина", "НДС", "Акциз", "Сбор", "Себестоимость"];

        checkPage(8);
        doc.setFillColor(...C.tableBg);
        doc.rect(margin, y - 3, contentW, 6, "F");
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.2);
        doc.line(margin, y + 3, pageW - margin, y + 3);

        setFont("bold", 7);
        doc.setTextColor(...C.emerald);
        let x = margin;
        for (let i = 0; i < headers.length; i++) {
          doc.text(headers[i], x + 1, y);
          x += colWidths[i];
        }
        y += 5;

        // Table rows
        setFont("normal", 7);
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const r = item.result;
          checkPage(6);

          if (idx % 2 === 1) {
            doc.setFillColor(...C.stripeBg);
            doc.rect(margin, y - 3.5, contentW, 5.5, "F");
          }

          doc.setTextColor(...C.text);
          x = margin;
          const rowData = [
            String(idx + 1),
            item.tnvedCode,
            item.productName.length > 25 ? item.productName.slice(0, 23) + ".." : item.productName,
            r ? fmtRub(r.customsValue) : "\u2014",
            r ? fmtRub(r.duty) : "\u2014",
            r ? fmtRub(r.vat) : "\u2014",
            r ? fmtRub(r.excise) : "\u2014",
            r ? fmtRub(r.customsFee) : "\u2014",
            r ? fmtRub(r.landedCost) : "\u2014",
          ];
          for (let i = 0; i < rowData.length; i++) {
            doc.text(rowData[i], x + 1, y);
            x += colWidths[i];
          }
          y += 5;
        }

        // Bottom border
        doc.setDrawColor(...C.border);
        doc.line(margin, y - 2, pageW - margin, y - 2);
        y += 5;
      }

      // ── Applied Rates ──
      if (items.length > 0 && items[0].appliedDutyRate !== undefined) {
        checkPage(14);
        setFont("bold", 10);
        doc.setTextColor(...C.heading);
        doc.text("ПРИМЕНЁННЫЕ СТАВКИ", margin, y);
        y += 6;

        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.2);
        doc.line(margin, y, pageW - margin, y);
        y += 4;

        setFont("normal", 8);
        doc.setTextColor(...C.muted);
        for (const item of items) {
          checkPage(6);
          doc.text(
            `${item.tnvedCode}  \u2014  ${item.appliedDutyType ?? "?"} ${item.appliedDutyRate ?? "?"}%,  НДС ${item.appliedVatRate ?? "?"}%,  курс ${item.appliedExchangeRate ?? "?"} \u20BD (${item.appliedExchangeDate ?? "?"})`,
            margin + 2,
            y,
          );
          y += 4.5;
        }
        y += 4;
      }

      // ── Warnings ──
      if (calculation.warnings && calculation.warnings.length > 0) {
        checkPage(12);
        setFont("bold", 10);
        doc.setTextColor(...C.heading);
        doc.text("ПРЕДУПРЕЖДЕНИЯ", margin, y);
        y += 6;

        setFont("normal", 8);
        doc.setTextColor(180, 120, 20);
        for (const w of calculation.warnings) {
          checkPage(5);
          doc.text(`\u26A0  ${w.message}`, margin + 2, y);
          y += 4.5;
        }
        y += 4;
      }

      // Footer on last page
      addFooter();

      // 5. Export to buffer
      const pdfBuffer = doc.output("arraybuffer");
      const blob = new Blob([pdfBuffer], { type: "application/pdf" });

      // 6. Upload to Convex storage
      const storageId = await ctx.storage.store(blob);

      const today = new Date().toISOString().slice(0, 10);
      const filename = `ved-calc-${today}-${shortId()}.pdf`;

      // 7. Update export record
      await ctx.runMutation(internal.exports.updateExport, {
        exportId,
        status: "ready",
        storageId,
        filename,
        mimeType: "application/pdf",
        sizeBytes: pdfBuffer.byteLength,
        readyAt: Date.now(),
      });

      return exportId;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.exports.updateExport, {
        exportId,
        status: "failed",
        errorMessage: message,
      });
      throw error;
    }
  },
});

// ── Excel Export Action ─────────────────────────────────────────────

export const requestXlsx = action({
  args: { calculationId: v.id("calculations") },
  handler: async (ctx, args): Promise<Id<"exports">> => {
    // Auth: use getAuthUserId which works with any ctx that has .auth
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Rate limit: max 5 exports per hour
    const rateCheck = await ctx.runQuery(
      internal.exports.checkExportRateLimitInternal,
      { userId },
    );
    if (rateCheck.limited) {
      throw new Error(
        "Превышен лимит: максимум 5 экспорт за 1 ч. Попробуйте позже.",
      );
    }

    // 1. Load data
    const data = await ctx.runQuery(internal.exports.getExportData, {
      calculationId: args.calculationId,
    });
    const { calculation, items } = data;

    if (calculation.userId !== userId) {
      throw new Error("Access denied");
    }
    if (calculation.status !== "completed") {
      throw new Error("Calculation must be completed before exporting");
    }

    // 2. Check snapshot hash
    const snapshotHash = buildSnapshotHash(calculation, items);
    const existingExports = await ctx.runQuery(
      internal.exports.getExistingExports,
      {
        calculationId: args.calculationId,
        type: "xlsx",
      },
    );
    const existing = existingExports.find(
      (e: { sourceSnapshotHash?: string; status: string }) =>
        e.sourceSnapshotHash === snapshotHash && e.status === "ready",
    );
    if (existing) {
      return existing._id;
    }

    // 3. Create export record
    const exportId = await ctx.runMutation(internal.exports.createExport, {
      calculationId: args.calculationId,
      type: "xlsx",
      userId,
      sourceSnapshotHash: snapshotHash,
    });

    await ctx.runMutation(internal.exports.updateExport, {
      exportId,
      status: "processing",
    });

    try {
      // 4. Generate Excel using exceljs
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();

      const dateStr = calculation.calculationDate ?? new Date().toISOString().slice(0, 10);

      // ── Sheet 1: Summary ──
      const ws1 = workbook.addWorksheet("Сводка");

      // Header styling
      ws1.getColumn(1).width = 35;
      ws1.getColumn(2).width = 25;

      const titleRow = ws1.addRow(["VED Smart Calc - Сводка"]);
      titleRow.font = { bold: true, size: 16 };
      ws1.addRow([]);

      ws1.addRow(["Дата расчёта", dateStr]);
      ws1.addRow(["Режим", calculation.mode === "direct" ? "Прямой" : "Обратный"]);
      ws1.addRow(["Распределение", calculation.distributionMethod === "by_weight" ? "По весу" : "По стоимости"]);
      if (calculation.title) {
        ws1.addRow(["Название", calculation.title]);
      }
      ws1.addRow([]);

      if (calculation.totals) {
        const t = calculation.totals;
        const totalsHeader = ws1.addRow(["Итоги"]);
        totalsHeader.font = { bold: true, size: 13 };

        const totalsData: [string, number][] = [
          ["Таможенная стоимость (RUB)", t.customsValue],
          ["Пошлина (RUB)", t.duty],
          ["Антидемпинг (RUB)", t.antidumping],
          ["Акциз (RUB)", t.excise],
          ["НДС (RUB)", t.vat],
          ["Таможенный сбор (RUB)", t.customsFee],
          ["Всего таможенных платежей (RUB)", t.totalCustoms],
          ["Себестоимость с доставкой (RUB)", t.landedCost],
        ];

        for (const [label, value] of totalsData) {
          const row = ws1.addRow([label, value]);
          row.getCell(2).numFmt = "#,##0.00";
        }
      }

      ws1.addRow([]);

      // Warnings
      if (calculation.warnings && calculation.warnings.length > 0) {
        const warnHeader = ws1.addRow(["Предупреждения"]);
        warnHeader.font = { bold: true, size: 13 };
        for (const w of calculation.warnings) {
          const row = ws1.addRow([`[${w.level}] ${w.message}`]);
          row.getCell(1).font = { color: { argb: "FFB47814" } };
        }
      }

      // ── Sheet 2: Items ──
      const ws2 = workbook.addWorksheet("Позиции");

      const itemHeaders = [
        "№", "Код ТН ВЭД", "Наименование", "Стоимость инвойс",
        "Валюта", "Incoterms", "Страна", "Вес нетто (кг)",
        "Вес брутто (кг)", "Кол-во", "Ед.", "Там. стоимость",
        "Пошлина", "Антидемпинг", "Акциз", "НДС", "Там. сбор",
        "Всего там.", "Себестоимость", "За единицу",
      ];

      const headerRow = ws2.addRow(itemHeaders);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8F5E9" },
      };

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const r = item.result;
        ws2.addRow([
          idx + 1,
          item.tnvedCode,
          item.productName,
          item.invoiceValue,
          item.currency,
          item.incoterms,
          item.country,
          item.weightNet,
          item.weightGross,
          item.quantity,
          item.unit,
          r?.customsValue ?? null,
          r?.duty ?? null,
          r?.antidumping ?? null,
          r?.excise ?? null,
          r?.vat ?? null,
          r?.customsFee ?? null,
          r?.totalCustoms ?? null,
          r?.landedCost ?? null,
          r?.landedCostPerUnit ?? null,
        ]);
      }

      // Auto-width columns
      ws2.columns.forEach((column) => {
        let maxLength = 10;
        column.eachCell?.({ includeEmpty: false }, (cell) => {
          const cellLen = cell.value ? String(cell.value).length : 0;
          if (cellLen > maxLength) maxLength = cellLen;
        });
        column.width = Math.min(maxLength + 2, 40);
      });

      // Number format for currency columns (12-20)
      for (let col = 12; col <= 20; col++) {
        ws2.getColumn(col).numFmt = "#,##0.00";
      }

      // ── Sheet 3: Detailed breakdown ──
      const ws3 = workbook.addWorksheet("Формулы и разбивка");

      ws3.getColumn(1).width = 20;
      ws3.getColumn(2).width = 20;
      ws3.getColumn(3).width = 20;
      ws3.getColumn(4).width = 15;
      ws3.getColumn(5).width = 15;
      ws3.getColumn(6).width = 15;

      const breakdownTitle = ws3.addRow(["Детальная разбивка по позициям"]);
      breakdownTitle.font = { bold: true, size: 14 };
      ws3.addRow([]);

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const r = item.result;

        const itemTitle = ws3.addRow([`Позиция ${idx + 1}: ${item.productName}`]);
        itemTitle.font = { bold: true, size: 12 };

        ws3.addRow(["Код ТН ВЭД", item.tnvedCode]);
        ws3.addRow(["Инвойс стоимость", item.invoiceValue, item.currency]);
        ws3.addRow(["Incoterms", item.incoterms]);
        ws3.addRow(["Страна", item.country]);
        ws3.addRow(["Вес нетто / брутто", item.weightNet, item.weightGross, "кг"]);
        ws3.addRow(["Количество", item.quantity, item.unit]);
        ws3.addRow([]);

        ws3.addRow(["Применённые ставки:"]);
        ws3.addRow(["  Тип пошлины", item.appliedDutyType ?? "-"]);
        ws3.addRow(["  Ставка пошлины (%)", item.appliedDutyRate ?? "-"]);
        ws3.addRow(["  Ставка НДС (%)", item.appliedVatRate ?? "-"]);
        ws3.addRow(["  Курс валюты", item.appliedExchangeRate ?? "-", "RUB", `(${item.appliedExchangeDate ?? "-"})`]);
        ws3.addRow(["  Антидемпинг (%)", item.appliedAntidumpingRate ?? "-"]);
        ws3.addRow(["  Источник тарифа", item.tariffSource ?? "-"]);
        ws3.addRow([]);

        if (r) {
          ws3.addRow(["Результаты:"]);
          const resultRows: [string, number][] = [
            ["  Таможенная стоимость", r.customsValue],
            ["  Пошлина", r.duty],
            ["  Антидемпинг", r.antidumping],
            ["  Акциз", r.excise],
            ["  НДС", r.vat],
            ["  Таможенный сбор", r.customsFee],
            ["  Всего там. платежей", r.totalCustoms],
            ["  Себестоимость", r.landedCost],
            ["  За единицу", r.landedCostPerUnit],
          ];
          for (const [label, value] of resultRows) {
            const row = ws3.addRow([label, value, "RUB"]);
            row.getCell(2).numFmt = "#,##0.00";
          }
        }

        ws3.addRow([]);
        ws3.addRow([]);
      }

      // 5. Export to buffer
      const xlsxBuffer = await workbook.xlsx.writeBuffer();

      const blob = new Blob(
        [xlsxBuffer],
        { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      );

      // 6. Upload to Convex storage
      const storageId = await ctx.storage.store(blob);

      const today = new Date().toISOString().slice(0, 10);
      const filename = `ved-calc-${today}-${shortId()}.xlsx`;

      // 7. Update export record
      await ctx.runMutation(internal.exports.updateExport, {
        exportId,
        status: "ready",
        storageId,
        filename,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sizeBytes: (xlsxBuffer as ArrayBuffer).byteLength,
        readyAt: Date.now(),
      });

      return exportId;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.exports.updateExport, {
        exportId,
        status: "failed",
        errorMessage: message,
      });
      throw error;
    }
  },
});

// ── Internal: check export rate limit ─────────────────────────────

export const checkExportRateLimitInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 3_600_000; // 1 hour window
    const recent = await ctx.db
      .query("exports")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.gte(q.field("_creationTime"), cutoff))
      .collect();

    if (recent.length >= 5) {
      return { limited: true, count: recent.length };
    }
    return { limited: false, count: recent.length };
  },
});

// ── Internal: get existing exports for dedup ────────────────────────

export const getExistingExports = internalQuery({
  args: {
    calculationId: v.id("calculations"),
    type: v.union(v.literal("pdf"), v.literal("xlsx")),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("exports")
      .withIndex("by_calculationId", (q) =>
        q.eq("calculationId", args.calculationId),
      )
      .collect();

    return all.filter((e) => e.type === args.type);
  },
});
