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

  console.log("1. Visiting / while unauthenticated...");
  await page.goto(BASE + "/");
  await page.waitForURL(/\/login/);
  console.log("   -> redirected to", page.url());

  console.log("2. Logging in...");
  await page.fill('input[name="email"]', "admin@yasa.local");
  await page.fill('input[name="password"]', "ChangeMe123!");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
  console.log("   -> redirected to", page.url());

  console.log("3. Checking dashboard KPIs render real data...");
  const kpiText = await page.locator("text=Active employees").first().isVisible();
  console.log("   -> KPI card visible:", kpiText);
  const employeeCountCard = await page.locator("text=Active employees").locator("..").innerText();
  console.log("   -> ", employeeCountCard.replace(/\n/g, " "));

  console.log("4. Visiting /employees...");
  await page.goto(BASE + "/employees");
  const rows = await page.locator("table tbody tr").count();
  console.log("   -> employee rows rendered:", rows);

  console.log("5. Visiting /projects...");
  await page.goto(BASE + "/projects");
  const projRows = await page.locator("table tbody tr").count();
  console.log("   -> project rows rendered:", projRows);

  console.log("6. Visiting /admin/users as ADMIN...");
  await page.goto(BASE + "/admin/users");
  await page.waitForURL(/\/admin\/users/);
  const userRows = await page.locator("table tbody tr").count();
  console.log("   -> admin sees user rows:", userRows);

  console.log("7. Signing out...");
  await page.click('button:has-text("Sign out")');
  await page.waitForURL(/\/login/);
  console.log("   -> redirected to", page.url());

  console.log("8. Confirming /dashboard is blocked post-logout...");
  await page.goto(BASE + "/dashboard");
  await page.waitForURL(/\/login/);
  console.log("   -> redirected to", page.url());

  console.log("\nBrowser console/page errors captured:", errors.length);
  errors.forEach((e) => console.log("   !", e));

  await browser.close();
  console.log("\nE2E smoke test PASSED");
}

main().catch((e) => {
  console.error("E2E smoke test FAILED:", e);
  process.exit(1);
});
