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

  console.log("2. Go to /forecast...");
  await page.goto(BASE + "/forecast");
  const before = await page.locator("table tbody tr").count();
  console.log("   -> existing allocation rows:", before);

  // The list is capped at 50 rows, and seed data already fills it, so a row-count
  // check can't detect a new insert (the oldest row just drops off). Instead use a
  // distinctive hours value per mode and check the newest (first) row shows it.
  async function addAllocation(mode, targetSelectName, hoursMarker) {
    console.log(`3. Add a ${mode}-mode allocation (marker hours=${hoursMarker})...`);
    await page.goto(BASE + "/forecast");
    await page.locator(`input[name="mode"][value="${mode}"]`).click();
    await page.selectOption(`select[name="${targetSelectName}"]`, { index: 0 });
    await page.selectOption('select[name="scenarioId"]', { index: 0 });
    await page.selectOption('select[name="forecastSourceId"]', { index: 0 });
    await page.selectOption('select[name="resourceTypeId"]', { index: 0 });
    await page.selectOption('select[name="dateKey"]', { index: 0 });
    await page.fill('input[name="hours"]', String(hoursMarker));
    await page.locator("form").last().locator('button[type="submit"]').click();
    await page.waitForFunction(
      (marker) => {
        const firstRow = document.querySelector("table tbody tr");
        return firstRow && firstRow.textContent.includes(marker);
      },
      String(hoursMarker),
      { timeout: 10000 }
    );
    const firstRowText = await page.locator("table tbody tr").first().innerText();
    console.log("   -> newest row:", firstRowText.replace(/\n/g, " | "));
    if (!firstRowText.includes(String(hoursMarker))) throw new Error(`${mode}-mode allocation was not created`);
  }

  await addAllocation("team", "teamId", "17.5");
  await addAllocation("employee", "employeeId", "18.5");
  await addAllocation("skill", "skillId", "19.5");

  // Also capped at 50, so delete-by-count doesn't work here either — delete the
  // specific marker row we just created and confirm its marker text is gone.
  console.log("4. Delete the skill-mode marker allocation (19.5)...");
  await page.goto(BASE + "/forecast");
  const markerRow = page.locator("tr", { hasText: "19.5" }).first();
  if ((await markerRow.count()) === 0) throw new Error("Marker row (19.5) not found before delete");
  await markerRow.locator('button:has-text("Delete")').click();
  await page.waitForTimeout(1500);
  await page.reload();
  const stillPresent = await page.locator("text=19.5").count();
  console.log(`   -> "19.5" occurrences after delete: ${stillPresent}`);
  if (stillPresent !== 0) throw new Error("Allocation was not deleted");

  console.log("\nBrowser console/page errors captured:", errors.length);
  errors.forEach((e) => console.log("   !", e));

  await browser.close();
  console.log("\nForecast allocation e2e test PASSED");
}

main().catch((e) => {
  console.error("Forecast allocation e2e test FAILED:", e);
  process.exit(1);
});
