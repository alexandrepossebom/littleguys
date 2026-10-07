// The Skills tab: what a guy can do (skills, slash commands, tools, plugins,
// MCP servers). List in the sidebar, details in the main pane. Read-only.
import { Blocks, ChevronRight, RotateCw, Search, Server, Slash, Sparkles, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type Ability, type AbilitySection, readSkill, stripFrontMatter, useAbilities } from "../lib/abilities";
import { guyHue, guyName } from "../lib/guys";
import { errorMessage } from "../lib/ipc";
import type { Guy, McpServer, PluginEntry, SkillEntry, ToolEntry } from "../lib/types";
import { useApp } from "../stores/app";
import { Markdown } from "../ui/Markdown";
import { IconButton, Spinner } from "../ui/kit";

const KIND_ICON: Record<Ability["kind"], typeof Sparkles> = {
  skill: Sparkles,
  command: Slash,
  tool: Wrench,
  plugin: Blocks,
  mcp: Server,
};

const KIND_LABEL: Record<Ability["kind"], string> = {
  skill: "Skill",
  command: "Slash command",
  tool: "Tool",
  plugin: "Plugin",
  mcp: "MCP server",
};

const STATUS: Record<Ability["status"], { label: string; text: string; dot: string }> = {
  ready: { label: "Ready", text: "text-[var(--color-ok)]", dot: "bg-[var(--color-ok)]" },
  off: { label: "Off", text: "text-[var(--color-ink-3)]", dot: "bg-[var(--color-ink-3)]" },
  "needs-setup": { label: "Needs setup", text: "text-[#c77700] dark:text-[var(--color-warn)]", dot: "bg-[var(--color-warn)]" },
  error: { label: "Error", text: "text-[var(--color-bad)]", dot: "bg-[var(--color-bad)]" },
};

const SECTION_HINT: Partial<Record<AbilitySection["id"], string>> = {
  skills: "Know-how they pull in when a task calls for it",
  commands: "Shortcuts you can type in a chat",
  tools: "Things they can reach for while working",
  plugins: "Add-ons installed on their gateway",
  mcp: "Outside services they're connected to",
};

function useGuyAbilities(guy: Guy) {
  const state = useAbilities((s) => s.byGuy[guy.uid]);
  const load = useAbilities((s) => s.load);
  const ready = useApp((s) => s.roster.gateways.some((g) => g.id === guy.gatewayId && g.status.phase === "connected"));
  useEffect(() => {
    if (ready) load(useApp.getState().roster, guy);
  }, [ready, guy, load]);
  return { ...state, reload: () => load(useApp.getState().roster, guy, true) };
}

function Tile({ ability, size = 20 }: { ability: Ability; size?: number }) {
  const Icon = KIND_ICON[ability.kind];
  return (
    <span
      className="flex shrink-0 items-center justify-center bg-[var(--guy-wash-strong)] text-[var(--guy-ink)]"
      style={{ width: size, height: size, borderRadius: size > 30 ? 14 : 6 }}
    >
      {ability.emoji ? (
        <span style={{ fontSize: size * 0.6, lineHeight: 1 }}>{ability.emoji}</span>
      ) : (
        <Icon size={size * 0.55} strokeWidth={2.2} />
      )}
    </span>
  );
}

/** Sidebar: searchable, sectioned list. */
export function AbilityList({ guy }: { guy: Guy }) {
  const { sections, loading, error, reload } = useGuyAbilities(guy);
  const selected = useApp((s) => s.abilityByGuy[guy.uid]);
  const selectAbility = useApp((s) => s.selectAbility);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ tools: true });

  // Open the first thing when nothing is picked yet.
  useEffect(() => {
    if (selected || !sections) return;
    const first = sections.find((s) => s.items.length)?.items[0];
    if (first) selectAbility(first.id);
  }, [sections, selected, selectAbility]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      (sections ?? []).map((s) => ({
        ...s,
        items: q ? s.items.filter((a) => [a.name, a.description, a.group].some((v) => v?.toLowerCase().includes(q))) : s.items,
      })),
    [sections, q],
  );

  return (
    <div className="guy-themed flex min-h-0 flex-1 flex-col" style={{ ["--guy-h" as string]: guyHue(guy.id) }}>
      <div className="flex items-center justify-between pl-4 pr-2.5">
        <h3 className="font-display text-[13px] font-semibold">What {guyName(guy)} can do</h3>
        <IconButton label="Refresh" onClick={reload} disabled={loading}>
          <RotateCw size={12} className={loading ? "animate-spin" : ""} />
        </IconButton>
      </div>
      <div className="px-3 pb-2 pt-1">
        <label className="flex h-8 items-center gap-2 rounded-lg bg-[var(--color-chip)] px-2.5 focus-within:ring-2 focus-within:ring-[var(--color-accent)]/30">
          <Search size={13} className="shrink-0 text-[var(--color-ink-3)]" />
          <input
            className="selectable min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-[var(--color-ink-3)]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills and tools"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {!sections && loading && (
          <div className="flex items-center gap-2 px-2 py-3 text-[12px] text-[var(--color-ink-3)]">
            <Spinner size={12} /> Asking {guy.gatewayName}
          </div>
        )}
        {error && <p className="px-2 py-2 text-[12px] text-[var(--color-bad)]">{error}</p>}
        {filtered.map((s) => {
          if (q && !s.items.length) return null;
          const isCollapsed = !q && collapsed[s.id];
          const notReady = s.items.filter((a) => a.status === "needs-setup" || a.status === "error").length;
          return (
            <section key={s.id} className="mt-2">
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [s.id]: !c[s.id] }))}
                className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left"
                title={SECTION_HINT[s.id]}
              >
                <span className="text-[12px] font-semibold text-[var(--color-ink-2)] group-hover:text-[var(--color-ink)]">{s.title}</span>
                <span className="rounded-full bg-[var(--color-chip)] px-1.5 text-[10.5px] font-medium tabular-nums text-[var(--color-ink-3)]">
                  {s.items.length}
                </span>
                {notReady > 0 && <span className="text-[10.5px] text-[var(--color-ink-3)]">{notReady} need setup</span>}
                <ChevronRight size={12} className={`ml-auto text-[var(--color-ink-3)] transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
              </button>
              {!isCollapsed && (
                <div className="mt-0.5">
                  {s.error && <p className="px-2 py-1 text-[11.5px] text-[var(--color-bad)]">{s.error}</p>}
                  {!s.error && !s.items.length && (
                    <p className="px-2 py-1 text-[11.5px] text-[var(--color-ink-3)]">{s.note ?? "None yet."}</p>
                  )}
                  {s.items.map((a) => {
                    const active = selected === a.id;
                    const st = STATUS[a.status];
                    return (
                      <button
                        key={a.id}
                        onClick={() => selectAbility(a.id)}
                        title={a.description}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-[5px] text-left transition-colors ${
                          active ? "bg-[var(--guy-wash-strong)]" : "hover:bg-[var(--color-chip)]"
                        } ${a.status === "off" && !active ? "opacity-55" : ""}`}
                      >
                        <Tile ability={a} />
                        <span className={`min-w-0 flex-1 truncate text-[12.5px] ${active ? "font-medium" : ""}`}>{a.name}</span>
                        {a.status !== "ready" ? (
                          <span className={`shrink-0 text-[10.5px] font-medium ${st.text}`}>{st.label}</span>
                        ) : a.kind === "tool" && a.group ? (
                          <span className="max-w-[42%] shrink-0 truncate text-[10.5px] text-[var(--color-ink-3)]">{a.group}</span>
                        ) : null}
                      </button>
                    );
                  })}
                  {s.note && s.items.length > 0 && !q && <p className="px-2 pt-1 text-[11px] text-[var(--color-ink-3)]">{s.note}</p>}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Main pane: everything we know about the selected item. */
export function SkillsView({ guy }: { guy: Guy }) {
  const { sections, loading } = useGuyAbilities(guy);
  const id = useApp((s) => s.abilityByGuy[guy.uid]);
  const ability = useMemo(() => sections?.flatMap((s) => s.items).find((a) => a.id === id), [sections, id]);

  if (!ability) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[var(--color-ink-3)]">
        {loading ? <Spinner size={18} /> : `Pick something ${guyName(guy)} can do.`}
      </div>
    );
  }
  return <AbilityDetail key={ability.id} guy={guy} ability={ability} />;
}

function AbilityDetail({ guy, ability: a }: { guy: Guy; ability: Ability }) {
  const gatewayName = useApp((s) => s.roster.gateways.find((g) => g.id === guy.gatewayId)?.name);
  const [doc, setDoc] = useState<{ content: string; path?: string } | null>(null);
  const [docState, setDocState] = useState<"idle" | "loading" | "none" | string>("idle");

  useEffect(() => {
    if (a.kind !== "skill") return;
    let cancelled = false;
    setDocState("loading");
    readSkill(useApp.getState().roster, guy, a)
      .then((d) => {
        if (cancelled) return;
        setDoc(d);
        setDocState(d ? "idle" : "none");
      })
      .catch((e) => !cancelled && setDocState(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [a, guy]);

  const skill = a.kind === "skill" || a.kind === "command" ? (a.raw as SkillEntry) : null;
  const tool = a.kind === "tool" ? (a.raw as ToolEntry) : null;
  const plugin = a.kind === "plugin" ? (a.raw as PluginEntry) : null;
  const server = a.kind === "mcp" ? (a.raw as McpServer) : null;
  const st = STATUS[a.status];
  const usage = skill?.usage;

  const facts: Array<[string, React.ReactNode]> = [];
  if (skill?.hint) facts.push(["Type", `${a.name} ${skill.hint}`]);
  if (typeof usage === "number") facts.push(["Used", `${usage} ${usage === 1 ? "time" : "times"}`]);
  else if (usage) facts.push(["Usage", usage]);
  if (skill?.category) facts.push(["Category", skill.category]);
  if (skill?.primaryEnv) facts.push(["Needs", skill.primaryEnv]);
  if (skill?.homepage) facts.push(["Homepage", skill.homepage]);
  if (doc?.path ?? skill?.filePath) facts.push(["File", doc?.path ?? skill?.filePath]);
  if (tool) facts.push(["Name", tool.id]);
  if (tool?.mcpServer) facts.push(["From server", tool.mcpServer]);
  if (tool?.pluginId) facts.push(["From plugin", tool.pluginId]);
  if (tool?.risk) facts.push(["Risk", tool.risk]);
  if (plugin) facts.push(["Id", plugin.id]);
  if (plugin?.version) facts.push(["Version", plugin.version]);
  if (plugin?.kind?.length) facts.push(["Kind", plugin.kind.join(", ")]);
  if (plugin && gatewayName) facts.push(["Installed on", `${gatewayName}, shared by every guy there`]);
  if (server?.transport) facts.push(["Connects over", server.transport]);
  if (server?.command) facts.push(["Runs", server.command]);
  if (server?.url) facts.push(["Address", server.url]);
  if (server?.status) facts.push(["Status", server.status]);
  if (server?.tools != null) facts.push(["Tools", Array.isArray(server.tools) ? server.tools.join(", ") || "None" : String(server.tools)]);
  if (a.source) facts.push(["From", a.source.replace(/this guy/i, guyName(guy))]);

  return (
    <div className="guy-themed h-full overflow-y-auto" style={{ ["--guy-h" as string]: guyHue(guy.id) }}>
      <header data-tauri-drag-region className="bg-[var(--guy-wash)] px-10 pb-7 pt-9">
        <div data-tauri-drag-region className="mx-auto flex max-w-[680px] items-start gap-4">
          <Tile ability={a} size={52} />
          <div data-tauri-drag-region className="min-w-0 flex-1 pt-0.5">
            <h1 className="selectable break-words font-display text-[22px] font-semibold leading-tight tracking-tight">{a.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px] text-[var(--color-ink-2)]">
              <span className="font-medium text-[var(--guy-ink)]">{KIND_LABEL[a.kind]}</span>
              {a.group && <span>in {a.group}</span>}
            </p>
          </div>
          <span
            className={`mt-1 flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-pane-solid)] px-2.5 py-1 text-[11.5px] font-medium shadow-sm ${st.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
            {st.label}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[680px] px-10 pb-16 pt-6">
        {a.description ? (
          <p className="selectable text-[15px] leading-relaxed">{a.description}</p>
        ) : (
          <p className="text-[13px] text-[var(--color-ink-3)]">No description.</p>
        )}

        {a.status !== "ready" && a.statusNote && (
          <div
            className={`mt-5 rounded-xl px-4 py-3 text-[13px] ${
              a.status === "error" ? "bg-[var(--color-bad)]/10" : a.status === "off" ? "bg-[var(--color-chip)]" : "bg-[var(--color-warn)]/12"
            }`}
          >
            <p className={`font-medium ${st.text}`}>{a.status === "needs-setup" ? "Before it can be used" : st.label}</p>
            <p className="mt-0.5 text-[var(--color-ink-2)]">{a.statusNote}</p>
            {skill?.install?.length ? (
              <>
                <ul className="mt-2 space-y-0.5 text-[12.5px] text-[var(--color-ink-2)]">
                  {skill.install.map((opt) => (
                    <li key={opt.id}>
                      {opt.label}
                      {!opt.label.toLowerCase().includes(opt.kind) && <span className="text-[var(--color-ink-3)]"> with {opt.kind}</span>}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11.5px] text-[var(--color-ink-3)]">Set it up from OpenClaw; littleguys only shows skills for now.</p>
              </>
            ) : null}
          </div>
        )}

        {facts.length > 0 && (
          <dl className="mt-7 grid grid-cols-[112px_1fr] gap-x-4 gap-y-2.5 border-t border-[var(--color-line)] pt-5">
            {facts.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-[12.5px] text-[var(--color-ink-3)]">{label}</dt>
                <dd className="selectable min-w-0 break-words text-[12.5px]">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {a.kind === "skill" && (
          <section className="mt-8 border-t border-[var(--color-line)] pt-6">
            <h2 className="mb-3 font-display text-[15px] font-semibold">Instructions</h2>
            {docState === "loading" ? (
              <Spinner size={14} />
            ) : doc ? (
              <div className="prose-doc">
                <Markdown text={stripFrontMatter(doc.content)} />
              </div>
            ) : (
              <p className="text-[12.5px] text-[var(--color-ink-3)]">
                {docState === "none"
                  ? `This skill's instructions live on ${gatewayName ?? "the gateway"} and can't be opened from here.`
                  : docState}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
