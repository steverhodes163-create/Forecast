import { chromium } from "playwright";

const BASE = "http://localhost:3100";
const PX_PER_DAY = 26; // must match gantt-chart.tsx's PX_PER_DAY

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

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

  async function addTask(name, duration, dependsOnTaskId) {
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
    const row = await dataRowByName(name);
    if (duration) {
      const durationInput = row.locator("input").nth(1);
      await durationInput.fill(`${duration}d`);
      await durationInput.blur();
      await page.waitForTimeout(1200);
    }
    if (dependsOnTaskId) {
      const predInput = row.locator('input[placeholder="e.g. 1,3+2d"]');
      await predInput.fill(String(dependsOnTaskId));
      await predInput.blur();
      await page.waitForTimeout(1200);
      const err = await predInput.getAttribute("title");
      if (err) throw new Error(`Unexpected predecessor error adding "${name}": ${err}`);
    }
    return (await row.locator("td").first().innerText()).trim();
  }

  function barLocator(name) {
    return page.locator(`div[title*="${name}"]`).first();
  }

  async function dragBar(bar, fromEdge, deltaDays) {
    const box = await bar.boundingBox();
    const startX = fromEdge === "right-edge" ? box.x + box.width - 1 : box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX + deltaDays * PX_PER_DAY, y, { steps: 8 });
    await page.mouse.up();
  }

  console.log("1. Login...");
  await page.goto(BASE + "/login");
  await page.fill('input[name="email"]', "steve@yasa.local");
  await page.fill('input[name="password"]', "steve");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);

  console.log("2. Open a project's Gantt page, add a marker task...");
  await page.goto(BASE + "/projects");
  // "Zephyr" specifically -- it's the one seeded project with zero existing
  // tasks. The others (NM-450/Aurora/Falcon) now ship with a full demo
  // Gantt, and a marker task added after 8 existing rows can render below
  // the viewport, where page.mouse's raw coordinates (unlike a locator
  // click) won't auto-scroll to reach it.
  await page.locator('tr:has-text("Zephyr") a:has-text("Gantt")').click();
  await page.waitForURL(/\/projects\/\d+\/gantt/);
  await addTask("Drag E2E Task A", 5, null);

  console.log("3. Drag the right edge +2 days -- confirm the chart bar and the task sheet's Duration cell agree...");
  const barA = barLocator("Drag E2E Task A");
  await barA.waitFor({ timeout: 10000 });
  const titleBefore = await barA.getAttribute("title");
  console.log("   -> before:", titleBefore);
  await dragBar(barA, "right-edge", 2);
  await page.waitForFunction(
    (title) => document.querySelector(`div[title*="${title}"]`)?.getAttribute("title")?.includes("(7d)"),
    "Drag E2E Task A",
    { timeout: 10000 }
  );
  const titleAfterResize = await barLocator("Drag E2E Task A").getAttribute("title");
  console.log("   -> after resize:", titleAfterResize);
  const rowAAfterResize = await dataRowByName("Drag E2E Task A");
  const sheetDurationAfterResize = await rowAAfterResize.locator("input").nth(1).inputValue();
  console.log("   -> task sheet Duration cell:", sheetDurationAfterResize);
  if (sheetDurationAfterResize !== "7d") throw new Error(`Expected task sheet Duration to read 7d, got "${sheetDurationAfterResize}"`);

  console.log("4. Drag the resized bar's body +3 days -- confirm the start date shifts...");
  const barAForMove = barLocator("Drag E2E Task A");
  await dragBar(barAForMove, "body", 3);
  await page.waitForFunction(
    (args) => document.querySelector(`div[title*="${args.name}"]`)?.getAttribute("title") !== args.previousTitle,
    { name: "Drag E2E Task A", previousTitle: titleAfterResize },
    { timeout: 10000 }
  );
  const titleAfterMove = await barLocator("Drag E2E Task A").getAttribute("title");
  console.log("   -> after move:", titleAfterMove);
  // Task A's original start (project's anchor Monday) shifted 3 calendar days later -- still 7d duration, same as after step 3.
  if (!titleAfterMove.includes("(7d)")) throw new Error(`Expected duration to remain 7d after a move (only the start shifts), got: "${titleAfterMove}"`);

  console.log("5. Add a dependent task B, drag it 10 days earlier -- confirm the manual-start-date conflict tooltip appears...");
  const idA = (await (await dataRowByName("Drag E2E Task A")).locator("td").first().innerText()).trim();
  await addTask("Drag E2E Task B", null, idA);
  const barB = barLocator("Drag E2E Task B");
  await barB.waitFor({ timeout: 10000 });
  const titleBBefore = await barB.getAttribute("title");
  console.log("   -> Task B before:", titleBBefore);
  await dragBar(barB, "body", -10);
  await page.waitForFunction(
    (name) => document.querySelector(`div[title*="${name}"]`)?.getAttribute("title")?.includes("manual start date conflicts"),
    "Drag E2E Task B",
    { timeout: 10000 }
  );
  const titleBAfter = await barLocator("Drag E2E Task B").getAttribute("title");
  console.log("   -> Task B after dragging 10 days earlier:", titleBAfter);
  // The dependency wins the conflict -- B's actual "name: dates (Nd)" prefix should be unchanged from before the drag.
  const datesPrefix = (title) => title.split(" — ")[0];
  if (datesPrefix(titleBAfter) !== datesPrefix(titleBBefore)) {
    throw new Error(`Expected B's dates to stay put since the dependency wins the conflict, before: "${titleBBefore}", after: "${titleBAfter}"`);
  }

  console.log("6. Clean up: delete both marker tasks...");
  for (const name of ["Drag E2E Task B", "Drag E2E Task A"]) {
    const row = await dataRowByName(name);
    if (row) {
      await row.locator('button:has-text("✕")').click();
      await page.waitForTimeout(600);
    }
  }
  const remaining = await dataRowByName("Drag E2E Task A");
  console.log("   -> marker rows remaining:", !!remaining);
  if (remaining) throw new Error("Marker tasks were not fully cleaned up");

  console.log("\nBrowser console/page errors captured:", errors.length);
  errors.forEach((e) => console.log("   !", e));
  if (errors.length > 0) throw new Error("Console errors present");

  await browser.close();
  console.log("\nGantt drag e2e test PASSED");
}

main().catch((e) => {
  console.error("Gantt drag e2e test FAILED:", e);
  process.exit(1);
});
