import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3100";
const OUT = "/home/user/Forecast/web/.screenshots";
mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log("Login page...");
  await page.goto(BASE + "/login");
  await page.screenshot({ path: `${OUT}/01-login.png` });

  await page.fill('input[name="email"]', "steve@yasa.local");
  await page.fill('input[name="password"]', "steve");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);

  console.log("Dashboard...");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/02-dashboard.png`, fullPage: true });

  console.log("Employees...");
  await page.goto(BASE + "/employees");
  await page.screenshot({ path: `${OUT}/03-employees.png`, fullPage: true });

  console.log("Employee new form...");
  await page.goto(BASE + "/employees/new");
  await page.screenshot({ path: `${OUT}/04-employee-form.png`, fullPage: true });

  console.log("Projects...");
  await page.goto(BASE + "/projects");
  await page.screenshot({ path: `${OUT}/05-projects.png`, fullPage: true });

  console.log("Forecast...");
  await page.goto(BASE + "/forecast");
  await page.screenshot({ path: `${OUT}/06-forecast.png`, fullPage: true });

  console.log("Capacity...");
  await page.goto(BASE + "/capacity");
  await page.screenshot({ path: `${OUT}/07-capacity.png`, fullPage: true });

  console.log("Settings index...");
  await page.goto(BASE + "/settings");
  await page.screenshot({ path: `${OUT}/08-settings.png`, fullPage: true });

  console.log("Teams...");
  await page.goto(BASE + "/teams");
  await page.screenshot({ path: `${OUT}/09-teams.png`, fullPage: true });

  await browser.close();
  console.log("Done.");
}

main();
