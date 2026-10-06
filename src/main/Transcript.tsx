import {
  Brain,
  Check,
  ChevronRight,
  Clock,
  Download,
  File as FileIcon,
  FilePen,
  FileText,
  Film,
  Folder,
  Globe,
  ImageOff,
  Music,
  Search,
  Sparkles,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import { memo, useEffect, useState } from "react";
import { artifacts } from "../lib/gateway";
import { gatewayOf, shortTime } from "../lib/guys";
import { errorMessage } from "../lib/ipc";
import { cleanDirectives, extractMediaLines, type Item, type MediaRef, type ToolCallBlock, type ToolResult } from "../lib/transcript";
import type { AgentSummary } from "../lib/types";
export { toItems } from "../lib/transcript";
import { useApp } from "../stores/app";
import type { LiveRun, ToolState } from "../stores/chat";
import { Avatar } from "../ui/Avatar";
import { TypingDots } from "../ui/kit";
import { Markdown } from "../ui/Markdown";
import { openExternal } from "../ui/openExternal";

// ---- rendering --------------------------------------------------------------

export function Transcript({
  gatewayId,
  sessionKey,
  items,
  agent,
  live,
  toolStatus,
}: {
  gatewayId: string;
  sessionKey: string;
  items: Item[];
  agent: AgentSummary;
  live: LiveRun | null;
  toolStatus: Record<string, ToolState>;
}) {
  const rendered: React.ReactNode[] = [];
  let prevKind: string | null = null;
  let lastTs = 0;
  const where = { gatewayId, sessionKey };

  items.forEach((item) => {
    const side = item.kind === "user" ? `user:${item.sender ?? ""}` : item.kind === "note" ? null : "guy";
    const ts = "ts" in item && item.ts ? item.ts : 0;
    if (ts && lastTs && ts - lastTs > 30 * 60_000) {
      rendered.push(
        <div key={`ts-${item.id}`} className="py-2 text-center text-[11px] text-[var(--color-ink-3)]">
          {shortTime(ts)}
        </div>,
      );
      prevKind = null;
    }
    if (ts) lastTs = ts;
    const startsGroup = side !== prevKind;
    prevKind = side;

    if (item.kind === "user") {
      rendered.push(<UserBubble key={item.id} item={item} first={startsGroup} where={where} />);
    } else if (item.kind === "note") {
      rendered.push(
        <p
          key={item.id}
          className={`mx-auto my-2 max-w-[80%] text-center text-[11.5px] ${
            item.tone === "error" ? "text-[var(--color-bad)]" : "text-[var(--color-ink-3)]"
          }`}
        >
          {item.text}
        </p>,
      );
    } else {
      rendered.push(
        <GuyLine key={item.id} agent={agent} showAvatar={startsGroup}>
          {item.kind === "text" && (
            <div className="rounded-2xl rounded-tl-md bg-[var(--color-bubble-them)] px-3.5 py-2">
              <Markdown text={item.text} />
            </div>
          )}
          {item.kind === "thinking" && <Thinking text={item.text} />}
          {item.kind === "tool" && <ToolChip call={item.call} result={item.result} status={toolStatus[item.call.id]} />}
          {item.kind === "media" && <MediaView media={item.media} where={where} />}
        </GuyLine>,
      );
    }
  });

  if (live) {
    const startsGroup = prevKind !== "guy";
    rendered.push(
      <GuyLine key="live" agent={agent} showAvatar={startsGroup}>
        {live.text ? (
          <div className="rounded-2xl rounded-tl-md bg-[var(--color-bubble-them)] px-3.5 py-2">
            <Markdown text={extractMediaLines(cleanDirectives(live.text)).text} />
            <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-[var(--color-accent)]" />
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-[var(--color-bubble-them)] px-3.5 py-2.5 text-[var(--color-ink-3)]">
            <TypingDots />
            {live.phase && <span className="text-[11.5px]">{phaseLabel(live.phase)}</span>}
          </div>
        )}
      </GuyLine>,
    );
  }
  return <>{rendered}</>;
}

function phaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    sending: "sending…",
    preparing_workspace: "getting ready…",
    preparing_context: "reading up…",
    starting_model: "thinking…",
    queued: "waiting in line…",
  };
  return labels[phase] ?? phase.replace(/_/g, " ") + "…";
}

function GuyLine({ agent, showAvatar, children }: { agent: AgentSummary; showAvatar: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-2 pr-12 ${showAvatar ? "mt-3" : "mt-1"}`}>
      <div className="w-7 shrink-0">{showAvatar && <Avatar agent={agent} size={28} />}</div>
      <div className="min-w-0 max-w-[720px]">{children}</div>
    </div>
  );
}

type Where = { gatewayId: string; sessionKey: string };

const UserBubble = memo(function UserBubble({ item, first, where }: { item: Extract<Item, { kind: "user" }>; first: boolean; where: Where }) {
  return (
    <div className={`flex justify-end pl-16 ${first ? "mt-3" : "mt-1"} ${item.pending ? "opacity-60" : ""}`}>
      <div className="flex max-w-[640px] flex-col items-end gap-1">
        {first && item.sender && <span className="px-1 text-[11px] text-[var(--color-ink-3)]">{item.sender}</span>}
        {item.media.map((m, i) => (
          <MediaView key={i} media={m} where={where} />
        ))}
        {item.text && (
          <div className="bubble-me rounded-2xl rounded-tr-md bg-[var(--color-bubble-me)] px-3.5 py-2 text-white">
            <Markdown text={item.text} />
          </div>
        )}
      </div>
    </div>
  );
});

function Thinking({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const summary = text.replace(/\*\*/g, "").split("\n")[0].slice(0, 120);
  return (
    <button
      onClick={() => setOpen(!open)}
      className="flex max-w-full items-start gap-1.5 rounded-md px-1 py-0.5 text-left text-[12px] italic text-[var(--color-ink-3)] hover:text-[var(--color-ink-2)]"
    >
      <Sparkles size={12} className="mt-0.5 shrink-0" />
      <span className={open ? "selectable whitespace-pre-wrap not-italic" : "truncate"}>{open ? text : summary}</span>
    </button>
  );
}

// ---- tool chips ---------------------------------------------------------------

function toolIcon(name: string) {
  const n = name.toLowerCase();
  if (/(browser|web_fetch|fetch|navigate|open_url|web)/.test(n)) return <Globe size={13} />;
  if (/(search|grep|find|query|glob)/.test(n)) return <Search size={13} />;
  if (/(exec|bash|shell|command|run|process)/.test(n)) return <Terminal size={13} />;
  if (/(write|edit|patch|apply|create_file|replace)/.test(n)) return <FilePen size={13} />;
  if (/(^ls$|list|dir|tree)/.test(n)) return <Folder size={13} />;
  if (/(read|cat|view|file)/.test(n)) return <FileText size={13} />;
  if (/(memory|remember|recall)/.test(n)) return <Brain size={13} />;
  if (/(cron|schedule|automation|routine)/.test(n)) return <Clock size={13} />;
  return <Wrench size={13} />;
}

function toolSummary(call: ToolCallBlock): string {
  let args = (call.arguments ?? {}) as Record<string, unknown>;
  if (typeof call.arguments === "string") {
    try {
      args = JSON.parse(call.arguments);
    } catch {
      return call.arguments.slice(0, 80);
    }
  }
  const pick = ["url", "command", "cmd", "query", "path", "file_path", "filePath", "pattern", "description", "skill", "name", "text"]
    .map((k) => args[k])
    .find((v) => typeof v === "string" && v.trim()) as string | undefined;
  const subject = pick ? (Array.isArray(args.command) ? (args.command as string[]).join(" ") : pick) : "";
  const pretty = subject.replace(/^\/Users\/[^/]+/, "~").replace(/\s+/g, " ");
  return pretty.length > 80 ? `${pretty.slice(0, 77)}…` : pretty;
}

function ToolChip({ call, result, status }: { call: ToolCallBlock; result?: ToolResult; status?: ToolState }) {
  const [open, setOpen] = useState(false);
  const state: ToolState = result ? (result.isError ? "error" : "completed") : (status ?? "running");
  const summary = toolSummary(call);
  return (
    <div className="max-w-full">
      <button
        onClick={() => setOpen(!open)}
        className="group flex max-w-full items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-pane-solid)] py-1 pl-2 pr-2.5 text-[12px] text-[var(--color-ink-2)] transition hover:border-[var(--color-ink-3)]/40"
      >
        <span className="text-[var(--color-ink-3)]">{toolIcon(call.name)}</span>
        <span className="font-medium text-[var(--color-ink)]">{call.name}</span>
        {summary && <span className="truncate font-mono text-[11px] text-[var(--color-ink-3)]">{summary}</span>}
        {state === "running" ? (
          <TypingDots className="ml-0.5 text-[var(--color-accent)]" />
        ) : state === "error" ? (
          <X size={12} className="text-[var(--color-bad)]" />
        ) : (
          <Check size={12} className="text-[var(--color-ok)]" />
        )}
        <ChevronRight size={12} className={`opacity-40 transition ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="selectable mt-1.5 overflow-hidden rounded-lg border border-[var(--color-line)] text-[11.5px]">
          <pre className="max-h-40 overflow-auto bg-[var(--color-chip)] p-2.5 font-mono text-[var(--color-ink-2)]">
            {typeof call.arguments === "string" ? call.arguments : JSON.stringify(call.arguments ?? {}, null, 2)}
          </pre>
          {result && (
            <pre
              className={`max-h-64 overflow-auto whitespace-pre-wrap border-t border-[var(--color-line)] p-2.5 font-mono ${
                result.isError ? "text-[var(--color-bad)]" : "text-[var(--color-ink-2)]"
              }`}
            >
              {result.text.slice(0, 20_000) || "(no output)"}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ---- media & files ------------------------------------------------------------------

function gatewayHttpOrigin(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.replace(/^ws(s?):/, "http$1:")).origin;
  } catch {
    return null;
  }
}

type SessionArtifact = { id: string; type?: string; mimeType?: string; title?: string; fileName?: string; sizeBytes?: number };

/** Per-thread artifact index (to match `MEDIA:` file names to stored files). */
const artifactIndex = new Map<string, Promise<SessionArtifact[]>>();
function sessionArtifacts(gatewayId: string, sessionKey: string): Promise<SessionArtifact[]> {
  const key = `${gatewayId}|${sessionKey}`;
  let p = artifactIndex.get(key);
  if (!p) {
    p = import("../lib/ipc")
      .then(({ gwCall }) => gwCall<{ artifacts?: SessionArtifact[] }>(gatewayId, "artifacts.list", { sessionKey }))
      .then((r) => r.artifacts ?? [])
      .catch(() => []);
    artifactIndex.set(key, p);
    setTimeout(() => artifactIndex.delete(key), 60_000);
  }
  return p;
}

/** Short-lived download URLs, cached until they expire. */
const urlCache = new Map<string, { url: string; until: number }>();
async function resolveArtifactUrl(gatewayId: string, sessionKey: string, artifactId: string, origin: string | null): Promise<string> {
  const key = `${gatewayId}|${artifactId}`;
  const hit = urlCache.get(key);
  if (hit && hit.until > Date.now()) return hit.url;
  const res = await artifacts.download(gatewayId, sessionKey, artifactId);
  let url: string;
  if (res.data) url = `data:${res.artifact?.mimeType ?? "application/octet-stream"};base64,${res.data}`;
  else if (res.url) url = /^(https?:|data:|blob:)/.test(res.url) ? res.url : origin ? origin + res.url : res.url;
  else throw new Error("The gateway didn't return the file.");
  const expires = (res as { expiresAt?: string }).expiresAt;
  urlCache.set(key, { url, until: expires ? Date.parse(expires) - 15_000 : Date.now() + 120_000 });
  return url;
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function MediaView({ media, where }: { media: MediaRef; where: Where }) {
  const gateway = useApp((s) => gatewayOf(s.roster, where.gatewayId));
  const origin = gatewayHttpOrigin(gateway?.status.url);
  const [artifactId, setArtifactId] = useState<string | undefined>(media.artifactId);
  const [src, setSrc] = useState<string | null>(() => {
    if (media.data) return media.data.startsWith("data:") ? media.data : `data:${media.mimeType ?? "image/png"};base64,${media.data}`;
    if (media.url && /^(https?:|data:|blob:)/.test(media.url)) return media.url;
    return null;
  });
  const [failed, setFailed] = useState<string | null>(null);
  const [lookedUp, setLookedUp] = useState(false);
  const inline = media.kind !== "file";

  // `MEDIA:/path` references: find the stored copy of that file in this thread.
  useEffect(() => {
    if (!media.path || artifactId) return;
    let cancelled = false;
    sessionArtifacts(where.gatewayId, where.sessionKey).then((list) => {
      if (cancelled) return;
      const name = media.fileName?.toLowerCase();
      const hit = list.find((a) => [a.title, a.fileName].some((n) => n && n.toLowerCase() === name));
      if (hit) setArtifactId(hit.id);
      setLookedUp(true);
    });
    return () => {
      cancelled = true;
    };
  }, [media.path, media.fileName, artifactId, where.gatewayId, where.sessionKey]);

  // Inline media resolves its URL right away; files wait for a click.
  useEffect(() => {
    if (src || !inline || failed) return;
    if (!artifactId) {
      if (media.url && origin && !media.path) setSrc(origin + media.url);
      return;
    }
    let cancelled = false;
    resolveArtifactUrl(where.gatewayId, where.sessionKey, artifactId, origin)
      .then((u) => !cancelled && setSrc(u))
      .catch((e) => !cancelled && setFailed(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [src, inline, failed, artifactId, media.url, media.path, origin, where.gatewayId, where.sessionKey]);

  const open = async () => {
    try {
      const url = artifactId ? await resolveArtifactUrl(where.gatewayId, where.sessionKey, artifactId, origin) : src;
      if (url) openExternal(url);
    } catch (e) {
      setFailed(errorMessage(e));
    }
  };

  const name = media.fileName ?? (media.kind === "image" ? "Image" : media.kind === "video" ? "Video" : "File");
  const onBot = media.path && !artifactId && (lookedUp || !media.path);

  // Not retrievable: a file that only exists on the bot's machine.
  if (onBot || (!src && !artifactId && !inline)) {
    return (
      <FileCard
        icon={media.kind}
        name={name}
        detail={media.path ? `on ${gateway?.name ?? "the bot's computer"}` : formatSize(media.sizeBytes)}
        title={media.path}
      />
    );
  }

  if (failed) {
    return <FileCard icon={media.kind} name={name} detail="couldn't load" title={failed} broken />;
  }

  if (media.kind === "file") {
    return <FileCard icon="file" name={name} detail={formatSize(media.sizeBytes)} onOpen={open} />;
  }

  if (!src) {
    return media.kind === "image" ? (
      <div className="h-40 w-56 animate-pulse rounded-xl bg-[var(--color-chip)]" />
    ) : (
      <FileCard icon={media.kind} name={name} detail="loading…" />
    );
  }

  if (media.kind === "video") {
    return (
      <div className="max-w-[440px]">
        <video
          src={src}
          controls
          preload="metadata"
          playsInline
          onError={() => setFailed("This video couldn't be played here.")}
          className="max-h-80 w-full rounded-xl border border-[var(--color-line)] bg-black"
        />
        <FileCaption name={name} size={media.sizeBytes} onOpen={open} />
      </div>
    );
  }
  if (media.kind === "audio") {
    return (
      <div className="w-[320px]">
        <audio src={src} controls preload="metadata" onError={() => setFailed("This audio couldn't be played here.")} className="w-full" />
        <FileCaption name={name} size={media.sizeBytes} onOpen={open} />
      </div>
    );
  }
  return (
    <button onClick={open} className="block" title={`Open ${name}`}>
      <img
        src={src}
        alt={name}
        onError={() => setFailed("This image couldn't be loaded.")}
        className="max-h-80 max-w-[360px] rounded-xl border border-[var(--color-line)] object-contain"
      />
    </button>
  );
}

function FileCaption({ name, size, onOpen }: { name: string; size?: number; onOpen: () => void }) {
  return (
    <div className="mt-1 flex items-center gap-1.5 px-1 text-[11px] text-[var(--color-ink-3)]">
      <span className="truncate">{name}</span>
      {size ? <span>· {formatSize(size)}</span> : null}
      <button onClick={onOpen} className="ml-auto flex items-center gap-0.5 hover:text-[var(--color-ink)]" title="Open">
        <Download size={11} /> Open
      </button>
    </div>
  );
}

function FileCard({
  icon,
  name,
  detail,
  title,
  onOpen,
  broken,
}: {
  icon: MediaRef["kind"];
  name: string;
  detail?: string;
  title?: string;
  onOpen?: () => void;
  broken?: boolean;
}) {
  const Icon = broken ? ImageOff : icon === "video" ? Film : icon === "audio" ? Music : icon === "image" ? FileIcon : FileIcon;
  return (
    <button
      onClick={onOpen}
      disabled={!onOpen}
      title={title}
      className="flex max-w-[360px] items-center gap-2.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-pane-solid)] px-3 py-2 text-left transition enabled:hover:border-[var(--color-ink-3)]/40"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-chip)] text-[var(--color-ink-2)]">
        <Icon size={15} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-medium text-[var(--color-ink)]">{name}</span>
        {detail && <span className="block truncate text-[11px] text-[var(--color-ink-3)]">{detail}</span>}
      </span>
      {onOpen && <Download size={13} className="ml-1 shrink-0 text-[var(--color-ink-3)]" />}
    </button>
  );
}
