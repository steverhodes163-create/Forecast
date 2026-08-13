// MSP-style shorthand for the task sheet's Predecessors column (task
// numbers with optional lag, e.g. "1,3+2d"). Resources are picked via
// dropdowns scoped to the task's owner team, not typed shorthand -- see
// task-sheet.tsx and setTaskAssignmentsAction.
// Pure parsing only -- no DB access, safe to import from client or server.

export type PredecessorToken = { taskId: number; lagDays: number };

export function parsePredecessors(raw: string): { tokens: PredecessorToken[] } | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { tokens: [] };
  const parts = trimmed
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const tokens: PredecessorToken[] = [];
  for (const part of parts) {
    const match = /^(\d+)(?:\+(\d+)d)?$/.exec(part);
    if (!match) {
      return { error: `Can't understand "${part}" — use a task number, optionally with lag (e.g. "3" or "3+2d")` };
    }
    tokens.push({ taskId: Number(match[1]), lagDays: match[2] ? Number(match[2]) : 0 });
  }
  return { tokens };
}

export function formatPredecessors(tokens: PredecessorToken[]): string {
  return tokens.map((t) => (t.lagDays ? `${t.taskId}+${t.lagDays}d` : `${t.taskId}`)).join(", ");
}
