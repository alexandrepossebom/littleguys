// Per-thread transcript state. History comes from chat.history; live updates
// come from three event streams for subscribed sessions:
//   session.message → a transcript entry was appended (user, assistant, tool result)
//   chat            → run status + streaming text for the reply in progress
//   agent           → tool start/end (needs the `tool-events` cap)
import { create } from "zustand";
import { chat as chatApi, sessions as sessionsApi } from "../lib/gateway";
import { errorMessage, listen } from "../lib/ipc";
import type { Attachment, ChatMessage } from "../lib/types";

export interface LiveRun {
  runId: string;
  text: string;
  phase: string | null;
  startedAt: number;
}

export type ToolState = "running" | "completed" | "error";

/** Threads are identified per gateway: `${gatewayId}|${sessionKey}`. */
export function threadId(gateway: string, key: string): string {
  return `${gateway}|${key}`;
}

function splitThreadId(id: string): [string, string] {
  const i = id.indexOf("|");
  return [id.slice(0, i), id.slice(i + 1)];
}

export interface ThreadState {
  /** threadId(gateway, sessionKey) */
  key: string;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  messages: ChatMessage[];
  hasMore: boolean;
  live: LiveRun | null;
  toolStatus: Record<string, ToolState>;
  /** Optimistic user messages not yet confirmed by session.message (`runId` once chat.send answers). */
  pending: Array<{ idempotencyKey: string; runId?: string; message: ChatMessage }>;
  sendError: string | null;
}

interface ChatState {
  threads: Record<string, ThreadState>;
  open(id: string): Promise<void>;
  reload(id: string): Promise<void>;
  /** `cwd`: folder for a thread's first message (ACP agents). */
  send(id: string, text: string, attachments: Attachment[], cwd?: string): Promise<void>;
  abort(id: string): Promise<void>;
  handleEvent(gateway: string, name: string, payload: Record<string, unknown>): void;
  resubscribe(gateway: string): void;
}

/**
 * How many of the newest pending messages wait for the reply in progress to end
 * (every runtime queues them until then). The one that started it doesn't wait.
 */
export function waitingCount(t: ThreadState | undefined): number {
  if (!t?.live || !t.pending.length) return 0;
  const first = t.pending[0];
  // Before chat.send answers, the run's first event can beat it; then it's ours if sent before the run began.
  const startedLive = first.runId ? first.runId === t.live.runId : (first.message.timestamp ?? 0) <= t.live.startedAt;
  return t.pending.length - (startedLive ? 1 : 0);
}

const blank = (key: string): ThreadState => ({
  key,
  loading: false,
  loaded: false,
  error: null,
  messages: [],
  hasMore: false,
  live: null,
  toolStatus: {},
  pending: [],
  sendError: null,
});

function messageId(m: ChatMessage): string | undefined {
  return m.__openclaw?.id;
}

function textOf(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const content = (message as ChatMessage).content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text" && typeof (b as { text?: unknown }).text === "string")
    .map((b) => b.text)
    .join("");
}

export const useChat = create<ChatState>((set, get) => {
  const patch = (key: string, fn: (t: ThreadState) => Partial<ThreadState>) =>
    set((s) => {
      const t = s.threads[key] ?? blank(key);
      return { threads: { ...s.threads, [key]: { ...t, ...fn(t) } } };
    });

  return {
    threads: {},

    async open(key) {
      const existing = get().threads[key];
      if (!existing) patch(key, () => ({}));
      const [gw, sessionKey] = splitThreadId(key);
      sessionsApi.subscribeMessages(gw, sessionKey).catch(() => {});
      if (!existing?.loaded) await get().reload(key);
    },

    async reload(key) {
      patch(key, () => ({ loading: true, error: null }));
      const [gw, sessionKey] = splitThreadId(key);
      try {
        const h = await chatApi.history(gw, sessionKey);
        patch(key, (t) => {
          const live =
            h.inFlightRun?.runId && !t.live
              ? { runId: h.inFlightRun.runId, text: textOf(h.inFlightRun.message), phase: null, startedAt: Date.now() }
              : t.live;
          return { loading: false, loaded: true, messages: h.messages ?? [], hasMore: Boolean(h.hasMore), live };
        });
      } catch (e) {
        patch(key, () => ({ loading: false, error: errorMessage(e) }));
      }
    },

    async send(key, text, attachments, cwd) {
      const idempotencyKey = crypto.randomUUID();
      const optimistic: ChatMessage = {
        role: "user",
        content: [
          ...(text ? [{ type: "text" as const, text }] : []),
          ...attachments
            .filter((a) => a.type === "image")
            .map((a) => ({ type: "image" as const, url: a.previewUrl, mimeType: a.mimeType })),
        ],
        timestamp: Date.now(),
      };
      patch(key, (t) => ({
        pending: [...t.pending, { idempotencyKey, message: optimistic }],
        sendError: null,
      }));
      const [gw, sessionKey] = splitThreadId(key);
      try {
        const res = await chatApi.send(gw, sessionKey, text, attachments, cwd);
        patch(key, (t) => ({
          // "ok": a slash command answered without starting a turn.
          live: t.live ?? (res.status === "ok" ? null : { runId: res.runId, text: "", phase: "sending", startedAt: Date.now() }),
          pending: t.pending.map((p) => (p.idempotencyKey === idempotencyKey ? { ...p, runId: res.runId } : p)),
        }));
      } catch (e) {
        patch(key, (t) => ({
          pending: t.pending.filter((p) => p.idempotencyKey !== idempotencyKey),
          sendError: errorMessage(e),
        }));
        throw e;
      }
    },

    async abort(key) {
      const live = get().threads[key]?.live;
      const [gw, sessionKey] = splitThreadId(key);
      await chatApi.abort(gw, sessionKey, live?.runId).catch(() => {});
    },

    handleEvent(gateway, name, payload) {
      const key = typeof payload.sessionKey === "string" ? threadId(gateway, payload.sessionKey) : null;
      if (!key || !get().threads[key]) return;

      if (name === "session.message") {
        const message = payload.message as ChatMessage | undefined;
        if (!message) return;
        patch(key, (t) => {
          const id = messageId(message);
          if (id && t.messages.some((m) => messageId(m) === id)) return {};
          const runId = (payload.runId as string | undefined) ?? message.__openclaw?.runId;
          let pending = t.pending;
          if (message.role === "user") {
            // Confirmed: drop the oldest optimistic entry (sends are serialized per thread).
            pending = t.pending.slice(1);
          }
          const live =
            message.role === "assistant" && t.live && runId === t.live.runId && textOf(message)
              ? { ...t.live, text: "" }
              : t.live;
          return { messages: [...t.messages, message], pending, live };
        });
        return;
      }

      if (name === "chat") {
        const state = payload.state as string;
        const runId = String(payload.runId ?? "");
        patch(key, (t) => {
          const live = t.live && t.live.runId === runId ? t.live : { runId, text: "", phase: null, startedAt: Date.now() };
          switch (state) {
            case "status":
              return { live: { ...live, phase: (payload.phase as string) ?? live.phase } };
            case "delta":
              return { live: { ...live, phase: null, text: textOf(payload.message) || live.text + String(payload.deltaText ?? "") } };
            case "final":
              return { live: null };
            case "aborted":
              return { live: null };
            case "error":
              return { live: null, sendError: (payload.errorMessage as string) || "The run failed." };
            default:
              return {};
          }
        });
        if (state === "final" || state === "error" || state === "aborted") {
          // Canonicalize (tool results, final text) after the run settles.
          setTimeout(() => get().reload(key), 250);
        }
        return;
      }

      if (name === "agent") {
        const data = (payload.data ?? {}) as Record<string, unknown>;
        if (data.kind !== "tool" && payload.stream !== "tool") return;
        const id = String(data.toolCallId ?? "");
        if (!id) return;
        const phase = data.phase as string;
        const status: ToolState =
          phase === "start" || phase === "update" ? "running" : data.isError || data.status === "failed" ? "error" : "completed";
        patch(key, (t) => ({ toolStatus: { ...t.toolStatus, [id]: status } }));
      }
    },

    resubscribe(gateway: string) {
      for (const key of Object.keys(get().threads)) {
        const [gw, sessionKey] = splitThreadId(key);
        if (gw !== gateway) continue;
        sessionsApi.subscribeMessages(gw, sessionKey).catch(() => {});
        get().reload(key);
      }
    },
  };
});

let wired = false;
export async function connectChatStore() {
  if (wired) return;
  wired = true;
  await listen<{ gateway: string; event: string; payload: Record<string, unknown> }>("gw:event", (frame) => {
    if (frame.event === "chat" || frame.event === "agent" || frame.event === "session.message") {
      useChat.getState().handleEvent(frame.gateway, frame.event, frame.payload ?? {});
    }
  });
  const lastPhase = new Map<string, string>();
  await listen<{ gatewayId: string; phase: string }>("gw:status", (status) => {
    const prev = lastPhase.get(status.gatewayId);
    if (status.phase === "connected" && prev && prev !== "connected") {
      useChat.getState().resubscribe(status.gatewayId);
    }
    lastPhase.set(status.gatewayId, status.phase);
  });
}
