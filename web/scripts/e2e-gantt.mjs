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

  async function dataRowByName(name) {
    const rows = page.locator("tbody tr");
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      if ((await row.locator("td").count()) < 9) continue;
      const val = await row.locator("input").first().inputValue().catch(() => "");
      if (val === name) return row;
    }
    return null;
  }

  async function addTask(name, duration, dependsOnTaskId) {
    const newRow = page.locator('input[placeholder="Type a task name to add a row…"]');
    await newRow.fill(name);
    await newRow.blur();
    await page.waitForFunction(
      (n) => {
        for (const row of document.querySelectorAll("tbody tr")) {
          if (row.querySelectorAll("td").length < 9) continue;
          const input = row.querySelector("input");
          if (input && input.value === n) return true;
        }
        return false;
      },
      name,
      { timeout: 10000 }
    );
    const row = await dataRowByName(name);
    if (duration) {
      const durationInput = row.locator("input").nth(1);
      await durationInput.fill(`${duration}d`);
      await durationInput.blur();
      await page.waitForTimeout(1200);
    }
    if (dependsOnTaskId) {
      const predInput = row.locator('input[placeholder="e.g. 1,3+2d"]');
      await predInput.fill(String(dependsOnTaskId));
      await predInput.blur();
      await page.waitForTimeout(1200);
      const err = await predInput.getAttribute("title");
      if (err) throw new Error(`Unexpected predecessor error adding "${name}": ${err}`);
    }
    return (await row.locator("td").first().innerText()).trim();
  }

  console.log("1. Login...");
  await page.goto(BASE + "/login");
  await page.fill('input[name="email"]', "steve@yasa.local");
  await page.fill('input[name="password"]', "steve");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);

  console.log("2. Open a project's Gantt page...");
  await page.goto(BASE + "/projects");
  await page.locator('a:has-text("Gantt")').first().click();
  await page.waitForURL(/\/projects\/\d+\/gantt/);
  const projectUrl = page.url();
  console.log("   -> on", projectUrl);

  console.log("3. Add a 3-task chain A(5d) -> B(3d) -> C(2d), confirm critical path...");
  const idA = await addTask("Gantt E2E Task A", 5, null);
  const idB = await addTask("Gantt E2E Task B", 3, idA);
  await addTask("Gantt E2E Task C", 2, idB);
  const criticalCount = await page.locator('span:has-text("Critical")').count();
  console.log("   -> critical badges:", criticalCount);
  if (criticalCount < 3) throw new Error(`Expected all 3 tasks critical in a pure chain, got ${criticalCount}`);

  console.log("4. Chart renders dependency connectors between the bars...");
  const svgPaths = await page.locator("svg path[stroke]").count();
  console.log("   -> dependency connector paths in chart:", svgPaths);
  if (svgPaths < 2) throw new Error("Expected at least 2 dependency connectors drawn on the chart");

  console.log("5. A cycle-creating dependency is rejected...");
  const rowA = await dataRowByName("Gantt E2E Task A");
  const predInputA = rowA.locator('input[placeholder="e.g. 1,3+2d"]');
  const idC = (await (await dataRowByName("Gantt E2E Task C")).locator("td").first().innerText()).trim();
  await predInputA.fill(idC);
  await predInputA.blur();
  await page.waitForTimeout(800);
  const cycleError = await predInputA.getAttribute("title");
  console.log("   -> error:", cycleError);
  if (!cycleError || !cycleError.toLowerCase().includes("circular")) {
    throw new Error("Expected a circular-dependency error");
  }
  // Restore A's original (empty) predecessors -- the rejected input stays in the box but was never saved.
  await predInputA.fill("");
  await predInputA.blur();
  await page.waitForTimeout(500);

  console.log("6. Recalculate-for-current-scenario button works without error...");
  await page.click('button:has-text("Recalculate for current scenario")');
  await page.waitForURL(/\/gantt$/);

  console.log("7. Clean up: delete all three marker tasks...");
  for (const name of ["Gantt E2E Task A", "Gantt E2E Task B", "Gantt E2E Task C"]) {
    const row = await dataRowByName(name);
    if (row) {
      await row.locator('button:has-text("✕")').click();
      await page.waitForTimeout(600);
    }
  }
  const remaining = await dataRowByName("Gantt E2E Task A");
  console.log("   -> marker rows remaining:", !!remaining);
  if (remaining) throw new Error("Marker tasks were not fully cleaned up");

  console.log("\nBrowser console/page errors captured:", errors.length);
  errors.forEach((e) => console.log("   !", e));
  if (errors.length > 0) throw new Error("Console errors present");

  await browser.close();
  console.log("\nGantt e2e test PASSED");
}

main().catch((e) => {
  console.error("Gantt e2e test FAILED:", e);
  process.exit(1);
});
