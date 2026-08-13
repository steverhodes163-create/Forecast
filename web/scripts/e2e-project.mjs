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

  console.log("2. Go to /projects, click Add Project...");
  await page.goto(BASE + "/projects");
  await page.click("text=Add Project");
  await page.waitForURL(/\/projects\/new/);

  console.log("3. Fill project form...");
  await page.fill('input[name="name"]', "E2E Test Project");
  await page.selectOption('select[name="customerId"]', { index: 0 });
  await page.selectOption('select[name="businessUnitId"]', { index: 0 });
  await page.selectOption('select[name="projectStatusId"]', { index: 0 });
  await page.selectOption('select[name="priorityId"]', { index: 0 });
  await page.selectOption('select[name="ragStatus"]', "Amber");
  await page.check('input[name="strategicImportance"]');
  await page.fill('input[name="revenueForecast"]', "500000");
  await page.click('main button[type="submit"]');

  await page.waitForURL(/\/projects$/, { timeout: 10000 });
  console.log("   -> redirected to", page.url());

  const rowVisible = await page.locator("text=E2E Test Project").first().isVisible();
  console.log("   -> new project row visible:", rowVisible);
  if (!rowVisible) throw new Error("New project not found in list");

  console.log("4. Edit the new project...");
  const row = page.locator("tr", { hasText: "E2E Test Project" });
  await row.locator("text=Edit").click();
  await page.waitForURL(/\/projects\/\d+\/edit/);
  await page.fill('input[name="revenueForecast"]', "750000");
  await page.click('main button[type="submit"]');
  await page.waitForURL(/\/projects$/);
  const updatedText = await page.locator("tr", { hasText: "E2E Test Project" }).innerText();
  console.log("   -> row after edit:", updatedText.replace(/\n/g, " | "));
  if (!updatedText.includes("750,000")) throw new Error("Revenue forecast update did not persist");

  console.log("5. Delete the test project...");
  const rowToDelete = page.locator("tr", { hasText: "E2E Test Project" });
  page.once("dialog", (d) => d.accept());
  await rowToDelete.locator('button:has-text("Delete")').click();
  await page.waitForTimeout(1000);
  const stillVisible = await page.locator("text=E2E Test Project").count();
  console.log("   -> rows remaining after delete:", stillVisible);
  if (stillVisible !== 0) throw new Error("Project was not deleted");

  console.log("\nBrowser console/page errors captured:", errors.length);
  errors.forEach((e) => console.log("   !", e));

  await browser.close();
  console.log("\nProject CRUD e2e test PASSED");
}

main().catch((e) => {
  console.error("Project CRUD e2e test FAILED:", e);
  process.exit(1);
});
