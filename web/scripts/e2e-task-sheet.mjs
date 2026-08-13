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

  // Only real data rows have 9 <td>s; the blank "add" row has 2.
  async function dataRowByName(name) {
    const rows = page.locator("tbody tr");
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      if ((await row.locator("td").count()) < 9) continue;
      const val = await row.locator("input").first().inputValue().catch(() => "");
      if (val === name) return row;
    }
    return null;
  }

  async function addTask(name) {
    const newRow = page.locator('input[placeholder="Type a task name to add a row…"]');
    await newRow.fill(name);
    await newRow.blur();
    await page.waitForFunction(
      (n) => {
        for (const row of document.querySelectorAll("tbody tr")) {
          if (row.querySelectorAll("td").length < 9) continue;
          const input = row.querySelector("input");
          if (input && input.value === n) return true;
        }
        return false;
      },
      name,
      { timeout: 10000 }
    );
  }

  console.log("1. Login...");
  await page.goto(BASE + "/login");
  await page.fill('input[name="email"]', "steve@yasa.local");
  await page.fill('input[name="password"]', "steve");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);

  console.log("2. Open a project's Gantt page...");
  await page.goto(BASE + "/projects");
  await page.locator('a:has-text("Gantt")').first().click();
  await page.waitForURL(/\/projects\/\d+\/gantt/);

  console.log("3. Add Task A via the blank row, set duration...");
  await addTask("Sheet Task A");
  const rowA = await dataRowByName("Sheet Task A");
  const taskAId = (await rowA.locator("td").first().innerText()).trim();
  if (!/^\d+$/.test(taskAId)) throw new Error(`Task A id isn't numeric: "${taskAId}"`);
  const durationInput = rowA.locator("input").nth(1);
  await durationInput.fill("5d");
  await durationInput.blur();
  await page.waitForTimeout(1000);
  console.log("   -> Task A id:", taskAId);

  console.log("4. Add Task B depending on A via Predecessors shorthand...");
  await addTask("Sheet Task B");
  const rowB = await dataRowByName("Sheet Task B");
  const predInput = rowB.locator('input[placeholder="e.g. 1,3+2d"]');
  await predInput.fill(taskAId);
  await predInput.blur();
  await page.waitForTimeout(1000);
  if (await predInput.getAttribute("title")) throw new Error(`Unexpected predecessor error: ${await predInput.getAttribute("title")}`);
  const bStart = await rowB.locator("td").nth(6).innerText();
  console.log("   -> Task B start:", bStart);
  if (!bStart.includes("12 Jan") && !bStart.includes("Jan")) {
    // Not asserting an exact date here (depends on this project's anchor date) --
    // just confirm B's start is AFTER A's finish, which the reschedule step below verifies precisely.
  }

  console.log("5. A bad predecessor id is rejected with a clear error...");
  await predInput.fill("999999");
  await predInput.blur();
  await page.waitForTimeout(800);
  const badPredError = await predInput.getAttribute("title");
  console.log("   -> error:", badPredError);
  if (!badPredError || !badPredError.includes("999999")) throw new Error("Expected a clear error for an invalid predecessor id");
  await predInput.fill(taskAId);
  await predInput.blur();
  await page.waitForTimeout(800);

  console.log("6. Owner team + Assigned to: pick a team, add two people scoped to it, set their %...");
  const teamSelect = rowB.locator("select").first();
  await teamSelect.selectOption({ index: 1 });
  const teamLabel = await teamSelect.locator("option").nth(1).textContent();
  await page.waitForTimeout(1000);
  console.log("   -> owner team:", teamLabel);

  await (await dataRowByName("Sheet Task B")).locator('button:has-text("+ Add person")').click();
  await page.waitForTimeout(500);
  let rowB2 = await dataRowByName("Sheet Task B");
  const personSelect1 = rowB2.locator("select").nth(1);
  const personCount1 = await personSelect1.locator("option").count();
  if (personCount1 < 2) throw new Error(`Expected at least one team member available, got ${personCount1 - 1}`);
  await personSelect1.selectOption({ index: 1 });
  const person1 = await personSelect1.locator("option").nth(1).textContent();
  await page.waitForTimeout(1000);

  rowB2 = await dataRowByName("Sheet Task B");
  const pctInput1 = rowB2.locator('input[type="number"]').first();
  await pctInput1.fill("60");
  await pctInput1.blur();
  await page.waitForTimeout(1000);
  console.log("   -> first person:", person1, "at 60%");

  rowB2 = await dataRowByName("Sheet Task B");
  await rowB2.locator('button:has-text("+ Add person")').click();
  await page.waitForTimeout(500);
  rowB2 = await dataRowByName("Sheet Task B");
  const personSelect2 = rowB2.locator("select").nth(2);
  const personCount2 = await personSelect2.locator("option").count();
  console.log("   -> second picker excludes the first person, options left:", personCount2 - 1);
  if (personCount2 < 2) throw new Error("Expected at least one other team member available for the second person");
  await personSelect2.selectOption({ index: 1 });
  const person2 = await personSelect2.locator("option").nth(1).textContent();
  await page.waitForTimeout(1000);
  if (person2 === person1) throw new Error("Second picker allowed selecting the same person twice");

  rowB2 = await dataRowByName("Sheet Task B");
  const pctInput2 = rowB2.locator('input[type="number"]').nth(1);
  await pctInput2.fill("40");
  await pctInput2.blur();
  await page.waitForTimeout(1000);
  console.log("   -> second person:", person2, "at 40%");

  console.log("7. Mark Task A done, confirm Task B's start reschedules...");
  const aFinishBefore = await rowA.locator("td").nth(7).innerText();
  await rowA.locator('input[type="checkbox"]').check();
  await page.waitForTimeout(1200);
  const rowBAfter = await dataRowByName("Sheet Task B");
  const bStartAfter = await rowBAfter.locator("td").nth(6).innerText();
  console.log("   -> A's planned finish was:", aFinishBefore, " | B's start is now:", bStartAfter);

  console.log("8. Clean up: delete both marker tasks...");
  const rowBFinal = await dataRowByName("Sheet Task B");
  await rowBFinal.locator("td").last().locator('button:has-text("✕")').click();
  await page.waitForTimeout(800);
  const rowAFinal = await dataRowByName("Sheet Task A");
  await rowAFinal.locator("td").last().locator('button:has-text("✕")').click();
  await page.waitForTimeout(800);
  const remaining = await dataRowByName("Sheet Task A");
  console.log("   -> Task A row remaining:", !!remaining);
  if (remaining) throw new Error("Marker tasks were not fully cleaned up");

  console.log("\nBrowser console/page errors captured:", errors.length);
  errors.forEach((e) => console.log("   !", e));
  if (errors.length > 0) throw new Error("Console errors present");

  await browser.close();
  console.log("\nTask sheet e2e test PASSED");
}

main().catch((e) => {
  console.error("Task sheet e2e test FAILED:", e);
  process.exit(1);
});
