import { db } from "@/lib/db";
import { createCapacityAction, deleteCapacityAction } from "@/app/actions/capacity";
import { getActiveScenarioId } from "@/lib/scenario";
import { Card, DataTable, PageHeader, Row, Cell } from "@/components/page";
import { CapacityForm } from "@/components/capacity-form";
import { DeleteButton } from "@/components/form";

// §7.2: Available Hours = Standard − (Training + Shutdown + Holiday + InternalMeeting + BAUAllowance + ManagementOverhead)
function availableHours(c: {
  standardHours: unknown;
  trainingHours: unknown;
  businessShutdownHours: unknown;
  holidayHours: unknown;
  internalMeetingHours: unknown;
  bauAllowanceHours: unknown;
  managementOverheadHours: unknown;
}) {
  const n = (v: unknown) => Number(v);
  return (
    n(c.standardHours) -
    (n(c.trainingHours) +
      n(c.businessShutdownHours) +
      n(c.holidayHours) +
      n(c.internalMeetingHours) +
      n(c.bauAllowanceHours) +
      n(c.managementOverheadHours))
  );
}

export default async function CapacityPage({ searchParams }: PageProps<"/capacity">) {
  const { error } = await searchParams;
  const [teams, scenarios, activeScenarioId, capacities] = await Promise.all([
    db.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // Branch scenarios (baseScenarioId set) are "base + adjustments only" --
    // excluded here so hand-entered rows never collide with adjustment
    // resolution (§7.4, see src/lib/whatif.ts).
    db.scenario.findMany({ where: { isLocked: false, baseScenarioId: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getActiveScenarioId(),
    db.capacity.findMany({
      take: 50,
      orderBy: { dateKey: "desc" },
      include: { team: { select: { name: true } }, scenario: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Capacity"
        description="fact_Capacity (§5.2) — independent of demand. Available Hours here is computed live (§7.2), not stored. Replaces INP_Capacity."
      />
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {String(error)}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
        <DataTable head={["Month", "Team", "Scenario", "Budgeted HC", "Actual HC", "Available Hours", ""]}>
          {capacities.map((c) => (
            <Row key={c.id}>
              <Cell>
                <span className="font-mono text-xs text-slate-500">{c.dateKey}</span>
              </Cell>
              <Cell>{c.team.name}</Cell>
              <Cell>{c.scenario.name}</Cell>
              <Cell align="right">{c.budgetedHeadcount.toString()}</Cell>
              <Cell align="right">{c.actualHeadcount.toString()}</Cell>
              <Cell align="right">{availableHours(c).toFixed(1)}</Cell>
              <Cell align="right">
                <form action={deleteCapacityAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <DeleteButton />
                </form>
              </Cell>
            </Row>
          ))}
          {capacities.length === 0 ? (
            <Row>
              <Cell>
                <span className="text-slate-400">No capacity entries yet.</span>
              </Cell>
            </Row>
          ) : null}
        </DataTable>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Add / update capacity</h2>
          <p className="mb-4 text-xs text-slate-500">
            One row per team, scenario and month — saving again for the same combination updates it in place.
          </p>
          <CapacityForm action={createCapacityAction} teams={teams} scenarios={scenarios} defaultScenarioId={activeScenarioId ?? undefined} />
        </Card>
      </div>
    </div>
  );
}
