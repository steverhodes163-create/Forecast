import { pixelDeltaToCalendarDays, clampResizeDays } from "../src/lib/gantt-drag.ts";

const PX_PER_DAY = 26;

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : ` -- got ${actual}, expected ${expected}`}`);
  if (!ok) failures++;
}

check("zero delta -> 0 days", pixelDeltaToCalendarDays(0, PX_PER_DAY), 0);
check("positive delta rounds to nearest day", pixelDeltaToCalendarDays(2 * PX_PER_DAY, PX_PER_DAY), 2);
check("negative delta rounds to nearest day", pixelDeltaToCalendarDays(-3 * PX_PER_DAY, PX_PER_DAY), -3);
check("sub-day delta rounds down", pixelDeltaToCalendarDays(0.4 * PX_PER_DAY, PX_PER_DAY), 0);
check("sub-day delta rounds up", pixelDeltaToCalendarDays(0.6 * PX_PER_DAY, PX_PER_DAY), 1);

check("resize with no delta keeps duration", clampResizeDays(5, 0), 5);
check("resize grows duration", clampResizeDays(5, 2), 7);
check("resize shrinks duration within floor", clampResizeDays(5, -3), 2);
check("resize floors at 1 day, not below", clampResizeDays(5, -4), 1);
check("resize floors at 1 day even with a huge negative delta", clampResizeDays(5, -100), 1);
check("resize exactly at the floor boundary", clampResizeDays(5, -4), 1);

console.log(failures === 0 ? "\nAll Gantt drag helper checks PASSED" : `\n${failures} check(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
