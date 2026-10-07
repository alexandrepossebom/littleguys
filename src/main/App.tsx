import { useEffect } from "react";
import { capsOf, liveGateways } from "../lib/guys";
import { core, listen } from "../lib/ipc";
import { useApp, useSelectedGuy } from "../stores/app";
import { AddGateway } from "./AddGateway";
import { BrowserPanel } from "./BrowserPanel";
import { ChatView } from "./ChatView";
import { Doctor } from "./Doctor";
import { FilesView } from "./Files";
import { GatewayBanner } from "./GatewayBanner";
import { GuyEditor } from "./GuyEditor";
import { RoutinesPanel } from "./Routines";
import { Settings } from "./Settings";
import { Sidebar } from "./Sidebar";
import { SkillsView } from "./Skills";
import { StoriesBar } from "./StoriesBar";

export function App() {
  const roster = useApp((s) => s.roster);
  const view = useApp((s) => s.view);
  const selectedSessionKey = useApp((s) => s.selectedSessionKey);
  const editor = useApp((s) => s.editor);
  const settingsOpen = useApp((s) => s.settingsOpen);
  const addGatewayOpen = useApp((s) => s.addGatewayOpen);
  const guy = useSelectedGuy();
  const browserOpen = useApp((s) => (guy ? Boolean(s.browser.open[guy.uid]) : false));
  const routineRun = useApp((s) => (guy ? (s.routineRunByGuy[guy.uid] ?? null) : null));
  const connected = liveGateways(roster).length > 0;
  const caps = capsOf(roster, guy?.gatewayId);
  const gatewayId = guy?.gatewayId ?? null;

  // Tell the core which thread is on screen (so it doesn't notify for it).
  const onScreen = view === "chat" ? selectedSessionKey : view === "routines" ? routineRun : null;
  useEffect(() => {
    let focused = document.hasFocus();
    const sync = () =>
      core.setFocusedSession(focused && onScreen ? gatewayId : null, focused ? onScreen : null).catch(() => {});
    sync();
    const unlisten = listen<boolean>("lg:main-focus", (f) => {
      focused = f;
      sync();
    });
    return () => {
      unlisten.then((u) => u());
    };
  }, [gatewayId, onScreen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === ",") {
        e.preventDefault();
        useApp.getState().setSettingsOpen(true);
      }
      if (e.metaKey && e.key === "n") {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("lg:new-thread"));
      }
      if (e.metaKey && /^[1-9]$/.test(e.key)) {
        const el = document.querySelectorAll<HTMLButtonElement>("[data-story]")[Number(e.key) - 1];
        el?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <StoriesBar />
      {connected && <GatewayBanner />}
      <div className="flex min-h-0 flex-1">
        {connected ? (
          <>
            <Sidebar />
            <main className="flex min-w-0 flex-1 flex-col border-l border-[var(--color-line)] bg-[var(--color-pane-solid)]">
              {guy &&
                (view === "routines" && caps.routines ? (
                  routineRun ? (
                    <ChatView key={`${guy.gatewayId}|${routineRun}`} guy={guy} sessionKey={routineRun} />
                  ) : (
                    <RoutinesPanel key={guy.uid} guy={guy} />
                  )
                ) : view === "files" && caps.files ? (
                  <FilesView key={guy.uid} guy={guy} />
                ) : view === "skills" && (caps.skills || caps.tools || caps.plugins) ? (
                  <SkillsView key={guy.uid} guy={guy} />
                ) : selectedSessionKey ? (
                  <div className="flex h-full min-h-0">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <ChatView key={`${guy.gatewayId}|${selectedSessionKey}`} guy={guy} sessionKey={selectedSessionKey} />
                    </div>
                    {caps.browser && browserOpen && <BrowserPanel key={guy.uid} guy={guy} />}
                  </div>
                ) : null)}
            </main>
          </>
        ) : (
          <main className="flex min-w-0 flex-1 bg-[var(--color-pane-solid)]">
            <Doctor />
          </main>
        )}
      </div>
      {editor.open && <GuyEditor uid={editor.uid} />}
      {settingsOpen && <Settings />}
      {addGatewayOpen && <AddGateway />}
    </div>
  );
}
