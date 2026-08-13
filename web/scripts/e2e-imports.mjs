import { chromium } from "playwright";
import { writeFileSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const BASE = "http://localhost:3100";

// One row matches a real seeded employee/project; one row has a bad
// EmployeeNumber (exception); one row has a bad Hours value (exception).
const CSV = `EmployeeNumber,ProjectCode,ForecastSource,WeekCommencing,Hours
EMP-1002,PRJ-450,Project,2026-08-03,32.5
EMP-9999,PRJ-450,Project,2026-08-03,10
EMP-1003,PRJ-450,Project,2026-08-03,not-a-number
`;

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  console.log("1. Login...");
  await page.goto(BASE + "/login");
  await page.fill('input[name="email"]', "steve@yasa.local");
  await page.fill('input[name="password"]', "steve");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);

  console.log("2. Download template link is present on /imports...");
  await page.goto(BASE + "/imports");
  const templateLink = await page.locator('a[href="/imports/template.csv"]').count();
  console.log("   -> template link present:", templateLink > 0);
  if (templateLink === 0) throw new Error("Template download link missing");

  console.log("3. Upload a CSV with 1 valid row and 2 bad rows...");
  const dir = mkdtempSync(join(tmpdir(), "yasa-import-"));
  const filePath = join(dir, "timesheet.csv");
  writeFileSync(filePath, CSV);

  await page.setInputFiles('input[name="file"]', filePath);
  await page.locator("form").last().locator('button[type="submit"]').click();
  await page.waitForURL(/\/imports\/\d+/, { timeout: 10000 });
  console.log("   -> redirected to", page.url());

  const bodyText = await page.locator("body").innerText();
  console.log("4. Checking batch detail page content...");
  if (!bodyText.includes("3 rows")) throw new Error(`Expected "3 rows" in summary, got: ${bodyText.slice(0, 300)}`);
  if (!bodyText.includes("1 loaded")) throw new Error(`Expected "1 loaded" in summary, got: ${bodyText.slice(0, 300)}`);
  if (!bodyText.includes("2 exceptions")) throw new Error(`Expected "2 exceptions" in summary, got: ${bodyText.slice(0, 300)}`);
  console.log("   -> summary text confirms 3 rows / 1 loaded / 2 exceptions");

  const exceptionRows = await page.locator("tr", { hasText: "Unknown EmployeeNumber" }).count();
  const badHoursRows = await page.locator("tr", { hasText: "Invalid Hours" }).count();
  console.log("   -> 'Unknown EmployeeNumber' exception row present:", exceptionRows > 0);
  console.log("   -> 'Invalid Hours' exception row present:", badHoursRows > 0);
  if (exceptionRows === 0 || badHoursRows === 0) throw new Error("Expected exceptions not found in exceptions table");

  const loadedRow = await page.locator("tr", { hasText: "32.5" }).count();
  console.log("   -> loaded actual (32.5 hrs) present:", loadedRow > 0);
  if (loadedRow === 0) throw new Error("Loaded actual allocation row not found");

  console.log("5. Batch appears in /imports history...");
  await page.goto(BASE + "/imports");
  const historyRow = await page.locator("tr", { hasText: "timesheet.csv" }).count();
  console.log("   -> history row present:", historyRow > 0);
  if (historyRow === 0) throw new Error("Import batch not listed in history");

  console.log("\nBrowser console/page errors captured:", errors.length);
  errors.forEach((e) => console.log("   !", e));
  if (errors.length > 0) throw new Error("Console errors present");

  await browser.close();
  console.log("\nImports e2e test PASSED");
}

main().catch((e) => {
  console.error("Imports e2e test FAILED:", e);
  process.exit(1);
});
