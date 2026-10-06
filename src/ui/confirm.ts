import { isTauri } from "../lib/ipc";

/** Native yes/no sheet (WKWebView has no window.confirm). */
export async function confirmAction(message: string, title = "littleguys", okLabel = "Delete"): Promise<boolean> {
  if (isTauri) {
    const { ask } = await import("@tauri-apps/plugin-dialog");
    return ask(message, { title, kind: "warning", okLabel, cancelLabel: "Cancel" });
  }
  return window.confirm(message);
}
