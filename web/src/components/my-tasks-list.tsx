"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MyTask } from "@/lib/my-tasks";
import { markMyTaskCompleteAction } from "@/app/actions/my-tasks";
import { FormError } from "@/components/form";

function formatDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function MyTasksList({ tasks }: { tasks: MyTask[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>(undefined);
  const [pendingDone, setPendingDone] = useState<Record<number, boolean>>({});

  async function toggle(taskId: number, completed: boolean) {
    setError(undefined);
    setPendingDone((prev) => ({ ...prev, [taskId]: completed }));
    const result = await markMyTaskCompleteAction({ taskId, completed });
    if ("error" in result) {
      setError(result.error);
      setPendingDone((prev) => ({ ...prev, [taskId]: !completed }));
      return;
    }
    router.refresh();
  }

  if (tasks.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">You have no tasks assigned right now.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <FormError message={error} />
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
            <th className="px-2 py-1.5">Task</th>
            <th className="px-2 py-1.5">Project</th>
            <th className="px-2 py-1.5 text-right">Duration</th>
            <th className="px-2 py-1.5">Due by</th>
            <th className="w-16 px-2 py-1.5 text-center">Done</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const isComplete = t.taskId in pendingDone ? pendingDone[t.taskId] : t.isComplete;
            return (
              <tr key={t.taskId} className={`border-b border-slate-50 ${isComplete ? "bg-slate-50 text-slate-400" : ""}`}>
                <td className="px-2 py-2">
                  <span className={t.isCritical && !isComplete ? "font-medium text-red-600" : "font-medium text-slate-800"}>
                    {t.taskName}
                  </span>
                  {t.isCritical && !isComplete ? (
                    <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 ring-1 ring-inset ring-red-600/20">
                      Critical
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-2">
                  <Link href={`/projects/${t.projectId}/gantt`} className="text-slate-500 hover:text-slate-900 hover:underline">
                    {t.projectName}
                  </Link>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-500">{t.durationDays}d</td>
                <td className="px-2 py-2 tabular-nums text-slate-500">{formatDate(t.dueDate)}</td>
                <td className="px-2 py-2 text-center">
                  <input type="checkbox" checked={isComplete} onChange={(e) => toggle(t.taskId, e.currentTarget.checked)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
