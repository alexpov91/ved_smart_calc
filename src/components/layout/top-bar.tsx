"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "./user-menu";

const navLinks = [
  { href: "/calculator", label: "Калькулятор" },
  { href: "/history", label: "История" },
] as const;

export function TopBar() {
  const pathname = usePathname();

  return (
    <header className="flex h-14 items-center border-b border-slate-800 bg-slate-900 px-4">
      {/* Left: Logo */}
      <Link href="/calculator" className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600" />
        <span className="text-base font-semibold text-slate-50">
          VED Calc
        </span>
      </Link>

      {/* Center: Navigation */}
      <nav className="ml-8 flex items-center gap-1">
        {navLinks.map(({ href, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "text-emerald-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Right: User menu */}
      <div className="ml-auto">
        <UserMenu />
      </div>
    </header>
  );
}
