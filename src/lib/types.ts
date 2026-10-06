// Gateway protocol types come straight from OpenClaw's published package so
// the UI tracks the real wire format. littleguys-only shapes live below.
export type {
  AgentEvent,
  AgentSummary,
  ChatEvent,
  CronJob,
  CronRunLogEntry,
  ModelChoice,
  SessionRow,
} from "@openclaw/gateway-protocol";

import type { AgentSummary, SessionRow } from "@openclaw/gateway-protocol";

export type Phase =
  | "starting"
  | "connecting"
  | "connected"
  | "pairing"
  | "auth-failed"
  | "offline"
  | "no-config"
  | "error";

export type RuntimeKind = "openclaw" | "hermes" | "acp";

/** What a bot runtime can do; the UI hides the rest (see src-tauri/src/runtime/mod.rs). */
export interface Capabilities {
  manageGuys: boolean;
  routines: boolean;
  routinesLocal: boolean;
  approvals: boolean;
  threadActions: boolean;
  newThreads: boolean;
  attachments: boolean;
  models: boolean;
}

export interface ConnStatus {
  gatewayId: string;
  gatewayName: string;
  kind: RuntimeKind;
  capabilities: Capabilities;
  phase: Phase;
  mode: "local" | "remote" | null;
  url: string | null;
  message: string | null;
  detailCode: string | null;
  requestId: string | null;
  deviceId: string;
  serverVersion: string | null;
  configVersion: string | null;
  configPath: string;
  scopes: string[];
  retryAtMs: number | null;
  credentialIssue: string | null;
  hello: HelloSnapshot | null;
}

export interface HelloSnapshot {
  policy?: {
    maxPayload?: number;
    attachments?: { maxBytes?: number; maxImageBytes?: number };
  };
  snapshot?: { sessionDefaults?: { defaultAgentId?: string; mainSessionKey?: string } };
  features?: { methods?: string[] };
}

export interface ExecApproval {
  id?: string;
  approvalId?: string;
  agentId?: string;
  sessionKey?: string;
  command?: string;
  request?: { id?: string; command?: string; agentId?: string; sessionKey?: string; cwd?: string };
  presentation?: { commandText?: string; warningText?: string | null; allowedDecisions?: string[] };
  [key: string]: unknown;
}

/** One gateway's slice of the roster (see src-tauri/src/activity.rs). */
export interface GatewayRoster {
  id: string;
  name: string;
  enabled: boolean;
  status: ConnStatus;
  loaded: boolean;
  defaultAgentId: string | null;
  agents: AgentSummary[];
  sessions: SessionRow[];
  running: string[];
  approvals: ExecApproval[];
}

export interface Roster {
  gateways: GatewayRoster[];
  /** Guys hidden in Settings, as `gatewayId/agentId`. */
  hidden: string[];
  updatedAt: number;
}

/** A little guy = an OpenClaw agent on a particular gateway. */
export type Guy = AgentSummary & {
  gatewayId: string;
  gatewayName: string;
  /** `${gatewayId}/${agentId}` — unique across gateways. */
  uid: string;
};

export interface AcpConfig {
  transport: "stdio" | "websocket";
  command?: string | null;
  args: string[];
  env: Record<string, string>;
  url?: string | null;
  cwd?: string | null;
  agentName: string;
  emoji?: string | null;
  registryId?: string | null;
}

export interface HermesConfig {
  mode: "local" | "api";
  url?: string | null;
  profile?: string | null;
}

export interface GatewayEntry {
  id: string;
  name: string;
  url: string | null;
  enabled: boolean;
  addedAtMs: number;
  kind: RuntimeKind;
  acp?: AcpConfig;
  hermes?: HermesConfig;
}

export interface RegistryAgent {
  id: string;
  name: string;
  description: string;
  version: string;
  website?: string | null;
  icon?: string | null;
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface HermesProbe {
  url: string;
  version?: string | null;
  mode: "local" | "api";
  authRequired: boolean;
}

export interface DiscoveredGateway {
  name: string;
  url: string;
  via: "tailscale" | "bonjour";
  host: string;
  addedAs: string | null;
}

export interface Navigate {
  gatewayId?: string | null;
  agentId?: string | null;
  sessionKey?: string | null;
  view?: string | null;
}

/** A transcript message as returned by chat.history / chat events. */
export interface ChatMessage {
  role: "user" | "assistant" | "toolResult" | "system" | string;
  content: string | ContentBlock[];
  timestamp?: number;
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
  stopReason?: string;
  model?: string;
  __openclaw?: { id?: string; seq?: number; runId?: string; kind?: string };
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "toolCall"; id: string; name: string; arguments?: unknown }
  | {
      type: "image";
      url?: string;
      openUrl?: string;
      artifactId?: string;
      alt?: string;
      mimeType?: string;
      data?: string;
      source?: { type: string; media_type?: string; data?: string };
    }
  | { type: "attachment"; attachment: { artifactId?: string; url?: string; label?: string; mimeType?: string } }
  | { type: string; [key: string]: unknown };

export interface Attachment {
  type: "image" | "file";
  mimeType: string;
  fileName: string;
  content: string; // base64
  sizeBytes: number;
  previewUrl?: string;
}

export interface DoctorIssue {
  id: string;
  title: string;
  detail: string;
  fix: "install" | "update" | "start" | "onboard" | "pairing" | "credential" | null;
}

export interface DoctorReport {
  mode: "local" | "remote" | null;
  configPath: string;
  configExists: boolean;
  configVersion: string | null;
  cliPath: string | null;
  cliVersion: string | null;
  cliProblem: string | null;
  gatewayUrl: string | null;
  gatewayHealthy: boolean | null;
  serviceInstalled: boolean;
  service: { loaded: boolean; running: boolean; pid: number | null; lastExitCode: number | null };
  connected: boolean;
  issues: DoctorIssue[];
  logTail: string | null;
}
