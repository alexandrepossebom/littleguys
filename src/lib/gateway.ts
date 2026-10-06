// Typed wrappers for the gateway methods littleguys uses. Every call names the
// gateway it goes to (`gw` = gateway id).
import { gwCall } from "./ipc";
import type { AgentSummary, Attachment, ChatMessage, CronJob, CronRunLogEntry, ModelChoice, SessionRow } from "./types";

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export const agents = {
  list: (gw: string) => gwCall<{ defaultId: string; agents: AgentSummary[] }>(gw, "agents.list"),
  create: (gw: string, p: { name: string; model?: string; emoji?: string; avatar?: string }) =>
    gwCall<{ ok: boolean; agentId: string; name: string; workspace: string }>(gw, "agents.create", p),
  update: (gw: string, p: { agentId: string; name?: string; model?: string | null; emoji?: string; avatar?: string }) =>
    gwCall<{ ok: boolean }>(gw, "agents.update", p),
  remove: (gw: string, agentId: string, deleteFiles: boolean) =>
    gwCall<{ ok: boolean }>(gw, "agents.delete", { agentId, deleteFiles }),
  getFile: (gw: string, agentId: string, name: string) =>
    gwCall<{ agentId: string; workspace: string; file: { name: string; content?: string; hash?: string; missing?: boolean } }>(
      gw,
      "agents.files.get",
      { agentId, name },
    ),
  setFile: (gw: string, agentId: string, name: string, content: string, expectedHash?: string) =>
    gwCall<{ ok: boolean }>(gw, "agents.files.set", { agentId, name, content, ...(expectedHash ? { expectedHash } : {}) }),
};

export const sessions = {
  create: (gw: string, agentId: string, label?: string) =>
    gwCall<{ ok: boolean; key: string; sessionId?: string }>(gw, "sessions.create", {
      agentId,
      idempotencyKey: newIdempotencyKey(),
      ...(label ? { label } : {}),
    }),
  patch: (
    gw: string,
    key: string,
    patch: { label?: string | null; pinned?: boolean; archived?: boolean; unread?: boolean },
    expectedSessionId?: string,
  ) => gwCall<SessionRow>(gw, "sessions.patch", { key, ...patch, ...(expectedSessionId ? { expectedSessionId } : {}) }),
  remove: (gw: string, key: string, expectedSessionId?: string) =>
    gwCall<{ ok: boolean }>(gw, "sessions.delete", {
      key,
      archivedOnly: true,
      deleteTranscript: true,
      ...(expectedSessionId ? { expectedSessionId } : {}),
    }),
  subscribeMessages: (gw: string, key: string) => gwCall<{ subscribed: boolean }>(gw, "sessions.messages.subscribe", { key }),
};

export interface ChatHistory {
  sessionKey: string;
  sessionId?: string;
  messages: ChatMessage[];
  hasMore?: boolean;
  nextOffset?: number;
  totalMessages?: number;
  sessionInfo?: SessionRow;
  inFlightRun?: { runId: string; message?: ChatMessage } | null;
}

export const chat = {
  history: (gw: string, sessionKey: string, limit = 200) =>
    gwCall<ChatHistory>(gw, "chat.history", { sessionKey, limit, maxChars: 40_000 }, 60_000),
  send: (gw: string, sessionKey: string, message: string, attachments: Attachment[] = []) =>
    gwCall<{ runId: string; status: string }>(
      gw,
      "chat.send",
      {
        sessionKey,
        message,
        idempotencyKey: newIdempotencyKey(),
        ...(attachments.length
          ? {
              attachments: attachments.map(({ type, mimeType, fileName, content, sizeBytes }) => ({
                type,
                mimeType,
                fileName,
                content,
                sizeBytes,
              })),
            }
          : {}),
      },
      120_000,
    ),
  abort: (gw: string, sessionKey: string, runId?: string) =>
    gwCall(gw, "chat.abort", { sessionKey, ...(runId ? { runId } : {}) }),
};

export const artifacts = {
  download: (gw: string, sessionKey: string, artifactId: string) =>
    gwCall<{ url?: string; encoding?: string; data?: string; artifact?: { mimeType?: string } }>(gw, "artifacts.download", {
      sessionKey,
      artifactId,
    }),
};

export const models = {
  list: (gw: string, agentId?: string) =>
    gwCall<{ models: ModelChoice[] }>(gw, "models.list", { view: "configured", ...(agentId ? { agentId } : {}) }),
};

export const cron = {
  list: (gw: string, agentId?: string) =>
    gwCall<{ jobs: CronJob[]; total: number }>(gw, "cron.list", {
      includeDisabled: true,
      limit: 200,
      ...(agentId ? { agentId } : {}),
    }),
  add: (gw: string, job: Record<string, unknown>) => gwCall<CronJob>(gw, "cron.add", job),
  update: (gw: string, id: string, patch: Record<string, unknown>) => gwCall<CronJob>(gw, "cron.update", { id, patch }),
  remove: (gw: string, id: string) => gwCall(gw, "cron.remove", { id }),
  run: (gw: string, id: string) => gwCall<{ ok: boolean; runId?: string }>(gw, "cron.run", { id, mode: "force" }),
  runs: (gw: string, jobId: string, limit = 20) =>
    gwCall<{ entries: CronRunLogEntry[]; total: number }>(gw, "cron.runs", { jobId, limit, sortDir: "desc" }),
};

export const config = {
  get: (gw: string) =>
    gwCall<{ hash?: string; config?: Record<string, unknown>; parsed?: Record<string, unknown> } & Record<string, unknown>>(
      gw,
      "config.get",
    ),
  patch: (gw: string, raw: object, baseHash?: string, note?: string) =>
    gwCall<{ changedPaths?: string[] }>(gw, "config.patch", {
      raw: JSON.stringify(raw),
      ...(baseHash ? { baseHash } : {}),
      ...(note ? { note } : {}),
    }),
};

export const approvals = {
  resolve: (gw: string, id: string, decision: "allow-once" | "allow-always" | "deny") =>
    gwCall(gw, "exec.approval.resolve", { id, decision }),
};
