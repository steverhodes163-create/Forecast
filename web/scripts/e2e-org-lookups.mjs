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
  await page.fill('input[name="email"]', "admin@yasa.local");
  await page.fill('input[name="password"]', "ChangeMe123!");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);

  console.log("2. Settings index lists all lookup categories...");
  await page.goto(BASE + "/settings");
  const cardCount = await page.locator("a[href^='/settings/']").count();
  console.log("   -> lookup category cards:", cardCount);
  if (cardCount < 10) throw new Error("Expected at least 10 lookup categories");

  console.log("3. Priority lookup: add, edit, delete...");
  await page.goto(BASE + "/settings/priority");
  await page.fill('input[name="name"]', "E2E Priority");
  await page.fill('input[name="sortOrder"]', "9");
  // The create form is always the last <form> on the page (row delete forms render first).
  // Note: this form redirects back to the SAME url it's on, so waitForURL would resolve
  // instantly against the already-matching current URL — wait for the new row instead.
  await page.locator("form").last().locator('button[type="submit"]').click();
  await page.waitForSelector("text=E2E Priority", { timeout: 10000 });
  let visible = await page.locator("text=E2E Priority").first().isVisible();
  console.log("   -> created row visible:", visible);
  if (!visible) throw new Error("Priority row not created");

  const row = page.locator("tr", { hasText: "E2E Priority" });
  await row.locator("text=Edit").click();
  await page.waitForURL(/\/settings\/priority\/\d+\/edit/);
  await page.fill('input[name="sortOrder"]', "42");
  await page.click('main button[type="submit"]');
  await page.waitForURL(/\/settings\/priority$/);
  const editedText = await page.locator("tr", { hasText: "E2E Priority" }).innerText();
  console.log("   -> row after edit:", editedText.replace(/\n/g, " | "));
  if (!editedText.includes("42")) throw new Error("Priority sortOrder edit did not persist");

  page.once("dialog", (d) => d.accept());
  await page.locator("tr", { hasText: "E2E Priority" }).locator('button:has-text("Delete")').click();
  await page.waitForTimeout(1000);
  const remaining = await page.locator("text=E2E Priority").count();
  console.log("   -> remaining after delete:", remaining);
  if (remaining !== 0) throw new Error("Priority row not deleted");

  console.log("4. Departments page renders with data...");
  await page.goto(BASE + "/departments");
  const deptRows = await page.locator("table tbody tr").count();
  console.log("   -> department rows:", deptRows);
  if (deptRows === 0) throw new Error("No departments rendered");

  console.log("5. Teams page renders with data...");
  await page.goto(BASE + "/teams");
  const teamRows = await page.locator("table tbody tr").count();
  console.log("   -> team rows:", teamRows);
  if (teamRows === 0) throw new Error("No teams rendered");

  console.log("\nBrowser console/page errors captured:", errors.length);
  errors.forEach((e) => console.log("   !", e));

  await browser.close();
  console.log("\nOrg/lookups e2e test PASSED");
}

main().catch((e) => {
  console.error("Org/lookups e2e test FAILED:", e);
  process.exit(1);
});
