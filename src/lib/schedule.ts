// Friendly schedule presets <-> OpenClaw cron schedules.

export type CronSchedule =
  | { kind: "cron"; expr: string; tz?: string }
  | { kind: "every"; everyMs: number; anchorMs?: number }
  | { kind: "at"; at: string }
  | { kind: string; [key: string]: unknown };

export type Preset =
  | { kind: "daily"; time: string }
  | { kind: "weekdays"; time: string }
  | { kind: "weekly"; day: number; time: string }
  | { kind: "hourly"; hours: number }
  | { kind: "minutes"; minutes: number }
  | { kind: "once"; at: string } // datetime-local value
  | { kind: "custom"; expr: string };

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function hm(time: string): [number, number] {
  const [h, m] = time.split(":").map((n) => Number.parseInt(n, 10));
  return [Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0];
}

export function presetToSchedule(p: Preset, tz = localTimeZone()): CronSchedule {
  switch (p.kind) {
    case "daily": {
      const [h, m] = hm(p.time);
      return { kind: "cron", expr: `${m} ${h} * * *`, tz };
    }
    case "weekdays": {
      const [h, m] = hm(p.time);
      return { kind: "cron", expr: `${m} ${h} * * 1-5`, tz };
    }
    case "weekly": {
      const [h, m] = hm(p.time);
      return { kind: "cron", expr: `${m} ${h} * * ${p.day}`, tz };
    }
    case "hourly":
      return { kind: "every", everyMs: Math.max(1, p.hours) * 3_600_000 };
    case "minutes":
      return { kind: "every", everyMs: Math.max(5, p.minutes) * 60_000 };
    case "once":
      return { kind: "at", at: new Date(p.at).toISOString() };
    case "custom":
      return { kind: "cron", expr: p.expr.trim(), tz };
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

export function scheduleToPreset(s: CronSchedule | undefined): Preset {
  if (!s) return { kind: "daily", time: "09:00" };
  if (s.kind === "every" && typeof s.everyMs === "number") {
    if (s.everyMs % 3_600_000 === 0) return { kind: "hourly", hours: s.everyMs / 3_600_000 };
    return { kind: "minutes", minutes: Math.round(s.everyMs / 60_000) };
  }
  if (s.kind === "at" && typeof s.at === "string") {
    const d = new Date(s.at);
    return { kind: "once", at: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` };
  }
  if (s.kind === "cron" && typeof s.expr === "string") {
    const m = s.expr.trim().match(/^(\d{1,2}) (\d{1,2}) \* \* (\*|1-5|[0-6])$/);
    if (m) {
      const time = `${pad(Number(m[2]))}:${pad(Number(m[1]))}`;
      if (m[3] === "*") return { kind: "daily", time };
      if (m[3] === "1-5") return { kind: "weekdays", time };
      return { kind: "weekly", day: Number(m[3]), time };
    }
    return { kind: "custom", expr: s.expr };
  }
  return { kind: "custom", expr: "" };
}

function formatTime(time: string): string {
  const [h, m] = hm(time);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function describeSchedule(s: CronSchedule | undefined): string {
  if (!s) return "No schedule";
  if (s.kind === "every" && typeof s.everyMs === "number") {
    const mins = Math.round(s.everyMs / 60_000);
    if (mins % (60 * 24 * 7) === 0) return mins === 60 * 24 * 7 ? "Every week" : `Every ${mins / (60 * 24 * 7)} weeks`;
    if (mins % (60 * 24) === 0) return mins === 60 * 24 ? "Every day" : `Every ${mins / (60 * 24)} days`;
    if (mins % 60 === 0) return mins === 60 ? "Every hour" : `Every ${mins / 60} hours`;
    return `Every ${mins} min`;
  }
  const p = scheduleToPreset(s);
  switch (p.kind) {
    case "daily":
      return `Every day at ${formatTime(p.time)}`;
    case "weekdays":
      return `Weekdays at ${formatTime(p.time)}`;
    case "weekly":
      return `${DAYS[p.day]}s at ${formatTime(p.time)}`;
    case "once":
      return `Once, ${new Date(p.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
    case "custom":
      return p.expr ? `cron: ${p.expr}` : `${s.kind} trigger`;
    default:
      return s.kind;
  }
}

export function describeNext(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return "";
  const diff = ms - now;
  if (diff < 0) return "due now";
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `in ${Math.max(1, mins)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  return new Date(ms).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
