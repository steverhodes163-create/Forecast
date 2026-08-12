import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card, DataTable, PageHeader, Row, Cell } from "@/components/page";

export default async function ImportBatchDetailPage({ params }: PageProps<"/imports/[id]">) {
  const { id } = await params;
  const batch = await db.importBatch.findUnique({ where: { id: Number(id) } });
  if (!batch) notFound();

  const [loadedRows, exceptions] = await Promise.all([
    db.actualAllocation.findMany({
      where: { importBatchId: batch.id },
      include: { employee: { select: { name: true } }, project: { select: { name: true } }, forecastSource: { select: { name: true } } },
      orderBy: { id: "asc" },
    }),
    db.importException.findMany({ where: { importBatchId: batch.id }, orderBy: { rowNumber: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={batch.sourceFileName}
        description={`Uploaded ${new Date(batch.refreshTimestamp).toLocaleString("en-GB")} — ${batch.rowCount} rows, ${batch.rowCount - batch.exceptionCount} loaded, ${batch.exceptionCount} exceptions.`}
      />

      {exceptions.length > 0 ? (
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Exceptions</h2>
          <p className="mb-4 text-xs text-slate-500">
            OUT_ImportExceptions (§8) — these rows were not loaded. Fix the underlying master data (or the source
            file) and re-upload; re-importing does not affect rows already loaded successfully.
          </p>
          <DataTable head={["Row", "Reason", "Raw data"]}>
            {exceptions.map((e) => (
              <Row key={e.id}>
                <Cell align="right">{e.rowNumber}</Cell>
                <Cell>
                  <span className="text-red-700">{e.reason}</span>
                </Cell>
                <Cell>
                  <code className="text-xs text-slate-500">{e.rawData}</code>
                </Cell>
              </Row>
            ))}
          </DataTable>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Loaded actuals</h2>
        <p className="mb-4 text-xs text-slate-500">fact_ActualAllocation rows created by this batch.</p>
        <DataTable head={["Week", "Employee", "Project", "Source", "Hours"]}>
          {loadedRows.map((r) => (
            <Row key={r.id}>
              <Cell>
                <span className="font-mono text-xs text-slate-500">{r.dateKey}</span>
              </Cell>
              <Cell>{r.employee.name}</Cell>
              <Cell>{r.project?.name ?? "—"}</Cell>
              <Cell>{r.forecastSource.name}</Cell>
              <Cell align="right">{r.actualHours.toString()}</Cell>
            </Row>
          ))}
          {loadedRows.length === 0 ? (
            <Row>
              <Cell>
                <span className="text-slate-400">No rows loaded from this batch.</span>
              </Cell>
            </Row>
          ) : null}
        </DataTable>
      </Card>
    </div>
  );
}
