// Slash commands for the composer: fetched from whichever runtime a guy lives
// on (`commands.list`, see src-tauri/src/runtime/mod.rs), cached briefly, and
// matched against what's being typed.
import { commands as commandsApi } from "./gateway";
import type { CommandEntry } from "./types";

const TTL = 60_000;
const cache = new Map<string, { at: number; list: Promise<CommandEntry[]> }>();

export function loadCommands(gw: string, agentId: string, sessionKey?: string): Promise<CommandEntry[]> {
  const key = `${gw}|${agentId}|${sessionKey ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.list;
  const list = commandsApi
    .list(gw, agentId, sessionKey)
    // OpenClaw refuses threads it hasn't created yet; the guy-wide list is the same.
    .catch((e) => (sessionKey ? commandsApi.list(gw, agentId) : Promise.reject(e)))
    .then((r) => dedupe(r.commands ?? []))
    .catch(() => {
      cache.delete(key);
      return [];
    });
  cache.set(key, { at: Date.now(), list });
  return list;
}

function dedupe(list: CommandEntry[]): CommandEntry[] {
  const seen = new Set<string>();
  return list
    .map((c) => ({ ...c, name: c.name.replace(/^\//, "") }))
    .filter((c) => c.name && !seen.has(c.name.toLowerCase()) && seen.add(c.name.toLowerCase()));
}

export type Choice = { value: string; label: string };

/** What the composer should offer for the text typed so far. */
export type SlashMatch =
  /** Typing the command itself: `/mo` */
  | { stage: "command"; query: string; items: CommandEntry[] }
  /** Picking the first argument from a fixed list: `/think hi` */
  | { stage: "choice"; command: CommandEntry; items: Choice[] }
  /** Typing free-form arguments: `/review main…` (just a usage reminder) */
  | { stage: "args"; command: CommandEntry };

export function matchSlash(text: string, list: CommandEntry[]): SlashMatch | null {
  const typing = /^\/(\S*)$/.exec(text);
  if (typing) {
    const query = typing[1].toLowerCase();
    return { stage: "command", query, items: rankCommands(list, query) };
  }
  const withArgs = /^\/(\S+)\s([^\n]*)$/.exec(text);
  const command = withArgs ? findCommand(list, withArgs[1]) : undefined;
  if (!withArgs || !command) return null;
  const choices = command.args?.[0]?.choices;
  const arg = withArgs[2];
  if (choices?.length && !/\s/.test(arg)) {
    const q = arg.toLowerCase();
    const items = choices.filter((c) => c.value.toLowerCase().startsWith(q) || c.label.toLowerCase().includes(q));
    if (items.length && !(items.length === 1 && items[0].value.toLowerCase() === q)) return { stage: "choice", command, items };
  }
  return command.args?.length || command.description ? { stage: "args", command } : null;
}

function names(c: CommandEntry): string[] {
  return [c.name, ...(c.textAliases ?? []).map((a) => a.replace(/^\//, ""))].map((n) => n.toLowerCase());
}

export function findCommand(list: CommandEntry[], typed: string): CommandEntry | undefined {
  const t = typed.toLowerCase();
  return list.find((c) => names(c).includes(t));
}

/** Name matches first (exact, prefix, anywhere), then words in the description; ties keep the runtime's order. */
function rankCommands(list: CommandEntry[], query: string): CommandEntry[] {
  if (!query) return list;
  const rank = (c: CommandEntry) => {
    const n = names(c);
    if (n.includes(query)) return 0;
    if (n.some((x) => x.startsWith(query))) return 1;
    if (n.some((x) => x.includes(query))) return 2;
    if (c.description?.toLowerCase().split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(query))) return 3;
    return -1;
  };
  return list
    .map((c, i) => ({ c, i, r: rank(c) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.c);
}

/** `/think [off|low|high]`, `/review [branch or PR]` */
export function usage(c: CommandEntry): string {
  const args = (c.args ?? []).map((a) => {
    const label = a.choices?.length && a.choices.length <= 4 ? a.choices.map((ch) => ch.value).join("|") : a.name;
    return a.required ? `<${label}>` : `[${label}]`;
  });
  return [`/${c.name}`, ...args].join(" ");
}
