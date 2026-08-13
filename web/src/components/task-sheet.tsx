"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GanttTask } from "@/lib/gantt";
import {
  setTaskNameAction,
  setTaskDurationAction,
  setTaskPredecessorsAction,
  setTaskOwnerTeamAction,
  setTaskAssignmentsAction,
  markTaskDoneAction,
  deleteTaskAction,
  createBlankTaskAction,
} from "@/app/actions/tasks";
import { formatPredecessors } from "@/lib/task-shorthand";

type Team = { id: number; name: string };
type Employee = { id: number; name: string; teamId: number | null };
type AssignmentRow = { employeeId: number | null; pct: number };

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

const cellInputClass =
  "w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs outline-none focus:border-slate-400 hover:border-slate-200";

export function TaskSheet({
  projectId,
  tasks,
  teams,
  employees,
}: {
  projectId: number;
  tasks: GanttTask[];
  teams: Team[];
  employees: Employee[];
}) {
  const router = useRouter();
  const [cellError, setCellError] = useState<Record<string, string>>({});
  const [newTaskName, setNewTaskName] = useState("");
  const [creating, setCreating] = useState(false);
  const [pendingDone, setPendingDone] = useState<Record<number, boolean>>({});
  const [draftAssignments, setDraftAssignments] = useState<Record<number, AssignmentRow[]>>({});

  function setError(key: string, message: string | undefined) {
    setCellError((prev) => {
      if (!message) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: message };
    });
  }

  async function commitName(taskId: number, raw: string) {
    const key = `name-${taskId}`;
    const result = await setTaskNameAction({ taskId, projectId, name: raw });
    if ("error" in result) {
      setError(key, result.error);
      return;
    }
    setError(key, undefined);
    router.refresh();
  }

  async function commitDuration(taskId: number, raw: string) {
    const key = `duration-${taskId}`;
    const result = await setTaskDurationAction({ taskId, projectId, raw });
    if ("error" in result) {
      setError(key, result.error);
      return;
    }
    setError(key, undefined);
    router.refresh();
  }

  async function commitPredecessors(taskId: number, raw: string) {
    const key = `pred-${taskId}`;
    const result = await setTaskPredecessorsAction({ taskId, projectId, raw });
    if ("error" in result) {
      setError(key, result.error);
      return;
    }
    setError(key, undefined);
    router.refresh();
  }

  async function commitOwnerTeam(taskId: number, raw: string) {
    const key = `team-${taskId}`;
    const result = await setTaskOwnerTeamAction({ taskId, projectId, teamId: raw ? Number(raw) : null });
    if ("error" in result) {
      setError(key, result.error);
      return;
    }
    setError(key, undefined);
    router.refresh();
  }

  function assignmentsFor(t: GanttTask): AssignmentRow[] {
    return draftAssignments[t.id] ?? t.assignees.map((a) => ({ employeeId: a.employeeId, pct: Math.round(a.fte * 100) }));
  }

  function setDraftFor(taskId: number, rows: AssignmentRow[]) {
    setDraftAssignments((prev) => ({ ...prev, [taskId]: rows }));
  }

  async function saveAssignments(taskId: number, rows: AssignmentRow[]) {
    const key = `assign-${taskId}`;
    const complete = rows.filter((r): r is { employeeId: number; pct: number } => r.employeeId !== null);
    const result = await setTaskAssignmentsAction({ taskId, projectId, assignments: complete });
    if ("error" in result) {
      setError(key, result.error);
      return;
    }
    setError(key, undefined);
    router.refresh();
  }

  function addAssignmentRow(t: GanttTask) {
    setDraftFor(t.id, [...assignmentsFor(t), { employeeId: null, pct: 100 }]);
  }

  function removeAssignmentRow(t: GanttTask, index: number) {
    const rows = assignmentsFor(t).filter((_, i) => i !== index);
    setDraftFor(t.id, rows);
    saveAssignments(t.id, rows);
  }

  function changeAssignmentEmployee(t: GanttTask, index: number, employeeId: number) {
    const rows = assignmentsFor(t).map((r, i) => (i === index ? { ...r, employeeId } : r));
    setDraftFor(t.id, rows);
    if (rows.every((r) => r.employeeId !== null)) saveAssignments(t.id, rows);
  }

  function changeAssignmentPctLocal(t: GanttTask, index: number, pct: number) {
    setDraftFor(t.id, assignmentsFor(t).map((r, i) => (i === index ? { ...r, pct } : r)));
  }

  function commitAssignmentPct(t: GanttTask) {
    const rows = assignmentsFor(t);
    if (rows.every((r) => r.employeeId !== null)) saveAssignments(t.id, rows);
  }

  async function toggleDone(taskId: number, completed: boolean) {
    setPendingDone((prev) => ({ ...prev, [taskId]: completed }));
    const result = await markTaskDoneAction({ taskId, projectId, completed });
    if ("error" in result) {
      setError(`done-${taskId}`, result.error);
      setPendingDone((prev) => ({ ...prev, [taskId]: !completed }));
      return;
    }
    router.refresh();
  }

  async function handleDelete(taskId: number) {
    const result = await deleteTaskAction({ taskId, projectId });
    if ("error" in result) {
      setError(`row-${taskId}`, result.error);
      return;
    }
    router.refresh();
  }

  async function handleCreate() {
    const name = newTaskName.trim();
    if (!name || creating) return;
    setCreating(true);
    const result = await createBlankTaskAction({ projectId, name });
    setCreating(false);
    if ("error" in result) {
      setError("new-task", result.error);
      return;
    }
    setError("new-task", undefined);
    setNewTaskName("");
    router.refresh();
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
            <th className="w-10 px-2 py-1.5">#</th>
            <th className="px-2 py-1.5">Task Name</th>
            <th className="w-20 px-2 py-1.5">Duration</th>
            <th className="w-28 px-2 py-1.5">Predecessors</th>
            <th className="w-36 px-2 py-1.5">Owner team</th>
            <th className="w-56 px-2 py-1.5">Assigned to</th>
            <th className="w-20 px-2 py-1.5">Start</th>
            <th className="w-20 px-2 py-1.5">Finish</th>
            <th className="w-14 px-2 py-1.5 text-center">Done</th>
            <th className="w-10 px-2 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const rows = assignmentsFor(t);
            const pool = t.ownerTeamId ? employees.filter((e) => e.teamId === t.ownerTeamId) : employees;
            return (
              <tr key={t.id} className={`border-b border-slate-50 align-top ${(t.id in pendingDone ? pendingDone[t.id] : !!t.completedAt) ? "bg-slate-50" : ""}`}>
                <td className="px-2 py-1 text-xs text-slate-400">{t.id}</td>
                <td className="px-1 py-0.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      defaultValue={t.name}
                      onBlur={(e) => e.currentTarget.value.trim() !== t.name && commitName(t.id, e.currentTarget.value)}
                      className={`${cellInputClass} flex-1 ${t.isCritical ? "font-medium text-red-600" : "text-slate-800"}`}
                      title={cellError[`name-${t.id}`]}
                    />
                    {t.isCritical ? (
                      <span className="shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 ring-1 ring-inset ring-red-600/20">
                        Critical
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-1 py-0.5">
                  <input
                    type="text"
                    defaultValue={`${t.durationDays}d`}
                    onBlur={(e) => commitDuration(t.id, e.currentTarget.value)}
                    className={`${cellInputClass} tabular-nums ${cellError[`duration-${t.id}`] ? "border-red-400" : ""}`}
                    title={cellError[`duration-${t.id}`]}
                  />
                </td>
                <td className="px-1 py-0.5">
                  <input
                    type="text"
                    defaultValue={formatPredecessors(t.dependsOn.map((d) => ({ taskId: d.taskId, lagDays: d.lagDays })))}
                    onBlur={(e) => commitPredecessors(t.id, e.currentTarget.value)}
                    placeholder="e.g. 1,3+2d"
                    className={`${cellInputClass} tabular-nums ${cellError[`pred-${t.id}`] ? "border-red-400" : ""}`}
                    title={cellError[`pred-${t.id}`]}
                  />
                </td>
                <td className="px-1 py-0.5">
                  <select
                    defaultValue={t.ownerTeamId ?? ""}
                    onChange={(e) => commitOwnerTeam(t.id, e.target.value)}
                    className={cellInputClass}
                    title={cellError[`team-${t.id}`]}
                  >
                    <option value="">—</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1">
                  <div className="flex flex-col gap-1">
                    {rows.map((row, i) => {
                      const otherSelected = rows.filter((_, j) => j !== i).map((r) => r.employeeId);
                      const options = pool.filter((e) => e.id === row.employeeId || !otherSelected.includes(e.id));
                      return (
                        <div key={i} className="flex items-center gap-1">
                          <select
                            value={row.employeeId ?? ""}
                            onChange={(e) => changeAssignmentEmployee(t, i, Number(e.target.value))}
                            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs outline-none hover:border-slate-200 focus:border-slate-400"
                          >
                            <option value="" disabled>
                              Choose…
                            </option>
                            {options.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={row.pct}
                            onChange={(e) => changeAssignmentPctLocal(t, i, Number(e.target.value))}
                            onBlur={() => commitAssignmentPct(t)}
                            className="w-11 shrink-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-xs tabular-nums outline-none hover:border-slate-200 focus:border-slate-400"
                          />
                          <span className="shrink-0 text-[10px] text-slate-400">%</span>
                          <button
                            type="button"
                            onClick={() => removeAssignmentRow(t, i)}
                            className="shrink-0 text-[10px] text-slate-400 hover:text-red-600"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => addAssignmentRow(t)}
                      className="text-left text-[10px] font-medium text-slate-400 hover:text-slate-700"
                    >
                      + Add person
                    </button>
                    {cellError[`assign-${t.id}`] ? <p className="text-[10px] text-red-600">{cellError[`assign-${t.id}`]}</p> : null}
                  </div>
                </td>
                <td className="px-2 py-1 text-xs tabular-nums text-slate-500">{formatDate(t.startDate)}</td>
                <td className="px-2 py-1 text-xs tabular-nums text-slate-500">{formatDate(t.endDate)}</td>
                <td className="px-2 py-1 text-center">
                  <input
                    type="checkbox"
                    checked={t.id in pendingDone ? pendingDone[t.id] : !!t.completedAt}
                    onChange={(e) => toggleDone(t.id, e.currentTarget.checked)}
                    title={cellError[`done-${t.id}`]}
                  />
                </td>
                <td className="px-2 py-1 text-right">
                  <button type="button" onClick={() => handleDelete(t.id)} className="text-[11px] font-medium text-slate-400 hover:text-red-600">
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
          <tr>
            <td className="px-2 py-1 text-xs text-slate-300">+</td>
            <td className="px-1 py-0.5" colSpan={8}>
              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                onBlur={handleCreate}
                placeholder="Type a task name to add a row…"
                disabled={creating}
                className={`${cellInputClass} text-slate-500 ${cellError["new-task"] ? "border-red-400" : ""}`}
                title={cellError["new-task"]}
              />
            </td>
          </tr>
        </tbody>
      </table>
      {tasks.length === 0 ? <p className="px-2 py-4 text-xs text-slate-400">No tasks yet — type a name in the row below to add one.</p> : null}
    </div>
  );
}
