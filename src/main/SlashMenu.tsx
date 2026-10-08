// The popup above the composer while a slash command is being typed.
import { useEffect, useRef } from "react";
import { usage, type Choice, type SlashMatch } from "../lib/commands";
import type { CommandEntry } from "../lib/types";

export function SlashMenu({
  match,
  active,
  onHover,
  onPick,
}: {
  match: SlashMatch;
  active: number;
  onHover: (i: number) => void;
  onPick: (i: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, match]);

  if (match.stage === "args") {
    const c = match.command;
    return (
      <Popup>
        <div className="flex items-baseline gap-3 px-3 py-2">
          <span className="shrink-0 font-mono text-[12px] text-[var(--color-ink-2)]">{usage(c)}</span>
          {c.description && <span className="truncate text-[12px] text-[var(--color-ink-3)]">{c.description}</span>}
        </div>
      </Popup>
    );
  }

  const rows: Array<{ key: string; label: string; detail?: string; badge?: string }> =
    match.stage === "command"
      ? match.items.map((c: CommandEntry) => ({
          key: c.name,
          label: usage(c),
          detail: c.description,
          badge: c.source === "skill" ? "skill" : c.source === "plugin" ? "plugin" : undefined,
        }))
      : match.items.map((ch: Choice) => ({
          key: ch.value,
          label: `/${match.command.name} ${ch.value}`,
          detail: ch.label !== ch.value ? ch.label : undefined,
        }));

  if (!rows.length) {
    if (match.stage !== "command" || match.query) return null;
    return (
      <Popup>
        <p className="px-3 py-2 text-[12px] text-[var(--color-ink-3)]">No slash commands yet. Some agents only list them after the first chat.</p>
      </Popup>
    );
  }

  return (
    <Popup>
      <div ref={listRef} role="listbox" id="slash-menu" className="max-h-[264px] overflow-y-auto p-1">
        {rows.map((row, i) => (
          <div
            key={row.key}
            data-i={i}
            id={`slash-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseMove={() => i !== active && onHover(i)}
            onMouseDown={(e) => {
              // Keep focus in the textarea.
              e.preventDefault();
              onPick(i);
            }}
            className={`flex items-baseline gap-3 rounded-lg px-2.5 py-1.5 ${i === active ? "bg-[var(--color-chip)]" : ""}`}
          >
            <span className="shrink-0 font-mono text-[12.5px] text-[var(--color-ink)]">{row.label}</span>
            {row.badge && (
              <span className="shrink-0 rounded bg-[var(--color-accent-soft)] px-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-accent-strong)]">
                {row.badge}
              </span>
            )}
            {row.detail && <span className="min-w-0 truncate text-[12px] text-[var(--color-ink-3)]">{row.detail}</span>}
          </div>
        ))}
      </div>
      <p className="border-t border-[var(--color-line)] px-3 py-1 text-[10.5px] text-[var(--color-ink-3)]">
        ↑↓ choose · ↵ {match.stage === "choice" ? "run" : "pick"} · tab fill · esc close
      </p>
    </Popup>
  );
}

function Popup({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute bottom-full left-0 right-0 z-20 mb-2 animate-fade overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-pane-solid)] shadow-[0_6px_24px_rgba(0,0,0,0.12)]">
      {children}
    </div>
  );
}
