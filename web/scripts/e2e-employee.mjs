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

  console.log("2. Go to /employees, click Add Employee...");
  await page.goto(BASE + "/employees");
  await page.click('text=Add Employee');
  await page.waitForURL(/\/employees\/new/);

  console.log("3. Fill employee form...");
  await page.fill('input[name="name"]', "E2E Test Employee");
  await page.selectOption('select[name="departmentId"]', { index: 0 });
  await page.selectOption('select[name="jobRoleId"]', { index: 0 });
  await page.selectOption('select[name="employmentTypeId"]', { index: 0 });
  await page.selectOption('select[name="statusId"]', { index: 0 });
  await page.selectOption('select[name="locationId"]', { index: 0 });
  await page.selectOption('select[name="workingCalendarId"]', { index: 0 });
  await page.fill('input[name="employmentStartDate"]', "2024-01-15");
  await page.fill('input[name="contractHoursPerWeek"]', "37.5");
  await page.fill('input[name="standardWeeklyHours"]', "37.5");
  await page.fill('input[name="fte"]', "1");
  await page.fill('input[name="costRate"]', "45");
  await page.click('main button[type="submit"]');

  await page.waitForURL(/\/employees$/, { timeout: 10000 });
  console.log("   -> redirected to", page.url());

  const rowVisible = await page.locator("text=E2E Test Employee").first().isVisible();
  console.log("   -> new employee row visible:", rowVisible);
  if (!rowVisible) throw new Error("New employee not found in list");

  console.log("4. Edit the new employee...");
  const row = page.locator("tr", { hasText: "E2E Test Employee" });
  await row.locator("text=Edit").click();
  await page.waitForURL(/\/employees\/\d+\/edit/);
  await page.fill('input[name="costRate"]', "50");
  await page.click('main button[type="submit"]');
  await page.waitForURL(/\/employees$/);
  const updatedText = await page.locator("tr", { hasText: "E2E Test Employee" }).innerText();
  console.log("   -> row after edit:", updatedText.replace(/\n/g, " | "));
  if (!updatedText.includes("50")) throw new Error("Cost rate update did not persist");

  console.log("5. Delete the test employee...");
  const rowToDelete = page.locator("tr", { hasText: "E2E Test Employee" });
  page.once("dialog", (d) => d.accept());
  await rowToDelete.locator('button:has-text("Delete")').click();
  await page.waitForTimeout(1000);
  const stillVisible = await page.locator("text=E2E Test Employee").count();
  console.log("   -> rows remaining after delete:", stillVisible);
  if (stillVisible !== 0) throw new Error("Employee was not deleted");

  console.log("\nBrowser console/page errors captured:", errors.length);
  errors.forEach((e) => console.log("   !", e));

  await browser.close();
  console.log("\nEmployee CRUD e2e test PASSED");
}

main().catch((e) => {
  console.error("Employee CRUD e2e test FAILED:", e);
  process.exit(1);
});
