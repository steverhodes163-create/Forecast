import { TIMESHEET_CSV_TEMPLATE } from "@/lib/imports";

export async function GET() {
  return new Response(TIMESHEET_CSV_TEMPLATE, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="timesheet-template.csv"',
    },
  });
}
