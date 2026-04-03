"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

const features = [
  { icon: "📦", text: "Полный расчёт Landed Cost" },
  { icon: "🔄", text: "Обратный расчёт от розничной цены" },
  { icon: "📋", text: "Мультитоварная декларация" },
  { icon: "📄", text: "Экспорт в PDF и Excel" },
];

export default function Home() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/calculator");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-lg text-center">
        {/* Logo */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600" />
          <span className="text-3xl font-bold text-slate-50">VED Calc</span>
        </div>

        {/* Tagline */}
        <p className="mb-10 text-xl text-slate-300">
          Калькулятор таможенных платежей и полной себестоимости
        </p>

        {/* Features */}
        <ul className="mb-10 space-y-3 text-left">
          {features.map((f) => (
            <li
              key={f.text}
              className="flex items-center gap-3 text-base text-slate-300"
            >
              <span className="text-xl">{f.icon}</span>
              {f.text}
            </li>
          ))}
        </ul>

        {/* CTA buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-emerald-500 px-6 py-3 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/10"
          >
            Войти
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            Зарегистрироваться
          </Link>
        </div>
      </div>
    </div>
  );
}
