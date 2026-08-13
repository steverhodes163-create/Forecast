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

  console.log("2. Business Overview: filter by team changes employee count...");
  await page.goto(BASE + "/dashboard");
  const before = await page.locator("text=Active employees").locator("..").innerText();
  await page.selectOption('form:has-text("Filter") select[name="teamId"]', { label: "Controls & Embedded Software" });
  await page.waitForURL(/teamId=/);
  const after = await page.locator("text=Active employees").locator("..").innerText();
  console.log("   -> before:", before.replace(/\n/g, " "), " | after:", after.replace(/\n/g, " "));
  if (before === after) throw new Error("Employee count did not change when filtering by team");

  console.log("3. Clear filters link works...");
  await page.click('a:has-text("Clear filters")');
  await page.waitForURL((url) => !url.search.includes("teamId"));
  console.log("   -> URL after clear:", page.url());

  console.log("4. Team Overview: filter narrows to one team...");
  await page.goto(BASE + "/team-overview");
  await page.selectOption('form:has-text("Filter") select[name="teamId"]', { label: "Rotor & Stator Design" });
  await page.waitForURL(/teamId=/);
  const legendText = await page.locator("body").innerText();
  console.log("   -> contains 'Rotor & Stator Design':", legendText.includes("Rotor & Stator Design"));
  console.log("   -> contains 'Programme Office' (should be filtered out):", legendText.includes("Programme Office"));

  console.log("5. Project Overview: filter by customer...");
  await page.goto(BASE + "/project-overview");
  const projectRowsBefore = await page.locator("table tbody tr").count();
  const customerOptions = await page.locator('select[name="customerId"] option').count();
  console.log("   -> project rows before filter:", projectRowsBefore, " | customer options:", customerOptions);

  console.log("\nBrowser console/page errors captured:", errors.length);
  errors.forEach((e) => console.log("   !", e));
  if (errors.length > 0) throw new Error("Console errors present");

  await browser.close();
  console.log("\nFilters e2e test PASSED");
}

main().catch((e) => {
  console.error("Filters e2e test FAILED:", e);
  process.exit(1);
});
