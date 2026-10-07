import { AlarmClock, Archive, ChevronRight, Folder, MessageCircle, MoreHorizontal, Pencil, Pin, PinOff, Sparkles, SquarePen, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sessions as sessionsApi } from "../lib/gateway";
import {
  activityFor,
  capsOf,
  channelName,
  cleanPreview,
  gatewayOf,
  guyName,
  isMultiGateway,
  isRunning,
  RUNTIME_LABEL,
  sessionsFor,
  shortTime,
  threadKind,
  threadTitle,
} from "../lib/guys";
import { core } from "../lib/ipc";
import type { Guy, SessionRow } from "../lib/types";
import { type MainView, mainSessionKey, useApp, useSelectedGuy } from "../stores/app";
import { Avatar } from "../ui/Avatar";
import { IconButton, inputClass, TypingDots } from "../ui/kit";
import { FileTree } from "./Files";
import { AbilityList } from "./Skills";

export function Sidebar() {
  const guy = useSelectedGuy();
  const view = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);
  const caps = useApp((s) => capsOf(s.roster, guy?.gatewayId));
  if (!guy) return <aside className="w-[264px] shrink-0" />;
  const tabs: Array<{ value: MainView; label: string; icon: React.ReactNode }> = [
    { value: "chat", label: "Chats", icon: <MessageCircle size={14} /> },
    ...(caps.routines ? [{ value: "routines" as const, label: "Routines", icon: <AlarmClock size={14} /> }] : []),
    ...(caps.files ? [{ value: "files" as const, label: "Files", icon: <Folder size={14} /> }] : []),
    ...(caps.skills || caps.tools || caps.plugins ? [{ value: "skills" as const, label: "Skills", icon: <Sparkles size={14} /> }] : []),
  ];
  // A tab the guy's runtime doesn't have falls back to its chats.
  const current = tabs.some((t) => t.value === view) ? view : "chat";
  return (
    <aside className="flex w-[264px] shrink-0 flex-col">
      <GuyHeader guy={guy} />
      {tabs.length > 1 && (
        <div className="flex gap-1 px-3 pb-2.5" role="tablist">
          {tabs.map((t) => {
            const active = current === t.value;
            return (
              <button
                key={t.value}
                role="tab"
                aria-selected={active}
                title={t.label}
                onClick={() => setView(t.value)}
                className={`flex h-8 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-medium transition-[flex-grow,background-color,color] duration-200 ${
                  active
                    ? "flex-[2.2] bg-[var(--color-ink)] px-3 text-[var(--color-pane-solid)]"
                    : "flex-1 text-[var(--color-ink-2)] hover:bg-[var(--color-chip)] hover:text-[var(--color-ink)]"
                }`}
              >
                {t.icon}
                {active && <span className="truncate">{t.label}</span>}
              </button>
            );
          })}
        </div>
      )}
      {current === "files" ? (
        <FileTree key={guy.uid} guy={guy} />
      ) : current === "skills" ? (
        <AbilityList key={guy.uid} guy={guy} />
      ) : current === "routines" ? (
        <RoutineRunList guy={guy} />
      ) : (
        <ThreadList guy={guy} />
      )}
    </aside>
  );
}

function GuyHeader({ guy }: { guy: Guy }) {
  const roster = useApp((s) => s.roster);
  const openEditor = useApp((s) => s.openEditor);
  const act = activityFor(roster, guy);
  const gateway = gatewayOf(roster, guy.gatewayId);
  const caps = capsOf(roster, guy.gatewayId);
  const runtime = gateway?.status.kind && gateway.status.kind !== "openclaw" ? RUNTIME_LABEL[gateway.status.kind] : null;
  const multi = isMultiGateway(roster);
  const model = typeof guy.model === "object" && guy.model ? guy.model.primary : undefined;
  const isAcp = gateway?.status.kind === "acp";
  const subtitle = [
    act.running ? "working…" : isAcp ? guy.gatewayName : model ? model.split("/").pop() : (runtime ?? "ready"),
    multi && !isAcp && guy.gatewayName !== guyName(guy) ? `on ${guy.gatewayName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="px-3 pb-3">
      <div className="flex items-center gap-2.5">
        <Avatar agent={guy} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <h2 className="truncate font-display text-[15px] font-semibold tracking-tight">{guyName(guy)}</h2>
            {caps.manageGuys && (
              <IconButton label="Edit little guy" className="h-6 w-6" onClick={() => openEditor(guy.uid)}>
                <Pencil size={12} />
              </IconButton>
            )}
          </div>
          <p className="truncate text-[11.5px] text-[var(--color-ink-3)]">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

type Group = { id: string; title: string; rows: SessionRow[]; collapsible: boolean };

function ThreadList({ guy }: { guy: Guy }) {
  const roster = useApp((s) => s.roster);
  const caps = capsOf(roster, guy.gatewayId);
  const selected = useApp((s) => s.selectedSessionKey);
  const view = useApp((s) => s.view);
  const selectSession = useApp((s) => s.selectSession);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ routine: true, helper: true });
  const [creating, setCreating] = useState(false);

  const groups = useMemo<Group[]>(() => {
    const rows = sessionsFor(roster, guy).filter((r) => !r.archived);
    const byActivity = (a: SessionRow, b: SessionRow) =>
      Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    const main = rows.find((r) => threadKind(r.key) === "main");
    // Channel conversations sit alongside app chats; ThreadRow badges them with their channel.
    const threads = rows.filter((r) => ["chat", "channel"].includes(threadKind(r.key))).sort(byActivity);
    const mainRow: SessionRow = main ?? ({ key: mainSessionKey(guy.id), kind: "direct", updatedAt: null } as SessionRow);
    return [{ id: "threads", title: "", rows: [mainRow, ...threads], collapsible: false }];
  }, [roster, guy]);

  const newThread = useCallback(async () => {
    if (creating || !caps.newThreads) return;
    setCreating(true);
    try {
      const res = await sessionsApi.create(guy.gatewayId, guy.id);
      selectSession(res.key);
      core.refreshRoster(guy.gatewayId).catch(() => {});
    } finally {
      setCreating(false);
    }
  }, [guy.gatewayId, guy.id, creating, selectSession, caps.newThreads]);

  useEffect(() => {
    const handler = () => newThread();
    document.addEventListener("lg:new-thread", handler);
    return () => document.removeEventListener("lg:new-thread", handler);
  }, [newThread]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between pb-1 pl-4 pr-2.5">
        <h3 className="font-display text-[13px] font-semibold">Threads</h3>
        {caps.newThreads && (
          <IconButton label="New thread (⌘N)" onClick={newThread} disabled={creating}>
            <SquarePen size={14} />
          </IconButton>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {groups.map((g) => (
          <div key={g.id} className="mb-1">
            {g.title && (
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [g.id]: !c[g.id] }))}
                className="flex w-full items-center gap-1 px-2 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-3)] hover:text-[var(--color-ink-2)]"
              >
                <ChevronRight size={12} className={`transition ${collapsed[g.id] ? "" : "rotate-90"}`} />
                {g.title}
                <span className="font-normal normal-case tracking-normal opacity-70">{g.rows.length}</span>
              </button>
            )}
            {!(g.collapsible && collapsed[g.id]) &&
              g.rows.map((row) => (
                <ThreadRow
                  key={row.key}
                  actions={caps.threadActions}
                  gatewayId={guy.gatewayId}
                  agentId={guy.id}
                  row={row}
                  running={isRunning(roster, guy.gatewayId, row.key)}
                  selected={view === "chat" && selected === row.key}
                  onSelect={() => selectSession(row.key)}
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The Routines tab's sidebar: the routines themselves, then each run's conversation. */
function RoutineRunList({ guy }: { guy: Guy }) {
  const roster = useApp((s) => s.roster);
  const caps = capsOf(roster, guy.gatewayId);
  const run = useApp((s) => s.routineRunByGuy[guy.uid] ?? null);
  const selectRoutineRun = useApp((s) => s.selectRoutineRun);
  const runs = useMemo(
    () =>
      sessionsFor(roster, guy)
        .filter((r) => !r.archived && threadKind(r.key) === "routine")
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [roster, guy],
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center pb-1 pl-4 pr-2.5">
        <h3 className="font-display text-[13px] font-semibold">Routines</h3>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <button
          onClick={() => selectRoutineRun(null)}
          className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition ${
            run ? "hover:bg-[var(--color-chip)]" : "bg-[var(--color-accent)] text-white shadow-sm"
          }`}
        >
          <AlarmClock size={14} className="shrink-0 opacity-80" />
          <span className="font-medium">All routines</span>
        </button>
        <p className="flex items-center gap-1.5 px-2 pb-1 pt-3 text-[11.5px] font-medium text-[var(--color-ink-3)]">
          Recent runs
          {runs.length > 0 && <span className="rounded-full bg-[var(--color-chip)] px-1.5 text-[10.5px] tabular-nums">{runs.length}</span>}
        </p>
        {runs.length === 0 ? (
          <p className="px-2 py-1 text-[12px] text-[var(--color-ink-3)]">Each time a routine runs, its conversation shows up here.</p>
        ) : (
          runs.map((row) => (
            <ThreadRow
              key={row.key}
              actions={caps.threadActions}
              gatewayId={guy.gatewayId}
              agentId={guy.id}
              row={row}
              running={isRunning(roster, guy.gatewayId, row.key)}
              selected={run === row.key}
              onSelect={() => selectRoutineRun(row.key)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ThreadRow({
  actions,
  gatewayId,
  agentId,
  row,
  running,
  selected,
  onSelect,
}: {
  actions: boolean;
  gatewayId: string;
  agentId: string;
  row: SessionRow;
  running: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const kind = threadKind(row.key);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const preview = cleanPreview(row.lastMessagePreview);
  const title = threadTitle(row);
  const channel = kind === "channel" ? channelName(row.key) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      onContextMenu={(e) => {
        if (kind === "main" || !actions) return;
        e.preventDefault();
        setMenu(true);
      }}
      className={`group relative mb-0.5 flex cursor-default items-start gap-2 rounded-lg px-2.5 py-2 outline-none transition ${
        selected ? "bg-[var(--color-accent)] text-white shadow-sm" : "hover:bg-[var(--color-chip)]"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          {row.pinned && kind !== "main" && <Pin size={10} className="shrink-0 self-center opacity-60" />}
          {renaming ? (
            <RenameInput gatewayId={gatewayId} row={row} onDone={() => setRenaming(false)} />
          ) : (
            <span className={`truncate ${row.unread && !selected ? "font-semibold" : "font-medium"}`}>{title}</span>
          )}
          <span className={`ml-auto shrink-0 text-[10.5px] ${selected ? "text-white/75" : "text-[var(--color-ink-3)]"}`}>
            {running ? <TypingDots /> : row.updatedAt ? shortTime(row.updatedAt) : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {channel && (
            <span
              className={`shrink-0 rounded px-1 text-[9.5px] font-semibold uppercase tracking-wide ${
                selected ? "bg-white/20" : "bg-[var(--color-chip)] text-[var(--color-ink-3)]"
              }`}
            >
              {channel}
            </span>
          )}
          <p className={`truncate text-[12px] ${selected ? "text-white/80" : "text-[var(--color-ink-3)]"}`}>
            {running ? "working…" : preview || (kind === "main" ? "Your main chat" : "No messages yet")}
          </p>
          {row.unread && !selected && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]" />}
        </div>
      </div>
      {kind !== "main" && actions && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenu((m) => !m);
          }}
          className={`absolute right-1.5 top-1.5 rounded p-0.5 opacity-0 transition group-hover:opacity-100 ${
            selected ? "hover:bg-white/20" : "hover:bg-black/5 dark:hover:bg-white/10"
          } ${menu ? "opacity-100" : ""}`}
          aria-label="Thread actions"
        >
          <MoreHorizontal size={14} />
        </button>
      )}
      {menu && (
        <ThreadMenu
          gatewayId={gatewayId}
          agentId={agentId}
          row={row}
          onClose={() => setMenu(false)}
          onRename={() => setRenaming(true)}
        />
      )}
    </div>
  );
}

function RenameInput({ gatewayId, row, onDone }: { gatewayId: string; row: SessionRow; onDone: () => void }) {
  const [value, setValue] = useState(threadTitle(row));
  const commit = async () => {
    const label = value.trim();
    onDone();
    if (label && label !== threadTitle(row)) {
      await sessionsApi.patch(gatewayId, row.key, { label }).catch(() => {});
      core.refreshRoster(gatewayId).catch(() => {});
    }
  };
  return (
    <input
      autoFocus
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onDone();
      }}
      className={`${inputClass} h-6 py-0 text-[12.5px] text-[var(--color-ink)]`}
    />
  );
}

function ThreadMenu({
  gatewayId,
  agentId,
  row,
  onClose,
  onRename,
}: {
  gatewayId: string;
  agentId: string;
  row: SessionRow;
  onClose: () => void;
  onRename: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const selectSession = useApp((s) => s.selectSession);
  const selected = useApp((s) => s.selectedSessionKey);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const act = async (fn: () => Promise<unknown>) => {
    onClose();
    await fn().catch(() => {});
    core.refreshRoster(gatewayId).catch(() => {});
  };
  const leaveIfOpen = () => {
    const s = useApp.getState();
    if (s.selectedUid && s.routineRunByGuy[s.selectedUid] === row.key) s.selectRoutineRun(null);
    else if (selected === row.key) selectSession(mainSessionKey(agentId));
  };
  const kind = threadKind(row.key);

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className="animate-pop absolute right-1 top-8 z-20 w-44 rounded-lg border border-[var(--color-line)] bg-[var(--color-pane-solid)] p-1 text-[12.5px] text-[var(--color-ink)] shadow-xl"
    >
      <MenuButton icon={<Pencil size={13} />} label="Rename" onClick={() => (onClose(), onRename())} />
      <MenuButton
        icon={row.pinned ? <PinOff size={13} /> : <Pin size={13} />}
        label={row.pinned ? "Unpin" : "Pin"}
        onClick={() => act(() => sessionsApi.patch(gatewayId, row.key, { pinned: !row.pinned }))}
      />
      <MenuButton
        icon={<Archive size={13} />}
        label="Archive"
        onClick={() =>
          act(async () => {
            await sessionsApi.patch(gatewayId, row.key, { archived: true }, row.sessionId ?? undefined);
            leaveIfOpen();
          })
        }
      />
      {(kind === "chat" || kind === "routine") && (
        <MenuButton
          icon={<Trash2 size={13} />}
          label="Delete"
          danger
          onClick={() =>
            act(async () => {
              await sessionsApi.patch(gatewayId, row.key, { archived: true }, row.sessionId ?? undefined);
              await sessionsApi.remove(gatewayId, row.key);
              leaveIfOpen();
            })
          }
        />
      )}
    </div>
  );
}

function MenuButton({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
        danger ? "text-[var(--color-bad)] hover:bg-[var(--color-bad)]/10" : "hover:bg-[var(--color-chip)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
