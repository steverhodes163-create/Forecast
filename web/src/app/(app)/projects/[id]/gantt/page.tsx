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

  const gantt = await getProjectGantt(projectId);

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
          Predecessors: task number, optionally with lag — e.g. <code>1,3+2d</code>. Resources: name, optionally with
          an FTE share — e.g. <code>Alex Whitfield[50%]</code>.
        </p>
        <TaskSheet projectId={project.id} tasks={gantt.tasks} />
      </Card>
    </div>
  );
}
