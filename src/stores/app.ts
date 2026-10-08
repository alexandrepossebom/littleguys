import { useMemo } from "react";
import { create } from "zustand";
import { allGuys, defaultThread, findGuy, guyName, guyUid, liveGateways, threadKind } from "../lib/guys";
import { core, listen } from "../lib/ipc";
import type { ConnStatus, Guy, Navigate, Roster } from "../lib/types";

const ORDER_KEY = "littleguys.order";
const LAST_THREAD_KEY = "littleguys.lastThread";
const BROWSER_KEY = "littleguys.browser";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export type MainView = "chat" | "routines" | "files" | "skills";

/** The browser panel beside the chat: open per guy, one shared width. */
interface BrowserPanelPrefs {
  open: Record<string, boolean>;
  width: number;
}

interface AppState {
  roster: Roster;
  /** User-chosen order of guys (uids) in the stories bar. */
  order: string[];
  /** Selected guy, as `${gatewayId}/${agentId}`. */
  selectedUid: string | null;
  selectedSessionKey: string | null;
  lastThreadByGuy: Record<string, string>;
  view: MainView;
  /** Open file in the Files tab, per guy (workspace-relative path). */
  fileByGuy: Record<string, string>;
  /** Routine run open in the Routines tab, per guy (null = the routines list). */
  routineRunByGuy: Record<string, string | null>;
  /** Selected item in the Skills tab, per guy (see lib/abilities.ts ids). */
  abilityByGuy: Record<string, string>;
  browser: BrowserPanelPrefs;
  editor: { open: boolean; uid: string | null };
  settingsOpen: boolean;
  addGatewayOpen: boolean;
  setStatus(status: ConnStatus): void;
  setRoster(roster: Roster): void;
  selectGuy(uid: string, sessionKey?: string | null): void;
  selectSession(key: string | null): void;
  setView(view: MainView): void;
  selectFile(path: string): void;
  /** Open a routine run's transcript in the Routines tab (null = back to the list). */
  selectRoutineRun(key: string | null): void;
  selectAbility(id: string): void;
  setBrowserOpen(uid: string, open: boolean): void;
  setBrowserWidth(width: number): void;
  setOrder(order: string[]): void;
  openEditor(uid: string | null): void;
  closeEditor(): void;
  setSettingsOpen(open: boolean): void;
  setAddGatewayOpen(open: boolean): void;
  navigate(nav: Navigate): void;
  /** Make a guy on a gateway that can, else add another kind of bot. */
  startNewGuy(): void;
}

const emptyRoster: Roster = { gateways: [], hidden: [], updatedAt: 0 };

export const useApp = create<AppState>((set, get) => ({
  roster: emptyRoster,
  order: readJson<string[]>(ORDER_KEY, []),
  selectedUid: null,
  selectedSessionKey: null,
  lastThreadByGuy: readJson<Record<string, string>>(LAST_THREAD_KEY, {}),
  view: "chat",
  fileByGuy: {},
  routineRunByGuy: {},
  abilityByGuy: {},
  browser: readJson<BrowserPanelPrefs>(BROWSER_KEY, { open: {}, width: 520 }),
  editor: { open: false, uid: null },
  settingsOpen: false,
  addGatewayOpen: false,

  setStatus: (status) =>
    set((s) => ({
      roster: {
        ...s.roster,
        gateways: s.roster.gateways.map((g) => (g.id === status.gatewayId ? { ...g, status } : g)),
      },
    })),
  setRoster: (roster) => {
    set({ roster });
    const guys = sortGuys(roster, get().order);
    const { selectedUid } = get();
    if ((!selectedUid || !guys.some((g) => g.uid === selectedUid)) && guys.length) {
      get().selectGuy(guys[0].uid);
    }
  },
  selectGuy: (uid, sessionKey) => {
    // Routine runs live in the Routines tab, not in the chats.
    const last = get().lastThreadByGuy[uid];
    const remembered = last && threadKind(last) !== "routine" ? last : undefined;
    const gatewayId = uid.slice(0, uid.indexOf("/"));
    const agentId = uid.slice(uid.indexOf("/") + 1);
    const key = sessionKey ?? remembered ?? defaultThread(get().roster, { gatewayId, id: agentId });
    set({ selectedUid: uid, selectedSessionKey: key });
    get().selectSession(key);
  },
  selectSession: (key) => {
    if (key && threadKind(key) === "routine") return get().selectRoutineRun(key);
    const uid = get().selectedUid;
    if (key && uid) {
      const lastThreadByGuy = { ...get().lastThreadByGuy, [uid]: key };
      localStorage.setItem(LAST_THREAD_KEY, JSON.stringify(lastThreadByGuy));
      set({ lastThreadByGuy });
    }
    set({ selectedSessionKey: key, view: "chat" });
  },
  setView: (view) => set({ view }),
  selectRoutineRun: (key) => {
    const uid = get().selectedUid;
    if (uid) set({ routineRunByGuy: { ...get().routineRunByGuy, [uid]: key }, view: "routines" });
  },
  selectFile: (path) => {
    const uid = get().selectedUid;
    if (uid) set({ fileByGuy: { ...get().fileByGuy, [uid]: path }, view: "files" });
  },
  selectAbility: (id) => {
    const uid = get().selectedUid;
    if (uid) set({ abilityByGuy: { ...get().abilityByGuy, [uid]: id }, view: "skills" });
  },
  setBrowserOpen: (uid, open) => {
    const browser = { ...get().browser, open: { ...get().browser.open, [uid]: open } };
    localStorage.setItem(BROWSER_KEY, JSON.stringify(browser));
    set({ browser });
  },
  setBrowserWidth: (width) => {
    const browser = { ...get().browser, width: Math.round(width) };
    localStorage.setItem(BROWSER_KEY, JSON.stringify(browser));
    set({ browser });
  },
  setOrder: (order) => {
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
    set({ order });
  },
  openEditor: (uid) => set({ editor: { open: true, uid } }),
  closeEditor: () => set({ editor: { open: false, uid: null } }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setAddGatewayOpen: (addGatewayOpen) => set({ addGatewayOpen }),
  startNewGuy: () => {
    const canMake = liveGateways(get().roster).some((g) => g.status.capabilities?.manageGuys);
    set(canMake ? { editor: { open: true, uid: null } } : { addGatewayOpen: true });
  },
  navigate: (nav) => {
    if (nav.view === "settings") return set({ settingsOpen: true });
    if (nav.view === "new-guy") return get().startNewGuy();
    if (nav.view === "add-gateway") return set({ addGatewayOpen: true });
    const agentId = nav.agentId ?? (nav.sessionKey ? agentIdFromKey(nav.sessionKey) : null);
    if (nav.gatewayId && agentId) get().selectGuy(guyUid(nav.gatewayId, agentId), nav.sessionKey ?? undefined);
    if (nav.view === "routines" || nav.view === "files" || nav.view === "skills") set({ view: nav.view });
  },
}));

export function mainSessionKey(agentId: string): string {
  return `agent:${agentId}:main`;
}

export function agentIdFromKey(key: string): string | null {
  const parts = key.split(":");
  return parts[0] === "agent" && parts[1] ? parts[1] : null;
}

/** Guys in display order: user order, then gateway order, default guy first, then by name. */
export function sortGuys(roster: Roster, order: string[]): Guy[] {
  const gwIndex = new Map(roster.gateways.map((g, i) => [g.id, i]));
  const defaults = new Set(roster.gateways.map((g) => g.defaultAgentId && guyUid(g.id, g.defaultAgentId)));
  const rank = (uid: string) => {
    const i = order.indexOf(uid);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return allGuys(roster).sort(
    (a, b) =>
      rank(a.uid) - rank(b.uid) ||
      (gwIndex.get(a.gatewayId) ?? 0) - (gwIndex.get(b.gatewayId) ?? 0) ||
      Number(defaults.has(b.uid)) - Number(defaults.has(a.uid)) ||
      guyName(a).localeCompare(guyName(b)),
  );
}

/** The selected guy (or undefined while loading). */
export function useSelectedGuy(): Guy | undefined {
  const roster = useApp((s) => s.roster);
  const uid = useApp((s) => s.selectedUid);
  return useMemo(() => findGuy(roster, uid), [roster, uid]);
}

/** Wire the store to the Rust core. Call once per window. */
export async function connectAppStore() {
  const { setStatus, setRoster } = useApp.getState();
  await Promise.all([listen<ConnStatus>("gw:status", setStatus), listen<Roster>("lg:roster", setRoster)]);
  setRoster(await core.roster());
}
