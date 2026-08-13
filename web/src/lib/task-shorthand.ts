// MSP-style shorthand for the task sheet's Predecessors/Resources columns.
// Pure parsing only -- no DB access, safe to import from client or server.

export type PredecessorToken = { taskId: number; lagDays: number };
export type ResourceToken = { name: string; pct: number };

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

export function parseResources(raw: string): { tokens: ResourceToken[] } | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { tokens: [] };
  const parts = trimmed
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const tokens: ResourceToken[] = [];
  for (const part of parts) {
    const bracketMatch = /^(.*)\[(\d{1,3})%\]$/.exec(part);
    if (bracketMatch) {
      const name = bracketMatch[1].trim();
      if (!name) return { error: `Can't understand "${part}"` };
      tokens.push({ name, pct: Number(bracketMatch[2]) });
    } else {
      tokens.push({ name: part, pct: 100 });
    }
  }
  return { tokens };
}

export function formatPredecessors(tokens: PredecessorToken[]): string {
  return tokens.map((t) => (t.lagDays ? `${t.taskId}+${t.lagDays}d` : `${t.taskId}`)).join(", ");
}

export function formatResources(tokens: ResourceToken[]): string {
  return tokens.map((t) => (t.pct !== 100 ? `${t.name}[${t.pct}%]` : t.name)).join(", ");
}
