import { isTauri } from "../lib/ipc";

export async function openExternal(url: string) {
  if (!/^(https?:|mailto:)/i.test(url)) return;
  if (isTauri) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener");
  }
}
