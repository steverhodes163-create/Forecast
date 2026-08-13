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

  console.log("2. Add capacity for a future month...");
  await page.goto(BASE + "/capacity");
  await page.selectOption('select[name="teamId"]', { index: 0 });
  await page.selectOption('select[name="scenarioId"]', { index: 0 });
  await page.fill('input[name="month"]', "2030-06");
  await page.fill('input[name="standardHours"]', "320");
  await page.fill('input[name="trainingHours"]', "20");
  await page.fill('input[name="holidayHours"]', "15");
  await page.locator("form").last().locator('button[type="submit"]').click();
  await page.waitForTimeout(1500);
  await page.reload();

  let row = await page.locator("tr", { hasText: "20300601" }).innerText();
  console.log("   -> row:", row.replace(/\n/g, " | "));
  // Available Hours = 320 - (20 + 0 + 15 + 0 + 0 + 0) = 285
  if (!row.includes("285")) throw new Error(`Expected Available Hours 285, got: ${row}`);

  console.log("3. Re-submit same team/scenario/month -> should UPDATE, not duplicate...");
  await page.goto(BASE + "/capacity");
  await page.selectOption('select[name="teamId"]', { index: 0 });
  await page.selectOption('select[name="scenarioId"]', { index: 0 });
  await page.fill('input[name="month"]', "2030-06");
  await page.fill('input[name="standardHours"]', "320");
  await page.fill('input[name="trainingHours"]', "40");
  await page.locator("form").last().locator('button[type="submit"]').click();
  await page.waitForTimeout(1500);
  await page.reload();
  const matchingRows = await page.locator("tr", { hasText: "20300601" }).count();
  console.log("   -> rows for 2030-06 after re-submit:", matchingRows);
  if (matchingRows !== 1) throw new Error(`Expected exactly 1 row (upsert), found ${matchingRows}`);
  row = await page.locator("tr", { hasText: "20300601" }).innerText();
  console.log("   -> updated row:", row.replace(/\n/g, " | "));
  // The form isn't pre-populated (it's an add/update form, not an edit form), so
  // re-submitting without re-entering holidayHours correctly resets it to 0:
  // Available Hours = 320 - (40 + 0) = 280.
  if (!row.includes("280")) throw new Error(`Expected updated Available Hours 280, got: ${row}`);

  console.log("4. Delete the test capacity row...");
  page.once("dialog", (d) => d.accept());
  await page.locator("tr", { hasText: "20300601" }).locator('button:has-text("Delete")').click();
  await page.waitForTimeout(1500);
  await page.reload();
  const remaining = await page.locator("tr", { hasText: "20300601" }).count();
  console.log("   -> remaining after delete:", remaining);
  if (remaining !== 0) throw new Error("Capacity row was not deleted");

  console.log("\nBrowser console/page errors captured:", errors.length);
  errors.forEach((e) => console.log("   !", e));

  await browser.close();
  console.log("\nCapacity e2e test PASSED");
}

main().catch((e) => {
  console.error("Capacity e2e test FAILED:", e);
  process.exit(1);
});
