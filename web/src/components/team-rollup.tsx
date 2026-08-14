"use client";

import { useState } from "react";
import Link from "next/link";
import type { GridMonthColumn } from "@/lib/forecast-grid";
import type { RollupProjectRow } from "@/lib/team-rollup";

function formatHours(hours: number): string {
  return hours === 0 ? "" : hours.toFixed(1);
}

export function TeamRollupTable({ months, projects }: { months: GridMonthColumn[]; projects: RollupProjectRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(months.length ? [months[0].monthKey] : []));

  function toggleMonth(monthKey: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }

  function projectWeekHours(project: RollupProjectRow, dateKey: number): number {
    return project.hoursByDateKey[dateKey] ?? 0;
  }

  function projectMonthHours(project: RollupProjectRow, month: GridMonthColumn): number {
    return month.weeks.reduce((sum, w) => sum + projectWeekHours(project, w.dateKey), 0);
  }

  function allProjectsWeekHours(dateKey: number): number {
    return projects.reduce((sum, p) => sum + projectWeekHours(p, dateKey), 0);
  }

  function allProjectsMonthHours(month: GridMonthColumn): number {
    return month.weeks.reduce((sum, w) => sum + allProjectsWeekHours(w.dateKey), 0);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-48 border-b border-slate-200 px-2 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-slate-400" />
            {months.map((m) => (
              <th
                key={m.monthKey}
                colSpan={expanded.has(m.monthKey) ? m.weeks.length : 1}
                className="border-b border-l border-slate-200 px-2 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-slate-400"
              >
                <button type="button" onClick={() => toggleMonth(m.monthKey)} className="hover:text-slate-700">
                  {m.label} {expanded.has(m.monthKey) ? "▾" : "▸"}
                </button>
              </th>
            ))}
          </tr>
          <tr>
            <th className="border-b border-slate-200 px-2 py-1 text-left text-xs text-slate-400" />
            {months.map((m) =>
              expanded.has(m.monthKey) ? (
                m.weeks.map((w) => (
                  <th key={w.dateKey} className="border-b border-l border-slate-200 px-2 py-1 text-right text-xs font-normal text-slate-400">
                    {w.label}
                  </th>
                ))
              ) : (
                <th key={m.monthKey} className="border-b border-l border-slate-200 px-2 py-1" />
              )
            )}
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.projectId} className="border-b border-slate-50">
              <td className="py-1.5 pl-2 pr-2 text-slate-700">
                <Link href={`/projects/${project.projectId}/forecast`} className="hover:text-slate-900 hover:underline">
                  {project.projectName}
                </Link>
              </td>
              {months.map((m) =>
                expanded.has(m.monthKey) ? (
                  m.weeks.map((w) => (
                    <td key={w.dateKey} className="border-l border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-600">
                      {formatHours(projectWeekHours(project, w.dateKey))}
                    </td>
                  ))
                ) : (
                  <td key={m.monthKey} className="border-l border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-600">
                    {formatHours(projectMonthHours(project, m))}
                  </td>
                )
              )}
            </tr>
          ))}
          {projects.length === 0 ? (
            <tr>
              <td
                colSpan={1 + months.reduce((n, m) => n + (expanded.has(m.monthKey) ? m.weeks.length : 1), 0)}
                className="px-2 py-6 text-center text-sm text-slate-400"
              >
                This team isn&apos;t on any project&apos;s forecast grid yet.
              </td>
            </tr>
          ) : (
            <tr className="bg-slate-50">
              <td className="px-2 py-1.5 font-semibold text-slate-800">All projects</td>
              {months.map((m) =>
                expanded.has(m.monthKey) ? (
                  m.weeks.map((w) => (
                    <td key={w.dateKey} className="border-l border-slate-100 px-2 py-1.5 text-right font-semibold tabular-nums text-slate-800">
                      {formatHours(allProjectsWeekHours(w.dateKey))}
                    </td>
                  ))
                ) : (
                  <td key={m.monthKey} className="border-l border-slate-100 px-2 py-1.5 text-right font-semibold tabular-nums text-slate-800">
                    {formatHours(allProjectsMonthHours(m))}
                  </td>
                )
              )}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
