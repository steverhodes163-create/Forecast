import { notFound } from "next/navigation";
import { getLookupDef, getLookupRow } from "@/lib/lookups";
import { updateLookupAction } from "@/app/actions/lookups";
import { Card, PageHeader } from "@/components/page";
import { LookupForm } from "@/components/lookup-form";

export default async function EditLookupRowPage({ params }: PageProps<"/settings/[table]/[id]/edit">) {
  const { table, id } = await params;
  const def = getLookupDef(table);
  if (!def) notFound();

  const row = await getLookupRow(table, Number(id));
  if (!row) notFound();

  const action = updateLookupAction.bind(null, table, Number(id));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Edit ${def.label.replace(/s$/, "")}`} />
      <Card>
        <LookupForm def={def} action={action} defaults={row as Record<string, unknown>} submitLabel="Save changes" />
      </Card>
    </div>
  );
}
