import { chromium } from "playwright";

const BASE = "http://localhost:3100";

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
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
  await page.waitForTimeout(500);

  console.log("2. Checking chart elements rendered...");
  const svgCount = await page.locator("svg.recharts-surface").count();
  console.log("   -> recharts SVG elements on page:", svgCount);
  if (svgCount < 2) throw new Error("Expected at least 2 recharts SVGs (Manhattan + Waterfall)");

  const heatmapCells = await page.locator("table td div[title]").count();
  console.log("   -> heatmap cells rendered:", heatmapCells);
  if (heatmapCells === 0) throw new Error("Heatmap cells not rendered");

  await page.screenshot({ path: "/home/user/Forecast/web/.screenshots/dashboard-v2.png", fullPage: true });
  console.log("   -> screenshot saved");

  console.log("\nBrowser console/page errors captured:", errors.length);
  errors.forEach((e) => console.log("   !", e));
  if (errors.length > 0) throw new Error("Console errors present");

  await browser.close();
  console.log("\nDashboard e2e test PASSED");
}

main().catch((e) => {
  console.error("Dashboard e2e test FAILED:", e);
  process.exit(1);
});
