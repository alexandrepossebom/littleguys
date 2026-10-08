// What a guy can do — skills, slash commands, tools, plugins, MCP servers —
// gathered from whichever backend it lives on and flattened into one shape
// for the Skills tab. Read-only.
import { create } from "zustand";
import { mainSessionKey } from "../stores/app";
import { usage } from "./commands";
import { commands as commandsApi, config, mcp, plugins, skills, tools, workspace } from "./gateway";
import { capsOf, gatewayOf } from "./guys";
import { errorMessage } from "./ipc";
import type { CommandEntry, Guy, McpServer, PluginEntry, Roster, SkillEntry, ToolEntry, ToolGroup } from "./types";

export type AbilityKind = "skill" | "command" | "tool" | "plugin" | "mcp";
export type AbilityStatus = "ready" | "off" | "needs-setup" | "error";

export interface Ability {
  /** `${kind}:${key}`, unique per guy. */
  id: string;
  kind: AbilityKind;
  name: string;
  description?: string;
  emoji?: string;
  /** Where it comes from, in words. */
  source?: string;
  /** Tools: the group (toolset / plugin / MCP server) it belongs to. */
  group?: string;
  status: AbilityStatus;
  /** Why it isn't ready, in words. */
  statusNote?: string;
  raw: SkillEntry | ToolEntry | PluginEntry | McpServer;
  rawGroup?: ToolGroup;
}

export interface AbilitySection {
  id: "skills" | "commands" | "tools" | "plugins" | "mcp";
  title: string;
  items: Ability[];
  /** Shown instead of (or above) the items, e.g. "this agent doesn't publish its tools". */
  note?: string;
  error?: string;
}

const SOURCE_LABEL: Record<string, string> = {
  "openclaw-bundled": "Built into OpenClaw",
  "openclaw-managed": "Shared skills (~/.openclaw/skills)",
  "openclaw-workspace": "This guy's workspace",
  "openclaw-workshop": "Drafted by this guy",
  "openclaw-extra": "Extra folder or plugin",
  "openclaw-custodian": "OpenClaw custodian",
  "agents-skills-personal": "Personal (~/.agents/skills)",
  "agents-skills-project": "Workspace (.agents/skills)",
  personal: "Personal skills folder",
  project: "This guy's workspace",
  command: "Slash command",
  hub: "Skills hub",
  bundled: "Built in",
  external: "External folder",
  agent: "Made by this guy",
};

function sourceLabel(source?: string): string | undefined {
  if (!source) return undefined;
  return SOURCE_LABEL[source] ?? source.replace(/^openclaw-/, "").replace(/[-_]/g, " ");
}

function missingNote(missing?: SkillEntry["missing"]): string | undefined {
  if (!missing) return undefined;
  const labels: Record<string, string> = { bins: "programs", anyBins: "one of", env: "env vars", config: "settings", os: "OS" };
  const parts = Object.entries(missing)
    .filter(([, v]) => Array.isArray(v) && v.length)
    .map(([k, v]) => `${labels[k] ?? k}: ${(v as string[]).join(", ")}`);
  return parts.length ? `Missing ${parts.join("; ")}` : undefined;
}

function skillAbility(s: SkillEntry): Ability {
  const command = s.source === "command";
  const note = missingNote(s.missing);
  let status: AbilityStatus = "ready";
  let statusNote: string | undefined;
  if (s.disabled) [status, statusNote] = ["off", "Turned off"];
  else if (s.blockedByAllowlist || s.blockedByAgentFilter) [status, statusNote] = ["off", "Not enabled for this guy"];
  else if (note) [status, statusNote] = ["needs-setup", note];
  else if (s.eligible === false) [status, statusNote] = ["needs-setup", "Not usable right now"];
  return {
    id: `${command ? "command" : "skill"}:${s.skillKey ?? s.name}`,
    kind: command ? "command" : "skill",
    name: command && !s.name.startsWith("/") ? `/${s.name}` : s.name,
    description: s.description,
    emoji: s.emoji,
    source: sourceLabel(s.source),
    status,
    statusNote,
    raw: s,
  };
}

/** A `commands.list` entry, shown like the command rows `skills.status` used to carry. */
function commandAbility(c: CommandEntry): Ability {
  const hint = usage(c).slice(c.name.length + 2);
  return skillAbility({
    name: c.name,
    skillKey: `cmd:${c.name}`,
    description: c.description,
    source: "command",
    category: c.category,
    eligible: true,
    ...(hint ? { hint } : {}),
  });
}

const GROUP_SOURCE: Record<string, string> = { core: "Built in", plugin: "Plugin", channel: "Channel", mcp: "MCP server", toolset: "Toolset" };

function toolAbilities(groups: ToolGroup[]): Ability[] {
  return groups.flatMap((g) =>
    (g.tools ?? []).map((t) => ({
      id: `tool:${g.id}/${t.id}`,
      kind: "tool" as const,
      name: t.label || t.id,
      description: t.description,
      group: g.label || g.id,
      source: GROUP_SOURCE[t.source ?? g.source ?? ""] ?? t.source ?? g.source,
      status: (t.deniedBySession || g.enabled === false ? "off" : "ready") as AbilityStatus,
      statusNote: t.deniedBySession ? "Blocked in this chat" : g.enabled === false ? "Toolset turned off" : undefined,
      raw: t,
      rawGroup: g,
    })),
  );
}

function pluginAbility(p: PluginEntry): Ability {
  const status: AbilityStatus =
    p.state === "error" || p.error ? "error" : p.state === "needs-setup" ? "needs-setup" : p.enabled === false || p.state === "disabled" ? "off" : "ready";
  return {
    id: `plugin:${p.id}`,
    kind: "plugin",
    name: p.name || p.id,
    description: p.description,
    source: p.version ? `v${p.version}` : undefined,
    status,
    statusNote: p.error ?? (status === "off" ? "Turned off" : status === "needs-setup" ? "Needs setup" : undefined),
    raw: p,
  };
}

function mcpAbility(m: McpServer): Ability {
  const failed = m.status === "failed" || m.status === "error";
  return {
    id: `mcp:${m.name}`,
    kind: "mcp",
    name: m.name,
    description: m.url ?? m.command,
    source: m.source,
    status: m.enabled === false ? "off" : failed ? "error" : "ready",
    statusNote: m.enabled === false ? "Turned off" : failed ? "Not connected" : undefined,
    raw: m,
  };
}

/** OpenClaw keeps MCP servers in config (`mcp.servers`); show names and where they run, nothing else. */
async function openclawMcpServers(gw: string): Promise<McpServer[]> {
  const snapshot = await config.get(gw);
  const parsed = (snapshot.parsed ?? snapshot.config ?? {}) as { mcp?: { servers?: Record<string, Record<string, unknown>> } };
  return Object.entries(parsed.mcp?.servers ?? {}).map(([name, s]) => {
    const url = typeof s.url === "string" ? safeUrl(s.url) : undefined;
    const command = typeof s.command === "string" ? s.command.split("/").pop() : undefined;
    return {
      name,
      transport: url ? String(s.type ?? s.transport ?? "http") : "stdio",
      url,
      command,
      enabled: s.enabled !== false && s.disabled !== true,
      source: "OpenClaw config",
    };
  });
}

function safeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return raw.split("?")[0];
  }
}

async function section(
  id: AbilitySection["id"],
  title: string,
  load: () => Promise<Ability[]>,
  note?: string,
): Promise<AbilitySection> {
  try {
    return { id, title, items: await load(), note };
  } catch (e) {
    return { id, title, items: [], note, error: errorMessage(e) };
  }
}

export async function loadAbilities(roster: Roster, guy: Guy): Promise<AbilitySection[]> {
  const gw = guy.gatewayId;
  const caps = capsOf(roster, gw);
  const kind = gatewayOf(roster, gw)?.status.kind ?? "openclaw";
  const jobs: Array<Promise<AbilitySection | AbilitySection[]>> = [];

  if (caps.skills) {
    jobs.push(
      skills
        .status(gw, guy.id)
        .then((r) => {
          const all = (r.skills ?? []).map(skillAbility);
          const byStatus = (a: Ability, b: Ability) =>
            Number(a.status !== "ready") - Number(b.status !== "ready") || a.name.localeCompare(b.name);
          const out: AbilitySection[] = [{ id: "skills", title: "Skills", items: all.filter((a) => a.kind === "skill").sort(byStatus) }];
          // With `commands.list`, the Slash commands section comes from there (below).
          const commands = caps.commands ? [] : all.filter((a) => a.kind === "command").sort(byStatus);
          if (!caps.commands && (commands.length || kind === "acp"))
            out.push({
              id: "commands",
              title: "Slash commands",
              items: commands,
              note: commands.length ? undefined : "They show up once you've chatted with this agent.",
            });
          return out;
        })
        .catch((e) => ({ id: "skills" as const, title: "Skills", items: [], error: errorMessage(e) })),
    );
  }
  if (caps.commands) {
    jobs.push(
      section("commands", "Slash commands", async () => {
        const r = await commandsApi.list(gw, guy.id);
        // Skill-backed commands are already listed under Skills.
        return (r.commands ?? [])
          .filter((c) => c.source !== "skill")
          .map(commandAbility)
          .sort((a, b) => a.name.localeCompare(b.name));
      }).then((s) =>
        !s.items.length && !s.error && kind === "acp" ? { ...s, note: "They show up once you've chatted with this agent." } : s,
      ),
    );
  }
  if (caps.tools) {
    jobs.push(
      section("tools", "Tools", async () => {
        // What the guy can use in its main chat; the full catalog if that isn't available yet.
        const r = await tools.effective(gw, guy.id, mainSessionKey(guy.id)).catch(() => tools.catalog(gw, guy.id));
        return toolAbilities(r.groups ?? []);
      }),
    );
  } else if (kind === "acp") {
    jobs.push(Promise.resolve({ id: "tools", title: "Tools", items: [], note: "This agent doesn't publish its tool list." }));
  }
  if (caps.plugins) {
    jobs.push(
      plugins
        .list(gw)
        .then((r): AbilitySection => {
          // OpenClaw lists its whole catalog (hundreds, most bundled and off): show what's on or needs attention.
          const installed = (r.plugins ?? []).filter((p) => p.installed !== false && p.state !== "not-installed").map(pluginAbility);
          const shown = installed.filter((a) => a.status !== "off");
          const off = installed.length - shown.length;
          return { id: "plugins", title: "Plugins", items: shown, note: off ? `${off} more installed but turned off.` : undefined };
        })
        .catch((e) => ({ id: "plugins" as const, title: "Plugins", items: [], error: errorMessage(e) })),
    );
    jobs.push(
      section("mcp", "MCP servers", async () => {
        const servers = kind === "openclaw" ? await openclawMcpServers(gw) : (await mcp.servers(gw, guy.id)).servers ?? [];
        return servers.map(mcpAbility);
      }),
    );
  }
  return (await Promise.all(jobs)).flat();
}

/** SKILL.md for a skill, where the backend lets us read it (null otherwise). */
export async function readSkill(roster: Roster, guy: Guy, ability: Ability): Promise<{ content: string; path?: string } | null> {
  if (ability.kind !== "skill") return null;
  const skill = ability.raw as SkillEntry;
  const kind = gatewayOf(roster, guy.gatewayId)?.status.kind ?? "openclaw";
  if (kind !== "openclaw") {
    const r = await skills.read(guy.gatewayId, guy.id, skill.name);
    return { content: r.content, path: r.path };
  }
  // OpenClaw: only skills inside the guy's own workspace are readable remotely.
  const root = guy.workspace?.replace(/\/$/, "");
  if (!root || !skill.filePath?.startsWith(`${root}/`)) return null;
  const r = await workspace.get(guy.gatewayId, guy.id, skill.filePath.slice(root.length + 1));
  return r.file.encoding === "utf8" ? { content: r.file.content, path: skill.filePath } : null;
}

/** Drop a YAML front-matter block (it's shown as fields instead). */
export function stripFrontMatter(md: string): string {
  return md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

interface AbilitiesState {
  byGuy: Record<string, { sections: AbilitySection[] | null; loading: boolean; error?: string }>;
  load(roster: Roster, guy: Guy, force?: boolean): Promise<void>;
}

/** Shared by the Skills tab's list (sidebar) and detail (main pane). */
export const useAbilities = create<AbilitiesState>((set, get) => ({
  byGuy: {},
  load: async (roster, guy, force = false) => {
    const current = get().byGuy[guy.uid];
    if (current?.loading || (current?.sections && !force)) return;
    set((s) => ({ byGuy: { ...s.byGuy, [guy.uid]: { sections: current?.sections ?? null, loading: true } } }));
    try {
      const sections = await loadAbilities(roster, guy);
      set((s) => ({ byGuy: { ...s.byGuy, [guy.uid]: { sections, loading: false } } }));
    } catch (e) {
      set((s) => ({ byGuy: { ...s.byGuy, [guy.uid]: { sections: current?.sections ?? null, loading: false, error: errorMessage(e) } } }));
    }
  },
}));
