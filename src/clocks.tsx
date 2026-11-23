import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AlarmNative, TIMER_ID, nextDaily, pad, untilText } from './lib';
import { storage } from './storage';
import { T } from './theme';
import { useInsets } from './insets';
import {
  BigRoundButton, BigTime, Chip, CircleBtn, GLOW, GlassCard, Icon, IconBubble, Label, NeonButton, NeonOrb,
  NeonSwitch, OptionRow, Screen, SlideToDismiss, StackHeader, TabHeader, TickRing, TimePicker, Txt, WHEEL_ITEM, Wheel, glowText, sheetStyle,
} from './ui';

const mono = { fontVariant: ['tabular-nums'] } as any;

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
  const lap = () => { if (running) setLaps((p) => [elapsed, ...p]); };
  const reset = () => { setRunning(false); base.current = 0; setElapsed(0); setLaps([]); };

  const lapTimes = laps.map((t, i) => t - (laps[i + 1] ?? 0));
  const best = lapTimes.length >= 3 ? Math.min(...lapTimes) : -1;
  const worst = lapTimes.length >= 3 ? Math.max(...lapTimes) : -1;

  return (
    <View style={{ flex: 1 }}>
      <TabHeader icon="timer" title="Stopwatch" />
      <View style={{ alignItems: 'center', paddingVertical: 34 }}>
        <Txt style={[{ fontSize: 62, fontWeight: '300' }, mono, glowText(T.colors.violet, 16)]}>{fmt(elapsed)}</Txt>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: 20, marginBottom: 22 }}>
        <CircleBtn icon="reset" size={58} onPress={reset} />
        <BigRoundButton icon={running ? 'pause' : 'play'} onPress={toggle} />
        <CircleBtn icon="flag" size={58} onPress={lap} tint={running ? '#fff' : T.colors.dim} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {laps.length > 0 && (
          <GlassCard style={{ paddingVertical: 6 }}>
            {laps.map((t, i) => {
              const lt = lapTimes[i];
              const color = lt === best ? T.colors.success : lt === worst ? T.colors.danger : '#fff';
              return (
                <View key={laps.length - i} style={[styles.lapRow, i === laps.length - 1 && { borderBottomWidth: 0 }]}>
                  <Txt style={{ color: T.colors.muted, width: 70 }}>Lap {laps.length - i}</Txt>
                  <Txt style={[{ flex: 1, textAlign: 'center', color }, mono]}>{fmt(lt)}</Txt>
                  <Txt style={[{ color: T.colors.muted, width: 110, textAlign: 'right' }, mono]}>{fmt(t)}</Txt>
                </View>
              );
            })}
          </GlassCard>
        )}
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
const PRESETS = [1, 3, 5, 10, 15, 30];

function fmtHMS(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

export function Timer() {
  const [st, setSt] = useState<TState>({ status: 'idle' });
  const [hh, setHh] = useState(0);
  const [mm, setMm] = useState(5);
  const [ss, setSs] = useState(0);
  const [ver, setVer] = useState(0);
  const [custom, setCustom] = useState(false);
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
    if (total <= 0) { setCustom(true); return; }
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
    const totalMs = (hh * 3600 + mm * 60 + ss) * 1000;
    return (
      <View style={{ flex: 1 }}>
        <TabHeader icon="hourglass" title="Timer" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          <Pressable onPress={start}>
            <TickRing size={250} progress={1}>
              <Icon name="hourglass" size={34} color="#fff" />
              <Txt style={[{ fontSize: 40, fontWeight: '300', marginTop: 6 }, mono, glowText(T.colors.violet, 14)]}>{fmtHMS(totalMs)}</Txt>
              <Txt style={{ color: T.colors.muted, marginTop: 2 }}>Tap to Start</Txt>
            </TickRing>
          </Pressable>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 }}>
            {PRESETS.map((p) => <Chip key={p} label={`${p}m`} selected={mm === p && hh === 0 && ss === 0} onPress={() => preset(p)} />)}
          </View>

          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <Pressable onPress={() => setCustom((v) => !v)} style={{ padding: 8 }}>
              <Txt style={{ color: T.colors.magenta, fontWeight: '700' }}>{custom ? 'Hide custom time' : 'Set custom time'}</Txt>
            </Pressable>
          </View>

          {custom && (
            <GlassCard style={{ paddingVertical: 12 }}>
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute', height: WHEEL_ITEM, left: 8, right: 8, borderRadius: 22,
                    backgroundColor: 'rgba(168,85,247,0.14)', borderWidth: 1, borderColor: 'rgba(200,138,255,0.4)',
                  }}
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
            </GlassCard>
          )}

          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <BigRoundButton icon="play" onPress={start} />
          </View>
        </ScrollView>
      </View>
    );
  }

  const remaining = st.status === 'running' ? Math.max(0, st.endsAt - now) : st.remaining;
  const progress = st.total > 0 ? remaining / st.total : 0;
  const paused = st.status === 'paused';

  return (
    <View style={{ flex: 1 }}>
      <TabHeader icon="hourglass" title="Timer" />
      <View style={{ paddingHorizontal: 20 }}>
        <Pressable onPress={paused ? resume : pause}>
          <TickRing size={250} progress={progress}>
            <Icon name="hourglass" size={34} color="#fff" />
            <Txt style={[{ fontSize: 40, fontWeight: '300', marginTop: 6 }, mono, glowText(T.colors.violet, 14)]}>{fmtHMS(remaining)}</Txt>
            <Txt style={{ color: T.colors.muted, marginTop: 2 }}>{paused ? 'Paused · tap to resume' : 'Counting down'}</Txt>
          </TickRing>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 34 }}>
          <CircleBtn icon="x" size={58} onPress={cancel} />
          <View style={{ width: 36 }} />
          <BigRoundButton icon={paused ? 'play' : 'pause'} onPress={paused ? resume : pause} />
        </View>
        <Txt style={{ color: T.colors.dim, fontSize: 12, textAlign: 'center', marginTop: 22 }}>
          The timer will ring even if you close the app
        </Txt>
      </View>
    </View>
  );
}

// ======================================================================
// World clock
// ======================================================================
const CITIES: { id: string; name: string; country: string; cc: string }[] = [
  { id: 'Asia/Colombo', name: 'Sri Lanka', country: 'Colombo', cc: 'LK' },
  { id: 'Asia/Kolkata', name: 'Mumbai', country: 'India', cc: 'IN' },
  { id: 'Asia/Dubai', name: 'Dubai', country: 'UAE', cc: 'AE' },
  { id: 'Asia/Riyadh', name: 'Riyadh', country: 'Saudi Arabia', cc: 'SA' },
  { id: 'Asia/Qatar', name: 'Doha', country: 'Qatar', cc: 'QA' },
  { id: 'Asia/Karachi', name: 'Karachi', country: 'Pakistan', cc: 'PK' },
  { id: 'Asia/Dhaka', name: 'Dhaka', country: 'Bangladesh', cc: 'BD' },
  { id: 'Asia/Bangkok', name: 'Bangkok', country: 'Thailand', cc: 'TH' },
  { id: 'Asia/Singapore', name: 'Singapore', country: 'Singapore', cc: 'SG' },
  { id: 'Asia/Kuala_Lumpur', name: 'Kuala Lumpur', country: 'Malaysia', cc: 'MY' },
  { id: 'Asia/Hong_Kong', name: 'Hong Kong', country: 'China', cc: 'HK' },
  { id: 'Asia/Shanghai', name: 'Shanghai', country: 'China', cc: 'CN' },
  { id: 'Asia/Tokyo', name: 'Tokyo', country: 'Japan', cc: 'JP' },
  { id: 'Asia/Seoul', name: 'Seoul', country: 'South Korea', cc: 'KR' },
  { id: 'Australia/Sydney', name: 'Sydney', country: 'Australia', cc: 'AU' },
  { id: 'Australia/Perth', name: 'Perth', country: 'Australia', cc: 'AU' },
  { id: 'Pacific/Auckland', name: 'Auckland', country: 'New Zealand', cc: 'NZ' },
  { id: 'Europe/London', name: 'London', country: 'United Kingdom', cc: 'GB' },
  { id: 'Europe/Paris', name: 'Paris', country: 'France', cc: 'FR' },
  { id: 'Europe/Berlin', name: 'Berlin', country: 'Germany', cc: 'DE' },
  { id: 'Europe/Rome', name: 'Rome', country: 'Italy', cc: 'IT' },
  { id: 'Europe/Moscow', name: 'Moscow', country: 'Russia', cc: 'RU' },
  { id: 'Europe/Istanbul', name: 'Istanbul', country: 'Turkey', cc: 'TR' },
  { id: 'Africa/Cairo', name: 'Cairo', country: 'Egypt', cc: 'EG' },
  { id: 'Africa/Johannesburg', name: 'Johannesburg', country: 'South Africa', cc: 'ZA' },
  { id: 'Africa/Nairobi', name: 'Nairobi', country: 'Kenya', cc: 'KE' },
  { id: 'America/New_York', name: 'New York', country: 'USA', cc: 'US' },
  { id: 'America/Chicago', name: 'Chicago', country: 'USA', cc: 'US' },
  { id: 'America/Denver', name: 'Denver', country: 'USA', cc: 'US' },
  { id: 'America/Los_Angeles', name: 'Los Angeles', country: 'USA', cc: 'US' },
  { id: 'America/Toronto', name: 'Toronto', country: 'Canada', cc: 'CA' },
  { id: 'America/Sao_Paulo', name: 'São Paulo', country: 'Brazil', cc: 'BR' },
  { id: 'America/Mexico_City', name: 'Mexico City', country: 'Mexico', cc: 'MX' },
];

const DEFAULT_CITIES = ['Asia/Colombo', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];

const flag = (cc: string) => String.fromCodePoint(...cc.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0)));

interface Zoned { h: number; m: number; dayDiff: number; offsetMin: number; dateText: string }

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
    let dateText = '';
    try {
      dateText = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(date);
    } catch {}
    return { h, m: mi, dayDiff, offsetMin: Math.round((there - here) / 60000), dateText };
  } catch {
    return null;
  }
}

function offsetText(min: number) {
  if (min === 0) return 'Same time';
  const sign = min > 0 ? '+' : '-';
  const a = Math.abs(min);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `${sign} ${h}h${m ? ' ' + m + 'm' : ''}`;
}

function localTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; }
}

export function WorldClock({ h24 }: { h24: boolean }) {
  const [ids, setIds] = useState<string[]>(DEFAULT_CITIES);
  const [now, setNow] = useState(new Date());
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const loaded = useRef(false);
  const home = localTz();
  const insets = useInsets();

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
      <TabHeader
        icon="globe"
        title="World Clock"
        right={<CircleBtn icon="plus" filled onPress={() => { setQuery(''); setAdding(true); }} />}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {ids.length === 0 && (
          <GlassCard style={{ alignItems: 'center', paddingVertical: 30 }}>
            <Icon name="globe" size={34} color={T.colors.muted} />
            <Txt style={{ color: T.colors.muted, marginTop: 8 }}>Tap + to add a city</Txt>
          </GlassCard>
        )}
        {ids.map((id) => {
          const city = CITIES.find((c) => c.id === id);
          if (!city) return null;
          const z = zoned(id, now);
          const isHome = id === home;
          return (
            <GlassCard key={id} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 12 }}>
              <View style={styles.flagBox}><Txt style={{ fontSize: 28 }}>{flag(city.cc)}</Txt></View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Txt style={{ fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{city.name}</Txt>
                {z ? (
                  <>
                    <BigTime h={z.h} m={z.m} h24={h24} size={30} weight="600" />
                    <Txt style={{ color: T.colors.muted, fontSize: 12 }}>{z.dateText}</Txt>
                  </>
                ) : (
                  <Txt style={{ color: T.colors.muted, fontSize: 12, marginTop: 4 }}>Time zone data unavailable</Txt>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch' }}>
                <Pressable onPress={() => setIds((p) => p.filter((x) => x !== id))} hitSlop={10}>
                  <Icon name="x" size={16} color={T.colors.dim} />
                </Pressable>
                {isHome ? <IconBubble icon="house" size={38} /> : <Txt style={{ color: T.colors.muted, fontSize: 13 }}>{z ? offsetText(z.offsetMin) : ''}</Txt>}
              </View>
            </GlassCard>
          );
        })}
      </ScrollView>

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,0,18,0.7)' }]} onPress={() => setAdding(false)} />
          <View style={[sheetStyle, { maxHeight: '75%', paddingBottom: 28 + insets.bottom }]}>
            <Txt style={{ fontSize: 22, fontWeight: '800', marginBottom: 10 }}>Add a city</Txt>
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
                  <Txt style={{ fontSize: 24, marginRight: 12 }}>{flag(c.cc)}</Txt>
                  <Txt style={{ fontSize: 16, fontWeight: '600' }}>{c.name}</Txt>
                  <Txt style={{ color: T.colors.muted, marginLeft: 8, fontSize: 14 }}>{c.country}</Txt>
                </Pressable>
              ))}
              {available.length === 0 && <Txt style={{ color: T.colors.muted, paddingVertical: 20, textAlign: 'center' }}>No cities found</Txt>}
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

export function BedtimeScreen({
  cfg, h24, dark, onChange, onCreateAlarm, onBack,
}: {
  cfg: BedtimeCfg; h24: boolean; dark: boolean; onChange: (c: BedtimeCfg) => void;
  onCreateAlarm: (h: number, m: number) => void; onBack: () => void;
}) {
  const bt = bedtimeOf(cfg);

  return (
    <Screen dark={dark}>
      <StackHeader title="Bedtime" onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <GlassCard style={{ alignItems: 'center', paddingVertical: 22 }}>
          <View style={{ width: 90, height: 90, alignItems: 'center', justifyContent: 'center' }}>
            <Image source={GLOW} style={{ position: 'absolute', width: 160, height: 160, tintColor: T.colors.violet, opacity: 0.5 }} />
            <Icon name="moon-star" size={52} color={T.colors.magenta} />
          </View>
          <Label style={{ marginTop: 8, marginBottom: 2 }}>Go to bed at</Label>
          <BigTime h={bt.h} m={bt.m} h24={h24} size={60} weight="300" glow />
          <Txt style={{ color: T.colors.muted, marginTop: 4 }}>
            {goalLabel(cfg.goal)} of sleep  ·  {untilText(nextDaily(bt.h, bt.m))}
          </Txt>
        </GlassCard>

        <GlassCard style={{ paddingVertical: 14 }}>
          <Label style={{ marginLeft: 6 }}>Wake up at</Label>
          <TimePicker h={cfg.wakeH} m={cfg.wakeM} h24={h24} onChange={(h, m) => onChange({ ...cfg, wakeH: h, wakeM: m })} />
        </GlassCard>

        <GlassCard>
          <Label>Sleep goal</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: -8 }}>
            {GOALS.map((g) => <Chip key={g} label={goalLabel(g)} selected={cfg.goal === g} onPress={() => onChange({ ...cfg, goal: g })} />)}
          </View>
          <Txt style={{ color: T.colors.dim, fontSize: 12, marginTop: 12 }}>Most adults feel best with 7–9 hours of sleep.</Txt>
        </GlassCard>

        <OptionRow
          icon="bell"
          title="Bedtime reminder"
          subtitle="Rings every day at bedtime"
          right={<NeonSwitch value={cfg.enabled} onValueChange={(v) => onChange({ ...cfg, enabled: v })} />}
        />

        <NeonButton title="Create wake-up alarm for this time" icon="alarm-clock" variant="ghost" onPress={() => onCreateAlarm(cfg.wakeH, cfg.wakeM)} />
      </ScrollView>
    </Screen>
  );
}

// ======================================================================
// Ring screen for the Timer / Bedtime reminder
// ======================================================================
export function UtilRing({ kind, dark, onStop }: { kind: 'timer' | 'bedtime'; dark: boolean; onStop: () => void }) {
  const timer = kind === 'timer';
  return (
    <Screen variant="full" dark={dark}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Icon name="bell-ring" size={34} color={T.colors.magenta} />
          <Txt style={[{ fontSize: 22, fontWeight: '700', marginTop: 8 }, glowText(T.colors.violet, 10)]}>{timer ? 'Time’s up' : 'Time for bed'}</Txt>
          <Txt style={{ color: T.colors.muted, marginTop: 4 }}>{timer ? 'Your timer has finished' : 'Wind down and get some rest'}</Txt>
        </View>
        <NeonOrb><Icon name={timer ? 'hourglass' : 'moon-star'} size={64} /></NeonOrb>
        <View style={{ marginTop: 30 }}><SlideToDismiss label="Slide to Stop" onComplete={onStop} /></View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lapRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(190,116,255,0.16)' },
  unit: { fontSize: 14, color: T.colors.muted, marginHorizontal: 4, marginTop: 2 },
  flagBox: {
    width: 54, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(190,116,255,0.3)',
  },
  search: {
    color: '#fff', fontSize: 16, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: T.colors.border,
  },
  cityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(190,116,255,0.16)' },
});
