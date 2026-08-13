import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getProjectGantt } from "@/lib/gantt";
import { createTaskAction, deleteTaskAction, recalculateScheduleAction } from "@/app/actions/tasks";
import { GanttChart } from "@/components/gantt-chart";
import { TaskForm } from "@/components/task-form";
import { Card, DataTable, PageHeader, Row, Cell } from "@/components/page";
import { DeleteButton } from "@/components/form";

export default async function ProjectGanttPage({ params }: PageProps<"/projects/[id]/gantt">) {
  const { id } = await params;
  const projectId = Number(id);

  const [project, gantt, employees] = await Promise.all([
    db.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } }),
    getProjectGantt(projectId),
    db.employee.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${project.name} — Gantt`}
        description="§ task-driven forecasting — dependencies and the critical path (highlighted in red) drive the forecast grid's hours automatically. Edit dates via the form below; drag-to-resize on the chart is a planned follow-up."
      />

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Timeline</h2>
          <form action={recalculateScheduleAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <button type="submit" className="text-xs font-medium text-slate-500 hover:text-slate-900">
              Recalculate for current scenario
            </button>
          </form>
        </div>
        <GanttChart tasks={gantt.tasks} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <DataTable head={["Task", "Dates", "Duration", "Assigned to", ""]}>
          {gantt.tasks.map((t) => (
            <Row key={t.id}>
              <Cell>
                <span className={t.isCritical ? "font-medium text-red-600" : "font-medium text-slate-800"}>{t.name}</span>
                {t.isCritical ? (
                  <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 ring-1 ring-inset ring-red-600/20">
                    Critical
                  </span>
                ) : null}
              </Cell>
              <Cell>
                <span className="text-xs text-slate-500">
                  {new Date(t.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} –{" "}
                  {new Date(t.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </Cell>
              <Cell align="right">{t.durationDays}d</Cell>
              <Cell>{t.assignees.length ? t.assignees.map((a) => a.name).join(", ") : "—"}</Cell>
              <Cell align="right">
                <div className="flex justify-end gap-2">
                  <Link href={`/projects/${projectId}/gantt/tasks/${t.id}/edit`} className="text-xs font-medium text-slate-500 hover:text-slate-900">
                    Edit
                  </Link>
                  <form action={deleteTaskAction}>
                    <input type="hidden" name="taskId" value={t.id} />
                    <DeleteButton />
                  </form>
                </div>
              </Cell>
            </Row>
          ))}
          {gantt.tasks.length === 0 ? (
            <Row>
              <Cell>
                <span className="text-slate-400">No tasks yet.</span>
              </Cell>
            </Row>
          ) : null}
        </DataTable>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Add task</h2>
          <TaskForm
            action={createTaskAction}
            projectId={projectId}
            otherTasks={gantt.tasks.map((t) => ({ id: t.id, name: t.name }))}
            employees={employees}
          />
        </Card>
      </div>
    </div>
  );
}
