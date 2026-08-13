import { chromium } from "playwright";

const BASE = "http://localhost:3100";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

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
  await page.fill('input[name="email"]', "admin@yasa.local");
  await page.fill('input[name="password"]', "ChangeMe123!");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);

  console.log("2. Open a project's Gantt page...");
  await page.goto(BASE + "/projects");
  await page.locator('a:has-text("Gantt")').first().click();
  await page.waitForURL(/\/projects\/\d+\/gantt/);
  const projectUrl = page.url();
  console.log("   -> on", projectUrl);

  async function addTask(name, duration, dependsOnName, manualStart) {
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="durationDays"]', String(duration));
    if (manualStart) await page.fill('input[name="manualStartDate"]', manualStart);
    if (dependsOnName) {
      await page.locator(`label:has-text("${dependsOnName}") input[type="checkbox"]`).check();
    }
    await page.locator('button[type="submit"]').last().click();
    await page.waitForFunction((n) => document.querySelector("tbody")?.innerText.includes(n), name, { timeout: 10000 });
  }

  console.log("3. Add a 3-task chain A(5d, starts today) -> B(3d) -> C(2d)...");
  await addTask("E2E Task A", 5, null, todayIso());
  await addTask("E2E Task B", 3, "E2E Task A");
  await addTask("E2E Task C", 2, "E2E Task B");
  const criticalCount = await page.locator('span:has-text("Critical")').count();
  console.log("   -> critical badges:", criticalCount);
  if (criticalCount !== 3) throw new Error(`Expected all 3 tasks critical in a pure chain, got ${criticalCount}`);

  console.log("4. Assign an employee to Task A, confirm it shows in the task table...");
  await page.locator('tr:has-text("E2E Task A") a:has-text("Edit")').click();
  await page.waitForURL(/tasks\/\d+\/edit/);
  await page.locator('fieldset:has-text("Assigned to") input[type="checkbox"]').first().check();
  const assigneeRow = await page.locator('fieldset:has-text("Assigned to") div').first().innerText();
  const assigneeName = assigneeRow.trim().split("\n")[0];
  await page.locator('button[type="submit"]').last().click();
  await page.waitForURL(/\/gantt$/);
  const taskARow = await page.locator('tr:has-text("E2E Task A")').innerText();
  console.log("   -> Task A row:", taskARow.replace(/\n/g, " | "));
  if (!taskARow.includes(assigneeName)) throw new Error(`Expected assignee "${assigneeName}" to show in Task A's row`);

  console.log("5. Check the forecast grid: expand the assignee, confirm Task A hours appear...");
  await page.goto(projectUrl.replace("/gantt", "/forecast"));
  await page.waitForSelector("table");
  const toggle = page.locator('button[title="Show tasks driving these hours"]').first();
  if ((await toggle.count()) === 0) throw new Error("No employee task-expand toggle found on the forecast grid -- task hours never reached the grid");
  await toggle.click();
  await page.waitForTimeout(300);
  const gridText = await page.locator("body").innerText();
  if (!gridText.includes("E2E Task A")) throw new Error("Forecast grid did not show 'E2E Task A' under the assigned employee after expanding");
  console.log("   -> task sub-row visible under the assigned employee");

  console.log("6. Confirm a cycle-creating dependency is rejected...");
  await page.goto(projectUrl);
  await page.locator('tr:has-text("E2E Task A") a:has-text("Edit")').click();
  await page.waitForURL(/tasks\/\d+\/edit/);
  await page.locator('label:has-text("E2E Task C") input[type="checkbox"]').check();
  await page.locator('button[type="submit"]').last().click();
  await page.waitForTimeout(800);
  const stillOnEdit = /tasks\/\d+\/edit/.test(page.url());
  const alertText = await page.locator('[role="alert"]').allInnerTexts();
  console.log("   -> still on edit page:", stillOnEdit, " | alert:", alertText.join(" "));
  if (!stillOnEdit || !alertText.some((t) => t.toLowerCase().includes("circular"))) {
    throw new Error("Expected a circular-dependency error and to stay on the edit page");
  }

  console.log("7. Clean up: delete all three marker tasks...");
  await page.goto(projectUrl);
  for (const name of ["E2E Task A", "E2E Task B", "E2E Task C"]) {
    const row = page.locator(`tr:has-text("${name}")`);
    if ((await row.count()) > 0) {
      await row.locator('button:has-text("Delete")').click();
      await page.waitForTimeout(600);
    }
  }
  const remaining = await page.locator('tbody:has-text("E2E Task")').count();
  console.log("   -> marker rows remaining:", remaining);
  if (remaining !== 0) throw new Error("Marker tasks were not fully cleaned up");

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
