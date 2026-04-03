/**
 * TNVED Scraper — ifcg.ru
 *
 * Crawls https://www.ifcg.ru/kb/tnved/ to collect 10-digit TNVED codes
 * with duty rates and VAT.
 *
 * Usage: npx tsx scripts/scrape-tnved.ts
 *
 * Output: scripts/tnved-data.json
 */

import { writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const BASE = "https://www.ifcg.ru/kb/tnved";
const DELAY_MS = 350; // polite crawl delay
const OUT_FILE = join(__dirname, "tnved-data.json");
const PROGRESS_FILE = join(__dirname, "tnved-progress.json");

interface TnvedEntry {
  code: string; // 10-digit code, no spaces
  name: string;
  dutyRaw: string; // original text: "0%", "12%", "1,5 Евро/пар", etc.
  dutyType: "advalorem" | "specific" | "combined" | "unknown";
  dutyRate: number; // advalorem % or 0
  dutySpecific: number | null; // EUR per unit or null
  dutySpecificUnit: string | null; // "кг", "пар", "л", etc.
  vatRate: number; // 22, 10, 0
  section: string; // 2-digit section
  group: string; // 4-digit group
}

// ── Helpers ──────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; VedSmartCalcBot/1.0; +demo-project)",
          "Accept-Language": "ru-RU,ru;q=0.9",
        },
      });
      if (res.status === 404) return "";
      if (!res.ok) {
        console.warn(`  HTTP ${res.status} for ${url}, retry ${i + 1}`);
        await sleep(2000);
        continue;
      }
      return await res.text();
    } catch (e: unknown) {
      console.warn(`  Fetch error for ${url}: ${e}, retry ${i + 1}`);
      await sleep(2000);
    }
  }
  return "";
}

function extractLinks(html: string, pattern: RegExp): string[] {
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    if (!matches.includes(m[1])) matches.push(m[1]);
  }
  return matches;
}

// ── Duty parsing ─────────────────────────────────────────────────────

function parseDuty(raw: string): Pick<
  TnvedEntry,
  "dutyType" | "dutyRate" | "dutySpecific" | "dutySpecificUnit"
> {
  const s = raw.trim().replace(/\s+/g, " ");

  // "0%" or "12%" or "5,3%"
  const pureAdvalorem = s.match(/^(\d+[.,]?\d*)\s*%$/);
  if (pureAdvalorem) {
    return {
      dutyType: "advalorem",
      dutyRate: parseFloat(pureAdvalorem[1].replace(",", ".")),
      dutySpecific: null,
      dutySpecificUnit: null,
    };
  }

  // "1,5 Евро/пар" or "0.3 евро за кг" — pure specific
  const pureSpecific = s.match(
    /^(\d+[.,]?\d*)\s*(?:евро|Евро|EUR)\s*[/за]*\s*(\S+)$/i,
  );
  if (pureSpecific) {
    return {
      dutyType: "specific",
      dutyRate: 0,
      dutySpecific: parseFloat(pureSpecific[1].replace(",", ".")),
      dutySpecificUnit: pureSpecific[2].toLowerCase(),
    };
  }

  // Combined: "10%, но не менее 0.5 евро/кг" or "10%, но не менее 1,5 Евро за пар"
  const combined = s.match(
    /(\d+[.,]?\d*)\s*%\s*,?\s*но\s+не\s+менее\s+(\d+[.,]?\d*)\s*(?:евро|Евро|EUR)\s*[/за]*\s*(\S+)/i,
  );
  if (combined) {
    return {
      dutyType: "combined",
      dutyRate: parseFloat(combined[1].replace(",", ".")),
      dutySpecific: parseFloat(combined[2].replace(",", ".")),
      dutySpecificUnit: combined[3].toLowerCase(),
    };
  }

  // Fallback: try to extract at least a percentage
  const anyPercent = s.match(/(\d+[.,]?\d*)\s*%/);
  if (anyPercent) {
    return {
      dutyType: "advalorem",
      dutyRate: parseFloat(anyPercent[1].replace(",", ".")),
      dutySpecific: null,
      dutySpecificUnit: null,
    };
  }

  return {
    dutyType: "unknown",
    dutyRate: 0,
    dutySpecific: null,
    dutySpecificUnit: null,
  };
}

function parseVat(raw: string): number {
  const m = raw.match(/(\d+[.,]?\d*)\s*%/);
  return m ? parseFloat(m[1].replace(",", ".")) : 22;
}

// ── Scraping functions ───────────────────────────────────────────────

async function getSections(): Promise<string[]> {
  console.log("Fetching section list...");
  const html = await fetchPage(`${BASE}/`);
  // Links like /kb/tnved/84/
  return extractLinks(html, /href="\/kb\/tnved\/(\d{1,2})\/"/g);
}

async function getGroups(section: string): Promise<string[]> {
  const html = await fetchPage(`${BASE}/${section}/`);
  if (!html) return [];
  // Links like /kb/tnved/8471/
  return extractLinks(html, /href="\/kb\/tnved\/(\d{4})\/"/g);
}

async function getCodeUrls(group: string): Promise<string[]> {
  const html = await fetchPage(`${BASE}/${group}/`);
  if (!html) return [];
  // Links like /kb/tnved/8471300000/
  return extractLinks(html, /href="\/kb\/tnved\/(\d{10})\/"/g);
}

async function scrapeCode(
  code: string,
  section: string,
  group: string,
): Promise<TnvedEntry | null> {
  const html = await fetchPage(`${BASE}/${code}/`);
  if (!html || html.includes("СТРАНИЦА НЕ НАЙДЕНА")) return null;

  // Extract name from <span class="description" title="..."> on the current (final) item
  let name = "";
  const nameMatch = html.match(
    /tree-item-2_final">\s*<h4[^>]*class="tree-item-2--title current"[^>]*>\s*<span class="code">[^<]*<\/span>\s*<span class="description"[^>]*>\s*([\s\S]*?)<\/span>/,
  );
  if (nameMatch) {
    name = nameMatch[1].trim().replace(/<[^>]*>/g, "").trim();
  }
  // Fallback: try <a> text in final section
  if (!name) {
    const altMatch = html.match(
      /tree-item-2_final[\s\S]*?<a[^>]*href="\/kb\/tnved\/\d{10}\/"[^>]*>([^<]+)<\/a>/,
    );
    if (altMatch) name = altMatch[1].trim();
  }

  // Extract duty
  const dutyMatch = html.match(
    /Импортная пошлина:<\/span><\/td>\s*<td><span[^>]*>([^<]*)<\/span>/,
  );
  const dutyRaw = dutyMatch ? dutyMatch[1].trim() : "";

  // Extract VAT
  const vatMatch = html.match(
    /Ввозной НДС:<\/span><\/td>\s*<td><span[^>]*>([^<]*)<\/span>/,
  );
  const vatRaw = vatMatch ? vatMatch[1].trim() : "";

  if (!dutyRaw && !vatRaw) return null; // no tariff data on page

  const duty = parseDuty(dutyRaw);
  const vatRate = parseVat(vatRaw);

  return {
    code,
    name: name || `Товар ${code}`,
    dutyRaw,
    ...duty,
    vatRate,
    section,
    group,
  };
}

// ── Progress tracking ────────────────────────────────────────────────

interface Progress {
  completedSections: string[];
  entries: TnvedEntry[];
}

function loadProgress(): Progress {
  if (existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
    } catch {
      /* ignore */
    }
  }
  return { completedSections: [], entries: [] };
}

function saveProgress(progress: Progress): void {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), "utf-8");
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("=== TNVED Scraper (ifcg.ru) ===\n");

  const progress = loadProgress();
  const entries = progress.entries;

  const sections = await getSections();
  console.log(`Found ${sections.length} sections\n`);

  for (const section of sections) {
    if (progress.completedSections.includes(section)) {
      console.log(`Section ${section}: already done, skipping`);
      continue;
    }

    console.log(`\n── Section ${section} ──`);
    await sleep(DELAY_MS);

    const groups = await getGroups(section);
    console.log(`  ${groups.length} groups`);

    for (const group of groups) {
      await sleep(DELAY_MS);
      const codes = await getCodeUrls(group);
      if (codes.length === 0) continue;

      console.log(`  Group ${group}: ${codes.length} codes`);

      for (const code of codes) {
        // Skip if already scraped
        if (entries.some((e) => e.code === code)) continue;

        await sleep(DELAY_MS);
        const entry = await scrapeCode(code, section, group);
        if (entry) {
          entries.push(entry);
          process.stdout.write(".");
        } else {
          process.stdout.write("x");
        }
      }
      console.log();
    }

    progress.completedSections.push(section);
    progress.entries = entries;
    saveProgress(progress);
    console.log(
      `  Section ${section} done. Total entries: ${entries.length}`,
    );
  }

  // Save final output
  writeFileSync(OUT_FILE, JSON.stringify(entries, null, 2), "utf-8");
  console.log(`\n=== Done! ${entries.length} entries saved to ${OUT_FILE} ===`);

  // Stats
  const byType = { advalorem: 0, specific: 0, combined: 0, unknown: 0 };
  for (const e of entries) byType[e.dutyType]++;
  console.log("Duty types:", byType);

  const vatRates = new Map<number, number>();
  for (const e of entries) vatRates.set(e.vatRate, (vatRates.get(e.vatRate) ?? 0) + 1);
  console.log("VAT rates:", Object.fromEntries(vatRates));
}

main().catch(console.error);
