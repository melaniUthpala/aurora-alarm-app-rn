import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { AlarmNative, TIMER_ID, nextDaily, pad, untilText } from './lib';
import { storage } from './storage';
import {
  ACCENT_SOLID, BigTime, Btn, Chip, GhostBtn, Glass, Hero, Label, Pulse, Screen, TimePicker, Txt, WHEEL_ITEM, Wheel,
} from './ui';

const mono = { fontVariant: ['tabular-nums'] } as any;

function Header({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingBottom: 14 }}>
      <Txt style={{ flex: 1, fontSize: 30, fontWeight: '700' }}>{title}</Txt>
      {right}
    </View>
  );
}

const switchProps = { thumbColor: '#fff', trackColor: { false: 'rgba(255,255,255,0.25)', true: ACCENT_SOLID } };

// ======================================================================
// Stopwatch
// ======================================================================
function fmt(ms: number) {
  const cs = Math.floor(ms / 10) % 100;
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / 60000) % 60;
  const hr = Math.floor(ms / 3600000);
  return `${hr > 0 ? hr + ':' : ''}${pad(min)}:${pad(sec)}.${pad(cs)}`;
}

export function Stopwatch() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]); // cumulative times, newest first
  const startedAt = useRef(0);
  const base = useRef(0);

  useEffect(() => {
    if (!running) return;
    startedAt.current = Date.now();
    const t = setInterval(() => setElapsed(base.current + Date.now() - startedAt.current), 33);
    return () => clearInterval(t);
  }, [running]);

  const toggle = () => {
    if (running) {
      base.current += Date.now() - startedAt.current;
      setElapsed(base.current);
      setRunning(false);
    } else {
      setRunning(true);
    }
  };
  const lap = () => setLaps((p) => [elapsed, ...p]);
  const reset = () => { setRunning(false); base.current = 0; setElapsed(0); setLaps([]); };

  const lapTimes = laps.map((t, i) => t - (laps[i + 1] ?? 0));
  const best = lapTimes.length >= 3 ? Math.min(...lapTimes) : -1;
  const worst = lapTimes.length >= 3 ? Math.max(...lapTimes) : -1;

  return (
    <View style={{ flex: 1 }}>
      <Header title="Stopwatch" />
      <View style={{ alignItems: 'center', paddingVertical: 26 }}>
        <Txt style={[{ fontSize: 66, fontWeight: '200' }, mono]}>{fmt(elapsed)}</Txt>
      </View>
      <View style={{ flexDirection: 'row', paddingHorizontal: 22, marginBottom: 16 }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <GhostBtn title={running ? 'Lap' : 'Reset'} onPress={running ? lap : reset} />
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Btn title={running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'} onPress={toggle} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {laps.map((t, i) => {
          const lt = lapTimes[i];
          const color = lt === best ? '#7be0a4' : lt === worst ? '#ff8f9c' : '#fff';
          return (
            <View key={laps.length - i} style={styles.lapRow}>
              <Txt style={{ opacity: 0.6, width: 70 }}>Lap {laps.length - i}</Txt>
              <Txt style={[{ flex: 1, textAlign: 'center', color }, mono]}>{fmt(lt)}</Txt>
              <Txt style={[{ opacity: 0.6, width: 110, textAlign: 'right' }, mono]}>{fmt(t)}</Txt>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ======================================================================
// Timer (rings through the native alarm engine, so it works when the app is closed)
// ======================================================================
type TState =
  | { status: 'idle' }
  | { status: 'running'; endsAt: number; total: number }
  | { status: 'paused'; remaining: number; total: number };

const H = Array.from({ length: 24 }, (_, i) => String(i));
const MS = Array.from({ length: 60 }, (_, i) => pad(i));
const PRESETS = [1, 5, 10, 15, 30];

function fmtTimer(ms: number, withHours: boolean) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return withHours || h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function Timer() {
  const [st, setSt] = useState<TState>({ status: 'idle' });
  const [hh, setHh] = useState(0);
  const [mm, setMm] = useState(5);
  const [ss, setSs] = useState(0);
  const [ver, setVer] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (st.status === 'running' && now >= st.endsAt) setSt({ status: 'idle' });
  }, [now, st]);

  const fail = (e: any) => Alert.alert('Timer', String(e?.message ?? e));

  const start = async () => {
    const total = (hh * 3600 + mm * 60 + ss) * 1000;
    if (total <= 0) return;
    try {
      await AlarmNative.cancel(TIMER_ID);
      const endsAt = Date.now() + total;
      await AlarmNative.scheduleAt(TIMER_ID, new Date(endsAt), 'Timer', []);
      setSt({ status: 'running', endsAt, total });
    } catch (e) { fail(e); }
  };

  const pause = async () => {
    if (st.status !== 'running') return;
    try {
      await AlarmNative.cancel(TIMER_ID);
      setSt({ status: 'paused', remaining: Math.max(0, st.endsAt - Date.now()), total: st.total });
    } catch (e) { fail(e); }
  };

  const resume = async () => {
    if (st.status !== 'paused') return;
    try {
      const endsAt = Date.now() + st.remaining;
      await AlarmNative.scheduleAt(TIMER_ID, new Date(endsAt), 'Timer', []);
      setSt({ status: 'running', endsAt, total: st.total });
    } catch (e) { fail(e); }
  };

  const cancel = async () => {
    try { await AlarmNative.cancel(TIMER_ID); } catch {}
    setSt({ status: 'idle' });
  };

  const preset = (min: number) => { setHh(0); setMm(min); setSs(0); setVer((v) => v + 1); };

  if (st.status === 'idle') {
    const total = hh * 3600 + mm * 60 + ss;
    return (
      <View style={{ flex: 1 }}>
        <Header title="Timer" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          <Glass style={{ paddingVertical: 14 }}>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <View
                pointerEvents="none"
                style={{ position: 'absolute', height: WHEEL_ITEM, left: 8, right: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Wheel key={`h${ver}`} data={H} index={hh} onChange={setHh} width={70} />
                <Txt style={styles.unit}>h</Txt>
                <Wheel key={`m${ver}`} data={MS} index={mm} onChange={setMm} width={70} />
                <Txt style={styles.unit}>min</Txt>
                <Wheel key={`s${ver}`} data={MS} index={ss} onChange={setSs} width={70} />
                <Txt style={styles.unit}>s</Txt>
              </View>
            </View>
          </Glass>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, marginTop: -6 }}>
            {PRESETS.map((p) => <Chip key={p} label={`${p} min`} selected={false} onPress={() => preset(p)} />)}
          </View>
          <Btn title={total > 0 ? 'Start timer' : 'Set a time'} onPress={start} />
        </ScrollView>
      </View>
    );
  }

  const remaining = st.status === 'running' ? Math.max(0, st.endsAt - now) : st.remaining;
  const progress = st.total > 0 ? remaining / st.total : 0;

  return (
    <View style={{ flex: 1 }}>
      <Header title="Timer" />
      <View style={{ paddingHorizontal: 22 }}>
        <Hero>
          <Label>{st.status === 'paused' ? 'Paused' : 'Counting down'}</Label>
          <Txt style={[{ fontSize: 76, fontWeight: '200', textAlign: 'center', marginVertical: 14 }, mono]}>
            {fmtTimer(remaining, st.total >= 3600000)}
          </Txt>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <View style={{ width: `${Math.min(1, progress) * 100}%`, height: 6, borderRadius: 3, backgroundColor: ACCENT_SOLID }} />
          </View>
        </Hero>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: 8 }}><GhostBtn title="Cancel" onPress={cancel} /></View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Btn title={st.status === 'paused' ? 'Resume' : 'Pause'} onPress={st.status === 'paused' ? resume : pause} />
          </View>
        </View>
        <Txt style={{ opacity: 0.45, fontSize: 13, textAlign: 'center', marginTop: 18 }}>
          The timer will ring even if you close the app
        </Txt>
      </View>
    </View>
  );
}

// ======================================================================
// World clock
// ======================================================================
const CITIES: { id: string; name: string; country: string }[] = [
  { id: 'Asia/Colombo', name: 'Colombo', country: 'Sri Lanka' },
  { id: 'Asia/Kolkata', name: 'Mumbai', country: 'India' },
  { id: 'Asia/Dubai', name: 'Dubai', country: 'UAE' },
  { id: 'Asia/Riyadh', name: 'Riyadh', country: 'Saudi Arabia' },
  { id: 'Asia/Qatar', name: 'Doha', country: 'Qatar' },
  { id: 'Asia/Karachi', name: 'Karachi', country: 'Pakistan' },
  { id: 'Asia/Dhaka', name: 'Dhaka', country: 'Bangladesh' },
  { id: 'Asia/Bangkok', name: 'Bangkok', country: 'Thailand' },
  { id: 'Asia/Singapore', name: 'Singapore', country: 'Singapore' },
  { id: 'Asia/Kuala_Lumpur', name: 'Kuala Lumpur', country: 'Malaysia' },
  { id: 'Asia/Hong_Kong', name: 'Hong Kong', country: 'China' },
  { id: 'Asia/Shanghai', name: 'Shanghai', country: 'China' },
  { id: 'Asia/Tokyo', name: 'Tokyo', country: 'Japan' },
  { id: 'Asia/Seoul', name: 'Seoul', country: 'South Korea' },
  { id: 'Australia/Sydney', name: 'Sydney', country: 'Australia' },
  { id: 'Australia/Perth', name: 'Perth', country: 'Australia' },
  { id: 'Pacific/Auckland', name: 'Auckland', country: 'New Zealand' },
  { id: 'Europe/London', name: 'London', country: 'United Kingdom' },
  { id: 'Europe/Paris', name: 'Paris', country: 'France' },
  { id: 'Europe/Berlin', name: 'Berlin', country: 'Germany' },
  { id: 'Europe/Rome', name: 'Rome', country: 'Italy' },
  { id: 'Europe/Moscow', name: 'Moscow', country: 'Russia' },
  { id: 'Europe/Istanbul', name: 'Istanbul', country: 'Turkey' },
  { id: 'Africa/Cairo', name: 'Cairo', country: 'Egypt' },
  { id: 'Africa/Johannesburg', name: 'Johannesburg', country: 'South Africa' },
  { id: 'Africa/Nairobi', name: 'Nairobi', country: 'Kenya' },
  { id: 'America/New_York', name: 'New York', country: 'USA' },
  { id: 'America/Chicago', name: 'Chicago', country: 'USA' },
  { id: 'America/Denver', name: 'Denver', country: 'USA' },
  { id: 'America/Los_Angeles', name: 'Los Angeles', country: 'USA' },
  { id: 'America/Toronto', name: 'Toronto', country: 'Canada' },
  { id: 'America/Sao_Paulo', name: 'São Paulo', country: 'Brazil' },
  { id: 'America/Mexico_City', name: 'Mexico City', country: 'Mexico' },
];

const DEFAULT_CITIES = ['Asia/Colombo', 'Europe/London', 'America/New_York', 'Asia/Tokyo'];

interface Zoned { h: number; m: number; dayDiff: number; offsetMin: number }

function zoned(tz: string, date: Date): Zoned | null {
  try {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
    });
    const p: Record<string, string> = {};
    f.formatToParts(date).forEach((x) => { p[x.type] = x.value; });
    const y = +p.year, mo = +p.month, d = +p.day, h = +p.hour % 24, mi = +p.minute;
    if ([y, mo, d, h, mi].some((n) => Number.isNaN(n))) return null;
    const there = Date.UTC(y, mo - 1, d, h, mi);
    const here = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes());
    const dayDiff = Math.round((Date.UTC(y, mo - 1, d) - Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000);
    return { h, m: mi, dayDiff, offsetMin: Math.round((there - here) / 60000) };
  } catch {
    return null;
  }
}

function offsetText(min: number) {
  if (min === 0) return 'Same time as you';
  const sign = min > 0 ? '+' : '-';
  const a = Math.abs(min);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `${sign}${h}h${m ? ' ' + m + 'm' : ''} from you`;
}

export function WorldClock({ h24 }: { h24: boolean }) {
  const [ids, setIds] = useState<string[]>(DEFAULT_CITIES);
  const [now, setNow] = useState(new Date());
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    storage.getItem('worldclock')
      .then((v) => { if (v) setIds(JSON.parse(v)); })
      .catch(() => {})
      .finally(() => { loaded.current = true; });
  }, []);

  useEffect(() => {
    if (loaded.current) storage.setItem('worldclock', JSON.stringify(ids)).catch(() => {});
  }, [ids]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const q = query.trim().toLowerCase();
  const available = CITIES.filter((c) => !ids.includes(c.id) && (!q || c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)));

  return (
    <View style={{ flex: 1 }}>
      <Header
        title="World clock"
        right={
          <Pressable onPress={() => { setQuery(''); setAdding(true); }} hitSlop={8} style={styles.addBtn}>
            <Txt style={{ fontSize: 24, marginTop: -2 }}>＋</Txt>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {ids.length === 0 && (
          <Glass style={{ alignItems: 'center', paddingVertical: 30 }}>
            <Txt style={{ fontSize: 34 }}>🌍</Txt>
            <Txt style={{ opacity: 0.6, marginTop: 8 }}>Tap ＋ to add a city</Txt>
          </Glass>
        )}
        {ids.map((id) => {
          const city = CITIES.find((c) => c.id === id);
          if (!city) return null;
          const z = zoned(id, now);
          const night = z ? z.h < 6 || z.h >= 19 : false;
          const day = z ? (z.dayDiff === 0 ? 'Today' : z.dayDiff === 1 ? 'Tomorrow' : z.dayDiff === -1 ? 'Yesterday' : '') : '';
          return (
            <Glass key={id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }}>
              <View style={{ flex: 1 }}>
                <Txt style={{ fontSize: 20, fontWeight: '700' }}>{city.name}</Txt>
                <Txt style={{ opacity: 0.55, fontSize: 13, marginTop: 2 }}>
                  {z ? `${day}${day ? ' · ' : ''}${offsetText(z.offsetMin)}` : 'Time zone data unavailable'}
                </Txt>
              </View>
              {z && (
                <View style={{ alignItems: 'flex-end' }}>
                  <BigTime h={z.h} m={z.m} h24={h24} size={34} weight="300" />
                  <Txt style={{ fontSize: 13, opacity: 0.6 }}>{night ? '🌙 Night' : '☀️ Day'}</Txt>
                </View>
              )}
              <Pressable onPress={() => setIds((p) => p.filter((x) => x !== id))} hitSlop={10} style={{ paddingLeft: 14 }}>
                <Txt style={{ fontSize: 16, opacity: 0.45 }}>✕</Txt>
              </Pressable>
            </Glass>
          );
        })}
      </ScrollView>

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} onPress={() => setAdding(false)} />
          <View style={[styles.sheet, { maxHeight: '75%' }]}>
            <Txt style={{ fontSize: 22, fontWeight: '700', marginBottom: 10 }}>Add a city</Txt>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search city or country"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={styles.search}
            />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {available.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => { setIds((p) => [...p, c.id]); setAdding(false); }}
                  style={styles.cityRow}
                >
                  <Txt style={{ fontSize: 17, fontWeight: '600' }}>{c.name}</Txt>
                  <Txt style={{ opacity: 0.5, marginLeft: 8, fontSize: 14 }}>{c.country}</Txt>
                </Pressable>
              ))}
              {available.length === 0 && <Txt style={{ opacity: 0.5, paddingVertical: 20, textAlign: 'center' }}>No cities found</Txt>}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ======================================================================
// Bedtime
// ======================================================================
export interface BedtimeCfg { enabled: boolean; wakeH: number; wakeM: number; goal: number }
export const DEFAULT_BEDTIME: BedtimeCfg = { enabled: false, wakeH: 6, wakeM: 30, goal: 480 };

export function bedtimeOf(c: BedtimeCfg) {
  const t = (((c.wakeH * 60 + c.wakeM - c.goal) % 1440) + 1440) % 1440;
  return { h: Math.floor(t / 60), m: t % 60 };
}

const GOALS = [360, 420, 450, 480, 540];
const goalLabel = (g: number) => `${Math.floor(g / 60)}${g % 60 ? '.5' : ''}h`;

export function Bedtime({
  cfg, h24, onChange, onCreateAlarm,
}: { cfg: BedtimeCfg; h24: boolean; onChange: (c: BedtimeCfg) => void; onCreateAlarm: (h: number, m: number) => void }) {
  const bt = bedtimeOf(cfg);
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Header title="Bedtime" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <Hero>
          <Label>Go to bed at</Label>
          <BigTime h={bt.h} m={bt.m} h24={h24} size={64} weight="200" />
          <Txt style={{ fontSize: 15, opacity: 0.85, marginTop: 2 }}>
            {goalLabel(cfg.goal)} of sleep · {untilText(nextDaily(bt.h, bt.m))}
          </Txt>
        </Hero>

        <Glass style={{ paddingVertical: 14 }}>
          <Label style={{ marginLeft: 6 }}>Wake up at</Label>
          <TimePicker h={cfg.wakeH} m={cfg.wakeM} h24={h24} onChange={(h, m) => onChange({ ...cfg, wakeH: h, wakeM: m })} />
        </Glass>

        <Glass>
          <Label>Sleep goal</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: -8 }}>
            {GOALS.map((g) => <Chip key={g} label={goalLabel(g)} selected={cfg.goal === g} onPress={() => onChange({ ...cfg, goal: g })} />)}
          </View>
          <Txt style={{ opacity: 0.5, fontSize: 13, marginTop: 12 }}>Most adults feel best with 7–9 hours of sleep.</Txt>
        </Glass>

        <Glass style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Txt style={{ fontSize: 17, fontWeight: '600' }}>Bedtime reminder</Txt>
            <Txt style={{ opacity: 0.5, fontSize: 13, marginTop: 2 }}>Rings every day at bedtime</Txt>
          </View>
          <Switch value={cfg.enabled} onValueChange={(v) => onChange({ ...cfg, enabled: v })} {...switchProps} />
        </Glass>

        <GhostBtn title="Create wake-up alarm for this time" onPress={() => onCreateAlarm(cfg.wakeH, cfg.wakeM)} />
      </ScrollView>
    </View>
  );
}

// ======================================================================
// Ring screen for the Timer / Bedtime reminder
// ======================================================================
export function UtilRing({ kind, dark, onStop }: { kind: 'timer' | 'bedtime'; dark: boolean; onStop: () => void }) {
  const timer = kind === 'timer';
  return (
    <Screen dark={dark}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', justifyContent: 'center', height: 300 }}>
          <Pulse size={280} />
          <Txt style={{ fontSize: 72 }}>{timer ? '⏳' : '🌙'}</Txt>
          <Txt style={{ fontSize: 34, fontWeight: '300', marginTop: 10 }}>{timer ? 'Time’s up' : 'Time for bed'}</Txt>
          <Txt style={{ opacity: 0.6, marginTop: 6 }}>{timer ? 'Your timer has finished' : 'Wind down and get some rest'}</Txt>
        </View>
        <Btn title="Stop" onPress={onStop} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lapRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  unit: { fontSize: 14, opacity: 0.6, marginHorizontal: 4, marginTop: 2 },
  addBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  sheet: { backgroundColor: '#1a1640', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 30 },
  search: {
    color: '#fff', fontSize: 16, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  cityRow: { flexDirection: 'row', alignItems: 'baseline', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
});
