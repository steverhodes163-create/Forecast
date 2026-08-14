import { chromium } from "playwright";
import { Client } from "pg";
import "dotenv/config";

const BASE = "http://localhost:3100";
const BRANCH_NAME = "E2E Rollup Test";

// No delete-scenario UI action exists -- clean up the branch this script
// creates directly via SQL, both before (in case a prior run left one
// behind) and after, mirroring e2e-whatif.mjs's exact same pattern.
async function deleteTestScenario() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('DELETE FROM "ScenarioAdjustment" WHERE "scenarioId" IN (SELECT id FROM "Scenario" WHERE name = $1)', [BRANCH_NAME]);
    await client.query('DELETE FROM "Scenario" WHERE name = $1', [BRANCH_NAME]);
  } finally {
    await client.end();
  }
}

// Other scripts in this suite (e2e-gantt.mjs, e2e-task-sheet.mjs,
// e2e-my-tasks.mjs) assign employees to tasks, which auto-adds ProjectTeam
// rows as a legitimate side effect (task-service.ts: "tasks are meant to
// drive the grid") -- but they don't clean those links up afterward, so a
// project this test picks may already have every team pre-linked from an
// earlier script in the same run, leaving no "available team" left to add.
// Clear ProjectTeam for whichever two projects get picked before adding
// anything, so this test is self-sufficient regardless of run order.
async function clearProjectTeamLinks(projectIds) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('DELETE FROM "ProjectTeam" WHERE "projectId" = ANY($1)', [projectIds]);
  } finally {
    await client.end();
  }
}

async function main() {
  await deleteTestScenario();

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  // The rollup sorts project rows alphabetically by name (matching
  // getProjectForecastGrid's own team-sort convention), not by the order
  // markers were entered in -- always locate rows by project name, never
  // by position.
  async function rollupRow(name) {
    return page.locator("tbody tr", { has: page.locator(`text="${name}"`) });
  }
  async function openRollup() {
    await page.goto(BASE + "/teams");
    await page.locator("tr", { has: page.locator(`text=${teamName}`) }).locator('a:has-text("Rollup")').click();
    await page.waitForURL(/\/teams\/\d+\/rollup/);
  }

  console.log("1. Login...");
  await page.goto(BASE + "/login");
  await page.fill('input[name="email"]', "steve@yasa.local");
  await page.fill('input[name="password"]', "steve");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);

  console.log("2. Pick two distinct projects with a forecast grid...");
  await page.goto(BASE + "/projects");
  const forecastLinks = page.locator('a:has-text("Forecast grid")');
  const projectAHref = await forecastLinks.nth(0).getAttribute("href");
  const projectBHref = await forecastLinks.nth(1).getAttribute("href");
  await page.goto(BASE + projectAHref);
  const projectAName = (await page.locator("h1").innerText()).split(" — ")[0];
  await page.goto(BASE + projectBHref);
  const projectBName = (await page.locator("h1").innerText()).split(" — ")[0];
  console.log("   -> project A:", projectAName, " | project B:", projectBName);

  const projectAId = Number(projectAHref.match(/\/projects\/(\d+)\//)[1]);
  const projectBId = Number(projectBHref.match(/\/projects\/(\d+)\//)[1]);
  await clearProjectTeamLinks([projectAId, projectBId]);

  console.log("3. Add a team to project A, enter a 5.0h marker into its first member's Wk 1 cell...");
  await page.goto(BASE + projectAHref);
  await page.selectOption("main select", { index: 1 });
  const teamName = (await page.locator("main select option").nth(1).textContent())?.trim();
  await page.click('button:has-text("Add team")');
  await page.waitForFunction((name) => document.querySelector("tbody")?.innerText.includes(name), teamName, { timeout: 10000 });
  await page.click('button:has-text("Hours")');
  await page.waitForTimeout(300);
  const projectAInputs = page.locator("tbody tr").nth(1).locator("input");
  await projectAInputs.nth(0).fill("5.0");
  await projectAInputs.nth(0).blur();
  await page.waitForFunction(() => document.querySelector("tbody tr")?.innerText.includes("5.0"), { timeout: 10000 });
  console.log("   -> team:", teamName);

  console.log("4. Add the same team to project B, enter a 3.0h marker into its Wk 1 cell...");
  await page.goto(BASE + projectBHref);
  await page.selectOption("main select", { label: teamName });
  await page.click('button:has-text("Add team")');
  await page.waitForFunction((name) => document.querySelector("tbody")?.innerText.includes(name), teamName, { timeout: 10000 });
  await page.click('button:has-text("Hours")');
  await page.waitForTimeout(300);
  const projectBInputs = page.locator("tbody tr").nth(1).locator("input");
  await projectBInputs.nth(0).fill("3.0");
  await projectBInputs.nth(0).blur();
  await page.waitForFunction(() => document.querySelector("tbody tr")?.innerText.includes("3.0"), { timeout: 10000 });

  console.log("5. Open the team's rollup, confirm both projects sum correctly...");
  await openRollup();
  const rowCount = await page.locator("tbody tr").count();
  console.log(`   -> ${rowCount} row(s) on the rollup (expect 2 project rows + 1 total row)`);
  if (rowCount !== 3) throw new Error(`Expected 2 project rows + 1 total row, got ${rowCount} rows`);

  const projectAWk1 = await (await rollupRow(projectAName)).locator("td").nth(1).innerText();
  const projectBWk1 = await (await rollupRow(projectBName)).locator("td").nth(1).innerText();
  const totalWk1 = await (await rollupRow("All projects")).locator("td").nth(1).innerText();
  console.log("   -> project A Wk1:", projectAWk1, " | project B Wk1:", projectBWk1, " | All projects Wk1:", totalWk1);
  if (projectAWk1.trim() !== "5.0") throw new Error(`Expected project A's Wk1 to read 5.0, got "${projectAWk1}"`);
  if (projectBWk1.trim() !== "3.0") throw new Error(`Expected project B's Wk1 to read 3.0, got "${projectBWk1}"`);
  if (totalWk1.trim() !== "8.0") throw new Error(`Expected the All projects total to read 8.0, got "${totalWk1}"`);

  console.log("6. Remove the team from project A, confirm its row drops off the rollup and project B is unaffected...");
  await page.goto(BASE + projectAHref);
  await page.click('button:has-text("Hours")'); // the unit toggle is local state -- a full page load (goto) resets it to its FTE default
  await page.waitForTimeout(300);
  await page.click('button:has-text("Remove")');
  await page.waitForFunction(() => document.querySelector("tbody")?.innerText.includes("No teams on this project"), { timeout: 10000 });
  await openRollup();
  const afterRemoveCount = await page.locator("tbody tr").count();
  console.log("   -> rows after removing project A's team link:", afterRemoveCount);
  if (afterRemoveCount !== 2) throw new Error(`Expected 1 project row + 1 total row after removal, got ${afterRemoveCount}`);
  const remainingBWk1 = await (await rollupRow(projectBName)).locator("td").nth(1).innerText();
  if (remainingBWk1.trim() !== "3.0") throw new Error(`Expected the remaining row (project B) to still read 3.0, got "${remainingBWk1}"`);

  console.log("7. Re-add the team to project A, confirm the 5.0 marker survived...");
  await page.goto(BASE + projectAHref);
  await page.click('button:has-text("Hours")'); // fresh page load resets the unit toggle to its FTE default
  await page.waitForTimeout(300);
  await page.selectOption("main select", { label: teamName });
  await page.click('button:has-text("Add team")');
  await page.waitForFunction((name) => document.querySelector("tbody")?.innerText.includes(name), teamName, { timeout: 10000 });
  const reAddedValue = await page.locator("tbody tr").nth(1).locator("input").nth(0).inputValue();
  console.log("   -> project A's marker cell after re-adding the team:", reAddedValue);
  if (reAddedValue !== "5.0") throw new Error(`Expected the marker to survive team removal, got "${reAddedValue}"`);

  console.log("8. What-if: branch a scenario, Delay project A by 2 weeks, confirm the marker visibly shifts on the rollup...");
  await page.goto(BASE + "/what-if");
  await page.fill("#name", BRANCH_NAME);
  await page.click('button:has-text("Create & switch to it")');
  await page.waitForURL(/\/what-if/);
  await page.waitForTimeout(1000);
  await page.reload();
  await page.locator('select[name="adjustmentTypeId"]').selectOption({ label: "Delay" });
  await page.locator('select[name="projectId"]').selectOption({ label: projectAName });
  await page.locator('input[name="deltaWeeks"]').fill("2");
  await page.click('button:has-text("Add adjustment")');
  await page.waitForURL(/\/what-if/);
  await page.waitForTimeout(1000);

  await openRollup();
  const delayedRow = await rollupRow(projectAName);
  const delayedWk1 = await delayedRow.locator("td").nth(1).innerText();
  const delayedWk3 = await delayedRow.locator("td").nth(3).innerText();
  console.log("   -> after Delay, project A Wk1:", JSON.stringify(delayedWk1), " | Wk3:", JSON.stringify(delayedWk3));
  if (delayedWk1.trim() !== "") throw new Error(`Expected project A's original week to be empty after a 2-week Delay, got "${delayedWk1}"`);
  if (delayedWk3.trim() !== "5.0") throw new Error(`Expected the marker to reappear 2 weeks later (Wk3) after Delay, got "${delayedWk3}"`);

  console.log("9. What-if: swap Delay for Cancel on project A, confirm its row goes to 0 while project B is untouched...");
  await page.goto(BASE + "/what-if");
  await page.locator('button:has-text("Delete")').first().click();
  await page.waitForURL(/\/what-if/);
  await page.waitForTimeout(800);
  await page.locator('select[name="adjustmentTypeId"]').selectOption({ label: "Cancel" });
  await page.locator('select[name="projectId"]').selectOption({ label: projectAName });
  await page.click('button:has-text("Add adjustment")');
  await page.waitForURL(/\/what-if/);
  await page.waitForTimeout(1000);

  await openRollup();
  const cancelledAWk1 = await (await rollupRow(projectAName)).locator("td").nth(1).innerText();
  const cancelledBWk1 = await (await rollupRow(projectBName)).locator("td").nth(1).innerText();
  console.log("   -> after Cancel, project A Wk1:", JSON.stringify(cancelledAWk1), " | project B Wk1:", cancelledBWk1);
  if (cancelledAWk1.trim() !== "") throw new Error(`Expected project A's hours to read 0 after Cancel, got "${cancelledAWk1}"`);
  if (cancelledBWk1.trim() !== "3.0") throw new Error(`Expected project B untouched by A's Cancel, got "${cancelledBWk1}"`);

  console.log("10. Switch back to Baseline, confirm the rollup shows the original unshifted 5.0/3.0...");
  await page.selectOption('select[name="globalScenarioId"]', { label: "Baseline" });
  await page.waitForTimeout(500);
  await openRollup();
  const baselineAWk1 = await (await rollupRow(projectAName)).locator("td").nth(1).innerText();
  const baselineBWk1 = await (await rollupRow(projectBName)).locator("td").nth(1).innerText();
  console.log("   -> back on Baseline, project A Wk1:", baselineAWk1, " | project B Wk1:", baselineBWk1);
  if (baselineAWk1.trim() !== "5.0") throw new Error(`Expected project A's original 5.0 back on Baseline, got "${baselineAWk1}"`);
  if (baselineBWk1.trim() !== "3.0") throw new Error(`Expected project B's original 3.0 on Baseline, got "${baselineBWk1}"`);

  console.log("11. Clean up: clear both markers, remove the team from both grids, delete the branch scenario...");
  await page.goto(BASE + projectAHref);
  await page.click('button:has-text("Hours")');
  const cleanupA = page.locator("tbody tr").nth(1).locator("input");
  await cleanupA.nth(0).fill("");
  await cleanupA.nth(0).blur();
  await page.waitForTimeout(500);
  await page.click('button:has-text("Remove")');
  await page.waitForFunction(() => document.querySelector("tbody")?.innerText.includes("No teams on this project"), { timeout: 10000 });

  await page.goto(BASE + projectBHref);
  await page.click('button:has-text("Hours")');
  const cleanupB = page.locator("tbody tr").nth(1).locator("input");
  await cleanupB.nth(0).fill("");
  await cleanupB.nth(0).blur();
  await page.waitForTimeout(500);
  await page.click('button:has-text("Remove")');
  await page.waitForFunction(() => document.querySelector("tbody")?.innerText.includes("No teams on this project"), { timeout: 10000 });

  await browser.close();
  await deleteTestScenario();

  console.log("\nBrowser console/page errors captured:", errors.length);
  errors.forEach((e) => console.log("   !", e));
  if (errors.length > 0) throw new Error("Console errors present");

  console.log("\nTeam rollup e2e test PASSED");
}

main().catch((e) => {
  console.error("Team rollup e2e test FAILED:", e);
  process.exit(1);
});
