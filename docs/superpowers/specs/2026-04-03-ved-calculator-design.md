# VED Smart Calc — Design Specification

**Date:** 2026-04-03
**Status:** Approved
**Stack:** Next.js (App Router) + Convex (self-hosted VPS) + Clerk + shadcn/ui + Tailwind CSS

## 1. Product Overview

Калькулятор таможенных платежей и полной себестоимости (Landed Cost) для малого и среднего бизнеса РФ. Занимает нишу между примитивными бесплатными калькуляторами и дорогими профессиональными системами.

**Три ключевых дифференциатора:**
- Landed Cost — полная стоимость товара на складе
- Обратный расчёт — от розничной цены к максимальной закупочной
- Мультитоварная декларация — несколько позиций с распределением расходов

**MVP scope:** калькулятор (прямой + обратный), мультитоварная декларация (ручное добавление), личный кабинет, история расчётов, экспорт PDF/Excel. Обязательная регистрация.

---

## 2. Data Schema

### users — NOT a Convex table
Identity lives entirely in Clerk. There is **no `users` table in Convex**. The app has **10 Convex tables + Clerk identity outside Convex**. User reference throughout the schema uses `userId: string` which is the Clerk user ID obtained via `ctx.auth.getUserIdentity()`.

Identity lives in Clerk (external). Convex stores **10 application tables** + 1 reference table for excise:

### Convex Tables (11 total)

### userProfiles
Бизнес-данные пользователя, отделены от auth.
```
userId: string                    // Clerk user ID
name: string
companyName?: string
inn?: string
role: "user" | "admin"
createdAt: number
```
Создаётся через mutation при первом входе (Clerk webhook или client-side sync).

### tnvedCatalog
Стабильный справочник ТН ВЭД — код, описание, примеры для поиска.
```
code: string (10 цифр)            // index
nameShort: string                  // search index
nameFull: string                   // search index
examples: string[]                 // search index
searchTokens: string[]             // normalized tokens
```

### tnvedTariffs
Тарифные данные — версионируемые, с источником. Отделены от каталога.
```
tnvedCode: string                  // index
source: "TKS" | "TWS"             // index
sourceModule?: string              // TKS API module name
dutyType: "advalorem" | "specific" | "combined"
dutyRate: number                   // % for advalorem
dutySpecific?: number              // €/unit for specific
dutyUnit?: string                  // kg, pcs, pair
vatRate: 22 | 10 | 0
needsCertification: boolean
needsMarking: boolean
validFrom: string
validTo?: string
fetchedAt: number
effectiveDate?: string             // date tariff was considered current
payloadHash?: string               // hash of raw payload for dedup
rawPayload?: string                // JSON from source
```

### exchangeRates
Курсы ЦБ РФ. Primary source: официальный `cbr.ru/scripts/XML_daily.asp`.
```
currency: string                   // compound index: (currency, date)
rate: number                       // original rate from CBR
unitRate: number                   // normalized rate per 1 unit
nominal: number                    // 1 for USD, 100 for JPY etc.
date: string                       // effective date "2026-04-03"
source: "CBR" | "CBR_XML_DAILY"
fetchedAt: number
```
Cron: every 4 hours. If rate for requested date not found, use nearest previous + warning.

### customsFees
Шкала таможенных сборов (ПП РФ №1637). Versioned.
```
minValue: number                   // index (compound: validFrom + minValue)
maxValue: number
fee: number
validFrom: string
validTo?: string
source?: string                    // e.g. "ПП РФ №1637"
sourceDoc?: string
```

### exciseTariffs
Акцизные ставки (алкоголь, табак, авто >90 л.с., бензин, дизтопливо, сахаросодержащие напитки). Versioned, manual update.
```
tnvedCodePattern: string           // prefix match against 10-digit code
productCategory: string            // e.g. "auto", "alcohol", "tobacco"
ratePerUnit: number                // ₽ per unit (e.g. ₽/л.с. for autos)
unit: string                       // л.с., литр, кг, шт
validFrom: string
validTo?: string
source?: string
sourceDoc?: string
```
Matching: `tnvedCodePattern` is a prefix — e.g. "8703" matches all codes starting with 8703.

### antidumpingDuties
~27 действующих мер. Versioned, manual update.
```
tnvedCodePattern: string           // prefix match (e.g. "8482" matches 8482xxxxxx)
country: string
rate: number
validFrom: string
validTo?: string
source?: string
sourceDoc?: string
```
Matching: `tnvedCodePattern` is a prefix — e.g. "8482" matches all codes starting with 8482 (ball bearings).

### calculations
Шапка расчёта. Items вынесены в отдельную таблицу.
```
userId: string                     // from ctx.auth, never from client
createdAt: number
mode: "direct" | "reverse"
status: "draft" | "calculating" | "completed" | "error" | "archived"
title?: string
currencyMode: string               // original input currency
calculationDate?: string           // date for rates lookup; defaults to today if omitted

// Shipment-level logistics
logistics: {
  freight: number                  // in freightCurrency
  freightCurrency: string          // USD, EUR, CNY etc.
  insurance?: number               // absolute amount in freightCurrency (when insuranceAuto = false)
  insuranceAuto?: boolean          // if true, auto-calculate as 0.5% of invoice value; insurance field ignored
  // All below are in RUB (domestic expenses)
  broker?: number                  // RUB
  certification?: number           // RUB
  marking?: number                 // RUB
  bankCommission?: number          // RUB
  svh?: number                     // RUB
  transportAfterBorder?: number    // RUB
}
distributionMethod: "by_weight" | "by_value"

// Reverse mode params
retailParams?: {
  retailPrice: number
  desiredMargin: number            // %
}

// Aggregated totals (written by engine)
totals?: {
  customsValue: number
  duty: number
  antidumping: number
  excise: number
  vat: number
  customsFee: number
  totalCustoms: number
  landedCost: number
}

// Structured warnings/errors
warnings: Array<{
  code: string                     // e.g. "CERT_REQUIRED", "PRICE_BELOW_ITS"
  level: "info" | "warning" | "critical"
  message: string
  itemId?: string
}>
errors: Array<{
  code: string
  message: string
  itemId?: string
}>
```

### calculationItems
Строки товаров + snapshot применённых ставок + item-level allocation.
```
calculationId: Id<"calculations">  // index
order: number

// Input data
tnvedCode: string
productName: string                // human-readable label
invoiceValue: number
currency: string
incoterms: string
country: string
weightNet: number
weightGross: number
quantity: number
unit: string

// Snapshot of applied rates at calculation time
appliedDutyType: string
appliedDutyRate: number
appliedVatRate: number
appliedExchangeRate: number
appliedExchangeDate: string
appliedCustomsFee: number
appliedAntidumpingRate?: number
tariffSource: "TKS" | "TWS"
tariffFetchedAt: number

// Item-level logistics allocation
allocatedFreight: number
allocatedInsurance: number
allocationMethod: "by_weight" | "by_value"

// Per-item result
result: {
  customsValue: number
  duty: number
  antidumping: number
  excise: number
  vat: number
  customsFee: number
  totalCustoms: number
  landedCost: number
  landedCostPerUnit: number
}
```

### exports
Асинхронная генерация файлов экспорта.
```
calculationId: Id<"calculations">
userId: string
type: "pdf" | "xlsx"
status: "pending" | "processing" | "ready" | "failed" | "stale"
storageId?: string                 // Convex file storage ID (not URL)
filename?: string                  // e.g. "ved-calc-2026-04-03-abc123.pdf"
mimeType?: string
sizeBytes?: number
errorMessage?: string
sourceSnapshotHash?: string        // hash of calculation state at generation
templateVersion?: string
createdAt: number
readyAt?: number
```

---

## 3. Convex Functions & API Layer

### Architecture Pattern

**UI → mutation (request) → action (run) → internalMutation (apply)**

Mutations handle state changes. Actions handle external API calls and orchestration. InternalMutations write results atomically. All public functions have argument validators and return validators.

### Auth Model

- **Never accept `userId` as argument from client** — always from `ctx.auth`
- All queries/mutations check ownership: calculation belongs to current user
- Naming convention: `listMy()`, `getMine()` — not `list({ userId })`

### Queries (reactive, read-only)

```
tnved.searchLocal({ query, limit })     // prefix by code + full-text by name
tnved.getByCode({ code })               // single code with current tariff
exchangeRates.getCurrent({ currency })
exchangeRates.getByDate({ currency, date })
customsFees.getScale()
antidumping.check({ tnvedCode, country })
calculations.listMy({ cursor?, limit })  // cursor pagination
calculations.getMy({ id })               // with ownership check
calculations.getSummary({ id })          // header + totals only
calculationItems.byCalculation({ calculationId })
exports.listByCalculation({ calculationId })
exports.getStatus({ exportId })
exports.getDownloadUrl({ exportId })  // wraps storage.getUrl(storageId) with ownership check
userProfiles.getMine()
referenceData.getCalculationMeta()      // incoterms, currencies, units, transport modes
currencies.listSupported()
```

### Mutations

```
calculations.create({ mode, currencyMode, ... })  // → status: draft
calculations.requestCalculation({ calculationId }) // → status: calculating
calculations.updateLogistics({ calculationId, logistics })
calculations.updateMeta({ calculationId, title, date, mode })
calculations.setDistributionMethod({ calculationId, method })
calculations.clone({ id })                         // deep copy: header + items, status → draft, no results, new calculationDate = today
calculations.recalculate({ calculationId })         // re-fetch fresh tariffs/FX, then requestCalculation; vs requestCalculation which uses cached data
calculations.delete({ id })

calculationItems.add({ calculationId, ...itemData })
calculationItems.update({ id, ...itemData })
calculationItems.remove({ id })
calculationItems.duplicate({ id })

userProfiles.create({ name, companyName?, inn? })
userProfiles.update({ ...fields })
```

### Actions (HTTP, external APIs)

```
tks.searchTnved({ query })              // search TKS, cache to tnvedCatalog + tnvedTariffs
tks.getTariff({ tnvedCode })            // get current tariff, cache
cbr.fetchRates()                        // fetch from official cbr.ru
calculations.runCalculation({ calculationId })  // orchestrator → engine → applyResult
exports.requestPdf({ calculationId })
exports.requestXlsx({ calculationId })
```

### Internal Functions

```
calculations.applyResult({ calculationId, itemResults, totals, warnings, errors, snapshots })
tnved.getResolvedTariff({ tnvedCode, effectiveDate? })  // resolution priority below
tnved.buildSnapshots({ items, tariffs, rates })
```

### Cron Jobs

- **FX sync** — every 4 hours: `cbr.fetchRates()` from official `cbr.ru`
- **Stale tariff refresh** — daily: check `tnvedTariffs` older than 7 days, background refresh from TKS
- **Archive stale drafts** — daily: `calculations` with status: draft older than 7 days → archived (not deleted)

---

## 4. Calculation Engine

### Architecture: Pure Core + Orchestration

Separated into two layers:

**Orchestration layer** (Convex action): collects items, tariffs, antidumping data, exchange rates, customs fee scale. Calls pure core. Writes results via internalMutation.

**Pure calculation core** (standalone modules, no Convex dependency):
```
engine/types.ts       // Input/output types
engine/normalize.ts   // Incoterms → CIF conversion, currency normalization
engine/direct.ts      // Direct calculation
engine/reverse.ts     // Reverse calculation (separate engine)
engine/allocate.ts    // Logistics distribution by weight/value
engine/warnings.ts    // Warning generation
```

### Tariff Resolution Priority (`tnved.getResolvedTariff`)

When multiple `tnvedTariffs` records exist for a code, resolve in this order:
1. Filter by `effectiveDate` falling within `[validFrom, validTo]` range
2. Prefer `source: "TKS"` over `"TWS"` (production data over seed data)
3. Among same source, pick most recent by `fetchedAt`
4. If no record covers `effectiveDate`, use the most recent record by `validFrom` + warning "тариф может быть неактуальным"

### Direct Calculation (engine/direct.ts)

Input: normalized items, tariff snapshots, FX snapshot, customs fee scale, distribution method.

Per item:
1. Calculate customs value (ТС): invoice × FX rate + transport to border + insurance (Incoterms adjustment)
2. Calculate duty by type:
   - Advalorem: ТС × rate%
   - Specific: quantity × rate(€) × FX(€/₽)
   - Combined: max(advalorem, specific)
3. Check antidumping: additional duty if match by tnvedCode + country
4. Calculate excise (if applicable, conditional by tnvedCode)
5. Calculate VAT: (ТС + duty + antidumping + excise) × vatRate
6. Determine customs fee from scale by total ТС of shipment (shipment-level fee, allocated to items proportionally by customs value for per-item breakdown; `appliedCustomsFee` in item = item's share)
7. Allocate logistics: freight and insurance distributed to items by weight or value
8. Calculate landed cost per unit

Output: itemResults[], totals, warnings[], errors[], appliedSnapshots[].

### Reverse Calculation (engine/reverse.ts)

Separate engine. Input: retail price, desired margin, same reference data.

**Item relationship:** Reverse mode works with a **single item** in MVP. The `retailParams` at calculation level apply to that one item. Multi-item reverse is post-MVP.

**Enforcement:**
- **Server:** `calculations.requestCalculation` must reject reverse mode if `calculationItems` count > 1
- **UI:** In reverse mode, hide "+ Добавить позицию" button; show explanation "Обратный расчёт работает для одного товара"

Iterative approach: start from retail price, subtract margin, then iteratively solve for maximum purchase price accounting for all duties, VAT, logistics, and fees. Convergence tolerance: **0.01 RUB**, max iterations: **50**. If not converged, return last approximation with warning.

### Warnings (engine/warnings.ts)

Structured warnings with levels:
- `info`: certification may be needed, marking required
- `warning`: price below ITS threshold (risk of КТС), stale tariff data, FX rate from previous date
- `critical`: missing required data, TKS unavailable and no cache

Warnings live at `calculations.warnings[]` level. Per-item warnings use `itemId` field to reference the specific item. `calculationItems` does not carry its own warnings array — all warnings are centralized.

---

## 5. UI Architecture

### Tech Stack
- Next.js App Router + TypeScript
- shadcn/ui + Tailwind CSS
- Dark business theme (slate/green palette)
- Clerk components for auth UI

### Pages

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Lightweight landing: value proposition, 3-4 bullets, CTA Login/Register |
| `/login` | Public | Clerk sign-in component |
| `/register` | Public | Clerk sign-up component |
| `/calculator` | Auth | Single workspace: new (no params) or existing (`?id=xxx`) |
| `/history` | Auth | List of saved calculations, click → navigates to `/calculator?id=xxx` |
| `/profile` | Auth | User profile settings |

Post-MVP: `/forgot-password`, `/reset-password` (Clerk handles natively).

### Responsive Behavior

- **Desktop (1280px+):** split-layout as described above
- **Tablet (768-1279px):** stacked layout — form on top, results below; sticky "Рассчитать" bar at bottom of viewport
- **Mobile (<768px):** same stacked layout, simplified item cards, results collapsible; full functionality preserved

### Navigation
Top bar (always visible): logo, "Калькулятор", "История", avatar dropdown (Профиль, Выход).
After login → redirect to `/calculator`.

### Calculator Layout (Desktop 1280px+)

**Split-layout:** form left, results right.

**Top bar:** logo + nav + profile avatar
**Mode switcher:** "Прямой расчёт" / "Обратный расчёт" toggle

**Left column (form, scrollable):**
- Item cards with fields: productName (human label), ТН ВЭД autocomplete (prefix + full-text), стоимость, валюта (with live FX rate), Инкотермс, страна, вес нетто/брутто, количество
- Per-item status line: `TKS ✓ · курс USD на 01.04.2026 · без ошибок`
- Item actions: duplicate, delete
- "+ Добавить позицию" button
- Logistics section (collapsed by default, summary in header): freight, insurance, distribution method, broker, certification, marking, bank commission, SVH, transport after border
- **Sticky action bar** at bottom: "Рассчитать" button (always accessible)

**Right column (results, sticky on desktop):**
- Status badge: "Актуально" / "Черновик" / "Требуется пересчёт" / "Идёт расчёт..."
- Summary card: total customs payments (green accent)
- Landed Cost card: total + per unit (amber accent)
- Hierarchical breakdown in 3 groups:
  1. Таможенные платежи (duty, antidumping, excise, VAT, customs fee)
  2. Логистика (freight, insurance, internal transport)
  3. Дополнительные услуги (broker, certification, marking, bank commission, SVH)
- Structured warnings (info/warning/critical)
- Export buttons: PDF / Excel / Save
- Hotkeys: Enter or Ctrl+Enter triggers calculation

### Save Button Semantics

Calculations are **NOT auto-saved as drafts** on every field change. The lifecycle:
1. User opens `/calculator` → a new `calculation` is created with `status: draft` only when user adds the first item
2. **"Save" button** explicitly persists current form state to the draft (updates title, logistics, items). This is the user's conscious action to preserve work-in-progress.
3. **"Рассчитать"** triggers calculation; on success status → `completed`. A completed calculation is automatically in history.
4. Editing a completed calculation sets status back to `draft` until re-calculated.

In short: `Save` = "persist my current input to history as draft", `Рассчитать` = "persist + compute results".

### Calculation Flow (Manual-First)

1. User fills form fields
2. **Local-only reactions:** field validation, FX rate display, error highlights
3. Any meaningful field change → results panel shows "Требуется пересчёт" badge, old results remain visible but dimmed
4. User clicks "Рассчитать" (or Ctrl+Enter)
5. `requestCalculation()` mutation → status: calculating → UI shows loading state in right panel
6. `runCalculation()` action → fetches TKS/CBR if needed → pure engine → `applyResult()` internalMutation
7. `useQuery` reactively updates right panel with new results
8. Status → "Актуально"

Auto-recalculation may be added later as user preference for power users.

---

## 6. Authentication & Security

### Auth Stack: Convex Auth

- **Convex Auth** — authentication (email + password), sessions, token management
- **Convex** — authorization via `ctx.auth.getUserIdentity()`, ownership checks, app data
- **userProfiles** — app-level user data in Convex, created via mutation on first login

Integration: `ConvexAuthProvider` wrapper in Next.js app. No external auth dependency — everything on self-hosted Convex.

### Route Protection

- Client-side auth check via `useConvexAuth()` — redirect unauthenticated users to `/login`
- Real security boundary: every Convex public function checks auth and ownership
- Public routes: `/`, `/login`, `/register`
- Protected routes: everything else
- No external auth provider — all auth data on self-hosted Convex

### Ownership Checks

Every query/mutation for `calculations`, `calculationItems`, `exports` verifies the record belongs to the current user from `ctx.auth`. userId is never accepted as client argument.

### Input Validation

- All public functions (queries, mutations, actions) have Convex argument validators + return validators
- Numeric fields: positive, reasonable ranges (weight < 1,000,000 kg, value < $100,000,000)
- String fields: length limits, allowed characters
- ТН ВЭД code: exactly 10 digits format

### Rate Limiting

- Auth endpoints (login/register): rate limiting via Convex (max 5 failed attempts per email per 15 min)
- TKS API calls: max 30 requests/minute per user (Convex action level)
- Calculation: max 10 requests/minute per user
- Export: max 5 files/hour per user

### Post-MVP
- OAuth (Yandex, Google, Telegram)
- 2FA/MFA (Clerk supports natively)
- Admin panel with roles

---

## 7. Data Integration

### TKS.ru API (Production Data Provider)

**Role:** data provider for ТН ВЭД codes and tariff rates. **Not** a calculation engine — our engine is the single calculation authority.

**Functions:**
- `tks.searchTnved({ query })` — search codes, cache results to `tnvedCatalog` + `tnvedTariffs`
- `tks.getTariff({ tnvedCode })` — get current tariff, cache with metadata

**Caching policy (stale-while-revalidate):**
- Fresh (< 24h): serve from cache
- Stale (>= 24h): serve from cache + background refresh from TKS
- Cache miss: fetch from TKS
- TKS error: use last valid snapshot + warning to user

**Storage metadata:** `source`, `sourceModule`, `fetchedAt`, `effectiveDate`, `payloadHash`, `rawPayload`

### TWS.BY Excel (Dev/Test Only)

Seed script parses Excel, loads into `tnvedCatalog` + `tnvedTariffs` with `source: "TWS"`. Enables fully offline development.

### CBR Exchange Rates

**Primary source:** official `cbr.ru/scripts/XML_daily.asp` (XML daily rates)
**Fallback/dev:** `cbr-xml-daily.ru` (JSON proxy) — not primary in production

Cron: every 4 hours. Store both `rate` (original) and `unitRate` (normalized per 1 unit).
If rate for requested date not found → use nearest previous date + warning.

Supported currencies (MVP): USD, EUR, CNY, TRY, GBP.

### ТН ВЭД Search (Autocomplete)

`tnved.searchLocal({ query, limit })`:
- **Prefix search** by `code` (users type 2, 4, 6, 10 digits)
- **Full-text search** by `nameShort`, `nameFull`, `examples`
- Normalized tokens without punctuation
- Debounce 300ms on client
- Background enrichment via `tks.searchTnved` only if local results are weak — autocomplete must not depend on external API

### Reference Data (Manual/Seed)

All normative tables are **versioned** (not overwritten):
- `customsFees`: `validFrom`, `validTo`, `source`, `sourceDoc`
- `antidumpingDuties`: same versioning fields
- Excise tariffs: stored in `exciseTariffs` table (see Section 2)
- Update frequency: ~1/year for fees and excises, 5-10/year for antidumping

---

## 8. Export (PDF / Excel)

### Architecture

Async generation via Convex actions:
1. UI clicks "PDF" or "Excel"
2. `exports.requestPdf({ calculationId })` action
3. Generate file from **snapshot data only** (no re-fetching rates/tariffs)
4. Save to Convex file storage → write `storageId` to `exports` table
5. UI reactively gets download link via `useQuery`

### Deduplication

If `sourceSnapshotHash` hasn't changed since last export → return existing file without regeneration.
If calculation changed after export → mark existing export as `stale`.

### PDF

- Library: `@react-pdf/renderer`
- **Light business design** (not dark UI theme): white background, green brand accents, dark gray text
- Content: header with logo/date, item table, payment breakdown (3 groups), landed cost, warnings, applied rates/FX snapshot
- Cyrillic font support
- Filename: `ved-calc-YYYY-MM-DD-<shortId>.pdf`

### Excel

- Library: `exceljs`
- **Sheet 1 "Сводка":** header, calculation mode, date, totals, applied rates, warnings
- **Sheet 2 "Позиции":** item table with all fields, applied rates, allocated logistics, per-item results
- **Sheet 3 "Формулы и разбивка":** detailed formula per item (base, rate, result)
- Formatting: numbers as numbers (not strings), currency, %, auto-width columns
- Filename: `ved-calc-YYYY-MM-DD-<shortId>.xlsx`

### Export Table Statuses

`pending` → `processing` → `ready` | `failed` | `stale`

### Access Control

Export download checks: export belongs to current user, parent calculation belongs to current user.

---

## 9. Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Stack | Next.js + Convex + Clerk + shadcn/ui | Reactive backend, mature auth, flexible UI |
| Auth provider | Convex Auth (email + password) | No external dependency, everything on self-hosted Convex, client-first approach |
| Calculation approach | Our engine + TKS as data provider | Full control over breakdown, snapshots, UX |
| Recalculation trigger | Manual (button), not automatic | Predictable, less API load, better for multi-item editing |
| Items storage | Separate table (not nested array) | Easier editing, export, per-item validation |
| Catalog vs tariffs | Separate tables | Different update frequencies, versioning, sources |
| FX source | Official cbr.ru (primary) | Authoritative, no third-party dependency |
| Export from | Snapshot only | Historical consistency, no recalculation drift |
| PDF style | Light business (not dark) | Print-friendly, professional appearance |
| Engine architecture | Pure core + orchestration | Testable, reusable for direct/reverse, no Convex dependency in core |

---

## 10. Post-MVP Roadmap (not in scope)

- Excel invoice upload (parse items automatically)
- AI-powered ТН ВЭД code suggestion (free text → code)
- Scenario comparison ("what if" different routes/countries/codes)
- "Честный знак" module with cost estimation
- OAuth login (Yandex, Google, Telegram)
- Full marketing landing page
- REST API for CRM/ERP/1С integration
- Telegram/email notifications on rate changes
- Marketplace seller mode (Ozon/Wildberries margin calculator)
- Admin panel with roles
- Auto-recalculation as user preference
