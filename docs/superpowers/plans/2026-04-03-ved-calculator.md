# VED Smart Calc — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a customs duty and landed cost calculator for Russian importers with Next.js + Convex + Clerk.

**Architecture:** Convex-centric backend with pure calculation engine (no Convex dependency in core math). Clerk for auth, Convex for data/realtime. Split-layout dark UI with shadcn/ui.

**Tech Stack:** Next.js 15 (App Router), Convex (self-hosted) + Convex Auth, shadcn/ui, Tailwind CSS, TypeScript, @react-pdf/renderer, exceljs, vitest

**Spec:** `docs/superpowers/specs/2026-04-03-ved-calculator-design.md`

---

## File Structure

```
ved_smart_calc/
├── convex/
│   ├── _generated/              # Convex auto-generated
│   ├── schema.ts                # 10 Convex tables (no users table — identity in Clerk)
│   ├── auth.config.ts           # Convex Auth config (Password provider)
│   ├── auth.ts                  # Auth utilities export
│   ├── userProfiles.ts          # queries + mutations
│   ├── tnvedCatalog.ts          # search queries
│   ├── tnvedTariffs.ts          # tariff queries + internal functions
│   ├── exchangeRates.ts         # queries + cron action
│   ├── customsFees.ts           # queries
│   ├── exciseTariffs.ts         # queries
│   ├── antidumpingDuties.ts     # queries
│   ├── calculations.ts          # mutations + queries + actions (runCalculation, recalculate)
│   ├── calculationItems.ts      # mutations + queries
│   ├── exports.ts               # mutations + queries + actions
│   ├── tks.ts                   # TKS.ru API actions
│   ├── cbr.ts                   # CBR exchange rate actions
│   ├── crons.ts                 # Cron job definitions
│   ├── seed.ts                  # Seed data loader
│   └── helpers/
│       ├── auth.ts              # getUserId() helper
│       └── ownership.ts         # Ownership check helpers
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout with providers
│   │   ├── page.tsx             # Landing page (/)
│   │   ├── login/
│   │   │   └── page.tsx         # Sign-in form
│   │   ├── register/
│   │   │   └── page.tsx         # Sign-up form
│   │   └── (authenticated)/
│   │       ├── layout.tsx       # Layout with TopBar
│   │       ├── calculator/
│   │       │   └── page.tsx     # Single workspace: new (/calculator) or existing (/calculator?id=xxx)
│   │       ├── history/
│   │       │   └── page.tsx     # History list
│   │       └── profile/
│   │           └── page.tsx     # Profile settings
│   ├── components/
│   │   ├── providers.tsx        # ConvexAuthProvider
│   │   ├── auth/
│   │   │   ├── sign-in-form.tsx
│   │   │   ├── sign-up-form.tsx
│   │   │   └── auth-guard.tsx
│   │   ├── layout/
│   │   │   ├── top-bar.tsx      # Navigation bar
│   │   │   └── user-menu.tsx    # Avatar dropdown
│   │   ├── calculator/
│   │   │   ├── mode-switcher.tsx
│   │   │   ├── item-card.tsx
│   │   │   ├── item-card-status.tsx
│   │   │   ├── tnved-autocomplete.tsx
│   │   │   ├── logistics-section.tsx
│   │   │   ├── action-bar.tsx
│   │   │   ├── results-panel.tsx
│   │   │   ├── results-status-badge.tsx
│   │   │   ├── results-summary.tsx
│   │   │   ├── results-landed-cost.tsx
│   │   │   ├── results-breakdown.tsx
│   │   │   ├── results-warnings.tsx
│   │   │   ├── export-buttons.tsx
│   │   │   └── reverse-params.tsx
│   │   ├── history/
│   │   │   ├── calculation-list.tsx
│   │   │   └── calculation-card.tsx
│   │   └── ui/                  # shadcn/ui components
│   ├── lib/
│   │   └── utils.ts             # cn() helper
│   └── engine/
│       ├── types.ts             # All engine I/O types
│       ├── normalize.ts         # Incoterms → CIF, currency conversion
│       ├── direct.ts            # Direct calculation
│       ├── reverse.ts           # Reverse calculation
│       ├── allocate.ts          # Logistics distribution
│       ├── warnings.ts          # Warning generation
│       └── __tests__/
│           ├── normalize.test.ts
│           ├── direct.test.ts
│           ├── reverse.test.ts
│           ├── allocate.test.ts
│           └── warnings.test.ts
├── scripts/
│   └── seed-twsby.ts            # TWS.BY Excel parser + seed
├── tailwind.config.ts
├── next.config.ts
├── convex.json                  # Convex config (self-hosted URL)
├── package.json
├── tsconfig.json
└── .env.local                   # CONVEX_URL, CLERK keys
```

---

## Phase 1: Foundation (Scaffolding + Schema + Auth)

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `.env.local`, `convex.json`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd "C:/Users/Alexander/Nextcloud/prod/ved_smart_calc"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Expected: Next.js project initialized with App Router and Tailwind.

- [ ] **Step 2: Install Convex**

```bash
npm install convex
npx convex init
```

Edit `convex.json` to point to self-hosted VPS URL if needed (user will provide the URL).

- [ ] **Step 3: Install Convex Auth**

```bash
npm install @convex-dev/auth @auth/core
```

- [ ] **Step 4: Install shadcn/ui**

```bash
npx shadcn@latest init -d
```

Choose: New York style, Slate base color, CSS variables = yes.

- [ ] **Step 5: Install additional dependencies**

```bash
npm install convex
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 5b: Configure vitest immediately (needed for TDD in Phase 3)**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Configure dark theme in `tailwind.config.ts`**

Set `darkMode: "class"` and extend colors with slate/green palette for dark business theme:

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#10b981",
          dark: "#059669",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
```

- [ ] **Step 7: Create `.env.local` template**

```bash
# .env.local
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
```

- [ ] **Step 8: Create `.gitignore` and initial commit**

Ensure `.env.local`, `node_modules/`, `.next/`, `convex/_generated/` are in `.gitignore`.

```bash
git init
git add -A
git commit -m "feat: initialize Next.js + Convex + Clerk + shadcn/ui project"
```

---

### Task 2: Convex Schema

**Files:**
- Create: `convex/schema.ts`

- [ ] **Step 1: Define all 11 tables in schema**

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  userProfiles: defineTable({
    userId: v.string(),
    name: v.string(),
    companyName: v.optional(v.string()),
    inn: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin")),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  tnvedCatalog: defineTable({
    code: v.string(),
    nameShort: v.string(),
    nameFull: v.string(),
    examples: v.array(v.string()),
    searchTokens: v.array(v.string()),
  })
    .index("by_code", ["code"])
    .searchIndex("search_name", {
      searchField: "nameShort",
      filterFields: [],
    })
    .searchIndex("search_full", {
      searchField: "nameFull",
      filterFields: [],
    }),

  tnvedTariffs: defineTable({
    tnvedCode: v.string(),
    source: v.union(v.literal("TKS"), v.literal("TWS")),
    sourceModule: v.optional(v.string()),
    dutyType: v.union(
      v.literal("advalorem"),
      v.literal("specific"),
      v.literal("combined")
    ),
    dutyRate: v.number(),
    dutySpecific: v.optional(v.number()),
    dutyUnit: v.optional(v.string()),
    vatRate: v.union(v.literal(22), v.literal(10), v.literal(0)),
    needsCertification: v.boolean(),
    needsMarking: v.boolean(),
    validFrom: v.string(),
    validTo: v.optional(v.string()),
    fetchedAt: v.number(),
    effectiveDate: v.optional(v.string()),
    payloadHash: v.optional(v.string()),
    rawPayload: v.optional(v.string()),
  })
    .index("by_code", ["tnvedCode"])
    .index("by_code_source", ["tnvedCode", "source"]),

  exchangeRates: defineTable({
    currency: v.string(),
    rate: v.number(),
    unitRate: v.number(),
    nominal: v.number(),
    date: v.string(),
    source: v.union(v.literal("CBR"), v.literal("CBR_XML_DAILY")),
    fetchedAt: v.number(),
  }).index("by_currency_date", ["currency", "date"]),

  customsFees: defineTable({
    minValue: v.number(),
    maxValue: v.number(),
    fee: v.number(),
    validFrom: v.string(),
    validTo: v.optional(v.string()),
    source: v.optional(v.string()),
    sourceDoc: v.optional(v.string()),
  }).index("by_validFrom_minValue", ["validFrom", "minValue"]),

  exciseTariffs: defineTable({
    tnvedCodePattern: v.string(),
    productCategory: v.string(),
    ratePerUnit: v.number(),
    unit: v.string(),
    validFrom: v.string(),
    validTo: v.optional(v.string()),
    source: v.optional(v.string()),
    sourceDoc: v.optional(v.string()),
  }).index("by_pattern", ["tnvedCodePattern"]),

  antidumpingDuties: defineTable({
    tnvedCodePattern: v.string(),
    country: v.string(),
    rate: v.number(),
    validFrom: v.string(),
    validTo: v.optional(v.string()),
    source: v.optional(v.string()),
    sourceDoc: v.optional(v.string()),
  }).index("by_pattern_country", ["tnvedCodePattern", "country"]),

  calculations: defineTable({
    userId: v.string(),
    createdAt: v.number(),
    mode: v.union(v.literal("direct"), v.literal("reverse")),
    status: v.union(
      v.literal("draft"),
      v.literal("calculating"),
      v.literal("completed"),
      v.literal("error"),
      v.literal("archived")
    ),
    title: v.optional(v.string()),
    currencyMode: v.string(),
    calculationDate: v.optional(v.string()),
    logistics: v.object({
      freight: v.number(),
      freightCurrency: v.string(),
      insurance: v.optional(v.number()),
      insuranceAuto: v.optional(v.boolean()),
      broker: v.optional(v.number()),
      certification: v.optional(v.number()),
      marking: v.optional(v.number()),
      bankCommission: v.optional(v.number()),
      svh: v.optional(v.number()),
      transportAfterBorder: v.optional(v.number()),
    }),
    distributionMethod: v.union(
      v.literal("by_weight"),
      v.literal("by_value")
    ),
    retailParams: v.optional(
      v.object({
        retailPrice: v.number(),
        desiredMargin: v.number(),
      })
    ),
    totals: v.optional(
      v.object({
        customsValue: v.number(),
        duty: v.number(),
        antidumping: v.number(),
        excise: v.number(),
        vat: v.number(),
        customsFee: v.number(),
        totalCustoms: v.number(),
        landedCost: v.number(),
      })
    ),
    warnings: v.array(
      v.object({
        code: v.string(),
        level: v.union(
          v.literal("info"),
          v.literal("warning"),
          v.literal("critical")
        ),
        message: v.string(),
        itemId: v.optional(v.string()),
      })
    ),
    errors: v.array(
      v.object({
        code: v.string(),
        message: v.string(),
        itemId: v.optional(v.string()),
      })
    ),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  calculationItems: defineTable({
    calculationId: v.id("calculations"),
    order: v.number(),
    tnvedCode: v.string(),
    productName: v.string(),
    invoiceValue: v.number(),
    currency: v.string(),
    incoterms: v.string(),
    country: v.string(),
    weightNet: v.number(),
    weightGross: v.number(),
    quantity: v.number(),
    unit: v.string(),
    appliedDutyType: v.optional(v.string()),
    appliedDutyRate: v.optional(v.number()),
    appliedVatRate: v.optional(v.number()),
    appliedExchangeRate: v.optional(v.number()),
    appliedExchangeDate: v.optional(v.string()),
    appliedCustomsFee: v.optional(v.number()),
    appliedAntidumpingRate: v.optional(v.number()),
    tariffSource: v.optional(
      v.union(v.literal("TKS"), v.literal("TWS"))
    ),
    tariffFetchedAt: v.optional(v.number()),
    allocatedFreight: v.optional(v.number()),
    allocatedInsurance: v.optional(v.number()),
    allocationMethod: v.optional(
      v.union(v.literal("by_weight"), v.literal("by_value"))
    ),
    result: v.optional(
      v.object({
        customsValue: v.number(),
        duty: v.number(),
        antidumping: v.number(),
        excise: v.number(),
        vat: v.number(),
        customsFee: v.number(),
        totalCustoms: v.number(),
        landedCost: v.number(),
        landedCostPerUnit: v.number(),
      })
    ),
  }).index("by_calculationId", ["calculationId"]),

  exports: defineTable({
    calculationId: v.id("calculations"),
    userId: v.string(),
    type: v.union(v.literal("pdf"), v.literal("xlsx")),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
      v.literal("stale")
    ),
    storageId: v.optional(v.string()),
    filename: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    sourceSnapshotHash: v.optional(v.string()),
    templateVersion: v.optional(v.string()),
    createdAt: v.number(),
    readyAt: v.optional(v.number()),
  }).index("by_calculationId", ["calculationId"]),
});
```

- [ ] **Step 2: Push schema to Convex**

```bash
npx convex dev
```

Expected: Schema deployed, `_generated/` types created.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: define Convex schema with 11 tables"
```

---

### Task 3: Convex Auth Integration

**Files:**
- Create: `convex/auth.config.ts`, `convex/auth.ts`, `convex/helpers/auth.ts`, `src/components/providers.tsx`, `src/components/auth/sign-in-form.tsx`, `src/components/auth/sign-up-form.tsx`, `src/components/auth/auth-guard.tsx`, `src/app/layout.tsx`, `src/app/login/page.tsx`, `src/app/register/page.tsx`

- [ ] **Step 1: Install Convex Auth**

```bash
npm install @convex-dev/auth @auth/core
```

- [ ] **Step 2: Configure Convex Auth with Password provider**

```typescript
// convex/auth.config.ts
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password],
});
```

```typescript
// convex/auth.ts
import { query } from "./_generated/server";
import { auth } from "./auth.config";

// Re-export auth utilities for use in other Convex functions
export { auth, signIn, signOut, store } from "./auth.config";

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});
```

- [ ] **Step 3: Create auth helper**

```typescript
// convex/helpers/auth.ts
import { QueryCtx, MutationCtx } from "../_generated/server";
import { auth } from "../auth.config";

export async function getUserId(
  ctx: QueryCtx | MutationCtx
): Promise<string> {
  const userId = await auth.getUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return userId.toString();
}
```

- [ ] **Step 4: Update schema to include auth tables**

Convex Auth adds its own tables (users, authAccounts, authSessions, etc.). Update `schema.ts` to merge with auth schema:

```typescript
// At top of convex/schema.ts, add:
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  // ... rest of your 10 app tables
});
```

- [ ] **Step 5: Set CONVEX_AUTH_PRIVATE_KEY env var**

Convex Auth needs a signing key. Generate one:

```bash
npx @convex-dev/auth generate-keys
```

Add the private key to Convex environment variables via dashboard (http://127.0.0.1:6791) → Settings → Environment Variables:
- `AUTH_PRIVATE_KEY` = generated key

- [ ] **Step 6: Create providers component**

```tsx
// src/components/providers.tsx
"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL!
);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      {children}
    </ConvexAuthProvider>
  );
}
```

- [ ] **Step 7: Create root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "VED Calc — Калькулятор таможенных платежей",
  description: "Расчёт пошлин, НДС и полной себестоимости импорта",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-50`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Create auth guard component**

```tsx
// src/components/auth/auth-guard.tsx
"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-slate-400">Загрузка...</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
```

- [ ] **Step 9: Create sign-in form**

```tsx
// src/components/auth/sign-in-form.tsx
"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn("password", { email, password, flow: "signIn" });
      router.push("/calculator");
    } catch (err) {
      setError("Неверный email или пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <div>
        <label className="block text-sm text-slate-400 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-50 focus:border-emerald-500 focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="block text-sm text-slate-400 mb-1">Пароль</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-50 focus:border-emerald-500 focus:outline-none"
          required
        />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded-lg disabled:opacity-50"
      >
        {loading ? "Вход..." : "Войти"}
      </button>
    </form>
  );
}
```

- [ ] **Step 10: Create sign-up form**

Similar to sign-in but with `flow: "signUp"` and name field. Route: `src/components/auth/sign-up-form.tsx`.

- [ ] **Step 11: Create login and register pages**

```tsx
// src/app/login/page.tsx
import { SignInForm } from "@/components/auth/sign-in-form";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-50 mb-6">Вход в VED Calc</h1>
        <SignInForm />
        <p className="mt-4 text-slate-400 text-sm">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-emerald-400 hover:underline">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
```

```tsx
// src/app/register/page.tsx — similar with SignUpForm
```

- [ ] **Step 12: Create authenticated layout with AuthGuard**

```tsx
// src/app/(authenticated)/layout.tsx
import { AuthGuard } from "@/components/auth/auth-guard";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
```

- [ ] **Step 13: Verify auth flow**

```bash
npm run dev
```

1. Open `/register` → create account
2. Open `/calculator` → should redirect to `/login` if not authenticated
3. Login → redirected to `/calculator`

- [ ] **Step 14: Commit**

```bash
git add convex/auth.config.ts convex/auth.ts convex/helpers/ src/components/providers.tsx src/components/auth/ src/app/layout.tsx src/app/login/ src/app/register/ src/app/\(authenticated\)/
git commit -m "feat: integrate Convex Auth with email+password and auth guard"
```

---

### Task 4: UserProfiles CRUD

**Files:**
- Create: `convex/userProfiles.ts`, `convex/helpers/ownership.ts`

- [ ] **Step 1: Create ownership helper**

```typescript
// convex/helpers/ownership.ts
import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

type AnyCtx = QueryCtx | MutationCtx;

export async function assertCalculationOwner(
  ctx: AnyCtx,
  calculationId: Id<"calculations">,
  userId: string
) {
  const calc = await ctx.db.get(calculationId);
  if (!calc || calc.userId !== userId) {
    throw new Error("Calculation not found or access denied");
  }
  return calc;
}
```

- [ ] **Step 2: Create userProfiles queries and mutations**

```typescript
// convex/userProfiles.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./helpers/auth";

export const getMine = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("userProfiles"),
      _creationTime: v.number(),
      userId: v.string(),
      name: v.string(),
      companyName: v.optional(v.string()),
      inn: v.optional(v.string()),
      role: v.union(v.literal("user"), v.literal("admin")),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    return profile;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    companyName: v.optional(v.string()),
    inn: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      throw new Error("Profile already exists");
    }
    return await ctx.db.insert("userProfiles", {
      userId,
      name: args.name,
      companyName: args.companyName,
      inn: args.inn,
      role: "user",
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    name: v.optional(v.string()),
    companyName: v.optional(v.string()),
    inn: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile) {
      throw new Error("Profile not found");
    }
    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.companyName !== undefined) updates.companyName = args.companyName;
    if (args.inn !== undefined) updates.inn = args.inn;
    await ctx.db.patch(profile._id, updates);
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add convex/userProfiles.ts convex/helpers/ownership.ts
git commit -m "feat: add userProfiles queries and mutations with auth"
```

---

### Task 5: Reference Data Seed

**Files:**
- Create: `convex/seed.ts`

- [ ] **Step 1: Create seed function for customs fees (2026 scale)**

```typescript
// convex/seed.ts
import { mutation } from "./_generated/server";

export const seedCustomsFees = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("customsFees").first();
    if (existing) return "Already seeded";

    const fees = [
      { minValue: 0, maxValue: 200000, fee: 1231 },
      { minValue: 200001, maxValue: 450000, fee: 2462 },
      { minValue: 450001, maxValue: 1200000, fee: 4269 },
      { minValue: 1200001, maxValue: 2700000, fee: 8538 },
      { minValue: 2700001, maxValue: 4200000, fee: 16524 },
      { minValue: 4200001, maxValue: 5500000, fee: 20000 },
      { minValue: 5500001, maxValue: 7000000, fee: 25000 },
      { minValue: 7000001, maxValue: 10000000, fee: 30000 },
      { minValue: 10000001, maxValue: 999999999999, fee: 73860 },
    ];

    for (const f of fees) {
      await ctx.db.insert("customsFees", {
        ...f,
        validFrom: "2026-01-01",
        source: "ПП РФ №1637",
        sourceDoc: "Постановление Правительства РФ от 28.11.2024 №1637",
      });
    }
    return "Seeded customs fees";
  },
});

export const seedExchangeRatesTest = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("exchangeRates")
      .withIndex("by_currency_date", (q) => q.eq("currency", "USD"))
      .first();
    if (existing) return "Already seeded";

    const testRates = [
      { currency: "USD", rate: 84.38, unitRate: 84.38, nominal: 1 },
      { currency: "EUR", rate: 93.44, unitRate: 93.44, nominal: 1 },
      { currency: "CNY", rate: 13.24, unitRate: 13.24, nominal: 1 },
      { currency: "TRY", rate: 2.45, unitRate: 2.45, nominal: 1 },
      { currency: "GBP", rate: 107.5, unitRate: 107.5, nominal: 1 },
    ];

    for (const r of testRates) {
      await ctx.db.insert("exchangeRates", {
        ...r,
        date: "2026-04-03",
        source: "CBR",
        fetchedAt: Date.now(),
      });
    }
    return "Seeded test exchange rates";
  },
});

export const seedSampleTnved = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("tnvedCatalog").first();
    if (existing) return "Already seeded";

    const samples = [
      {
        code: "9403202009",
        nameShort: "Мебель металлическая для кемпинга",
        nameFull: "Мебель металлическая прочая для кемпинга",
        examples: ["стул складной", "кровать кемпинговая", "стол походный"],
        searchTokens: ["мебель", "металл", "кемпинг", "стул", "складной"],
        dutyRate: 8, vatRate: 22 as const, dutyType: "advalorem" as const,
      },
      {
        code: "8215990000",
        nameShort: "Столовые приборы",
        nameFull: "Наборы из столовых и кухонных принадлежностей прочие",
        examples: ["вилки", "ложки", "ножи столовые"],
        searchTokens: ["столовые", "приборы", "вилки", "ложки"],
        dutyRate: 12, vatRate: 22 as const, dutyType: "advalorem" as const,
      },
      {
        code: "6403990000",
        nameShort: "Обувь с верхом из натуральной кожи",
        nameFull: "Обувь прочая с подошвой из резины и верхом из натуральной кожи",
        examples: ["ботинки", "туфли", "сапоги кожаные"],
        searchTokens: ["обувь", "кожа", "ботинки", "туфли"],
        dutyRate: 10, vatRate: 22 as const, dutyType: "combined" as const,
      },
      {
        code: "9503001000",
        nameShort: "Игрушки трёхколёсные велосипеды",
        nameFull: "Трехколесные велосипеды, самокаты и аналогичные игрушки",
        examples: ["самокат детский", "велосипед детский", "педальная машина"],
        searchTokens: ["игрушки", "велосипед", "самокат", "детский"],
        dutyRate: 7.5, vatRate: 10 as const, dutyType: "advalorem" as const,
      },
    ];

    for (const s of samples) {
      const { dutyRate, vatRate, dutyType, ...catalogData } = s;
      const catalogId = await ctx.db.insert("tnvedCatalog", catalogData);
      await ctx.db.insert("tnvedTariffs", {
        tnvedCode: s.code,
        source: "TWS",
        dutyType,
        dutyRate,
        dutySpecific: dutyType === "combined" ? 1.5 : undefined,
        dutyUnit: dutyType === "combined" ? "пара" : undefined,
        vatRate,
        needsCertification: s.code.startsWith("9403"),
        needsMarking: s.code.startsWith("6403"),
        validFrom: "2026-01-01",
        fetchedAt: Date.now(),
      });
    }
    return "Seeded sample TNVED catalog + tariffs";
  },
});
```

- [ ] **Step 2: Run seeds via Convex dashboard or CLI**

```bash
npx convex run seed:seedCustomsFees
npx convex run seed:seedExchangeRatesTest
npx convex run seed:seedSampleTnved
```

Expected: Reference data inserted (customs fees, exchange rates, 4 sample TNVED codes with tariffs).

- [ ] **Step 3: Commit**

```bash
git add convex/seed.ts
git commit -m "feat: add seed functions for customs fees and test exchange rates"
```

---

## Phase 2: Data Layer (Reference Queries + CBR + TN VED Search)

### Task 6: Reference Data Queries

**Files:**
- Create: `convex/customsFees.ts`, `convex/exciseTariffs.ts`, `convex/antidumpingDuties.ts`, `convex/exchangeRates.ts`

- [ ] **Step 1: Create customsFees queries**

```typescript
// convex/customsFees.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getScale = query({
  args: {},
  handler: async (ctx) => {
    const now = new Date().toISOString().slice(0, 10);
    const fees = await ctx.db
      .query("customsFees")
      .withIndex("by_validFrom_minValue", (q) => q.lte("validFrom", now))
      .collect();
    // Return only currently valid fees (validTo check in JS)
    return fees.filter((f) => !f.validTo || f.validTo >= now);
  },
});

export const getFeeForValue = query({
  args: { customsValue: v.number() },
  handler: async (ctx, { customsValue }) => {
    const now = new Date().toISOString().slice(0, 10);
    const fees = await ctx.db
      .query("customsFees")
      .withIndex("by_validFrom_minValue", (q) => q.lte("validFrom", now))
      .collect();
    const current = fees.filter(
      (f) => !f.validTo || f.validTo >= now
    );
    const match = current.find(
      (f) => customsValue >= f.minValue && customsValue <= f.maxValue
    );
    return match?.fee ?? 73860; // fallback to max
  },
});
```

- [ ] **Step 2: Create exchangeRates queries**

```typescript
// convex/exchangeRates.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getCurrent = query({
  args: { currency: v.string() },
  handler: async (ctx, { currency }) => {
    const rates = await ctx.db
      .query("exchangeRates")
      .withIndex("by_currency_date", (q) => q.eq("currency", currency))
      .order("desc")
      .first();
    return rates;
  },
});

export const getByDate = query({
  args: { currency: v.string(), date: v.string() },
  handler: async (ctx, { currency, date }) => {
    // Exact match first
    const exact = await ctx.db
      .query("exchangeRates")
      .withIndex("by_currency_date", (q) =>
        q.eq("currency", currency).eq("date", date)
      )
      .first();
    if (exact) return { rate: exact, warning: null };

    // Fallback: nearest previous date (bounded index query, not full scan)
    const nearest = await ctx.db
      .query("exchangeRates")
      .withIndex("by_currency_date", (q) =>
        q.eq("currency", currency).lt("date", date)
      )
      .order("desc")
      .first();
    if (nearest) {
      return {
        rate: nearest,
        warning: `Курс на ${date} не найден, использован курс на ${nearest.date}`,
      };
    }
    return { rate: null, warning: `Курс ${currency} не найден` };
  },
});
```

- [ ] **Step 3: Create antidumpingDuties and exciseTariffs queries**

```typescript
// convex/antidumpingDuties.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const check = query({
  args: { tnvedCode: v.string(), country: v.string() },
  handler: async (ctx, { tnvedCode, country }) => {
    const duties = await ctx.db
      .query("antidumpingDuties")
      .collect();
    const now = new Date().toISOString().slice(0, 10);
    return duties.filter(
      (d) =>
        tnvedCode.startsWith(d.tnvedCodePattern) &&
        d.country === country &&
        d.validFrom <= now &&
        (!d.validTo || d.validTo >= now)
    );
  },
});
```

```typescript
// convex/exciseTariffs.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const check = query({
  args: { tnvedCode: v.string() },
  handler: async (ctx, { tnvedCode }) => {
    const tariffs = await ctx.db
      .query("exciseTariffs")
      .collect();
    const now = new Date().toISOString().slice(0, 10);
    return tariffs.filter(
      (t) =>
        tnvedCode.startsWith(t.tnvedCodePattern) &&
        t.validFrom <= now &&
        (!t.validTo || t.validTo >= now)
    );
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add convex/customsFees.ts convex/exchangeRates.ts convex/antidumpingDuties.ts convex/exciseTariffs.ts
git commit -m "feat: add reference data queries (fees, rates, antidumping, excise)"
```

---

### Task 7: CBR Exchange Rates Fetcher

**Files:**
- Create: `convex/cbr.ts`, `convex/crons.ts`

- [ ] **Step 1: Create CBR action**

```typescript
// convex/cbr.ts
import { action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Internal version for cron jobs (crons can only call internal functions)
export const fetchRatesCron = internalAction({
  args: {},
  handler: async (ctx) => {
    return await fetchRatesImpl(ctx);
  },
});

// Public version for manual trigger
export const fetchRates = action({
  args: {},
  handler: async (ctx) => {
    return await fetchRatesImpl(ctx);
  },
});

async function fetchRatesImpl(ctx: any) {
    // Fetch from official CBR XML with error handling
    let text: string;
    try {
      const response = await fetch(
        "https://www.cbr.ru/scripts/XML_daily.asp"
      );
      if (!response.ok) {
        console.error(`CBR fetch failed: ${response.status}`);
        return { saved: 0, error: `HTTP ${response.status}` };
      }
      text = await response.text();
    } catch (err) {
      console.error("CBR fetch network error:", err);
      return { saved: 0, error: "Network error" };
    }

    // Parse XML — extract Valute entries
    const currencies = ["USD", "EUR", "CNY", "TRY", "GBP"];
    const rates: Array<{
      currency: string;
      rate: number;
      unitRate: number;
      nominal: number;
    }> = [];

    for (const cur of currencies) {
      const regex = new RegExp(
        `<Valute[^>]*>.*?<CharCode>${cur}</CharCode>.*?<Nominal>(\\d+)</Nominal>.*?<Value>([\\d,]+)</Value>.*?</Valute>`,
        "s"
      );
      const match = text.match(regex);
      if (match) {
        const nominal = parseInt(match[1]);
        const rate = parseFloat(match[2].replace(",", "."));
        rates.push({
          currency: cur,
          rate,
          unitRate: rate / nominal,
          nominal,
        });
      }
    }

    // Extract date from XML: <ValCurs Date="DD.MM.YYYY"
    const dateMatch = text.match(/Date="(\d{2})\.(\d{2})\.(\d{4})"/);
    const date = dateMatch
      ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
      : new Date().toISOString().slice(0, 10);

    // Save via internal mutation
    await ctx.runMutation(internal.cbr.saveRates, {
      rates,
      date,
      source: "CBR" as const,
    });

    return { saved: rates.length, date };
  },
});

export const saveRates = internalMutation({
  args: {
    rates: v.array(
      v.object({
        currency: v.string(),
        rate: v.number(),
        unitRate: v.number(),
        nominal: v.number(),
      })
    ),
    date: v.string(),
    source: v.union(v.literal("CBR"), v.literal("CBR_XML_DAILY")),
  },
  handler: async (ctx, { rates, date, source }) => {
    for (const r of rates) {
      // Check if already exists for this currency+date
      const existing = await ctx.db
        .query("exchangeRates")
        .withIndex("by_currency_date", (q) =>
          q.eq("currency", r.currency).eq("date", date)
        )
        .first();
      if (!existing) {
        await ctx.db.insert("exchangeRates", {
          ...r,
          date,
          source,
          fetchedAt: Date.now(),
        });
      }
    }
  },
});
```

- [ ] **Step 2: Create cron jobs**

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Fetch CBR rates every 4 hours
crons.interval("fetch CBR rates", { hours: 4 }, internal.cbr.fetchRatesCron);

export default crons;
```

Note: Archive stale drafts and stale tariff refresh crons will be added later in Phase 4.

- [ ] **Step 3: Test CBR action manually**

```bash
npx convex run cbr:fetchRates
```

Expected: Exchange rates saved for USD, EUR, CNY, TRY, GBP.

- [ ] **Step 4: Commit**

```bash
git add convex/cbr.ts convex/crons.ts
git commit -m "feat: add CBR exchange rate fetcher with cron job"
```

---

### Task 8: ТН ВЭД Catalog and Search

**Files:**
- Create: `convex/tnvedCatalog.ts`, `convex/tnvedTariffs.ts`

- [ ] **Step 1: Create tnvedCatalog search query**

```typescript
// convex/tnvedCatalog.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const searchLocal = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { query: q, limit = 10 }) => {
    if (!q || q.length < 2) return [];

    // Prefix search by code (if query looks like digits)
    // Uses index range query for efficiency — no full-table scan
    if (/^\d+$/.test(q)) {
      const filtered = await ctx.db
        .query("tnvedCatalog")
        .withIndex("by_code", (idx) =>
          idx.gte("code", q).lt("code", q + "\uffff")
        )
        .take(limit);

      // Enrich with current tariff
      const enriched = await Promise.all(
        filtered.map(async (item) => {
          const tariff = await ctx.db
            .query("tnvedTariffs")
            .withIndex("by_code", (t) => t.eq("tnvedCode", item.code))
            .order("desc")
            .first();
          return { ...item, tariff };
        })
      );
      return enriched;
    }

    // Full-text search: search both nameShort and nameFull indexes,
    // then merge and deduplicate results
    const byShort = await ctx.db
      .query("tnvedCatalog")
      .withSearchIndex("search_name", (s) => s.search("nameShort", q))
      .take(limit);

    const byFull = await ctx.db
      .query("tnvedCatalog")
      .withSearchIndex("search_full", (s) => s.search("nameFull", q))
      .take(limit);

    // Merge and deduplicate by _id
    const seen = new Set(byShort.map((r) => r._id));
    const results = [
      ...byShort,
      ...byFull.filter((r) => !seen.has(r._id)),
    ].slice(0, limit);

    const enriched = await Promise.all(
      results.map(async (item) => {
        const tariff = await ctx.db
          .query("tnvedTariffs")
          .withIndex("by_code", (t) => t.eq("tnvedCode", item.code))
          .order("desc")
          .first();
        return { ...item, tariff };
      })
    );
    return enriched;
  },
});

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const catalog = await ctx.db
      .query("tnvedCatalog")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!catalog) return null;

    const tariff = await ctx.db
      .query("tnvedTariffs")
      .withIndex("by_code", (t) => t.eq("tnvedCode", code))
      .order("desc")
      .first();

    return { ...catalog, tariff };
  },
});
```

- [ ] **Step 2: Create tnvedTariffs internal query for tariff resolution**

```typescript
// convex/tnvedTariffs.ts
import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getResolvedTariff = internalQuery({
  args: {
    tnvedCode: v.string(),
    effectiveDate: v.optional(v.string()),
  },
  handler: async (ctx, { tnvedCode, effectiveDate }) => {
    const date = effectiveDate ?? new Date().toISOString().slice(0, 10);

    const tariffs = await ctx.db
      .query("tnvedTariffs")
      .withIndex("by_code", (q) => q.eq("tnvedCode", tnvedCode))
      .collect();

    if (tariffs.length === 0) return null;

    // 1. Filter by effective date within [validFrom, validTo]
    const valid = tariffs.filter(
      (t) => t.validFrom <= date && (!t.validTo || t.validTo >= date)
    );

    if (valid.length > 0) {
      // 2. Prefer TKS over TWS
      const tks = valid.filter((t) => t.source === "TKS");
      if (tks.length > 0) {
        // 3. Most recent by fetchedAt
        return tks.sort((a, b) => b.fetchedAt - a.fetchedAt)[0];
      }
      return valid.sort((a, b) => b.fetchedAt - a.fetchedAt)[0];
    }

    // 4. Fallback: most recent by validFrom
    const sorted = tariffs.sort((a, b) =>
      b.validFrom.localeCompare(a.validFrom)
    );
    return sorted[0];
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add convex/tnvedCatalog.ts convex/tnvedTariffs.ts
git commit -m "feat: add TNVED catalog search and tariff resolution"
```

---

### Task 9: TWS.BY Excel Seed Script

**Files:**
- Create: `scripts/seed-twsby.ts`

- [ ] **Step 1: Install xlsx parser**

```bash
npm install xlsx
npm install -D tsx
```

- [ ] **Step 2: Create seed script**

This script parses TWS.BY Excel file and loads data into Convex via the API. The exact column mapping will depend on the Excel structure. Create a skeleton:

```typescript
// scripts/seed-twsby.ts
import * as XLSX from "xlsx";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/seed-twsby.ts <path-to-excel>");
    process.exit(1);
  }

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  console.log(`Parsed ${rows.length} rows from ${filePath}`);
  console.log("Sample row:", JSON.stringify(rows[0], null, 2));

  // TODO: Map columns to tnvedCatalog + tnvedTariffs schema
  // This requires inspecting the actual TWS.BY Excel format
  // Column mapping will be finalized when the file is available

  console.log("Seed script ready. Column mapping needs configuration.");
}

main().catch(console.error);
```

Note: The exact column mapping will be configured when the TWS.BY Excel file is available. The script skeleton is ready for adaptation.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-twsby.ts
git commit -m "feat: add TWS.BY Excel seed script skeleton"
```

---

## Phase 3: Calculation Engine (Pure Core)

### Task 10: Engine Types

**Files:**
- Create: `src/engine/types.ts`

- [ ] **Step 1: Define all engine input/output types**

```typescript
// src/engine/types.ts

export interface NormalizedItem {
  id: string;
  tnvedCode: string;
  productName: string;
  invoiceValue: number;          // original currency
  currency: string;
  incoterms: string;
  country: string;
  weightNet: number;
  weightGross: number;
  quantity: number;
  unit: string;
}

export interface TariffSnapshot {
  tnvedCode: string;
  dutyType: "advalorem" | "specific" | "combined";
  dutyRate: number;
  dutySpecific?: number;
  dutyUnit?: string;
  vatRate: number;
  needsCertification: boolean;
  needsMarking: boolean;
  source: "TKS" | "TWS";
  fetchedAt: number;
}

export interface FxSnapshot {
  currency: string;
  unitRate: number;
  date: string;
}

export interface CustomsFeeScale {
  minValue: number;
  maxValue: number;
  fee: number;
}

export interface AntidumpingMatch {
  rate: number;
  country: string;
}

export interface ExciseMatch {
  ratePerUnit: number;
  unit: string;
  productCategory: string;
}

export interface ShipmentLogistics {
  freight: number;
  freightCurrency: string;
  insurance?: number;
  insuranceAuto?: boolean;
  broker?: number;
  certification?: number;
  marking?: number;
  bankCommission?: number;
  svh?: number;
  transportAfterBorder?: number;
}

export interface CalculationInput {
  items: NormalizedItem[];
  tariffs: Map<string, TariffSnapshot>;       // keyed by tnvedCode
  fxRates: Map<string, FxSnapshot>;           // keyed by currency
  eurRate: FxSnapshot;                         // EUR rate for specific duties
  customsFeeScale: CustomsFeeScale[];
  antidumping: Map<string, AntidumpingMatch>;  // keyed by item id
  excise: Map<string, ExciseMatch>;            // keyed by item id
  logistics: ShipmentLogistics;
  distributionMethod: "by_weight" | "by_value";
}

export interface ItemResult {
  itemId: string;
  customsValue: number;
  duty: number;
  antidumping: number;
  excise: number;
  vat: number;
  customsFee: number;
  totalCustoms: number;
  landedCost: number;
  landedCostPerUnit: number;
}

export interface CalculationOutput {
  itemResults: ItemResult[];
  totals: {
    customsValue: number;
    duty: number;
    antidumping: number;
    excise: number;
    vat: number;
    customsFee: number;
    totalCustoms: number;
    landedCost: number;
  };
  warnings: Warning[];
  errors: EngineError[];
}

export interface Warning {
  code: string;
  level: "info" | "warning" | "critical";
  message: string;
  itemId?: string;
}

export interface EngineError {
  code: string;
  message: string;
  itemId?: string;
}

export interface ReverseInput {
  item: NormalizedItem;
  tariff: TariffSnapshot;
  fxRate: FxSnapshot;
  eurRate: FxSnapshot;
  customsFeeScale: CustomsFeeScale[];
  antidumping?: AntidumpingMatch;
  excise?: ExciseMatch;
  logistics: ShipmentLogistics;
  retailPrice: number;
  desiredMargin: number;           // %
}

export interface ReverseOutput {
  maxPurchasePrice: number;        // in original currency
  itemResult: ItemResult;
  warnings: Warning[];
  converged: boolean;
  iterations: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat: define calculation engine types"
```

---

### Task 11: Normalize Module

**Files:**
- Create: `src/engine/normalize.ts`, `src/engine/__tests__/normalize.test.ts`

- [ ] **Step 1: Write failing tests for Incoterms normalization**

```typescript
// src/engine/__tests__/normalize.test.ts
import { describe, it, expect } from "vitest";
import { adjustForIncoterms, convertToRub } from "../normalize";

describe("adjustForIncoterms", () => {
  it("FOB: adds freight and insurance to get CIF", () => {
    const result = adjustForIncoterms({
      invoiceValue: 50000,
      incoterms: "FOB",
      freightToBorder: 5000,
      insurance: 500,
    });
    expect(result).toBe(55500);
  });

  it("EXW: adds all transport costs", () => {
    const result = adjustForIncoterms({
      invoiceValue: 50000,
      incoterms: "EXW",
      freightToBorder: 7000,
      insurance: 500,
    });
    expect(result).toBe(57500);
  });

  it("CIF: returns invoice value unchanged", () => {
    const result = adjustForIncoterms({
      invoiceValue: 50000,
      incoterms: "CIF",
      freightToBorder: 5000,
      insurance: 500,
    });
    expect(result).toBe(50000);
  });
});

describe("convertToRub", () => {
  it("converts USD to RUB", () => {
    const result = convertToRub(1000, 84.38);
    expect(result).toBe(84380);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/engine/__tests__/normalize.test.ts
```

Expected: FAIL — functions not found.

- [ ] **Step 3: Implement normalize module**

```typescript
// src/engine/normalize.ts

interface IncotermsInput {
  invoiceValue: number;
  incoterms: string;
  freightToBorder: number;
  insurance: number;
}

/**
 * Adjusts invoice value to CIF-equivalent basis for customs value calculation.
 * All values in same currency as invoice.
 */
export function adjustForIncoterms(input: IncotermsInput): number {
  const { invoiceValue, incoterms, freightToBorder, insurance } = input;

  switch (incoterms.toUpperCase()) {
    case "CIF":
      // Already includes freight + insurance to destination
      return invoiceValue;
    case "FOB":
      // Add sea freight + insurance
      return invoiceValue + freightToBorder + insurance;
    case "EXW":
      // Add all transport + insurance
      return invoiceValue + freightToBorder + insurance;
    case "DAP":
    case "DDP":
      // Delivered — need to subtract internal transport (not added here)
      // For simplicity, return as-is; internal transport subtraction handled separately
      return invoiceValue;
    case "CPT":
      // Carriage paid — add insurance only
      return invoiceValue + insurance;
    case "CFR":
      // Cost + freight — add insurance
      return invoiceValue + insurance;
    default:
      // Unknown terms — treat as FOB for safety
      return invoiceValue + freightToBorder + insurance;
  }
}

/**
 * Convert amount to RUB using unit exchange rate.
 */
export function convertToRub(amount: number, unitRate: number): number {
  return Math.round(amount * unitRate * 100) / 100;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/engine/__tests__/normalize.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/normalize.ts src/engine/__tests__/normalize.test.ts
git commit -m "feat: add Incoterms normalization and currency conversion"
```

---

### Task 12: Allocate Module

**Files:**
- Create: `src/engine/allocate.ts`, `src/engine/__tests__/allocate.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/engine/__tests__/allocate.test.ts
import { describe, it, expect } from "vitest";
import { allocateLogistics } from "../allocate";

describe("allocateLogistics", () => {
  const items = [
    { id: "a", weightGross: 100, customsValue: 500000 },
    { id: "b", weightGross: 300, customsValue: 500000 },
  ];

  it("distributes by weight proportionally", () => {
    const result = allocateLogistics(items, 40000, "by_weight");
    expect(result.get("a")).toBe(10000);
    expect(result.get("b")).toBe(30000);
  });

  it("distributes by value proportionally", () => {
    const result = allocateLogistics(items, 40000, "by_value");
    expect(result.get("a")).toBe(20000);
    expect(result.get("b")).toBe(20000);
  });

  it("handles single item", () => {
    const single = [{ id: "a", weightGross: 100, customsValue: 500000 }];
    const result = allocateLogistics(single, 40000, "by_weight");
    expect(result.get("a")).toBe(40000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/engine/__tests__/allocate.test.ts
```

- [ ] **Step 3: Implement allocate module**

```typescript
// src/engine/allocate.ts

interface AllocatableItem {
  id: string;
  weightGross: number;
  customsValue: number;
}

export function allocateLogistics(
  items: AllocatableItem[],
  totalAmount: number,
  method: "by_weight" | "by_value"
): Map<string, number> {
  const result = new Map<string, number>();

  if (items.length === 0) return result;
  if (items.length === 1) {
    result.set(items[0].id, totalAmount);
    return result;
  }

  const totalBase = items.reduce(
    (sum, item) =>
      sum + (method === "by_weight" ? item.weightGross : item.customsValue),
    0
  );

  if (totalBase === 0) {
    // Equal split as fallback
    const perItem = Math.round((totalAmount / items.length) * 100) / 100;
    items.forEach((item) => result.set(item.id, perItem));
    return result;
  }

  let allocated = 0;
  items.forEach((item, index) => {
    const base =
      method === "by_weight" ? item.weightGross : item.customsValue;
    if (index === items.length - 1) {
      // Last item gets remainder to avoid rounding errors
      result.set(item.id, Math.round((totalAmount - allocated) * 100) / 100);
    } else {
      const share = Math.round((totalAmount * (base / totalBase)) * 100) / 100;
      result.set(item.id, share);
      allocated += share;
    }
  });

  return result;
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/engine/__tests__/allocate.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/allocate.ts src/engine/__tests__/allocate.test.ts
git commit -m "feat: add logistics allocation by weight and value"
```

---

### Task 13: Direct Calculation Engine

**Files:**
- Create: `src/engine/direct.ts`, `src/engine/__tests__/direct.test.ts`

- [ ] **Step 1: Write failing test with realistic data (cutlery from China example from spec)**

```typescript
// src/engine/__tests__/direct.test.ts
import { describe, it, expect } from "vitest";
import { calculateDirect } from "../direct";
import type { CalculationInput, FxSnapshot, TariffSnapshot, CustomsFeeScale } from "../types";

describe("calculateDirect", () => {
  const fxUSD: FxSnapshot = { currency: "USD", unitRate: 84.38, date: "2026-04-03" };
  const fxEUR: FxSnapshot = { currency: "EUR", unitRate: 93.44, date: "2026-04-03" };

  const tariff: TariffSnapshot = {
    tnvedCode: "8215990000",
    dutyType: "advalorem",
    dutyRate: 12,
    vatRate: 22,
    needsCertification: false,
    needsMarking: false,
    source: "TWS",
    fetchedAt: Date.now(),
  };

  const feeScale: CustomsFeeScale[] = [
    { minValue: 0, maxValue: 200000, fee: 1231 },
    { minValue: 200001, maxValue: 450000, fee: 2462 },
  ];

  it("calculates customs payments for single advalorem item", () => {
    const input: CalculationInput = {
      items: [
        {
          id: "item1",
          tnvedCode: "8215990000",
          productName: "Столовые приборы",
          invoiceValue: 4500,
          currency: "USD",
          incoterms: "FOB",
          country: "CN",
          weightNet: 200,
          weightGross: 220,
          quantity: 1000,
          unit: "шт",
        },
      ],
      tariffs: new Map([["8215990000", tariff]]),
      fxRates: new Map([["USD", fxUSD]]),
      eurRate: fxEUR,
      customsFeeScale: feeScale,
      antidumping: new Map(),
      excise: new Map(),
      logistics: {
        freight: 0,
        freightCurrency: "USD",
        insurance: 0,
      },
      distributionMethod: "by_weight",
    };

    const result = calculateDirect(input);

    // ТС = 4500 * 84.38 = 379710 RUB (FOB, no freight/insurance added in this test)
    expect(result.itemResults[0].customsValue).toBeCloseTo(379710, 0);
    // Duty = 379710 * 12% = 45565.2
    expect(result.itemResults[0].duty).toBeCloseTo(45565.2, 0);
    // VAT = (379710 + 45565.2) * 22% = 93560.54
    expect(result.itemResults[0].vat).toBeCloseTo(93560.54, 0);
    // Customs fee for 379710 → scale bracket 200001-450000 → 2462
    expect(result.itemResults[0].customsFee).toBe(2462);

    expect(result.errors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/engine/__tests__/direct.test.ts
```

- [ ] **Step 3: Implement direct calculation engine**

```typescript
// src/engine/direct.ts
import type {
  CalculationInput,
  CalculationOutput,
  ItemResult,
  Warning,
  EngineError,
} from "./types";
import { adjustForIncoterms, convertToRub } from "./normalize";
import { allocateLogistics } from "./allocate";

export function calculateDirect(input: CalculationInput): CalculationOutput {
  const warnings: Warning[] = [];
  const errors: EngineError[] = [];
  const itemResults: ItemResult[] = [];

  const {
    items,
    tariffs,
    fxRates,
    eurRate,
    customsFeeScale,
    antidumping,
    excise,
    logistics,
    distributionMethod,
  } = input;

  // Step 1: Calculate customs value per item (before allocation)
  const itemCustomsValues: Array<{ id: string; customsValue: number }> = [];

  for (const item of items) {
    const tariff = tariffs.get(item.tnvedCode);
    if (!tariff) {
      errors.push({
        code: "TARIFF_NOT_FOUND",
        message: `Тариф для кода ${item.tnvedCode} не найден`,
        itemId: item.id,
      });
      continue;
    }

    const fxRate = fxRates.get(item.currency);
    if (!fxRate) {
      errors.push({
        code: "FX_NOT_FOUND",
        message: `Курс ${item.currency} не найден`,
        itemId: item.id,
      });
      continue;
    }

    // Calculate freight and insurance shares (in item's currency)
    const freightFx = fxRates.get(logistics.freightCurrency);
    const freightInItemCurrency = freightFx
      ? (logistics.freight * freightFx.unitRate) / fxRate.unitRate
      : 0;

    const insuranceValue = logistics.insuranceAuto
      ? item.invoiceValue * 0.005
      : (logistics.insurance ?? 0);

    // Allocate freight to this item using chosen distribution method
    // (This is a preliminary allocation for CIF adjustment; final allocation done in Step 4)
    const totalWeight = items.reduce((s, i) => s + i.weightGross, 0);
    const totalValue = items.reduce((s, i) => s + i.invoiceValue, 0);
    const itemShare = distributionMethod === "by_weight"
      ? (totalWeight > 0 ? item.weightGross / totalWeight : 1 / items.length)
      : (totalValue > 0 ? item.invoiceValue / totalValue : 1 / items.length);

    // Adjust for Incoterms to get CIF-equivalent in original currency
    const cifValue = adjustForIncoterms({
      invoiceValue: item.invoiceValue,
      incoterms: item.incoterms,
      freightToBorder: freightInItemCurrency * itemShare,
      insurance: insuranceValue * itemShare,
    });

    const customsValueRub = convertToRub(cifValue, fxRate.unitRate);
    itemCustomsValues.push({ id: item.id, customsValue: customsValueRub });
  }

  // Step 2: Determine total customs value for fee calculation
  const totalCustomsValue = itemCustomsValues.reduce(
    (sum, i) => sum + i.customsValue,
    0
  );

  // Step 3: Determine customs fee (shipment-level)
  const feeEntry = customsFeeScale
    .sort((a, b) => a.minValue - b.minValue)
    .find(
      (f) =>
        totalCustomsValue >= f.minValue && totalCustomsValue <= f.maxValue
    );
  const totalCustomsFee = feeEntry?.fee ?? 73860;

  // Step 4: Allocate freight and insurance to items
  const freightRub = logistics.freight
    ? convertToRub(
        logistics.freight,
        fxRates.get(logistics.freightCurrency)?.unitRate ?? 1
      )
    : 0;
  const insuranceRub = logistics.insuranceAuto
    ? totalCustomsValue * 0.005
    : logistics.insurance
      ? convertToRub(
          logistics.insurance,
          fxRates.get(logistics.freightCurrency)?.unitRate ?? 1
        )
      : 0;

  const freightAlloc = allocateLogistics(
    items.map((item) => ({
      id: item.id,
      weightGross: item.weightGross,
      customsValue:
        itemCustomsValues.find((i) => i.id === item.id)?.customsValue ?? 0,
    })),
    freightRub,
    distributionMethod
  );

  const insuranceAlloc = allocateLogistics(
    items.map((item) => ({
      id: item.id,
      weightGross: item.weightGross,
      customsValue:
        itemCustomsValues.find((i) => i.id === item.id)?.customsValue ?? 0,
    })),
    insuranceRub,
    distributionMethod
  );

  // Step 5: Calculate per-item duties, VAT, etc.
  for (const item of items) {
    const tariff = tariffs.get(item.tnvedCode);
    const fxRate = fxRates.get(item.currency);
    if (!tariff || !fxRate) continue;

    const cv = itemCustomsValues.find((i) => i.id === item.id);
    if (!cv) continue;

    const customsValue = cv.customsValue;

    // Duty calculation
    let duty = 0;
    if (tariff.dutyType === "advalorem") {
      duty = customsValue * (tariff.dutyRate / 100);
    } else if (tariff.dutyType === "specific" && tariff.dutySpecific) {
      duty = item.quantity * tariff.dutySpecific * eurRate.unitRate;
    } else if (tariff.dutyType === "combined" && tariff.dutySpecific) {
      const advalorem = customsValue * (tariff.dutyRate / 100);
      const specific = item.quantity * tariff.dutySpecific * eurRate.unitRate;
      duty = Math.max(advalorem, specific);
    }
    duty = Math.round(duty * 100) / 100;

    // Antidumping
    const ad = antidumping.get(item.id);
    const antidumpingDuty = ad
      ? Math.round(customsValue * (ad.rate / 100) * 100) / 100
      : 0;

    // Excise
    const ex = excise.get(item.id);
    const exciseDuty = ex
      ? Math.round(item.quantity * ex.ratePerUnit * 100) / 100
      : 0;

    // VAT
    const vatBase = customsValue + duty + antidumpingDuty + exciseDuty;
    const vat = Math.round(vatBase * (tariff.vatRate / 100) * 100) / 100;

    // Customs fee allocation (proportional by customs value)
    const feeShare =
      totalCustomsValue > 0
        ? Math.round(
            (totalCustomsFee * (customsValue / totalCustomsValue)) * 100
          ) / 100
        : totalCustomsFee;

    const totalCustomsPayments =
      duty + antidumpingDuty + exciseDuty + vat + feeShare;

    // Landed cost per item
    const allocFreight = freightAlloc.get(item.id) ?? 0;
    const allocInsurance = insuranceAlloc.get(item.id) ?? 0;
    const domesticCosts =
      ((logistics.broker ?? 0) +
        (logistics.certification ?? 0) +
        (logistics.marking ?? 0) +
        (logistics.bankCommission ?? 0) +
        (logistics.svh ?? 0) +
        (logistics.transportAfterBorder ?? 0)) /
      items.length; // equal split for domestic costs

    // NOTE: freight-to-border and insurance are ALREADY included in customsValue
    // (via CIF adjustment). Do NOT add allocFreight/allocInsurance again here.
    // allocFreight/allocInsurance are stored on the item for transparency/reporting only.
    // Landed cost = customsValue (includes freight+insurance to border)
    //             + customs payments + domestic costs (after border)
    const landedCost =
      customsValue + totalCustomsPayments + domesticCosts;
    const landedCostPerUnit =
      item.quantity > 0
        ? Math.round((landedCost / item.quantity) * 100) / 100
        : landedCost;

    itemResults.push({
      itemId: item.id,
      customsValue,
      duty,
      antidumping: antidumpingDuty,
      excise: exciseDuty,
      vat,
      customsFee: feeShare,
      totalCustoms: Math.round(totalCustomsPayments * 100) / 100,
      landedCost: Math.round(landedCost * 100) / 100,
      landedCostPerUnit,
    });

    // Warnings
    if (tariff.needsCertification) {
      warnings.push({
        code: "CERT_REQUIRED",
        level: "info",
        message: `Код ${item.tnvedCode} может требовать сертификацию`,
        itemId: item.id,
      });
    }
    if (tariff.needsMarking) {
      warnings.push({
        code: "MARKING_REQUIRED",
        level: "info",
        message: `Код ${item.tnvedCode} требует маркировку «Честный знак»`,
        itemId: item.id,
      });
    }
  }

  // Aggregate totals
  const totals = {
    customsValue: sum(itemResults, "customsValue"),
    duty: sum(itemResults, "duty"),
    antidumping: sum(itemResults, "antidumping"),
    excise: sum(itemResults, "excise"),
    vat: sum(itemResults, "vat"),
    customsFee: totalCustomsFee,
    totalCustoms: sum(itemResults, "totalCustoms"),
    landedCost: sum(itemResults, "landedCost"),
  };

  return { itemResults, totals, warnings, errors };
}

function sum(items: ItemResult[], key: keyof ItemResult): number {
  return Math.round(
    items.reduce((s, i) => s + (i[key] as number), 0) * 100
  ) / 100;
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/engine/__tests__/direct.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add more tests (combined duty, multi-item, antidumping)**

Add tests for:
- Combined duty type (advalorem vs specific, pick max)
- Multiple items with allocation
- Antidumping duty added on top
- Missing tariff produces error

- [ ] **Step 6: Run all engine tests**

```bash
npx vitest run src/engine/
```

Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine/direct.ts src/engine/__tests__/direct.test.ts
git commit -m "feat: implement direct calculation engine with tests"
```

---

### Task 14: Reverse Calculation Engine

**Files:**
- Create: `src/engine/reverse.ts`, `src/engine/__tests__/reverse.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/engine/__tests__/reverse.test.ts
import { describe, it, expect } from "vitest";
import { calculateReverse } from "../reverse";
import type { ReverseInput, FxSnapshot, TariffSnapshot } from "../types";

describe("calculateReverse", () => {
  const fxUSD: FxSnapshot = { currency: "USD", unitRate: 84.38, date: "2026-04-03" };
  const fxEUR: FxSnapshot = { currency: "EUR", unitRate: 93.44, date: "2026-04-03" };

  const tariff: TariffSnapshot = {
    tnvedCode: "9403202009",
    dutyType: "advalorem",
    dutyRate: 8,
    vatRate: 22,
    needsCertification: false,
    needsMarking: false,
    source: "TWS",
    fetchedAt: Date.now(),
  };

  it("finds max purchase price for given retail price and margin", () => {
    const input: ReverseInput = {
      item: {
        id: "item1",
        tnvedCode: "9403202009",
        productName: "Стул складной",
        invoiceValue: 0, // to be determined
        currency: "USD",
        incoterms: "FOB",
        country: "CN",
        weightNet: 4,
        weightGross: 5,
        quantity: 1,
        unit: "шт",
      },
      tariff,
      fxRate: fxUSD,
      eurRate: fxEUR,
      customsFeeScale: [
        { minValue: 0, maxValue: 200000, fee: 1231 },
        { minValue: 200001, maxValue: 450000, fee: 2462 },
      ],
      logistics: { freight: 0, freightCurrency: "USD" },
      retailPrice: 10000, // 10000 RUB retail
      desiredMargin: 30,  // 30%
    };

    const result = calculateReverse(input);

    expect(result.converged).toBe(true);
    expect(result.maxPurchasePrice).toBeGreaterThan(0);
    expect(result.maxPurchasePrice).toBeLessThan(10000 / fxUSD.unitRate);
    expect(result.iterations).toBeLessThanOrEqual(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/engine/__tests__/reverse.test.ts
```

- [ ] **Step 3: Implement reverse engine**

```typescript
// src/engine/reverse.ts
import type {
  ReverseInput,
  ReverseOutput,
  Warning,
  CalculationInput,
} from "./types";
import { calculateDirect } from "./direct";

const TOLERANCE = 0.01;  // RUB
const MAX_ITERATIONS = 50;

export function calculateReverse(input: ReverseInput): ReverseOutput {
  const {
    item,
    tariff,
    fxRate,
    eurRate,
    customsFeeScale,
    antidumping,
    excise,
    logistics,
    retailPrice,
    desiredMargin,
  } = input;

  const warnings: Warning[] = [];

  // Target cost = retail price * (1 - margin%)
  const targetLandedCost = retailPrice * (1 - desiredMargin / 100);

  // Binary search for max purchase price
  let low = 0;
  let high = targetLandedCost / fxRate.unitRate; // max possible in foreign currency
  let bestPrice = 0;
  let bestResult = null;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS && high - low > TOLERANCE / fxRate.unitRate) {
    iterations++;
    const mid = (low + high) / 2;

    const testItem = { ...item, invoiceValue: mid };
    const directInput: CalculationInput = {
      items: [testItem],
      tariffs: new Map([[item.tnvedCode, tariff]]),
      fxRates: new Map([[item.currency, fxRate]]),
      eurRate,
      customsFeeScale,
      antidumping: antidumping ? new Map([[item.id, antidumping]]) : new Map(),
      excise: excise ? new Map([[item.id, excise]]) : new Map(),
      logistics,
      distributionMethod: "by_weight",
    };

    const result = calculateDirect(directInput);
    const landed = result.itemResults[0]?.landedCost ?? Infinity;

    if (landed <= targetLandedCost) {
      bestPrice = mid;
      bestResult = result;
      low = mid;
    } else {
      high = mid;
    }
  }

  const converged = high - low <= TOLERANCE / fxRate.unitRate;
  if (!converged) {
    warnings.push({
      code: "REVERSE_NOT_CONVERGED",
      level: "warning",
      message: `Обратный расчёт не сошёлся за ${MAX_ITERATIONS} итераций`,
    });
  }

  return {
    maxPurchasePrice: Math.round(bestPrice * 100) / 100,
    itemResult: bestResult?.itemResults[0] ?? {
      itemId: item.id,
      customsValue: 0,
      duty: 0,
      antidumping: 0,
      excise: 0,
      vat: 0,
      customsFee: 0,
      totalCustoms: 0,
      landedCost: 0,
      landedCostPerUnit: 0,
    },
    warnings,
    converged,
    iterations,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/engine/__tests__/reverse.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/reverse.ts src/engine/__tests__/reverse.test.ts
git commit -m "feat: implement reverse calculation engine with binary search"
```

---

### Task 15: Warnings Module

**Files:**
- Create: `src/engine/warnings.ts`, `src/engine/__tests__/warnings.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/engine/__tests__/warnings.test.ts
import { describe, it, expect } from "vitest";
import { generateWarnings } from "../warnings";
import type { TariffSnapshot } from "../types";

describe("generateWarnings", () => {
  it("warns about certification", () => {
    const tariff: TariffSnapshot = {
      tnvedCode: "9403202009",
      dutyType: "advalorem",
      dutyRate: 8,
      vatRate: 22,
      needsCertification: true,
      needsMarking: false,
      source: "TWS",
      fetchedAt: Date.now(),
    };
    const warnings = generateWarnings({
      itemId: "item1",
      tariff,
      staleTariff: false,
      fxDateMismatch: false,
    });
    expect(warnings.some((w) => w.code === "CERT_REQUIRED")).toBe(true);
  });

  it("warns about stale tariff", () => {
    const tariff: TariffSnapshot = {
      tnvedCode: "9403202009",
      dutyType: "advalorem",
      dutyRate: 8,
      vatRate: 22,
      needsCertification: false,
      needsMarking: false,
      source: "TWS",
      fetchedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days old
    };
    const warnings = generateWarnings({
      itemId: "item1",
      tariff,
      staleTariff: true,
      fxDateMismatch: false,
    });
    expect(warnings.some((w) => w.code === "STALE_TARIFF")).toBe(true);
  });
});
```

- [ ] **Step 2: Implement warnings module**

```typescript
// src/engine/warnings.ts
import type { Warning, TariffSnapshot } from "./types";

interface WarningInput {
  itemId: string;
  tariff: TariffSnapshot;
  staleTariff: boolean;
  fxDateMismatch: boolean;
  fxWarning?: string;
}

export function generateWarnings(input: WarningInput): Warning[] {
  const { itemId, tariff, staleTariff, fxDateMismatch, fxWarning } = input;
  const warnings: Warning[] = [];

  if (tariff.needsCertification) {
    warnings.push({
      code: "CERT_REQUIRED",
      level: "info",
      message: `Код ${tariff.tnvedCode} может требовать сертификацию`,
      itemId,
    });
  }

  if (tariff.needsMarking) {
    warnings.push({
      code: "MARKING_REQUIRED",
      level: "info",
      message: `Код ${tariff.tnvedCode} требует маркировку «Честный знак»`,
      itemId,
    });
  }

  if (staleTariff) {
    warnings.push({
      code: "STALE_TARIFF",
      level: "warning",
      message: `Тариф для ${tariff.tnvedCode} может быть неактуальным`,
      itemId,
    });
  }

  if (fxDateMismatch && fxWarning) {
    warnings.push({
      code: "FX_DATE_MISMATCH",
      level: "warning",
      message: fxWarning,
      itemId,
    });
  }

  return warnings;
}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/engine/__tests__/warnings.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/engine/warnings.ts src/engine/__tests__/warnings.test.ts
git commit -m "feat: add structured warnings module"
```

---

## Phase 4: Convex Orchestration (Calculations CRUD + Run Pipeline)

### Task 16: Calculations CRUD

**Files:**
- Create: `convex/calculations.ts`, `convex/calculationItems.ts`

- [ ] **Step 1: Create calculations mutations and queries**

Implement: `create`, `getMy`, `listMy` (cursor pagination), `getSummary`, `updateLogistics`, `updateMeta`, `setDistributionMethod`, `delete`, `clone`, `requestCalculation`, `recalculate`.

See spec Section 3 for full API. Key points:
- All functions use `getUserId(ctx)` from helpers
- All public functions include both argument validators AND return validators
- `listMy` uses cursor pagination via `_creationTime`
- `clone` does deep copy (header + items), status → draft, no results, new calculationDate = today
- `requestCalculation` sets status to "calculating"; **must reject reverse mode if calculationItems count > 1** (server-side enforcement)
- `recalculate` differs from `requestCalculation`: it forces fresh tariff/FX re-fetch from TKS/CBR before running the calculation
- `calculationDate` defaults to today if omitted (applied server-side in create and in orchestration action)
- Input validation: numeric fields must be positive, weight < 1,000,000 kg, value < $100,000,000, TN VED code exactly 10 digits
- Rate limiting: max 10 calculations/min per user (check via timestamp of last N calculations)

- [ ] **Step 2: Create calculationItems mutations and queries**

Implement: `add`, `update`, `remove`, `duplicate`, `byCalculation`.

Key points:
- `add` checks ownership of parent calculation
- `duplicate` copies item data, increments order
- Snapshot fields (`applied*`, `result`) are optional — set only during calculation

- [ ] **Step 3: Commit**

```bash
git add convex/calculations.ts convex/calculationItems.ts
git commit -m "feat: add calculations and items CRUD with ownership checks"
```

---

### Task 17: Calculation Run Pipeline (Orchestration)

**Files:**
- Modify: `convex/calculations.ts` (add `runCalculation` action and `applyResult` internalMutation)

- [ ] **Step 1: Implement `runCalculation` action**

This is the orchestration layer:
1. Fetch calculation and items from DB
2. For each item, resolve tariff via `tnvedTariffs.getResolvedTariff`
3. Get exchange rates for all currencies
4. Get customs fee scale, antidumping, excise data
5. Build `CalculationInput` for pure engine
6. Call `calculateDirect()` or `calculateReverse()` based on mode
7. Call `applyResult` internalMutation to save results

- [ ] **Step 2: Implement `applyResult` internalMutation**

Writes:
- Per-item snapshot fields + result to each `calculationItem`
- Totals, warnings, errors to `calculation`
- Status → "completed" or "error"
- Compute `sourceSnapshotHash` = hash of (items input data + applied tariff versions + applied FX rates). Store on calculation for export deduplication. Use simple JSON.stringify + hash approach.

- [ ] **Step 3: Test end-to-end via Convex dashboard**

Create a calculation, add items, run requestCalculation, verify results appear.

- [ ] **Step 4: Commit**

```bash
git add convex/calculations.ts
git commit -m "feat: add calculation orchestration pipeline (action + internalMutation)"
```

---

### Task 18: Reference Data Query

**Files:**
- Create: `convex/referenceData.ts`

- [ ] **Step 1: Create referenceData queries (includes currencies.listSupported)**

```typescript
// convex/referenceData.ts
import { query } from "./_generated/server";

// This also serves as currencies.listSupported (consolidated per spec)
export const getCalculationMeta = query({
  args: {},
  handler: async () => {
    return {
      incoterms: ["EXW", "FOB", "CIF", "DAP", "DDP", "CPT", "CFR"],
      currencies: ["USD", "EUR", "CNY", "TRY", "GBP"],
      units: ["шт", "кг", "пара", "литр", "м", "м²", "м³"],
      countries: [
        { code: "CN", name: "Китай" },
        { code: "TR", name: "Турция" },
        { code: "DE", name: "Германия" },
        { code: "IT", name: "Италия" },
        { code: "FR", name: "Франция" },
        { code: "KR", name: "Южная Корея" },
        { code: "JP", name: "Япония" },
        { code: "IN", name: "Индия" },
        { code: "VN", name: "Вьетнам" },
        { code: "US", name: "США" },
        { code: "GB", name: "Великобритания" },
      ],
    };
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/referenceData.ts
git commit -m "feat: add reference data query (incoterms, currencies, countries)"
```

---

## Phase 5: Calculator UI

### Task 19: Layout Shell and Navigation

**Files:**
- Create: `src/components/layout/top-bar.tsx`, `src/components/layout/user-menu.tsx`
- Install shadcn/ui components: `button`, `dropdown-menu`, `avatar`

- [ ] **Step 1: Install required shadcn components**

```bash
npx shadcn@latest add button dropdown-menu avatar input label select separator card badge tabs
```

- [ ] **Step 2: Create TopBar component**

Dark slate background, logo (VED Calc with green gradient icon), navigation links (Калькулятор, История), UserMenu on the right.

- [ ] **Step 3: Create UserMenu component**

`useQuery(api.auth.currentUser)` for name/email, avatar with initials, dropdown: Профиль, separator, Выход (via `useAuthActions().signOut()`).

- [ ] **Step 4: Create authenticated layout wrapper**

```tsx
// src/app/(authenticated)/layout.tsx
import { TopBar } from "@/components/layout/top-bar";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950">
      <TopBar />
      <main>{children}</main>
    </div>
  );
}
```

Move calculator, history, profile pages under `(authenticated)` route group.

- [ ] **Step 5: Verify navigation renders**

```bash
npm run dev
```

Login → see TopBar with links.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/ src/app/\(authenticated\)/
git commit -m "feat: add dark TopBar with navigation and user menu"
```

---

### Task 20: Calculator Page — Form Shell

**Files:**
- Create: `src/app/(authenticated)/calculator/page.tsx`, `src/components/calculator/mode-switcher.tsx`, `src/components/calculator/action-bar.tsx`

- [ ] **Step 1: Create mode switcher**

Toggle between "Прямой расчёт" / "Обратный расчёт". Uses state, green highlight on active tab.

- [ ] **Step 2: Create calculator page with split layout**

Left column (scrollable) + right column (sticky). Both wrapped in flex container. Left column has padding-bottom for action bar.

- [ ] **Step 3: Create sticky action bar**

Fixed at bottom of left column: "Рассчитать" button (green gradient), always visible.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authenticated\)/calculator/ src/components/calculator/
git commit -m "feat: add calculator page shell with split layout and mode switcher"
```

---

### Task 21: Item Card Component

**Files:**
- Create: `src/components/calculator/item-card.tsx`, `src/components/calculator/tnved-autocomplete.tsx`, `src/components/calculator/item-card-status.tsx`

- [ ] **Step 1: Create TN VED autocomplete**

Uses `useQuery(api.tnvedCatalog.searchLocal, { query, limit: 10 })` with 300ms debounce. Shows dropdown with code + name + duty rate. Dark styled input.

- [ ] **Step 2: Create item card**

Card with dark slate background. Fields: productName, TN VED autocomplete, invoiceValue + currency select (with live FX rate from `useQuery(api.exchangeRates.getCurrent)`), incoterms select, country select, weightNet, weightGross, quantity + unit select. Status line at bottom. Duplicate and delete buttons in header.

- [ ] **Step 3: Create item-card-status component**

Shows: `TKS ✓ · курс USD на 01.04.2026 · без ошибок` or error indicators.

- [ ] **Step 4: Commit**

```bash
git add src/components/calculator/item-card.tsx src/components/calculator/tnved-autocomplete.tsx src/components/calculator/item-card-status.tsx
git commit -m "feat: add item card with TNVED autocomplete and field validation"
```

---

### Task 22: Logistics Section

**Files:**
- Create: `src/components/calculator/logistics-section.tsx`

- [ ] **Step 1: Create collapsible logistics section**

Collapsed by default. Summary in header: `Фрахт: 5 000 USD · Страховка: авто · Распределение: по весу · Брокер: 20 000 ₽`. Expands to show all fields. Fields: freight + freightCurrency, insurance (toggle auto 0.5%), distribution method select, broker, certification, marking, bank commission, SVH, transport after border. All domestic fields in RUB.

- [ ] **Step 2: Commit**

```bash
git add src/components/calculator/logistics-section.tsx
git commit -m "feat: add collapsible logistics section with summary"
```

---

### Task 23: Results Panel

**Files:**
- Create: `src/components/calculator/results-panel.tsx`, `results-status-badge.tsx`, `results-summary.tsx`, `results-landed-cost.tsx`, `results-breakdown.tsx`, `results-warnings.tsx`, `export-buttons.tsx`

- [ ] **Step 1: Create results-status-badge**

Displays: "Актуально" (green), "Черновик" (gray), "Требуется пересчёт" (amber), "Идёт расчёт..." (blue pulse).

- [ ] **Step 2: Create results-summary**

Big green card: total customs payments with percentage of customs value.

- [ ] **Step 3: Create results-landed-cost**

Amber card: total landed cost + per-unit price.

- [ ] **Step 4: Create results-breakdown**

Hierarchical 3-group breakdown: Таможенные платежи, Логистика, Дополнительные услуги. Each group collapsible.

- [ ] **Step 5: Create results-warnings**

Renders structured warnings with color-coded levels (info=blue, warning=amber, critical=red).

- [ ] **Step 6: Create export-buttons**

Three buttons: PDF, Excel, Save. Show spinner during export generation.

- [ ] **Step 7: Create results-panel (wrapper)**

Sticky on desktop. Composes all sub-components. Shows loading skeleton during calculation.

- [ ] **Step 8: Commit**

```bash
git add src/components/calculator/results-*.tsx src/components/calculator/export-buttons.tsx
git commit -m "feat: add results panel with breakdown, warnings, and export buttons"
```

---

### Task 24: Wire Calculator to Convex

**Files:**
- Modify: `src/app/(authenticated)/calculator/page.tsx`

- [ ] **Step 1: Wire new calculation flow**

On `/calculator`: create calculation (draft) when first item is added. Wire all form state to Convex mutations. "Рассчитать" calls `requestCalculation` mutation → triggers `runCalculation` action. Results panel reads from `useQuery`.

- [ ] **Step 2: Wire existing calculation flow**

On `/calculator?id=xxx`: load calculation via `useQuery(api.calculations.getMy, { id })`, load items via `useQuery(api.calculationItems.byCalculation, { calculationId })`. Same form, pre-populated. Status badge tracks "Требуется пересчёт" via local dirty flag.

- [ ] **Step 3: Wire Save button**

**Save semantics (defined in spec):**
- Draft is created automatically when user adds first item (invisible to user)
- "Save" button persists current form state to the existing draft: calls `updateLogistics` + `updateMeta` mutations, syncs all item changes via `calculationItems.update`
- This is NOT "save to history for the first time" — the draft already exists in DB
- After save: toast "Расчёт сохранён"
- "Рассчитать" = save all changes + run calculation → status: completed
- A completed calculation is visible in history; a draft is also visible (with "Черновик" badge)

- [ ] **Step 4: Wire Ctrl+Enter hotkey**

Global keyboard listener: Ctrl+Enter or plain Enter on numeric fields → trigger "Рассчитать".

- [ ] **Step 5: Test full flow**

Register → create calculation → add item → fill fields → click Рассчитать → see results.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(authenticated\)/calculator/
git commit -m "feat: wire calculator to Convex mutations and queries"
```

---

### Task 25: Reverse Mode UI

**Files:**
- Create: `src/components/calculator/reverse-params.tsx`
- Modify: `src/app/(authenticated)/calculator/page.tsx`

- [ ] **Step 1: Create reverse params input**

Shows when mode = "reverse": retailPrice (RUB), desiredMargin (%). Visible above/below the item card.

- [ ] **Step 2: Hide "+ Добавить позицию" in reverse mode**

Show message: "Обратный расчёт работает для одного товара".

- [ ] **Step 3: Adjust results panel for reverse mode**

Show "Максимальная закупочная цена: X USD" as the primary result card instead of landed cost.

- [ ] **Step 4: Commit**

```bash
git add src/components/calculator/reverse-params.tsx
git commit -m "feat: add reverse mode UI with single-item enforcement"
```

---

## Phase 6: Supporting Pages

### Task 26: History Page

**Files:**
- Create: `src/app/(authenticated)/history/page.tsx`, `src/components/history/calculation-list.tsx`, `src/components/history/calculation-card.tsx`

- [ ] **Step 1: Create calculation card**

Shows: title (or "Без названия"), date, mode badge (direct/reverse), status badge, total customs + landed cost summary, item count. Click → navigate to `/calculator?id=xxx`.

- [ ] **Step 2: Create calculation list with cursor pagination**

Uses `useQuery(api.calculations.listMy, { limit: 20, cursor })`. "Загрузить ещё" button at bottom. Empty state: "Нет сохранённых расчётов".

- [ ] **Step 3: Create history page**

Title "История расчётов" + calculation list.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authenticated\)/history/ src/components/history/
git commit -m "feat: add history page with calculation list"
```

---

### Task 27: Profile Page

**Files:**
- Create: `src/app/(authenticated)/profile/page.tsx`

- [ ] **Step 1: Create profile page**

Form: name, companyName, INN. Uses `useQuery(api.userProfiles.getMine)` to pre-populate. "Сохранить" button calls `update` mutation. Auto-create profile on first visit if not exists.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(authenticated\)/profile/
git commit -m "feat: add profile page"
```

---

### Task 28: Landing Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create lightweight landing**

Dark background. Logo + "VED Calc". Value proposition: "Калькулятор таможенных платежей и полной себестоимости". 3-4 bullet points:
- Полный расчёт Landed Cost
- Обратный расчёт от розничной цены
- Мультитоварная декларация
- Экспорт в PDF и Excel

Two CTA buttons: "Войти" → `/login`, "Зарегистрироваться" → `/register`.

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add lightweight landing page"
```

---

## Phase 7: Export (PDF + Excel)

### Task 29: Export Infrastructure

**Files:**
- Create: `convex/exports.ts`

- [ ] **Step 1: Create exports queries and mutations**

Implement: `listByCalculation`, `getStatus`, `getDownloadUrl` (wraps `ctx.storage.getUrl()`), ownership checks.

- [ ] **Step 2: Commit**

```bash
git add convex/exports.ts
git commit -m "feat: add exports queries with download URL and ownership checks"
```

---

### Task 30: PDF Export

**Files:**
- Modify: `convex/exports.ts` (add `requestPdf` action)
- Create: PDF template module (either inline in action or separate file)

- [ ] **Step 1: Install @react-pdf/renderer**

```bash
npm install @react-pdf/renderer
```

- [ ] **Step 2: Implement `requestPdf` action**

1. Load calculation + items (snapshot data only)
2. Check `sourceSnapshotHash` — if unchanged, return existing export
3. Build PDF document: light business style, white background, green accents
4. Register Cyrillic font
5. Content: header, item table, 3-group breakdown, landed cost, warnings, applied rates
6. Upload to Convex file storage
7. Update exports table with storageId, filename, status: ready

- [ ] **Step 3: Test PDF generation**

Create a completed calculation → call requestPdf → download and verify content.

- [ ] **Step 4: Commit**

```bash
git add convex/exports.ts
git commit -m "feat: add PDF export generation with light business design"
```

---

### Task 31: Excel Export

**Files:**
- Modify: `convex/exports.ts` (add `requestXlsx` action)

- [ ] **Step 1: Install exceljs**

```bash
npm install exceljs
```

- [ ] **Step 2: Implement `requestXlsx` action**

1. Load calculation + items (snapshot data)
2. Check sourceSnapshotHash dedup
3. Create workbook with 3 sheets:
   - "Сводка": header, mode, date, totals, applied rates, warnings
   - "Позиции": item table with all fields and results
   - "Формулы и разбивка": detailed per-item formula breakdown
4. Format: numbers as numbers, currency format, auto-width
5. Upload to Convex storage

- [ ] **Step 3: Test Excel generation**

Create calculation → call requestXlsx → download and verify in Excel.

- [ ] **Step 4: Commit**

```bash
git add convex/exports.ts
git commit -m "feat: add Excel export with 3 sheets"
```

---

### Task 32: Wire Export Buttons in UI

**Files:**
- Modify: `src/components/calculator/export-buttons.tsx`

- [ ] **Step 1: Wire PDF button**

Click → call `exports.requestPdf` action → show spinner → reactive `useQuery(api.exports.getStatus)` → when ready, get download URL → trigger browser download.

- [ ] **Step 2: Wire Excel button**

Same pattern with `exports.requestXlsx`.

- [ ] **Step 3: Handle stale exports**

If calculation changed since last export (dirty flag), show "Обновить" instead of "Скачать".

- [ ] **Step 4: Commit**

```bash
git add src/components/calculator/export-buttons.tsx
git commit -m "feat: wire export buttons with async generation and download"
```

---

## Phase 8: Polish and Final Integration

### Task 33: Responsive Layout

**Files:**
- Modify: calculator page and components

- [ ] **Step 1: Add tablet breakpoint (768-1279px)**

Stacked layout: form on top, results below. Sticky "Рассчитать" bar at bottom of viewport.

- [ ] **Step 2: Add mobile breakpoint (<768px)**

Same stacked layout, simplified item cards (fields stack vertically), results collapsible.

- [ ] **Step 3: Test on different viewports**

Use browser dev tools to verify 3 breakpoints.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat: add responsive layout for tablet and mobile"
```

---

### Task 34: Additional Cron Jobs

**Files:**
- Modify: `convex/crons.ts`

- [ ] **Step 1: Add archive stale drafts cron**

Daily: find calculations with status "draft" older than 7 days → set status to "archived".

- [ ] **Step 2: Add stale tariff refresh cron**

Daily: find tnvedTariffs older than 7 days → trigger background TKS refresh.

- [ ] **Step 3: Commit**

```bash
git add convex/crons.ts
git commit -m "feat: add cron jobs for draft archival and tariff refresh"
```

---

### Task 35: TKS.ru API Integration

**Files:**
- Create: `convex/tks.ts`

- [ ] **Step 1: Implement TKS action stubs**

Create `tks.searchTnved` and `tks.getTariff` actions. Implementation depends on TKS API documentation and credentials. Create stubs that:
- Accept query/code parameters
- Log the request
- Return mock data for now
- Include TODO comments for real API integration

```typescript
// convex/tks.ts
import { action } from "./_generated/server";
import { v } from "convex/values";

export const searchTnved = action({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    // TODO: Replace with real TKS API call when credentials available
    // Endpoint: TKS API module "ТН ВЭД - подбор по наименованию"
    // Cache results to tnvedCatalog + tnvedTariffs
    console.log(`TKS search: ${query}`);
    return { results: [], source: "TKS_STUB" };
  },
});

export const getTariff = action({
  args: { tnvedCode: v.string() },
  handler: async (ctx, { tnvedCode }) => {
    // TODO: Replace with real TKS API call when credentials available
    // Endpoint: TKS API module "Расчёт таможенных платежей"
    //
    // CACHING POLICY (stale-while-revalidate):
    // 1. Check tnvedTariffs for existing record with source: "TKS"
    // 2. If fresh (fetchedAt < 24h ago) → return cached, skip API
    // 3. If stale (fetchedAt >= 24h ago) → return cached + trigger background refresh
    // 4. If cache miss → fetch from TKS API
    // 5. On TKS error → return last valid cached record + warning
    //
    // STORAGE: Save to tnvedTariffs with fields:
    //   source: "TKS", sourceModule: "tariff", fetchedAt: Date.now(),
    //   effectiveDate: today, payloadHash: hash(rawPayload), rawPayload: JSON.stringify(response)
    //
    // RATE LIMITING: max 30 TKS requests/min per user
    console.log(`TKS tariff: ${tnvedCode}`);
    return { tariff: null, source: "TKS_STUB" };
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/tks.ts
git commit -m "feat: add TKS API action stubs (to be connected with real API)"
```

---

### Task 36: Smoke Tests

#### A. Stub-Based Smoke Test (without real TKS — uses seed data)

Uses 4 sample TNVED codes from Task 5 seed. TKS actions are stubs.

- [ ] **Step 1: Manual smoke test checklist**

1. Open `/` → see landing page with CTA buttons
2. Click "Зарегистрироваться" → Clerk registration flow
3. After registration → redirected to `/calculator`
4. See empty calculator with mode switcher, empty form
5. Search TNVED: type "9403" → see "Мебель металлическая для кемпинга" from seed
6. Add item: fill fields using seed TNVED code, value, currency etc.
7. Fill logistics section
8. Click "Рассчитать" → see results in right panel (using TWS seed tariff)
9. Click "Save" → toast "Расчёт сохранён"
10. Navigate to `/history` → see saved calculation
11. Click on it → opens in `/calculator?id=xxx`
12. Click "PDF" → generates and downloads PDF
13. Click "Excel" → generates and downloads Excel
14. Switch to "Обратный расчёт" → reverse params visible, "+ Добавить позицию" hidden
15. Navigate to `/profile` → see and edit profile
16. Logout → redirected to landing page

- [ ] **Step 2: Fix any issues found**

- [ ] **Step 3: Commit**

```bash
git commit -am "fix: address stub smoke test findings"
```

#### B. TKS Integration Test Checklist (run after real TKS credentials obtained — not part of MVP build)

1. Search TNVED by free text → results from TKS API cached in `tnvedCatalog`
2. Calculate with TKS-sourced tariff → `tariffSource: "TKS"` in item snapshot
3. Verify stale-while-revalidate: cached tariff served, fresh one appears after background refresh
4. Verify TKS error fallback: disconnect network → last cached tariff used + warning
