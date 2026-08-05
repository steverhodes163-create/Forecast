import Link from "next/link";
import { LOOKUPS } from "@/lib/lookups";
import { PageHeader } from "@/components/page";

export default function SettingsIndexPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuration"
        description="CFG_ / MST_ lookup tables (§4, §5.1) — the values every dropdown elsewhere in the app is driven from. Nothing here is hard-coded into reports."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LOOKUPS.map((l) => (
          <Link
            key={l.key}
            href={`/settings/${l.key}`}
            className="rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <p className="text-sm font-semibold text-slate-900">{l.label}</p>
            <p className="mt-1 text-xs text-slate-500">{l.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
