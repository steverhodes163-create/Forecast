import { chromium } from "playwright";
import { Client } from "pg";
import "dotenv/config";

const BASE = "http://localhost:3100";

// The seeded demo user isn't linked to an Employee record by design (it's
// an admin account, not a staff member) -- link it temporarily so there's
// something to see on /my-tasks, and restore it afterward either way.
async function withLinkedEmployee(run) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows: userRows } = await client.query('SELECT id, "employeeId" FROM "User" WHERE email = $1', ["steve@yasa.local"]);
    if (userRows.length === 0) throw new Error("Demo user not found");
    const { id: userId, employeeId: originalEmployeeId } = userRows[0];

    const { rows: empRows } = await client.query('SELECT id, name FROM "Employee" ORDER BY id ASC LIMIT 1');
    if (empRows.length === 0) throw new Error("No employees to link");
    const employee = empRows[0];

    await client.query('UPDATE "User" SET "employeeId" = $1 WHERE id = $2', [employee.id, userId]);
    try {
      await run(employee);
    } finally {
      await client.query('UPDATE "User" SET "employeeId" = $1 WHERE id = $2', [originalEmployeeId, userId]);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  await withLinkedEmployee(async (employee) => {
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

    console.log(`2. Assign a task to ${employee.name} (now linked to this login)...`);
    await page.goto(BASE + "/projects");
    await page.locator('a:has-text("Gantt")').first().click();
    await page.waitForURL(/\/projects\/\d+\/gantt/);

    const newRow = page.locator('input[placeholder="Type a task name to add a row…"]');
    await newRow.fill("My Tasks Marker");
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
      "My Tasks Marker",
      { timeout: 10000 }
    );

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

    const row = await dataRowByName("My Tasks Marker");
    const resInput = row.locator('input[placeholder="e.g. Alex Whitfield[50%]"]');
    await resInput.fill(employee.name);
    await resInput.blur();
    await page.waitForTimeout(1000);
    if (await resInput.getAttribute("title")) throw new Error(`Unexpected resource error: ${await resInput.getAttribute("title")}`);

    console.log("3. Visit /my-tasks, confirm the task is listed...");
    await page.goto(BASE + "/my-tasks");
    const bodyText = await page.locator("body").innerText();
    if (!bodyText.includes("My Tasks Marker")) throw new Error("Assigned task did not appear on /my-tasks");
    console.log("   -> task listed");

    console.log("4. Mark it complete from /my-tasks...");
    const myTaskRow = page.locator("tr", { has: page.locator("text=My Tasks Marker") });
    await myTaskRow.locator('input[type="checkbox"]').check();
    await page.waitForTimeout(1000);
    console.log("   -> marked complete");

    console.log("5. Confirm the Gantt sheet reflects it as done...");
    await page.goto(BASE + "/projects");
    await page.locator('a:has-text("Gantt")').first().click();
    await page.waitForURL(/\/projects\/\d+\/gantt/);
    const rowAfter = await dataRowByName("My Tasks Marker");
    const doneChecked = await rowAfter.locator('input[type="checkbox"]').isChecked();
    console.log("   -> Gantt sheet shows done:", doneChecked);
    if (!doneChecked) throw new Error("Completing from /my-tasks did not reflect on the Gantt sheet");

    console.log("6. Clean up: delete the marker task...");
    await rowAfter.locator('button:has-text("✕")').click();
    await page.waitForTimeout(800);
    const remaining = await dataRowByName("My Tasks Marker");
    if (remaining) throw new Error("Marker task was not cleaned up");

    console.log("\nBrowser console/page errors captured:", errors.length);
    errors.forEach((e) => console.log("   !", e));
    if (errors.length > 0) throw new Error("Console errors present");

    await browser.close();
    console.log("\nMy Tasks e2e test PASSED");
  });
}

main().catch((e) => {
  console.error("My Tasks e2e test FAILED:", e);
  process.exit(1);
});
