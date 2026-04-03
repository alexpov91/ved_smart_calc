/**
 * Load scraped TNVED data into Convex.
 *
 * Reads scripts/tnved-data.json and calls seedTnvedBatch mutation
 * in batches of 50 to avoid timeout.
 *
 * Usage: npx tsx scripts/load-tnved-to-convex.ts
 *
 * Requires CONVEX_URL env or .env.local with NEXT_PUBLIC_CONVEX_URL.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const DATA_FILE = join(__dirname, "tnved-data.json");

interface TnvedEntry {
  code: string;
  name: string;
  dutyRaw: string;
  dutyType: "advalorem" | "specific" | "combined" | "unknown";
  dutyRate: number;
  dutySpecific: number | null;
  dutySpecificUnit: string | null;
  vatRate: number;
  section: string;
  group: string;
}

function getConvexUrl(): string {
  if (process.env.CONVEX_URL) return process.env.CONVEX_URL;
  // Try .env.local
  const envLocal = join(__dirname, "..", ".env.local");
  if (existsSync(envLocal)) {
    const content = readFileSync(envLocal, "utf-8");
    const match = content.match(
      /NEXT_PUBLIC_CONVEX_URL\s*=\s*["']?([^\s"']+)/,
    );
    if (match) return match[1];
  }
  throw new Error(
    "Set CONVEX_URL env or NEXT_PUBLIC_CONVEX_URL in .env.local",
  );
}

function generateSearchTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^\wа-яёА-ЯЁ\s-]/g, "")
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .slice(0, 10);
}

async function callMutation(
  convexUrl: string,
  functionName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const url = `${convexUrl}/api/mutation`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: functionName, args }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mutation ${functionName} failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  if (json.status === "error") {
    throw new Error(`Mutation error: ${json.errorMessage}`);
  }
  return json.value;
}

async function main() {
  if (!existsSync(DATA_FILE)) {
    console.error(`Data file not found: ${DATA_FILE}`);
    console.error("Run scrape-tnved.ts first.");
    process.exit(1);
  }

  const convexUrl = getConvexUrl();
  console.log(`Convex URL: ${convexUrl}`);

  const entries: TnvedEntry[] = JSON.parse(
    readFileSync(DATA_FILE, "utf-8"),
  );
  console.log(`Loaded ${entries.length} entries from ${DATA_FILE}`);

  // Filter out entries with unknown duty type
  const valid = entries.filter((e) => e.dutyType !== "unknown");
  const skipped = entries.length - valid.length;
  if (skipped > 0) {
    console.log(`Skipping ${skipped} entries with unknown duty type`);
  }

  // Transform to Convex format
  const catalogItems = valid.map((e) => ({
    code: e.code,
    nameShort: e.name.length > 100 ? e.name.slice(0, 97) + "..." : e.name,
    nameFull: e.name,
    examples: [] as string[],
    searchTokens: generateSearchTokens(e.name),
  }));

  const tariffItems = valid.map((e) => ({
    tnvedCode: e.code,
    source: "IFCG" as const,
    dutyType: e.dutyType as "advalorem" | "specific" | "combined",
    dutyRate: e.dutyRate,
    dutySpecific: e.dutySpecific ?? undefined,
    dutyUnit: e.dutySpecificUnit ?? undefined,
    vatRate: (e.vatRate === 10 ? 10 : e.vatRate === 0 ? 0 : 22) as
      | 22
      | 10
      | 0,
    needsCertification: false,
    needsMarking: false,
    validFrom: "2026-01-01",
    fetchedAt: Date.now(),
    rawPayload: e.dutyRaw,
  }));

  // Send in batches
  const BATCH_SIZE = 50;
  const totalBatches = Math.ceil(catalogItems.length / BATCH_SIZE);
  console.log(
    `Sending ${catalogItems.length} items in ${totalBatches} batches of ${BATCH_SIZE}...`,
  );

  for (let i = 0; i < catalogItems.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const catalogBatch = catalogItems.slice(i, i + BATCH_SIZE);
    const tariffBatch = tariffItems.slice(i, i + BATCH_SIZE);

    try {
      const result = await callMutation(convexUrl, "seed:seedTnvedBatch", {
        catalog: catalogBatch,
        tariffs: tariffBatch,
      });
      process.stdout.write(
        `\r  Batch ${batchNum}/${totalBatches}: ${result}`,
      );
    } catch (err) {
      console.error(`\nBatch ${batchNum} failed: ${err}`);
      console.error("Retrying in 2s...");
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const result = await callMutation(convexUrl, "seed:seedTnvedBatch", {
          catalog: catalogBatch,
          tariffs: tariffBatch,
        });
        process.stdout.write(
          `\r  Batch ${batchNum}/${totalBatches}: ${result} (retry ok)`,
        );
      } catch (err2) {
        console.error(`\nBatch ${batchNum} failed again: ${err2}`);
      }
    }
  }

  console.log(`\n\nDone! Loaded ${valid.length} TNVED codes into Convex.`);
}

main().catch(console.error);
