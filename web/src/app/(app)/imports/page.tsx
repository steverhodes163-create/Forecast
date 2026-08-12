import Link from "next/link";
import { db } from "@/lib/db";
import { uploadTimesheetAction } from "@/app/actions/imports";
import { Card, DataTable, PageHeader, Row, Cell } from "@/components/page";
import { TimesheetUploadForm } from "@/components/timesheet-upload-form";

export default async function ImportsPage() {
  const batches = await db.importBatch.findMany({
    orderBy: { refreshTimestamp: "desc" },
    take: 20,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Actuals Import"
        description="§8 Import Strategy — Landing → Staging → Conforming → Load. Drop a timesheet export, click import; unmatched rows never get silently dropped, they land in the exceptions queue."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <DataTable head={["Uploaded", "File", "Rows", "Loaded", "Exceptions", ""]}>
          {batches.map((b) => (
            <Row key={b.id}>
              <Cell>{new Date(b.refreshTimestamp).toLocaleString("en-GB")}</Cell>
              <Cell>{b.sourceFileName}</Cell>
              <Cell align="right">{b.rowCount}</Cell>
              <Cell align="right">{b.rowCount - b.exceptionCount}</Cell>
              <Cell align="right">
                {b.exceptionCount > 0 ? (
                  <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                    {b.exceptionCount}
                  </span>
                ) : (
                  "0"
                )}
              </Cell>
              <Cell align="right">
                <Link href={`/imports/${b.id}`} className="text-xs font-medium text-slate-500 hover:text-slate-900">
                  View
                </Link>
              </Cell>
            </Row>
          ))}
          {batches.length === 0 ? (
            <Row>
              <Cell>
                <span className="text-slate-400">No imports yet.</span>
              </Cell>
            </Row>
          ) : null}
        </DataTable>

        <Card>
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Import a timesheet export</h2>
          <p className="mb-4 text-xs text-slate-500">
            Columns: <code className="rounded bg-slate-100 px-1 py-0.5">EmployeeNumber</code>,{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">ProjectCode</code> (optional),{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">ForecastSource</code> (optional),{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">WeekCommencing</code>,{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">Hours</code>.{" "}
            <a href="/imports/template.csv" className="font-medium text-slate-700 underline">
              Download a template
            </a>
            .
          </p>
          <TimesheetUploadForm action={uploadTimesheetAction} />
        </Card>
      </div>
    </div>
  );
}
