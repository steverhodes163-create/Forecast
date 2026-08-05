import { db } from "@/lib/db";
import { createForecastAllocationAction, deleteForecastAllocationAction } from "@/app/actions/forecast";
import { getForecastFormRefData } from "@/lib/forecast-ref-data";
import { Card, DataTable, PageHeader, Row, Cell } from "@/components/page";
import { ForecastAllocationForm } from "@/components/forecast-allocation-form";
import { DeleteButton } from "@/components/form";

function allocationTarget(a: { employee: { name: string } | null; team: { name: string } | null; skill: { name: string } | null }) {
  if (a.employee) return { label: a.employee.name, mode: "Employee" };
  if (a.team) return { label: a.team.name, mode: "Team" };
  if (a.skill) return { label: a.skill.name, mode: "Skill" };
  return { label: "—", mode: "—" };
}

export default async function ForecastPage({ searchParams }: PageProps<"/forecast">) {
  const { error } = await searchParams;
  const [refData, allocations] = await Promise.all([
    getForecastFormRefData(),
    db.forecastAllocation.findMany({
      take: 50,
      orderBy: { id: "desc" },
      include: {
        project: { select: { name: true } },
        employee: { select: { name: true } },
        team: { select: { name: true } },
        skill: { select: { name: true } },
        scenario: { select: { name: true } },
        forecastSource: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Forecast Allocations"
        description="fact_ForecastAllocation (§5.2, §7) — Team / Employee / Skill planning modes share this one table and one reporting layer. Replaces INP_ForecastAllocations."
      />
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {String(error)}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <DataTable head={["Week", "Mode", "Allocated to", "Project", "Source", "Scenario", "Hours", ""]}>
          {allocations.map((a) => {
            const target = allocationTarget(a);
            return (
              <Row key={a.id}>
                <Cell>
                  <span className="font-mono text-xs text-slate-500">{a.dateKey}</span>
                </Cell>
                <Cell>{target.mode}</Cell>
                <Cell>{target.label}</Cell>
                <Cell>{a.project?.name ?? "—"}</Cell>
                <Cell>{a.forecastSource.name}</Cell>
                <Cell>{a.scenario.name}</Cell>
                <Cell align="right">{a.hours.toString()}</Cell>
                <Cell align="right">
                  <form action={deleteForecastAllocationAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <DeleteButton />
                  </form>
                </Cell>
              </Row>
            );
          })}
          {allocations.length === 0 ? (
            <Row>
              <Cell>
                <span className="text-slate-400">No allocations yet.</span>
              </Cell>
            </Row>
          ) : null}
        </DataTable>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Add allocation</h2>
          <ForecastAllocationForm action={createForecastAllocationAction} refData={refData} />
        </Card>
      </div>
    </div>
  );
}
