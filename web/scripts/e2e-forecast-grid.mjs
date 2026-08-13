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

  console.log("2. Open a project's forecast grid...");
  await page.goto(BASE + "/projects");
  await page.locator('a:has-text("Forecast grid")').first().click();
  await page.waitForURL(/\/projects\/\d+\/forecast/);
  console.log("   -> on", page.url());

  console.log("3. Add a team, confirm its members render as blank rows...");
  await page.selectOption("main select", { index: 1 });
  const teamName = (await page.locator("main select option").nth(1).textContent())?.trim();
  await page.click('button:has-text("Add team")');
  await page.waitForFunction((name) => document.querySelector("tbody")?.innerText.includes(name), teamName, { timeout: 10000 });
  const memberCount = (await page.locator("tbody tr").count()) - 1;
  console.log(`   -> team "${teamName}" added, ${memberCount} member row(s)`);
  if (memberCount < 1) throw new Error("Expected at least one member row under the team");

  console.log("4. Enter FTE marker (0.4) into the first member's Wk 1 cell...");
  const employee1Inputs = page.locator("tbody tr").nth(1).locator("input");
  await employee1Inputs.nth(0).fill("0.4");
  await employee1Inputs.nth(0).blur();
  await page.waitForFunction(() => document.querySelector("tbody tr")?.innerText.includes("0.40"), { timeout: 10000 });
  console.log("   -> team subtotal:", (await page.locator("tbody tr").first().innerText()).replace(/\n/g, " | "));

  if (memberCount >= 2) {
    console.log("5. Enter a second marker (0.3) into the second member's same Wk 1 cell...");
    const employee2Inputs = page.locator("tbody tr").nth(2).locator("input");
    await employee2Inputs.nth(0).fill("0.3");
    await employee2Inputs.nth(0).blur();
    await page.waitForFunction(() => document.querySelector("tbody tr")?.innerText.includes("0.70"), { timeout: 10000 });
    console.log("   -> team subtotal after both entries:", (await page.locator("tbody tr").first().innerText()).replace(/\n/g, " | "));
  } else {
    console.log("5. (only one member on this team -- skipping second-marker rollup check)");
  }

  console.log("6. Toggle unit to Hours, confirm the subtotal display changes...");
  const fteSubtotal = (await page.locator("tbody tr").first().innerText()).replace(/\n/g, " | ");
  await page.click('button:has-text("Hours")');
  await page.waitForTimeout(300);
  const hoursSubtotal = (await page.locator("tbody tr").first().innerText()).replace(/\n/g, " | ");
  console.log("   -> FTE:", fteSubtotal, " | Hours:", hoursSubtotal);
  if (fteSubtotal === hoursSubtotal) throw new Error("Unit toggle did not change the displayed subtotal");
  await page.click('button:has-text("FTE")');
  await page.waitForTimeout(300);

  console.log("7. Collapse the expanded month, confirm week columns disappear...");
  const headerCellsExpanded = await page.locator("thead tr").nth(1).locator("th").count();
  await page.click("thead button");
  await page.waitForTimeout(300);
  const headerCellsCollapsed = await page.locator("thead tr").nth(1).locator("th").count();
  console.log("   -> header cells expanded:", headerCellsExpanded, " | collapsed:", headerCellsCollapsed);
  if (headerCellsCollapsed >= headerCellsExpanded) throw new Error("Collapsing the month did not reduce week columns");
  await page.click("thead button");
  await page.waitForTimeout(300);

  console.log("8. Remove the team, confirm the empty-state message and that hours weren't deleted...");
  await page.click('button:has-text("Remove")');
  await page.waitForFunction(() => document.querySelector("tbody")?.innerText.includes("No teams on this project"), { timeout: 10000 });
  console.log("   -> empty state shown after remove");

  await page.selectOption("main select", { index: 1 });
  await page.click('button:has-text("Add team")');
  await page.waitForFunction(() => (document.querySelector("tbody input")?.value ?? "") !== "", { timeout: 10000 });
  const reAddedValue = await page.locator("tbody tr").nth(1).locator("input").nth(0).inputValue();
  console.log("   -> re-added team, first member's cell still shows:", reAddedValue);
  if (reAddedValue !== "0.40") throw new Error(`Expected hours to survive team removal, got "${reAddedValue}"`);

  console.log("9. Clean up: clear marker cells, remove the team again...");
  const allInputs = page.locator("tbody input");
  const inputCount = await allInputs.count();
  for (let i = 0; i < inputCount; i++) {
    const val = await allInputs.nth(i).inputValue();
    if (val) {
      await allInputs.nth(i).fill("");
      await allInputs.nth(i).blur();
      await page.waitForTimeout(300);
    }
  }
  await page.click('button:has-text("Remove")');
  await page.waitForFunction(() => document.querySelector("tbody")?.innerText.includes("No teams on this project"), { timeout: 10000 });
  console.log("   -> grid back to empty state");

  console.log("\nBrowser console/page errors captured:", errors.length);
  errors.forEach((e) => console.log("   !", e));
  if (errors.length > 0) throw new Error("Console errors present");

  await browser.close();
  console.log("\nForecast grid e2e test PASSED");
}

main().catch((e) => {
  console.error("Forecast grid e2e test FAILED:", e);
  process.exit(1);
});
