import { chromium } from "playwright";
import { Client } from "pg";
import "dotenv/config";

const BASE = "http://localhost:3100";
const BRANCH_NAME = "E2E Whatif Test";

// No delete-scenario UI action exists (§7.4 branch scenarios are meant to
// accumulate, not be torn down from the app itself) -- clean up the branch
// this script creates directly via SQL, both before (in case a prior run
// left one behind) and after, so the unique scenario-name constraint never
// blocks a rerun.
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

function weightedDemandFrom(bodyText) {
  // The KPI label renders uppercase via CSS, which .innerText() reflects.
  const match = bodyText.match(/([\d,]+(?:\.\d+)?) hrs\s*\n\s*WEIGHTED DEMAND/i);
  if (!match) throw new Error("Could not find 'Weighted demand' KPI on the page");
  return Number(match[1].replace(/,/g, ""));
}

function bridgeAfterFrom(bodyText) {
  const idx = bodyText.indexOf("Committed / Weighted");
  const section = bodyText.slice(idx, idx + 500);
  const match = section.match(/Weighted\n([\d,]+(?:\.\d+)?)h\n([\d,]+(?:\.\d+)?)h/);
  if (!match) throw new Error("Could not find Weighted before/after row on /what-if");
  return { before: Number(match[1].replace(/,/g, "")), after: Number(match[2].replace(/,/g, "")) };
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

  console.log("1. Login, read baseline Weighted Demand...");
  await page.goto(BASE + "/login");
  await page.fill('input[name="email"]', "steve@yasa.local");
  await page.fill('input[name="password"]', "steve");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
  const baselineWeighted = weightedDemandFrom(await page.locator("body").innerText());
  console.log("   -> baseline weighted demand:", baselineWeighted);

  console.log("2. On /what-if, branch a what-if scenario off Baseline...");
  await page.goto(BASE + "/what-if");
  await page.fill("#name", BRANCH_NAME);
  await page.click('button:has-text("Create & switch to it")');
  await page.waitForURL(/\/what-if/);
  await page.waitForTimeout(1000);
  await page.reload(); // same-path redirect -- reload to avoid reading a stale router-cached layout (see e2e-capacity.mjs for the same pattern)
  const switcherLabel = await page.locator('select[name="globalScenarioId"] option:checked').first().textContent();
  console.log("   -> active scenario after branching:", switcherLabel);
  if (!switcherLabel?.includes(BRANCH_NAME)) throw new Error(`Expected the new branch active, got: ${switcherLabel}`);

  console.log("3. Cancel adjustment against the Won project (NM-450)...");
  await page.locator('select[name="adjustmentTypeId"]').selectOption({ label: "Cancel" });
  await page.locator('select[name="projectId"]').selectOption({ label: "NM-450 Traction Motor (sample)" });
  await page.click('button:has-text("Add adjustment")');
  await page.waitForURL(/\/what-if/);
  await page.waitForTimeout(1000);
  await page.goto(BASE + "/what-if"); // fresh navigation -- avoids racing the redirect's own re-render
  let bodyText = await page.locator("body").innerText();
  if (!bodyText.includes("NM-450 Traction Motor")) throw new Error("Cancel adjustment did not appear in the adjustments table");

  await page.goto(BASE + "/dashboard");
  const afterCancelWeighted = weightedDemandFrom(await page.locator("body").innerText());
  console.log("   -> weighted demand after Cancel:", afterCancelWeighted, "(expected less than", baselineWeighted, ")");
  if (!(afterCancelWeighted < baselineWeighted)) throw new Error("Cancel did not reduce Weighted Demand on the dashboard");

  await page.goto(BASE + "/project-overview");
  const projectOverviewText = await page.locator("body").innerText();
  const cancelRowMatch = projectOverviewText.match(/NM-450 Traction Motor \(sample\)[\s\S]{0,80}?([\d,.]+) hrs/);
  console.log("   -> NM-450's weighted demand on Project Overview:", cancelRowMatch?.[1]);
  if (!cancelRowMatch || Number(cancelRowMatch[1].replace(/,/g, "")) !== 0) {
    throw new Error(`Expected NM-450's Project Overview figure to read 0 hrs, got: ${cancelRowMatch?.[1]}`);
  }

  console.log("4. Win adjustment against the RFQ project (Aurora)...");
  await page.goto(BASE + "/what-if");
  await page.locator('select[name="adjustmentTypeId"]').selectOption({ label: "Win" });
  await page.locator('select[name="projectId"]').selectOption({ label: "Aurora Light Commercial EV Motor (sample)" });
  await page.click('button:has-text("Add adjustment")');
  await page.waitForURL(/\/what-if/);
  await page.waitForTimeout(1000);
  await page.goto(BASE + "/dashboard");
  const afterWinWeighted = weightedDemandFrom(await page.locator("body").innerText());
  console.log("   -> weighted demand after Win:", afterWinWeighted, "(expected more than", afterCancelWeighted, ")");
  if (!(afterWinWeighted > afterCancelWeighted)) throw new Error("Win did not increase Weighted Demand on the dashboard");

  console.log("5. Delay adjustment (8 weeks) against the same project -- documented no-op on today's dashboards...");
  await page.goto(BASE + "/what-if");
  await page.locator('select[name="adjustmentTypeId"]').selectOption({ label: "Delay" });
  await page.locator('select[name="projectId"]').selectOption({ label: "Aurora Light Commercial EV Motor (sample)" });
  await page.locator('input[name="deltaWeeks"]').fill("8");
  await page.click('button:has-text("Add adjustment")');
  await page.waitForURL(/\/what-if/);
  await page.waitForTimeout(1000);
  await page.goto(BASE + "/what-if");
  const delayRow = page.locator("tbody tr", { has: page.locator("text=Delay") });
  const delayWeeksCell = await delayRow.locator("td").nth(2).innerText();
  console.log("   -> Delay row's delta weeks cell:", delayWeeksCell);
  if (delayWeeksCell.trim() !== "8") throw new Error(`Delay adjustment did not appear with 8 weeks, got: "${delayWeeksCell}"`);

  console.log("6. What-If page's own before/after panel matches the real dashboards...");
  const bridge = bridgeAfterFrom(await page.locator("body").innerText());
  console.log("   -> panel before:", bridge.before, "| panel after:", bridge.after);
  if (bridge.before !== baselineWeighted) throw new Error(`Panel 'before' (${bridge.before}) should equal the true baseline (${baselineWeighted})`);
  if (bridge.after !== afterWinWeighted) throw new Error(`Panel 'after' (${bridge.after}) should equal the dashboard's post-Win figure (${afterWinWeighted})`);

  await page.goto(BASE + "/dashboard");
  const afterDelayWeighted = weightedDemandFrom(await page.locator("body").innerText());
  console.log("   -> weighted demand after Delay:", afterDelayWeighted, "(expected unchanged from", afterWinWeighted, ")");
  if (afterDelayWeighted !== afterWinWeighted) throw new Error("Delay unexpectedly changed Weighted Demand -- update this guard if Delay is ever calendarized");

  console.log("7. Clean up: delete all three adjustments, confirm reversion, switch back to Baseline...");
  await page.goto(BASE + "/what-if");
  let deleteButtons = page.locator('button:has-text("Delete")');
  while ((await deleteButtons.count()) > 0) {
    await deleteButtons.first().click();
    await page.waitForURL(/\/what-if/);
    await page.waitForTimeout(800);
    await page.goto(BASE + "/what-if");
    deleteButtons = page.locator('button:has-text("Delete")');
  }
  await page.goto(BASE + "/dashboard");
  const revertedWeighted = weightedDemandFrom(await page.locator("body").innerText());
  console.log("   -> weighted demand after cleanup:", revertedWeighted, "(expected back to", baselineWeighted, ")");
  if (revertedWeighted !== baselineWeighted) throw new Error("Weighted Demand did not revert to baseline after deleting all adjustments");

  await page.selectOption('select[name="globalScenarioId"]', { label: "Baseline" });
  await page.waitForTimeout(300);
  const backToBaseline = await page.locator('select[name="globalScenarioId"] option:checked').first().textContent();
  console.log("   -> switched back to:", backToBaseline);
  if (!backToBaseline?.includes("Baseline")) throw new Error(`Expected Baseline selected, got: ${backToBaseline}`);

  console.log("\nBrowser console/page errors captured:", errors.length);
  errors.forEach((e) => console.log("   !", e));
  if (errors.length > 0) throw new Error("Console errors present");

  await browser.close();
  await deleteTestScenario();
  console.log("\nWhat-If e2e test PASSED");
}

main().catch((e) => {
  console.error("What-If e2e test FAILED:", e);
  process.exit(1);
});
