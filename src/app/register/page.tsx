import Link from "next/link";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-50">Регистрация</h1>
          <p className="mt-1 text-sm text-slate-400">
            Создайте аккаунт для работы с калькулятором
          </p>
        </div>

        <SignUpForm />

        <p className="text-center text-sm text-slate-400">
          Уже есть аккаунт?{" "}
          <Link
            href="/login"
            className="font-medium text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            Войти
          </Link>
        </p>
      </div>
    </main>
  );
}
