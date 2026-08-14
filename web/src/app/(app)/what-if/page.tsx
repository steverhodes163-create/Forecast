import { db } from "@/lib/db";
import { getActiveScenario } from "@/lib/scenario";
import { getScenarioAdjustments } from "@/lib/whatif";
import { getDemandBridge } from "@/lib/measures";
import { getForecastFormRefData } from "@/lib/forecast-ref-data";
import { createScenarioBranchAction } from "@/app/actions/scenario";
import { createAdjustmentAction, deleteAdjustmentAction } from "@/app/actions/whatif";
import { Card, DataTable, PageHeader, Row, Cell } from "@/components/page";
import { SelectField, NumberField, TextAreaField, SubmitButton, DeleteButton } from "@/components/form";

function formatWeeks(weeks: { dateKey: number; date: Date | string; weekNumber: number }[]) {
  return weeks.map((w) => ({
    value: w.dateKey,
    label: `Wk ${w.weekNumber} — ${new Date(w.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
  }));
}

export default async function WhatIfPage({ searchParams }: PageProps<"/what-if">) {
  const { error } = await searchParams;
  const activeScenario = await getActiveScenario();

  if (!activeScenario) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="What-If" description="§7.4 — no scenario is set up yet." />
      </div>
    );
  }

  const isBranch = activeScenario.baseScenarioId != null;

  const [adjustments, before, after, refData, adjustmentTypes] = await Promise.all([
    getScenarioAdjustments(activeScenario.id),
    getDemandBridge({ scenarioId: activeScenario.id, applyAdjustments: false }),
    getDemandBridge({ scenarioId: activeScenario.id, applyAdjustments: true }),
    getForecastFormRefData(),
    db.adjustmentType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="What-If"
        description={`§7.4 — "Baseline + adjustments." Viewing: ${activeScenario.name}${activeScenario.isLocked ? " (locked)" : ""}${isBranch ? " (what-if branch)" : ""}. Switch scenarios from the header dropdown.`}
      />
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {String(error)}
        </p>
      ) : null}

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Committed / Weighted / Stretch Demand</h2>
        <p className="mb-4 text-xs text-slate-500">
          Before is this scenario&apos;s own rows with no adjustments applied; After is what every dashboard actually
          shows once this scenario&apos;s adjustments are resolved — the same numbers, recalculated live from the same
          measure (§7.4), not a separate copy.
        </p>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div />
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Before</div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">After</div>

          <div className="text-left text-sm font-medium text-slate-700">Committed</div>
          <div className="text-sm tabular-nums text-slate-500">{before.committedHours.toLocaleString()}h</div>
          <div className="text-sm font-semibold tabular-nums text-slate-900">{after.committedHours.toLocaleString()}h</div>

          <div className="text-left text-sm font-medium text-slate-700">Weighted</div>
          <div className="text-sm tabular-nums text-slate-500">{before.weightedHours.toLocaleString()}h</div>
          <div className="text-sm font-semibold tabular-nums text-slate-900">{after.weightedHours.toLocaleString()}h</div>

          <div className="text-left text-sm font-medium text-slate-700">Stretch</div>
          <div className="text-sm tabular-nums text-slate-500">{before.stretchHours.toLocaleString()}h</div>
          <div className="text-sm font-semibold tabular-nums text-slate-900">{after.stretchHours.toLocaleString()}h</div>
        </div>
      </Card>

      {!isBranch ? (
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Create a what-if scenario</h2>
          <p className="mb-4 text-xs text-slate-500">
            Adjustments attached directly to &quot;{activeScenario.name}&quot; would change what every viewer sees,
            immediately. Branch first — a what-if scenario starts with zero rows of its own and reads{" "}
            {activeScenario.name}&apos;s data at query time, so trying an adjustment never touches the real plan.
          </p>
          <form action={createScenarioBranchAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="baseScenarioId" value={activeScenario.id} />
            <div className="w-64">
              <label htmlFor="name" className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Scenario name</span>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Delay NM-450 by 8 weeks"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
              </label>
            </div>
            <SubmitButton>Create &amp; switch to it</SubmitButton>
          </form>
        </Card>
      ) : null}

      {isBranch ? (
        <>
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Add adjustment</h2>
            <form action={createAdjustmentAction} className="flex flex-col gap-4">
              <input type="hidden" name="scenarioId" value={activeScenario.id} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SelectField
                  name="adjustmentTypeId"
                  label="Type"
                  required
                  allowEmpty="— choose —"
                  options={adjustmentTypes.map((t) => ({ value: t.id, label: t.name }))}
                />
                <SelectField
                  name="projectId"
                  label="Project (Delay / Cancel / Win)"
                  allowEmpty="— none —"
                  options={refData.projects.map((p) => ({ value: p.id, label: p.name }))}
                />
                <SelectField
                  name="teamId"
                  label="Team (other types)"
                  allowEmpty="— none —"
                  options={refData.teams.map((t) => ({ value: t.id, label: t.name }))}
                />
                <NumberField name="deltaWeeks" label="Delta weeks (Delay)" min={1} />
                <SelectField
                  name="effectiveDateKey"
                  label="Effective from"
                  allowEmpty="— all dates —"
                  options={formatWeeks(refData.weeks)}
                />
              </div>
              <TextAreaField name="notes" label="Notes" />
              <div>
                <SubmitButton>Add adjustment</SubmitButton>
              </div>
            </form>
          </Card>

          <DataTable head={["Type", "Project / Team", "Delta weeks", "Effective from", "Notes", "Created", ""]}>
            {adjustments.map((a) => (
              <Row key={a.id}>
                <Cell>{a.adjustmentTypeName}</Cell>
                <Cell>{a.projectName ?? a.teamName ?? "—"}</Cell>
                <Cell align="right">{a.deltaWeeks ?? "—"}</Cell>
                <Cell align="right">
                  <span className="font-mono text-xs text-slate-500">{a.effectiveDateKey ?? "all"}</span>
                </Cell>
                <Cell>{a.notes ?? "—"}</Cell>
                <Cell>
                  <span className="text-xs text-slate-400">{a.createdBy ?? "—"}</span>
                </Cell>
                <Cell align="right">
                  <form action={deleteAdjustmentAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <DeleteButton />
                  </form>
                </Cell>
              </Row>
            ))}
            {adjustments.length === 0 ? (
              <Row>
                <Cell>
                  <span className="text-slate-400">No adjustments on this scenario yet.</span>
                </Cell>
              </Row>
            ) : null}
          </DataTable>
        </>
      ) : null}
    </div>
  );
}
