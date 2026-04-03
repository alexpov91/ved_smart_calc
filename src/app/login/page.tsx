import Link from "next/link";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-50">Вход</h1>
          <p className="mt-1 text-sm text-slate-400">
            Войдите в таможенный калькулятор
          </p>
        </div>

        <SignInForm />

        <p className="text-center text-sm text-slate-400">
          Нет аккаунта?{" "}
          <Link
            href="/register"
            className="font-medium text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </main>
  );
}
