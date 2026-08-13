"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import type { GridMonthColumn, GridTeam, GridEmployee, GridTask } from "@/lib/forecast-grid";
import { setForecastCellAction, addProjectTeamAction, removeProjectTeamAction } from "@/app/actions/forecast-grid";
import { FormError } from "@/components/form";

type Unit = "fte" | "hours";

function fteFromHours(hours: number, standardWeeklyHours: number): number {
  return standardWeeklyHours ? hours / standardWeeklyHours : 0;
}

function hoursFromFte(fte: number, standardWeeklyHours: number): number {
  return fte * standardWeeklyHours;
}

function cellKey(employeeId: number, dateKey: number): string {
  return `${employeeId}:${dateKey}`;
}

function formatValue(value: number, unit: Unit): string {
  if (value === 0) return "";
  return unit === "fte" ? value.toFixed(2) : value.toFixed(1);
}

export function ForecastGrid({
  projectId,
  scenarioId,
  scenarioLocked,
  months,
  teams,
  availableTeams,
}: {
  projectId: number;
  scenarioId: number;
  scenarioLocked: boolean;
  months: GridMonthColumn[];
  teams: GridTeam[];
  availableTeams: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [unit, setUnit] = useState<Unit>("fte");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(months.length ? [months[0].monthKey] : []));
  const [expandedEmployees, setExpandedEmployees] = useState<Set<number>>(new Set());
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [cellError, setCellError] = useState<Record<string, string>>({});
  const [teamToAdd, setTeamToAdd] = useState<string>("");
  const [actionError, setActionError] = useState<string | undefined>(undefined);

  function directHoursFor(employeeId: number, dateKey: number, baseline: number): number {
    const key = cellKey(employeeId, dateKey);
    return key in edits ? edits[key] : baseline;
  }

  function taskHoursForWeek(employee: GridEmployee, dateKey: number): number {
    return employee.tasks.reduce((sum, t) => sum + (t.hoursByDateKey[dateKey] ?? 0), 0);
  }

  function isTaskCovered(employee: GridEmployee, dateKey: number): boolean {
    return employee.tasks.some((t) => (t.hoursByDateKey[dateKey] ?? 0) > 0);
  }

  function employeeWeekHours(employee: GridEmployee, dateKey: number): number {
    return directHoursFor(employee.employeeId, dateKey, employee.hoursByDateKey[dateKey] ?? 0) + taskHoursForWeek(employee, dateKey);
  }

  function employeeWeekValue(employee: GridEmployee, dateKey: number): number {
    const hours = employeeWeekHours(employee, dateKey);
    return unit === "fte" ? fteFromHours(hours, employee.standardWeeklyHours) : hours;
  }

  function taskWeekValue(task: GridTask, dateKey: number, standardWeeklyHours: number): number {
    const hours = task.hoursByDateKey[dateKey] ?? 0;
    return unit === "fte" ? fteFromHours(hours, standardWeeklyHours) : hours;
  }

  function teamWeekValue(team: GridTeam, dateKey: number): number {
    return team.employees.reduce((sum, e) => sum + employeeWeekValue(e, dateKey), 0);
  }

  function toggleMonth(monthKey: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }

  function toggleEmployee(employeeId: number) {
    setExpandedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  async function commitCell(employeeId: number, dateKey: number, standardWeeklyHours: number, raw: string) {
    const key = cellKey(employeeId, dateKey);
    const parsed = raw.trim() === "" ? 0 : Number(raw);
    if (Number.isNaN(parsed) || parsed < 0) {
      setCellError((prev) => ({ ...prev, [key]: "Enter a number ≥ 0" }));
      return;
    }
    const hours = unit === "fte" ? hoursFromFte(parsed, standardWeeklyHours) : parsed;
    setEdits((prev) => ({ ...prev, [key]: hours }));
    setCellError((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    const result = await setForecastCellAction({ projectId, employeeId, scenarioId, dateKey, hours });
    if ("error" in result) {
      setCellError((prev) => ({ ...prev, [key]: result.error }));
    }
  }

  async function handleAddTeam() {
    if (!teamToAdd) return;
    setActionError(undefined);
    const result = await addProjectTeamAction({ projectId, teamId: Number(teamToAdd) });
    if ("error" in result) {
      setActionError(result.error);
      return;
    }
    setTeamToAdd("");
    setEdits({});
    router.refresh();
  }

  async function handleRemoveTeam(teamId: number) {
    setActionError(undefined);
    const result = await removeProjectTeamAction({ projectId, teamId });
    if ("error" in result) {
      setActionError(result.error);
      return;
    }
    setEdits({});
    router.refresh();
  }

  const disabled = scenarioLocked;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-slate-700">Unit</span>
          <div className="flex overflow-hidden rounded-md border border-slate-300">
            {(["fte", "hours"] as Unit[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={`px-3 py-1 text-xs font-medium ${unit === u ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {u === "fte" ? "FTE" : "Hours"}
              </button>
            ))}
          </div>
        </div>
        {disabled ? <p className="text-xs text-amber-600">This scenario is locked — entry is disabled.</p> : null}
      </div>

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
            {teams.map((team) => (
              <Fragment key={team.teamId}>
                <tr className="bg-slate-50">
                  <td className="px-2 py-1.5 font-semibold text-slate-800">
                    <div className="flex items-center justify-between gap-2">
                      <span>{team.teamName}</span>
                      {!disabled ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveTeam(team.teamId)}
                          className="text-[11px] font-normal text-slate-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </td>
                  {months.map((m) =>
                    expanded.has(m.monthKey) ? (
                      m.weeks.map((w) => (
                        <td key={w.dateKey} className="border-l border-slate-100 px-2 py-1.5 text-right font-semibold tabular-nums text-slate-700">
                          {formatValue(teamWeekValue(team, w.dateKey), unit)}
                        </td>
                      ))
                    ) : (
                      <td key={m.monthKey} className="border-l border-slate-100 px-2 py-1.5 text-right font-semibold tabular-nums text-slate-700">
                        {formatValue(
                          m.weeks.reduce((sum, w) => sum + teamWeekValue(team, w.dateKey), 0),
                          unit
                        )}
                      </td>
                    )
                  )}
                </tr>
                {team.employees.map((employee) => (
                  <Fragment key={employee.employeeId}>
                    <tr>
                      <td className="py-1 pl-6 pr-2 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          {employee.tasks.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggleEmployee(employee.employeeId)}
                              className="text-slate-400 hover:text-slate-700"
                              title="Show tasks driving these hours"
                            >
                              {expandedEmployees.has(employee.employeeId) ? "▾" : "▸"}
                            </button>
                          ) : (
                            <span className="inline-block w-2.5" />
                          )}
                          <span>{employee.name}</span>
                        </div>
                      </td>
                      {months.map((m) =>
                        expanded.has(m.monthKey) ? (
                          m.weeks.map((w) => {
                            if (isTaskCovered(employee, w.dateKey)) {
                              return (
                                <td key={w.dateKey} className="border-l border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-500">
                                  {formatValue(employeeWeekValue(employee, w.dateKey), unit)}
                                </td>
                              );
                            }
                            const key = cellKey(employee.employeeId, w.dateKey);
                            return (
                              <td key={w.dateKey} className="border-l border-slate-100 px-1 py-0.5">
                                <input
                                  key={`${key}-${unit}`}
                                  type="number"
                                  step={unit === "fte" ? "0.01" : "0.5"}
                                  min={0}
                                  disabled={disabled}
                                  defaultValue={formatValue(employeeWeekValue(employee, w.dateKey), unit)}
                                  onBlur={(e) => commitCell(employee.employeeId, w.dateKey, employee.standardWeeklyHours, e.currentTarget.value)}
                                  title={cellError[key]}
                                  className={`w-16 rounded border bg-transparent px-1.5 py-1 text-right text-xs tabular-nums outline-none focus:border-slate-500 disabled:text-slate-400 ${
                                    cellError[key] ? "border-red-400" : "border-transparent hover:border-slate-200"
                                  }`}
                                />
                              </td>
                            );
                          })
                        ) : (
                          <td key={m.monthKey} className="border-l border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-500">
                            {formatValue(
                              m.weeks.reduce((sum, w) => sum + employeeWeekValue(employee, w.dateKey), 0),
                              unit
                            )}
                          </td>
                        )
                      )}
                    </tr>
                    {expandedEmployees.has(employee.employeeId)
                      ? employee.tasks.map((task) => (
                          <tr key={task.taskId} className="text-xs">
                            <td className="py-1 pl-10 pr-2">
                              <span className={task.isCritical ? "font-medium text-red-600" : "text-slate-500"}>{task.name}</span>
                              {task.isCritical ? (
                                <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 ring-1 ring-inset ring-red-600/20">
                                  Critical
                                </span>
                              ) : null}
                            </td>
                            {months.map((m) =>
                              expanded.has(m.monthKey) ? (
                                m.weeks.map((w) => (
                                  <td key={w.dateKey} className="border-l border-slate-100 px-2 py-1 text-right tabular-nums text-slate-400">
                                    {formatValue(taskWeekValue(task, w.dateKey, employee.standardWeeklyHours), unit)}
                                  </td>
                                ))
                              ) : (
                                <td key={m.monthKey} className="border-l border-slate-100 px-2 py-1 text-right tabular-nums text-slate-400">
                                  {formatValue(
                                    m.weeks.reduce((sum, w) => sum + taskWeekValue(task, w.dateKey, employee.standardWeeklyHours), 0),
                                    unit
                                  )}
                                </td>
                              )
                            )}
                          </tr>
                        ))
                      : null}
                  </Fragment>
                ))}
              </Fragment>
            ))}
            {teams.length === 0 ? (
              <tr>
                <td
                  colSpan={1 + months.reduce((n, m) => n + (expanded.has(m.monthKey) ? m.weeks.length : 1), 0)}
                  className="px-2 py-6 text-center text-sm text-slate-400"
                >
                  No teams on this project&apos;s grid yet. Add one below.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <FormError message={actionError} />

      {!disabled ? (
        <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
          <select
            value={teamToAdd}
            onChange={(e) => setTeamToAdd(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
          >
            <option value="">Add a team…</option>
            {availableTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddTeam}
            disabled={!teamToAdd}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
          >
            Add team
          </button>
        </div>
      ) : null}
    </div>
  );
}
