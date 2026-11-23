import { NativeEventEmitter, NativeModules } from 'react-native';

export const ORANGE = '#ff925f';
export type Challenge = 'Math' | 'Shake' | 'Slide' | 'None';

export interface Alarm {
  id: number;
  h: number;
  m: number;
  label: string;
  challenge: Challenge;
  enabled: boolean;
  snooze: number;
  days: number[]; // 1 = Mon ... 7 = Sun, empty = once
  sound?: string; // '' = default tone, 'raw:name' = built-in, otherwise a content:// URI
  soundName?: string; // display name for custom sounds
  vibrate?: boolean; // default true
}

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const CHALLENGES: Challenge[] = ['Math', 'Shake', 'Slide', 'None'];
export const SNOOZES = [1, 5, 10, 15];

export const pad = (n: number) => String(n).padStart(2, '0');

export function timeStr(h: number, m: number, h24: boolean) {
  if (h24) return `${pad(h)}:${pad(m)}`;
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}

const weekday = (d: Date) => ((d.getDay() + 6) % 7) + 1;

export function nextOccurrence(a: Alarm): Date {
  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, a.h, a.m, 0, 0);
    if (d.getTime() > now.getTime() && (a.days.length === 0 || a.days.includes(weekday(d)))) return d;
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, a.h, a.m, 0, 0);
}

const N = NativeModules.AuroraAlarm;

export const AlarmNative = {
  schedule: (a: Alarm): Promise<void> =>
    N.schedule(a.id, nextOccurrence(a).getTime(), a.label, a.h, a.m, a.days, a.sound ?? '', a.vibrate !== false),
  scheduleAt: (id: number, at: Date, label: string, days: number[], sound = '', vibrate = true): Promise<void> =>
    N.schedule(id, at.getTime(), label, at.getHours(), at.getMinutes(), days, sound, vibrate),
  pickSound: (current: string): Promise<{ uri: string; title: string } | null> => N.pickSound(current),
  previewSound: (sound: string): Promise<boolean> => N.previewSound(sound),
  stopPreview: (): Promise<void> => N.stopPreview(),
  getInsets: (): Promise<{ top: number; bottom: number; left: number; right: number } | null> => N.getInsets(),
  cancel: (id: number): Promise<void> => N.cancel(id),
  snooze: (id: number, at: number): Promise<void> => N.snooze(id, at),
  ringing: (): Promise<number> => N.ringing(),
  stop: (): Promise<void> => N.stop(),
  status: (): Promise<{ exact: boolean; fullScreen: boolean }> => N.permissionStatus(),
  openExact: (): Promise<void> => N.openExactAlarmSettings(),
  openFullScreen: (): Promise<void> => N.openFullScreenSettings(),
  startShake: (): Promise<boolean> => N.startShake(),
  stopShake: (): Promise<void> => N.stopShake(),
};

export const nativeEvents = new NativeEventEmitter(N);

export function untilText(target: Date): string {
  const mins = Math.max(0, Math.round((target.getTime() - Date.now()) / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m} min`;
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// Special native alarm ids for the Timer and the Bedtime reminder (normal alarms are always below this).
export const UTILITY_BASE = 2000000000;
export const TIMER_ID = 2000000001;
export const BEDTIME_ID = 2000000002;

/** Next time today/tomorrow that the clock shows h:m */
export function nextDaily(h: number, m: number): Date {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

export function repeatSummary(days: number[]): string {
  if (days.length === 0) return 'Once';
  if (days.length === 7) return 'Daily';
  const key = [...days].sort().join('');
  if (key === '12345') return 'Mon – Fri';
  if (key === '67') return 'Weekend';
  return days.map((d) => DAY_NAMES[d - 1]).join(', ');
}

export function dateLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
