// Standalone sanity check for the what-if resolver's pure logic (§7.4) --
// no server or database needed. Run with: npx tsx scripts/check-whatif.mjs
// (plain `node --experimental-strip-types` won't resolve the `@/` alias
// whatif.ts uses for its calendar import, unlike check-scheduling.mjs's
// target which has zero imports).
import { applyProjectAdjustments, effectiveProbabilityPct } from "../src/lib/whatif.ts";
import { dateKeyFor, dateKeyToDate } from "../src/lib/calendar.ts";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : ` -- got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
  if (!ok) failures++;
}

// 1. Cancel drops matching rows, leaves everything else untouched.
{
  const rows = [
    { projectId: 15, dateKey: 20260105, hours: 30 },
    { projectId: 15, dateKey: 20260112, hours: 30 },
    { projectId: 99, dateKey: 20260105, hours: 10 },
  ];
  const adjustments = [{ adjustmentTypeName: "Cancel", projectId: 15, deltaWeeks: null, effectiveDateKey: null }];
  check("Cancel with no effectiveDateKey drops all of the project's rows", applyProjectAdjustments(rows, adjustments), [
    { projectId: 99, dateKey: 20260105, hours: 10 },
  ]);
}

// 2. Cancel gated by effectiveDateKey only drops rows on/after it.
{
  const rows = [
    { projectId: 15, dateKey: 20260105, hours: 30 },
    { projectId: 15, dateKey: 20260202, hours: 30 },
  ];
  const adjustments = [{ adjustmentTypeName: "Cancel", projectId: 15, deltaWeeks: null, effectiveDateKey: 20260201 }];
  check("Cancel gated by effectiveDateKey keeps earlier rows", applyProjectAdjustments(rows, adjustments), [
    { projectId: 15, dateKey: 20260105, hours: 30 },
  ]);
}

// 3. Delay shifts dateKey forward by deltaWeeks*7 days, leaves hours/projectId alone.
{
  const rows = [{ projectId: 15, dateKey: 20260105, hours: 30 }];
  const adjustments = [{ adjustmentTypeName: "Delay", projectId: 15, deltaWeeks: 8, effectiveDateKey: null }];
  const expectedDateKey = dateKeyFor(new Date(Date.UTC(2026, 0, 5) + 8 * 7 * 24 * 60 * 60 * 1000));
  check("Delay shifts dateKey forward by deltaWeeks*7 days", applyProjectAdjustments(rows, adjustments), [
    { projectId: 15, dateKey: expectedDateKey, hours: 30 },
  ]);
}

// 4. Win has no effect on applyProjectAdjustments (only on probability).
{
  const rows = [{ projectId: 15, dateKey: 20260105, hours: 30 }];
  const adjustments = [{ adjustmentTypeName: "Win", projectId: 15, deltaWeeks: null, effectiveDateKey: null }];
  check("Win leaves allocation rows untouched", applyProjectAdjustments(rows, adjustments), rows);
}

// 5. effectiveProbabilityPct forces 100% on a Win match, leaves others alone.
{
  const adjustments = [{ adjustmentTypeName: "Win", projectId: 15 }];
  check("Win forces probability to 100 for the matching project", effectiveProbabilityPct(50, 15, adjustments), 100);
  check("Win doesn't affect a different project", effectiveProbabilityPct(50, 99, adjustments), 50);
  check("No projectId (team-mode row) passes through unchanged", effectiveProbabilityPct(50, null, adjustments), 50);
}

// 6. dateKeyFor / dateKeyToDate roundtrip is exact.
{
  const original = 20260317;
  const roundtripped = dateKeyFor(dateKeyToDate(original));
  check("dateKeyToDate -> dateKeyFor roundtrips exactly", roundtripped, original);
}

console.log(failures === 0 ? "\nAll what-if resolver checks PASSED" : `\n${failures} check(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
