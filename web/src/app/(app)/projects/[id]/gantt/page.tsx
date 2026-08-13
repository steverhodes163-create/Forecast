import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getProjectGantt } from "@/lib/gantt";
import { recalculateScheduleAction } from "@/app/actions/tasks";
import { GanttChart } from "@/components/gantt-chart";
import { TaskSheet } from "@/components/task-sheet";
import { Card, PageHeader } from "@/components/page";

export default async function ProjectGanttPage({ params }: PageProps<"/projects/[id]/gantt">) {
  const { id } = await params;
  const projectId = Number(id);

  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } });
  if (!project) notFound();

  const [gantt, teams, employees] = await Promise.all([
    getProjectGantt(projectId),
    db.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.employee.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, teamId: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${project.name} — Gantt`}
        description="§ task-driven forecasting — dependencies and the critical path (highlighted in red) drive the forecast grid's hours automatically. Edit the sheet below like a spreadsheet; drag-to-resize on the chart is a planned follow-up."
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

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Task sheet</h2>
        <p className="mb-3 text-xs text-slate-400">
          Predecessors: task number, optionally with lag — e.g. <code>1,3+2d</code>. Pick an owner team to narrow the
          Assigned to picker to that team&apos;s members; add up to as many people as needed and set each one&apos;s
          share of the work.
        </p>
        <TaskSheet projectId={project.id} tasks={gantt.tasks} teams={teams} employees={employees} />
      </Card>
    </div>
  );
}
