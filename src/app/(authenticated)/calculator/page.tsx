"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";

export default function CalculatorPage() {
  const { signOut } = useAuthActions();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 px-4 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-50">Калькулятор</h1>
          <button
            onClick={handleSignOut}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-50"
          >
            Выйти
          </button>
        </div>
        <p className="mt-4 text-slate-400">
          Таможенный калькулятор находится в разработке.
        </p>
      </div>
    </main>
  );
}
