import { Plus, Settings as SettingsIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { activityFor, guyName, isMultiGateway } from "../lib/guys";
import type { Guy, Roster } from "../lib/types";
import { sortGuys, useApp } from "../stores/app";
import { Avatar } from "../ui/Avatar";
import { IconButton } from "../ui/kit";

/** The horizontal "stories" pile of little guys (from every gateway) across the top. */
export function StoriesBar() {
  const roster = useApp((s) => s.roster);
  const order = useApp((s) => s.order);
  const selectedUid = useApp((s) => s.selectedUid);
  const selectGuy = useApp((s) => s.selectGuy);
  const setOrder = useApp((s) => s.setOrder);
  const startNewGuy = useApp((s) => s.startNewGuy);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const guys = useMemo(() => sortGuys(roster, order), [roster, order]);
  const multi = isMultiGateway(roster);
  const anyLoaded = roster.gateways.some((g) => g.loaded) || roster.gateways.length > 1;
  const dragUid = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const reorder = (from: string, to: string) => {
    const uids = guys.map((g) => g.uid);
    const next = uids.filter((id) => id !== from);
    next.splice(next.indexOf(to), 0, from);
    setOrder(next);
  };

  return (
    <header data-tauri-drag-region className={`flex shrink-0 items-center gap-1 pl-[84px] pr-3 ${multi ? "h-[100px]" : "h-[92px]"}`}>
      <div data-tauri-drag-region className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1">
        {guys.map((guy, i) => (
          <Story
            key={guy.uid}
            roster={roster}
            guy={guy}
            index={i}
            showGateway={multi}
            selected={guy.uid === selectedUid}
            dropTarget={dropTarget === guy.uid}
            onSelect={() => selectGuy(guy.uid)}
            onDragStart={() => (dragUid.current = guy.uid)}
            onDragOver={() => setDropTarget(guy.uid)}
            onDrop={() => {
              if (dragUid.current && dragUid.current !== guy.uid) reorder(dragUid.current, guy.uid);
              dragUid.current = null;
              setDropTarget(null);
            }}
          />
        ))}
        {anyLoaded && (
          <button
            onClick={startNewGuy}
            className="group flex w-[68px] shrink-0 flex-col items-center gap-1 rounded-xl py-1 outline-none"
            title="New little guy"
          >
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 border-dashed border-[var(--color-ink-3)]/40 text-[var(--color-ink-3)] transition group-hover:border-[var(--color-accent)] group-hover:text-[var(--color-accent)]">
              <Plus size={20} />
            </span>
            <span className="text-[11px] text-[var(--color-ink-3)]">New guy</span>
          </button>
        )}
      </div>
      <IconButton label="Settings (⌘,)" onClick={() => setSettingsOpen(true)}>
        <SettingsIcon size={16} />
      </IconButton>
    </header>
  );
}

function Story({
  roster,
  guy,
  index,
  showGateway,
  selected,
  dropTarget,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  roster: Roster;
  guy: Guy;
  index: number;
  showGateway: boolean;
  selected: boolean;
  dropTarget: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
}) {
  const act = activityFor(roster, guy);
  const ring = act.needsYou ? "needs-you" : act.running ? "working" : act.unread ? "unread" : "idle";
  return (
    <button
      data-story
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onClick={onSelect}
      title={`${guyName(guy)}${showGateway ? ` on ${guy.gatewayName}` : ""}${index < 9 ? ` (⌘${index + 1})` : ""}`}
      className={`relative flex w-[68px] shrink-0 flex-col items-center rounded-xl py-1 outline-none transition ${
        dropTarget ? "bg-[var(--color-chip)]" : ""
      }`}
    >
      <div className={`mb-1 rounded-full transition ${selected ? "scale-105" : "opacity-90 hover:opacity-100"}`}>
        <Avatar agent={guy} size={52} ring={ring} selected={selected} />
      </div>
      <span
        className={`max-w-full truncate px-1 text-[11px] leading-tight ${
          selected ? "font-semibold text-[var(--color-ink)]" : "text-[var(--color-ink-2)]"
        }`}
      >
        {guyName(guy)}
      </span>
      {showGateway && (
        <span className="max-w-full truncate px-1 text-[9.5px] leading-tight text-[var(--color-ink-3)]">{guy.gatewayName}</span>
      )}
      {act.unread > 0 && !act.running && (
        <span className="absolute right-1.5 top-0.5 min-w-[18px] rounded-full bg-[var(--color-accent)] px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-[var(--color-pane-solid)]">
          {act.unread}
        </span>
      )}
      {selected && <span className="absolute -bottom-1 h-1 w-5 rounded-full bg-[var(--color-accent)]" />}
    </button>
  );
}
