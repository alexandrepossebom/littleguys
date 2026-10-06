import { Archive, ArrowDown, RotateCw } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { sessions as sessionsApi } from "../lib/gateway";
import { capsOf, channelName, guyName, isRunning, sessionRow, threadKind, threadTitle } from "../lib/guys";
import { core } from "../lib/ipc";
import type { Guy, SessionRow } from "../lib/types";
import { mainSessionKey, useApp } from "../stores/app";
import { threadId, useChat } from "../stores/chat";
import { Avatar, GuyMark } from "../ui/Avatar";
import { Button, IconButton, Spinner } from "../ui/kit";
import { Approvals } from "./Approvals";
import { Composer } from "./Composer";
import { toItems, Transcript } from "./Transcript";

export function ChatView({ guy, sessionKey }: { guy: Guy; sessionKey: string }) {
  const agent = guy;
  const gw = guy.gatewayId;
  const tid = threadId(gw, sessionKey);
  const row = useApp((s) => sessionRow(s.roster, gw, sessionKey));
  const rosterRunning = useApp((s) => isRunning(s.roster, gw, sessionKey));
  const thread = useChat((s) => s.threads[tid]);
  const { open, send, abort, reload } = useChat.getState();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);

  useEffect(() => {
    open(tid);
  }, [open, tid]);

  // Opening a thread reads it.
  useEffect(() => {
    if (row?.unread) {
      sessionsApi.patch(gw, sessionKey, { unread: false }).then(() => core.refreshRoster(gw)).catch(() => {});
    }
  }, [row?.unread, gw, sessionKey]);

  const pendingMessages = useMemo(() => thread?.pending.map((p) => p.message) ?? [], [thread?.pending]);
  const items = useMemo(() => toItems(thread?.messages ?? [], pendingMessages), [thread?.messages, pendingMessages]);
  const live = thread?.live ?? null;
  const running = Boolean(live) || rosterRunning;

  // Stay pinned to the bottom while new content streams in, unless the user scrolled up.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [items.length, live?.text, live?.phase, thread?.loaded]);

  // Images, videos and code blocks finish laying out after the first render;
  // keep the newest message in view while they do (unless the user scrolled up).
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const ro = new ResizeObserver(() => {
      if (stickToBottom.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  const kind = threadKind(sessionKey);
  const title = row ? threadTitle(row) : kind === "main" ? "Main chat" : "Chat";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader
        title={title}
        row={row}
        gatewayId={gw}
        agentId={guy.id}
        threadKey={tid}
        sessionKey={sessionKey}
        agentName={guyName(agent)}
        running={running}
      />
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          stickToBottom.current = atBottom;
          setShowJump(!atBottom);
        }}
        className="relative min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2"
      >
        {!thread?.loaded && thread?.loading && (
          <div className="flex h-full items-center justify-center">
            <Spinner size={18} />
          </div>
        )}
        {thread?.error && (
          <div className="mx-auto mt-10 max-w-sm text-center">
            <p className="text-[var(--color-bad)]">{thread.error}</p>
            <Button className="mt-3" onClick={() => reload(tid)}>
              <RotateCw size={13} /> Try again
            </Button>
          </div>
        )}
        {thread?.loaded && items.length === 0 && !live && (
          <div className="flex h-full flex-col items-center justify-center pb-10 text-center">
            <Avatar agent={agent} size={72} ring="idle" />
            <p className="mt-3 font-display text-[15px] font-semibold">Say hi to {guyName(agent)}</p>
            <p className="mt-1 max-w-xs text-[12.5px] text-[var(--color-ink-3)]">
              {kind === "main"
                ? "This is your main chat. Ask for anything — research, errands on the web, files, reminders."
                : "A fresh thread. Good for keeping one topic in one place."}
            </p>
          </div>
        )}
        <div ref={contentRef} className="mx-auto max-w-[860px]">
          <Transcript gatewayId={gw} sessionKey={sessionKey} items={items} agent={agent} live={live} toolStatus={thread?.toolStatus ?? {}} />
          {thread?.sendError && (
            <p className="mt-3 text-center text-[12px] text-[var(--color-bad)]">{thread.sendError}</p>
          )}
        </div>
      </div>
      {showJump && (
        <div className="relative">
          <button
            onClick={() => {
              const el = scrollRef.current;
              if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            }}
            className="absolute -top-12 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-pane-solid)] shadow-md"
            aria-label="Jump to latest"
          >
            <ArrowDown size={15} />
          </button>
        </div>
      )}
      <Approvals guy={guy} />
      <div className="mx-auto w-full max-w-[900px]">
        <Composer
          gatewayId={gw}
          draftKey={tid}
          placeholder={kind === "channel" ? `Reply in ${channelName(sessionKey) ?? "channel"} as ${guyName(agent)}…` : `Message ${guyName(agent)}…`}
          running={running}
          onSend={async (text, attachments) => {
            stickToBottom.current = true;
            await send(tid, text, attachments);
          }}
          onStop={() => abort(tid)}
        />
      </div>
    </div>
  );
}

function ChatHeader({
  title,
  row,
  gatewayId,
  agentId,
  threadKey,
  sessionKey,
  agentName,
  running,
}: {
  title: string;
  row?: SessionRow;
  gatewayId: string;
  agentId: string;
  threadKey: string;
  sessionKey: string;
  agentName: string;
  running: boolean;
}) {
  const kind = threadKind(sessionKey);
  const canArchive = useApp((s) => capsOf(s.roster, gatewayId).threadActions) && kind !== "main" && Boolean(row);
  const archive = async () => {
    await sessionsApi.patch(gatewayId, sessionKey, { archived: true }, row?.sessionId ?? undefined).catch(() => {});
    useApp.getState().selectSession(mainSessionKey(agentId));
    core.refreshRoster(gatewayId).catch(() => {});
  };
  const model = row?.model ? row.model.split("/").pop() : null;
  const subtitle =
    kind === "channel"
      ? `${channelName(sessionKey)} conversation · replies go out as ${agentName}`
      : kind === "routine"
        ? "Routine run"
        : model ?? "";
  return (
    <div data-tauri-drag-region className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--color-line)] px-5">
      <div data-tauri-drag-region className="min-w-0 flex-1">
        <h3 className="truncate text-[13.5px] font-semibold">{title}</h3>
        {subtitle && <p className="truncate text-[11px] text-[var(--color-ink-3)]">{subtitle}</p>}
      </div>
      {running && (
        <span className="flex items-center gap-1.5 rounded-full bg-[var(--color-accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-accent-strong)]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent)] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
          </span>
          working
        </span>
      )}
      {canArchive && (
        <IconButton label="Archive thread" onClick={archive}>
          <Archive size={13} />
        </IconButton>
      )}
      <IconButton label="Reload thread" onClick={() => useChat.getState().reload(threadKey)}>
        <RotateCw size={13} />
      </IconButton>
    </div>
  );
}

export function NoThread() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-[var(--color-ink-3)]">
      <GuyMark size={80} />
    </div>
  );
}
