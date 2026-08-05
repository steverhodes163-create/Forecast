import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
          YASA Resource Forecasting
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Sign in</h1>
        <LoginForm />
        <p className="mt-6 text-xs text-slate-400">
          Demo credentials: admin@yasa.local / ChangeMe123!
        </p>
      </div>
    </div>
  );
}
