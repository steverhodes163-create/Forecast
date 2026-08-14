import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { getActiveScenarioId, listAllScenarios } from "@/lib/scenario";
import { ScenarioSwitcher } from "@/components/scenario-switcher";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/my-tasks", label: "My Tasks" },
  { href: "/team-overview", label: "Team Overview" },
  { href: "/project-overview", label: "Project Overview" },
  { href: "/employees", label: "Employees" },
  { href: "/departments", label: "Departments" },
  { href: "/teams", label: "Teams" },
  { href: "/projects", label: "Projects" },
  { href: "/forecast", label: "Forecast" },
  { href: "/capacity", label: "Capacity" },
  { href: "/what-if", label: "What-If" },
  { href: "/imports", label: "Imports" },
  { href: "/settings", label: "Settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const nav = session.appRole === "ADMIN" ? [...NAV, { href: "/admin/users", label: "Admin" }] : NAV;
  const [scenarios, activeScenarioId] = await Promise.all([listAllScenarios(), getActiveScenarioId()]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">YASA</p>
              <p className="-mt-0.5 text-sm font-semibold text-slate-900">Resource Forecasting</p>
            </div>
            <nav className="flex flex-wrap items-center gap-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <ScenarioSwitcher scenarios={scenarios} activeId={activeScenarioId} />
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{session.name}</p>
              <p className="text-xs text-slate-400">{session.appRole}</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
