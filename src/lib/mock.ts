// Fixture backend for running the UI in a plain browser (`pnpm dev`).
// Shapes mirror real gateway responses. Query params:
//   ?phase=pairing|offline|no-config   previews the Doctor (no gateway connected)
//   ?single=1                          one gateway only
//   ?empty=1                           connected, but no guys yet
import type { Backend } from "./ipc";
import type { ChatMessage, ConnStatus, DiscoveredGateway, DoctorReport, GatewayRoster, Roster } from "./types";

const params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
const listeners = new Map<string, Set<(p: unknown) => void>>();
const emit = (event: string, payload: unknown) => listeners.get(event)?.forEach((cb) => cb(payload));
const now = Date.now();
const min = 60_000;
const forcedPhase = params.get("phase") as ConnStatus["phase"] | null;

function status(id: string, name: string, url: string, phase: ConnStatus["phase"], extra: Partial<ConnStatus> = {}): ConnStatus {
  return {
    gatewayId: id,
    gatewayName: name,
    phase,
    mode: url.includes("127.0.0.1") ? "local" : "remote",
    url,
    message: phase === "offline" ? `can't reach ${url}` : null,
    detailCode: null,
    requestId: phase === "pairing" ? "pr_7Hq2kLx9" : null,
    deviceId: "fe812c12f3ab4ce6ac5db69ac352f906cb1b11ef43fb33e252ef7ff552263889",
    serverVersion: "2026.9.6",
    configVersion: "2026.9.6",
    configPath: "/Users/you/.openclaw/openclaw.json",
    scopes: ["operator.read", "operator.write", "operator.admin", "operator.approvals"],
    retryAtMs: null,
    credentialIssue: null,
    hello: { policy: { attachments: { maxBytes: 20 << 20, maxImageBytes: 6 << 20 } } },
    kind: "openclaw",
    capabilities: { manageGuys: true, routines: true, routinesLocal: false, approvals: true, threadActions: true, newThreads: true, attachments: true, models: true },
    ...extra,
  };
}

const agent = (gw: string, id: string, name: string, emoji: string, model: string) => ({
  id,
  name,
  identity: { name, emoji },
  workspace: `/Users/you/.openclaw/workspace-${id}`,
  model: { primary: model },
  _gw: gw,
});

function gateway(id: string, name: string, url: string, phase: ConnStatus["phase"], rest: Partial<GatewayRoster>): GatewayRoster {
  return {
    id,
    name,
    enabled: true,
    status: status(id, name, url, phase),
    loaded: phase === "connected",
    defaultAgentId: null,
    agents: [],
    sessions: [],
    running: [],
    approvals: [],
    ...rest,
  };
}

const attic = gateway("openclaw", "attic", "wss://attic.tail1234.ts.net", forcedPhase ?? "connected", {
  defaultAgentId: "main",
  agents: params.get("empty")
    ? []
    : ([agent("openclaw", "main", "Jefe", "🦆", "anthropic/claude-opus-5"), agent("openclaw", "fox", "Fox", "🦊", "anthropic/claude-sonnet-5")] as never),
  sessions: [
    { key: "agent:main:main", agentId: "main", kind: "direct", updatedAt: now - 3 * min, lastMessagePreview: "Booked! Table for 2 at 8pm, confirmation in your inbox.", unread: true },
    { key: "agent:main:dashboard:a1", agentId: "main", kind: "direct", label: "Japan trip", updatedAt: now - 2 * 60 * min, lastMessagePreview: "Here's a 10-day itinerary that keeps travel under 3h/day." },
    { key: "agent:main:slack:channel:C123", agentId: "main", kind: "group", displayName: "#eng-standup", updatedAt: now - 40 * min, lastMessagePreview: "Posted the daily summary." },
    { key: "agent:main:cron:job1:run:r1", agentId: "main", kind: "direct", label: "Morning briefing", updatedAt: now - 9 * 60 * min, lastMessagePreview: "Sunny, 24°. 3 meetings today." },
    { key: "agent:fox:main", agentId: "fox", kind: "direct", updatedAt: now - 1 * min, lastMessagePreview: "Pulling flight prices from 3 airlines…" },
  ] as never,
  running: ["agent:fox:main"],
});

const garage = gateway("gw-garage1", "garage-1", "wss://garage-1.tail1234.ts.net", "connected", {
  defaultAgentId: "main",
  agents: [agent("gw-garage1", "main", "Octo", "🐙", "openai/gpt-5.6-sol"), agent("gw-garage1", "turtle", "Turtle", "🐢", "ollama/qwen3")] as never,
  sessions: [
    { key: "agent:main:main", agentId: "main", kind: "direct", updatedAt: now - 26 * min, lastMessagePreview: "Done — PR is up: fix flaky auth test", unread: true },
    { key: "agent:main:dashboard:o2", agentId: "main", kind: "direct", label: "Refactor billing", updatedAt: now - 3 * 24 * 60 * min, lastMessagePreview: "I'd split it into three modules." },
    { key: "agent:turtle:main", agentId: "turtle", kind: "direct", updatedAt: now - 5 * 24 * 60 * min, lastMessagePreview: "Your plants were watered 🌱" },
  ] as never,
});

const shed = gateway("gw-shed", "shed", "wss://shed.tail1234.ts.net", "pairing", {});
const lab = gateway("gw-lab", "lab", "wss://lab.tail1234.ts.net", "offline", {});
lab.status = { ...lab.status, message: "can't reach wss://lab.tail1234.ts.net: HTTP error: 403 Forbidden" };

const hermes = gateway("hermes-1", "Hermes", "http://127.0.0.1:9119", "connected", {
  defaultAgentId: "default",
  agents: [agent("hermes-1", "default", "Hermes", "☤", "nous/hermes-4"), agent("hermes-1", "research", "Scout", "🔭", "openrouter/claude-opus-5")] as never,
  sessions: [
    { key: "agent:default:main", agentId: "default", kind: "direct", updatedAt: now - 15 * min, lastMessagePreview: "Your Telegram digest is ready." },
    { key: "agent:default:telegram:t1", agentId: "default", kind: "direct", displayName: "Telegram · Mom", updatedAt: now - 70 * min, lastMessagePreview: "Reminded her about Sunday lunch." },
  ] as never,
});
hermes.status = { ...hermes.status, kind: "hermes", capabilities: { ...hermes.status.capabilities, manageGuys: false, attachments: false, models: false } };

const claude = gateway("acp-claude", "Claude Code", "npx -y @agentclientprotocol/claude-agent-acp", "connected", {
  defaultAgentId: "bot",
  agents: [{ id: "bot", name: "Claude", identity: { name: "Claude", emoji: "✳️" }, workspace: "/Users/you/dev/littleguy" }] as never,
  sessions: [{ key: "agent:bot:main", agentId: "bot", kind: "direct", updatedAt: now - 5 * min, lastMessagePreview: "Tests pass — 21/21." }] as never,
});
claude.status = {
  ...claude.status,
  kind: "acp",
  mode: null,
  capabilities: { manageGuys: false, routines: true, routinesLocal: true, approvals: true, threadActions: true, newThreads: true, attachments: true, models: false },
};

const roster: Roster = {
  gateways: forcedPhase ? [attic] : params.get("single") ? [attic] : [attic, garage, shed, lab, hermes, claude],
  hidden: ["hermes-1/research"],
  updatedAt: now,
};

const oc = (id: string, extra: object = {}) => ({ __openclaw: { id, ...extra } });

const history: Record<string, ChatMessage[]> = {
  "openclaw|agent:main:main": [
    { role: "user", content: "Can you find a nice Italian place near the office for Friday, 8pm, 2 people?", timestamp: now - 12 * min, ...oc("u1") },
    { role: "assistant", content: [{ type: "thinking", thinking: "**Searching restaurants near the office**" }, { type: "toolCall", id: "t1", name: "web_search", arguments: { query: "best italian restaurant near Rua Augusta São Paulo" } }], timestamp: now - 11 * min, ...oc("a1") },
    { role: "toolResult", toolCallId: "t1", toolName: "web_search", isError: false, content: [{ type: "text", text: "1. Trattoria Nonna — 4.7★\n2. Osteria del Ponte — 4.6★\n3. Piccolo — 4.5★" }], ...oc("r1") },
    { role: "assistant", content: [{ type: "toolCall", id: "t2", name: "browser", arguments: { url: "https://trattorianonna.example/reservations" } }], timestamp: now - 10 * min, ...oc("a2") },
    { role: "toolResult", toolCallId: "t2", toolName: "browser", isError: false, content: [{ type: "text", text: "Reservation form: Friday 20:00 available for 2." }], ...oc("r2") },
    {
      role: "assistant",
      content: [{ type: "text", text: "Booked! 🍝\n\n**Trattoria Nonna** — Friday at **8:00 PM**, table for 2.\n\n- 4.7★, ~6 min walk from the office\n- Confirmation is in your inbox\n\nWant me to add it to your calendar?" }],
      timestamp: now - 3 * min,
      ...oc("a3"),
    },
  ],
  "gw-garage1|agent:main:main": [
    { role: "user", content: "the auth test keeps flaking on CI, can you take a look?", timestamp: now - 50 * min, ...oc("u1") },
    { role: "assistant", content: [{ type: "toolCall", id: "x1", name: "exec", arguments: { command: "pnpm test auth --repeat 20" } }], timestamp: now - 45 * min, ...oc("a1") },
    { role: "toolResult", toolCallId: "x1", toolName: "exec", isError: false, content: [{ type: "text", text: "3 of 20 runs failed: token expiry race in session.spec.ts:42" }], ...oc("r1") },
    { role: "assistant", content: [{ type: "text", text: "Found it — the test creates a token with a **1s expiry** and then awaits a network call, so it races on slow CI boxes.\n\n```ts\n// before\nconst token = sign(user, { expiresIn: '1s' })\n// after\nconst token = sign(user, { expiresIn: '1m' })\nvi.useFakeTimers()\n```\n\nDone — PR is up: _fix flaky auth test_." }], timestamp: now - 26 * min, ...oc("a2") },
  ],
};

const doctor: DoctorReport = {
  mode: forcedPhase === "no-config" ? "local" : "remote",
  configPath: "/Users/you/.openclaw/openclaw.json",
  configExists: forcedPhase !== "no-config",
  configVersion: "2026.9.6",
  cliPath: "/opt/homebrew/bin/openclaw",
  cliVersion: "2026.9.4",
  cliProblem: null,
  gatewayUrl: attic.status.url,
  gatewayHealthy: false,
  serviceInstalled: true,
  service: { loaded: true, running: false, pid: null, lastExitCode: 78 },
  connected: attic.status.phase === "connected",
  issues:
    forcedPhase === "no-config"
      ? [{ id: "no-config", title: "OpenClaw hasn't been set up yet", detail: "Pick an AI provider and littleguys will set up a local gateway for you.", fix: "onboard" }]
      : forcedPhase === "offline"
        ? [{ id: "cli-outdated", title: "OpenClaw needs an update", detail: "Your OpenClaw data was last written by 2026.9.6 but the installed CLI is 2026.9.4, so the gateway refuses to start.", fix: "update" }]
        : [],
  logTail: null,
};

const discovered: DiscoveredGateway[] = [
  { name: "attic", url: "wss://attic.tail1234.ts.net", via: "tailscale", host: "attic.tail1234.ts.net", addedAs: "openclaw" },
  { name: "garage-1", url: "wss://garage-1.tail1234.ts.net", via: "tailscale", host: "garage-1.tail1234.ts.net", addedAs: "gw-garage1" },
  { name: "shed", url: "wss://shed.tail1234.ts.net", via: "tailscale", host: "shed.tail1234.ts.net", addedAs: "gw-shed" },
  { name: "lab", url: "wss://lab.tail1234.ts.net", via: "tailscale", host: "lab.tail1234.ts.net", addedAs: "gw-lab" },
  { name: "studio", url: "ws://studio.local:18789", via: "bonjour", host: "studio.local", addedAs: null },
];

function streamReply(gateway: string, sessionKey: string, text: string) {
  const runId = crypto.randomUUID();
  const reply = `You said: “${text}”. On it! 🫡\n\nThis is the mock backend — run \`pnpm tauri dev\` to talk to a real gateway.`;
  const ev = (event: string, payload: object) => emit("gw:event", { gateway, event, payload: { sessionKey, ...payload } });
  ev("session.message", { message: { role: "user", content: text, timestamp: Date.now(), ...oc(crypto.randomUUID()) } });
  ev("chat", { runId, state: "status", phase: "starting_model" });
  let i = 0;
  const words = reply.split(" ");
  const tick = setInterval(() => {
    i += 2;
    ev("chat", { runId, state: "delta", message: { role: "assistant", content: [{ type: "text", text: words.slice(0, i).join(" ") }] } });
    if (i >= words.length) {
      clearInterval(tick);
      const message = { role: "assistant", content: [{ type: "text", text: reply }], timestamp: Date.now(), ...oc(crypto.randomUUID(), { runId }) };
      (history[`${gateway}|${sessionKey}`] ??= []).push(
        { role: "user", content: text, timestamp: Date.now(), ...oc(crypto.randomUUID()) },
        message as ChatMessage,
      );
      ev("session.message", { runId, message });
      ev("chat", { runId, state: "final", message });
    }
  }, 90);
  return { runId, status: "started" };
}

async function gwCall(gateway: string, method: string, p: Record<string, unknown>): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 120));
  switch (method) {
    case "chat.history":
      return { sessionKey: p.sessionKey, messages: history[`${gateway}|${p.sessionKey}`] ?? [], hasMore: false };
    case "chat.send":
      return streamReply(gateway, String(p.sessionKey), String(p.message));
    case "sessions.create":
      return { ok: true, key: `agent:${p.agentId}:dashboard:${crypto.randomUUID()}` };
    case "cron.list":
      return {
        jobs:
          gateway === "openclaw" && p.agentId === "main"
            ? [
                { id: "job1", name: "Morning briefing", agentId: "main", enabled: true, schedule: { kind: "cron", expr: "0 8 * * 1-5", tz: "America/Sao_Paulo" }, payload: { kind: "agentTurn", message: "Weather, calendar and anything I asked you to watch." }, sessionTarget: "isolated", lastRunStatus: "ok", nextRunAtMs: now + 14 * 60 * min },
                { id: "job2", name: "Check flight prices", agentId: "main", enabled: false, schedule: { kind: "every", everyMs: 4 * 3_600_000 }, payload: { kind: "agentTurn", message: "Check GRU→NRT prices for March and tell me if anything drops under $900." }, sessionTarget: "isolated", lastRunStatus: "error" },
                { id: "sys1", name: "skill-collection-review-main", displayName: "Skill collection review (main)", declarationKey: "skill-collection-review:main", agentId: "main", enabled: true, schedule: { kind: "every", everyMs: 604_800_000 }, payload: { kind: "systemEvent", text: "" }, sessionTarget: "isolated" },
              ]
            : [],
        total: 3,
      };
    case "cron.runs":
      return { entries: [{ ts: now - 9 * 60 * min, runAtMs: now - 9 * 60 * min, jobId: p.jobId, status: "ok", summary: "Sunny, 24°. 3 meetings today.", sessionKey: "agent:main:cron:job1:run:r1" }], total: 1 };
    case "models.list":
      return { models: [{ id: "claude-opus-5", name: "Claude Opus 5", provider: "anthropic" }, { id: "claude-sonnet-5", name: "Claude Sonnet 5", provider: "anthropic" }, { id: "gpt-5.6-sol", name: "GPT-5.6 Sol", provider: "openai" }] };
    case "agents.files.get":
      return { agentId: p.agentId, workspace: "", file: { name: p.name, content: "# SOUL.md\n", hash: "x" } };
    default:
      return { ok: true };
  }
}

export const mockBackend: Backend = {
  async invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    switch (cmd) {
      case "gw_statuses":
        return roster.gateways.map((g) => g.status) as T;
      case "get_roster":
      case "refresh_roster":
        return roster as T;
      case "gw_call":
        return (await gwCall(String(args?.gateway), String(args?.method), (args?.params ?? {}) as Record<string, unknown>)) as T;
      case "doctor_check":
        return doctor as T;
      case "set_guy_hidden": {
        const uid = String(args?.uid);
        roster.hidden = args?.hidden ? [...new Set([...roster.hidden, uid])] : roster.hidden.filter((u) => u !== uid);
        emit("lg:roster", { ...roster, hidden: [...roster.hidden] });
        return undefined as T;
      }
      case "acp_registry":
        await new Promise((r) => setTimeout(r, 500));
        return [
          { id: "claude-acp", name: "Claude Code", description: "Anthropic's coding agent", version: "0.85.1", command: "npx", args: ["-y", "@agentclientprotocol/claude-agent-acp"], env: {} },
          { id: "codex-acp", name: "Codex", description: "OpenAI's coding agent", version: "0.41.0", command: "npx", args: ["-y", "@agentclientprotocol/codex-acp"], env: {} },
          { id: "gemini", name: "Gemini CLI", description: "Google's agent in your terminal", version: "0.9.0", command: "npx", args: ["-y", "@google/gemini-cli", "--acp"], env: {} },
          { id: "goose", name: "Goose", description: "Open-source agent from the AAIF", version: "1.52.0", command: "goose", args: ["acp"], env: {} },
        ] as T;
      case "hermes_detect":
        await new Promise((r) => setTimeout(r, 600));
        return [{ url: "http://127.0.0.1:9119", version: "0.21.5", mode: "local", authRequired: false }] as T;
      case "bot_add": {
        const kind = String(args?.kind);
        const acp = args?.acp as { agentName?: string } | null;
        const name = (args?.name as string) || acp?.agentName || "Hermes";
        const id = `${kind}-${Date.now()}`;
        const g = gateway(id, name, kind === "acp" ? "stdio" : "http://127.0.0.1:9119", "connecting", {});
        g.status = { ...g.status, kind: kind as "acp" | "hermes" };
        roster.gateways.push(g);
        emit("lg:roster", { ...roster, gateways: [...roster.gateways] });
        setTimeout(() => {
          g.status = { ...g.status, phase: "connected" };
          g.loaded = true;
          g.agents = [{ id: "bot", name, identity: { name, emoji: "🤖" } }] as never;
          emit("lg:roster", { ...roster, gateways: [...roster.gateways] });
        }, 1200);
        return { id, name, url: null, enabled: true, addedAtMs: Date.now(), kind } as T;
      }
      case "gateway_remove": {
        roster.gateways = roster.gateways.filter((g) => g.id !== args?.id);
        for (const d of discovered) if (d.addedAs === args?.id) d.addedAs = null;
        emit("lg:roster", { ...roster, gateways: [...roster.gateways] });
        return undefined as T;
      }
      case "gateways_discover":
        await new Promise((r) => setTimeout(r, 900));
        return discovered as T;
      case "gateway_add": {
        const url = String(args?.url);
        const name = (args?.name as string) || url.replace(/^wss?:\/\//, "").split(".")[0];
        const id = `gw-${name}`;
        const g = gateway(id, name, url, "connecting", {});
        roster.gateways.push(g);
        emit("lg:roster", { ...roster });
        setTimeout(() => {
          g.status = status(id, name, url, "pairing");
          emit("lg:roster", { ...roster, gateways: [...roster.gateways] });
        }, 1200);
        return { id, name, url, enabled: true, addedAtMs: Date.now() } as T;
      }
      default:
        return undefined as T;
    }
  },
  async listen<T>(event: string, cb: (payload: T) => void) {
    const set = listeners.get(event) ?? new Set();
    set.add(cb as (p: unknown) => void);
    listeners.set(event, set);
    return () => set.delete(cb as (p: unknown) => void);
  },
};
