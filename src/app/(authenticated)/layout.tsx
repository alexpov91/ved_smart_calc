import { AuthGuard } from "@/components/auth/auth-guard";
import { TopBar } from "@/components/layout/top-bar";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-950">
        <TopBar />
        <main>{children}</main>
      </div>
    </AuthGuard>
  );
}
