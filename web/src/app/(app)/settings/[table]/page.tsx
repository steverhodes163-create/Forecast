import Link from "next/link";
import { notFound } from "next/navigation";
import { getLookupDef, listLookupRows } from "@/lib/lookups";
import { createLookupAction, deleteLookupAction } from "@/app/actions/lookups";
import { Card, DataTable, PageHeader, Row, Cell } from "@/components/page";
import { LookupForm } from "@/components/lookup-form";
import { DeleteButton } from "@/components/form";

export default async function LookupTablePage({ params, searchParams }: PageProps<"/settings/[table]">) {
  const { table } = await params;
  const { error } = await searchParams;
  const def = getLookupDef(table);
  if (!def) notFound();

  const rows = await listLookupRows(table);
  const action = createLookupAction.bind(null, table);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={def.label} description={def.description} />
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {String(error)}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <DataTable head={[...def.fields.map((f) => f.label), ""]}>
          {rows.map((row: Record<string, unknown>) => (
            <Row key={String(row.id)}>
              {def.fields.map((f) => (
                <Cell key={f.name}>
                  {f.type === "boolean" ? (row[f.name] ? "Yes" : "No") : String(row[f.name] ?? "—")}
                </Cell>
              ))}
              <Cell align="right">
                <div className="flex justify-end gap-2">
                  <Link href={`/settings/${table}/${row.id}/edit`} className="text-xs font-medium text-slate-500 hover:text-slate-900">
                    Edit
                  </Link>
                  <form action={deleteLookupAction}>
                    <input type="hidden" name="key" value={table} />
                    <input type="hidden" name="id" value={String(row.id)} />
                    <DeleteButton />
                  </form>
                </div>
              </Cell>
            </Row>
          ))}
          {rows.length === 0 ? (
            <Row>
              <Cell>
                <span className="text-slate-400">No rows yet.</span>
              </Cell>
            </Row>
          ) : null}
        </DataTable>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Add new</h2>
          <LookupForm def={def} action={action} submitLabel="Add" />
        </Card>
      </div>
    </div>
  );
}
