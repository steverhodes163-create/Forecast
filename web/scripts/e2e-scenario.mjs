import { chromium } from "playwright";

const BASE = "http://localhost:3100";

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

  console.log("2. Check scenario switcher shows Baseline by default...");
  const initialValue = await page.locator('select[name="globalScenarioId"]').first().inputValue();
  const initialLabel = await page
    .locator('select[name="globalScenarioId"] option')
    .filter({ hasText: /./ })
    .and(page.locator(`option[value="${initialValue}"]`))
    .textContent();
  console.log("   -> initial scenario:", initialLabel);

  console.log("3. Switch to Budget scenario (rendered as 'Budget (locked)')...");
  await page.selectOption('select[name="globalScenarioId"]', { label: "Budget (locked)" });
  await page.waitForURL(/\/dashboard/);
  await page.waitForTimeout(300);
  const afterSwitchLabel = await page
    .locator('select[name="globalScenarioId"] option:checked')
    .first()
    .textContent();
  console.log("   -> scenario after switch:", afterSwitchLabel);
  if (!afterSwitchLabel?.includes("Budget")) throw new Error(`Expected Budget selected, got: ${afterSwitchLabel}`);

  console.log("4. Navigate to /team-overview -- scenario should persist...");
  await page.goto(BASE + "/team-overview");
  const teamOverviewLabel = await page.locator('select[name="globalScenarioId"] option:checked').first().textContent();
  console.log("   -> scenario on team-overview:", teamOverviewLabel);
  if (!teamOverviewLabel?.includes("Budget")) throw new Error(`Expected Budget to persist across pages, got: ${teamOverviewLabel}`);

  console.log("5. Forecast input form (locked scenarios excluded from entry, so falls back)...");
  await page.goto(BASE + "/forecast");
  const forecastFormScenario = await page.locator('form').last().locator('select[name="scenarioId"] option:checked').first().textContent();
  // Budget is locked, so it's correctly absent from the entry form's own scenario
  // list -- the browser falls back to the first real option (Baseline) instead.
  console.log("   -> forecast form default scenario:", forecastFormScenario, "(expected: Baseline, since Budget is locked)");

  console.log("6. Switch back to Baseline...");
  await page.selectOption('select[name="globalScenarioId"]', { label: "Baseline" });
  await page.waitForTimeout(300);
  const backToBaseline = await page.locator('select[name="globalScenarioId"] option:checked').first().textContent();
  console.log("   -> scenario after switching back:", backToBaseline);
  if (!backToBaseline?.includes("Baseline")) throw new Error(`Expected Baseline selected, got: ${backToBaseline}`);

  console.log("\nBrowser console/page errors captured:", errors.length);
  errors.forEach((e) => console.log("   !", e));
  if (errors.length > 0) throw new Error("Console errors present");

  await browser.close();
  console.log("\nScenario switcher e2e test PASSED");
}

main().catch((e) => {
  console.error("Scenario switcher e2e test FAILED:", e);
  process.exit(1);
});
