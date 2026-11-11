import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, AppState, BackHandler, PermissionsAndroid, Platform, Pressable, ScrollView,
  StatusBar, Switch, ToastAndroid, View,
} from 'react-native';
import { storage } from './src/storage';
import {
  Alarm, AlarmNative, BEDTIME_ID, TIMER_ID, UTILITY_BASE, greeting, nextDaily, nextOccurrence, pad, timeStr, untilText,
} from './src/lib';
import { soundLabel } from './src/sounds';
import { ACCENT_SOLID, BigTime, Btn, DayDots, Glass, Hero, IconBtn, Label, Screen, Txt } from './src/ui';
import { Editor, History, Prefs, Ring, RingResult, Settings } from './src/screens';
import {
  Bedtime, BedtimeCfg, DEFAULT_BEDTIME, Stopwatch, Timer, UtilRing, WorldClock, bedtimeOf,
} from './src/clocks';

type Route =
  | { name: 'home' }
  | { name: 'editor'; alarm?: Alarm; template?: Partial<Alarm> }
  | { name: 'settings' }
  | { name: 'history' }
  | { name: 'ring'; alarm: Alarm; preview: boolean }
  | { name: 'utilRing'; kind: 'timer' | 'bedtime' };

type Tab = 'world' | 'alarm' | 'bed' | 'stopwatch' | 'timer';
const TABS: { k: Tab; icon: string; label: string }[] = [
  { k: 'world', icon: '🌍', label: 'World' },
  { k: 'alarm', icon: '⏰', label: 'Alarm' },
  { k: 'bed', icon: '🛏️', label: 'Bedtime' },
  { k: 'stopwatch', icon: '⏱️', label: 'Stopwatch' },
  { k: 'timer', icon: '⏳', label: 'Timer' },
];

export default function App() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({ name: 'Alex', photo: '', dark: true, h24: false });
  const [bed, setBed] = useState<BedtimeCfg>(DEFAULT_BEDTIME);
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [tab, setTab] = useState<Tab>('alarm');
  const [visited, setVisited] = useState<Record<string, boolean>>({ alarm: true });
  const [, tick] = useState(0);

  const storageWarned = useRef(false);
  const warnStorage = (e: any) => {
    if (storageWarned.current) return;
    storageWarned.current = true;
    Alert.alert('Storage problem', `Alarms may not be remembered after closing the app.\n${e?.message ?? e}`);
  };
  const alarmsRef = useRef<Alarm[]>([]);
  const ringingRef = useRef(false);
  alarmsRef.current = alarms;

  const selectTab = (k: Tab) => { setTab(k); setVisited((p) => ({ ...p, [k]: true })); };

  // ---------- load / save ----------
  useEffect(() => {
    (async () => {
      try {
        const [a, h, p, b] = await Promise.all([
          storage.getItem('alarms'), storage.getItem('history'), storage.getItem('prefs'), storage.getItem('bedtime'),
        ]);
        if (a) setAlarms(JSON.parse(a));
        if (h) setHistory(JSON.parse(h));
        if (p) setPrefs((old) => ({ ...old, ...JSON.parse(p) }));
        if (b) setBed((old) => ({ ...old, ...JSON.parse(b) }));
      } catch (e) {
        warnStorage(e);
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    Promise.all([
      storage.setItem('alarms', JSON.stringify(alarms)),
      storage.setItem('history', JSON.stringify(history.slice(0, 100))),
      storage.setItem('prefs', JSON.stringify(prefs)),
      storage.setItem('bedtime', JSON.stringify(bed)),
    ]).catch((e) => warnStorage(e));
  }, [alarms, history, prefs, bed, ready]);

  // ---------- bedtime reminder: a daily native alarm ----------
  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        await AlarmNative.cancel(BEDTIME_ID);
        if (bed.enabled) {
          const bt = bedtimeOf(bed);
          await AlarmNative.scheduleAt(BEDTIME_ID, nextDaily(bt.h, bt.m), 'Bedtime', [1, 2, 3, 4, 5, 6, 7]);
        }
      } catch (e: any) {
        if (bed.enabled) Alert.alert('Bedtime reminder', String(e?.message ?? e));
      }
    })();
  }, [bed.enabled, bed.wakeH, bed.wakeM, bed.goal, ready]);

  const changeBed = (c: BedtimeCfg) => {
    if (c.enabled && !bed.enabled) {
      const bt = bedtimeOf(c);
      ToastAndroid.show(`Bedtime reminder set for ${timeStr(bt.h, bt.m, prefs.h24)}`, ToastAndroid.LONG);
    }
    setBed(c);
  };

  // ---------- ringing detection (native service sets a flag) ----------
  const check = useCallback(async () => {
    if (ringingRef.current) return;
    try {
      const id = await AlarmNative.ringing();
      if (id < 0) return;
      if (id >= UTILITY_BASE) {
        ringingRef.current = true;
        setRoute({ name: 'utilRing', kind: id === TIMER_ID ? 'timer' : 'bedtime' });
        return;
      }
      const a = alarmsRef.current.find((x) => x.id === id);
      if (!a) { await AlarmNative.stop(); return; }
      ringingRef.current = true;
      setRoute({ name: 'ring', alarm: a, preview: false });
    } catch {}
  }, []);

  useEffect(() => {
    const t = setInterval(() => { check(); tick((n) => n + 1); }, 1000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => { clearInterval(t); sub.remove(); };
  }, [check]);

  // ---------- Android back button ----------
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (route.name === 'ring') {
        if (route.preview) setRoute({ name: 'home' });
        return true;
      }
      if (route.name === 'utilRing') return true;
      if (route.name !== 'home') { setRoute({ name: 'home' }); return true; }
      return false;
    });
    return () => sub.remove();
  }, [route]);

  // ---------- actions ----------
  const schedule = async (a: Alarm) => {
    await AlarmNative.cancel(a.id);
    if (a.enabled) await AlarmNative.schedule(a);
  };

  const saveAlarm = async (a: Alarm) => {
    try {
      await schedule(a);
      setAlarms((p) => [...p.filter((x) => x.id !== a.id), a]);
      setRoute({ name: 'home' });
      selectTab('alarm');
      if (a.enabled) {
        ToastAndroid.show(`Alarm set for ${timeStr(a.h, a.m, prefs.h24)} • ${untilText(nextOccurrence(a))}`, ToastAndroid.LONG);
      }
    } catch (e: any) {
      Alert.alert('Alarm not saved', `${e?.message ?? e}\nEnable the Alarms & reminders permission.`);
    }
  };

  const toggle = async (a: Alarm, v: boolean) => {
    const updated = { ...a, enabled: v };
    try {
      await schedule(updated);
      setAlarms((p) => p.map((x) => (x.id === a.id ? updated : x)));
    } catch (e: any) {
      Alert.alert('Alarm error', String(e?.message ?? e));
    }
  };

  const remove = async (a: Alarm) => {
    try { await AlarmNative.cancel(a.id); } catch {}
    setAlarms((p) => p.filter((x) => x.id !== a.id));
  };

  const onRingFinish = async (result: RingResult) => {
    if (route.name !== 'ring') return;
    const { alarm: a, preview } = route;
    if (!preview) {
      try { await AlarmNative.stop(); } catch {}
      if (result === 'snooze') {
        try { await AlarmNative.snooze(a.id, Date.now() + a.snooze * 60000); } catch (e: any) { Alert.alert('Snooze failed', String(e?.message ?? e)); }
      } else if (a.days.length === 0) {
        setAlarms((p) => p.map((x) => (x.id === a.id ? { ...x, enabled: false } : x)));
      }
      const d = new Date();
      const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setHistory((p) => [`${stamp} • ${a.label} • ${result}`, ...p]);
      ringingRef.current = false;
    }
    setRoute({ name: 'home' });
  };

  const onUtilStop = async () => {
    try { await AlarmNative.stop(); } catch {}
    ringingRef.current = false;
    setRoute({ name: 'home' });
  };

  const requestPermissions = async () => {
    try {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as any);
      }
      const s = await AlarmNative.status();
      if (!s.exact) { await AlarmNative.openExact(); return; }
      if (!s.fullScreen) { await AlarmNative.openFullScreen(); return; }
      Alert.alert('All set', 'Notifications, alarms and full-screen access are enabled.');
    } catch (e: any) {
      Alert.alert('Permissions', String(e?.message ?? e));
    }
  };

  // ---------- routing ----------
  if (!ready) return <Screen dark><View /></Screen>;

  const home = route.name === 'home';
  const tabStyle = (k: Tab) => ({ flex: 1, display: tab === k ? ('flex' as const) : ('none' as const) });

  // ----- Alarm tab -----
  const enabled = alarms.filter((a) => a.enabled).sort((a, b) => nextOccurrence(a).getTime() - nextOccurrence(b).getTime());
  const sorted = [...alarms].sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
  const nxt = enabled[0];

  const alarmTab = (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 22 }}>
          <View style={{ flex: 1 }}>
            <Txt style={{ opacity: 0.6, fontSize: 15 }}>{greeting()}</Txt>
            <Txt style={{ fontSize: 30, fontWeight: '700' }} numberOfLines={1}>{prefs.name || 'there'}</Txt>
          </View>
          <IconBtn icon="🕘" onPress={() => setRoute({ name: 'history' })} />
          <IconBtn icon="⚙️" onPress={() => setRoute({ name: 'settings' })} />
        </View>

        <Hero>
          <Label>Next alarm</Label>
          {nxt ? (
            <>
              <BigTime h={nxt.h} m={nxt.m} h24={prefs.h24} size={64} weight="200" />
              <Txt style={{ fontSize: 16, opacity: 0.85, marginTop: 2 }}>{nxt.label}  ·  {untilText(nextOccurrence(nxt))}</Txt>
            </>
          ) : (
            <>
              <Txt style={{ fontSize: 30, fontWeight: '300', marginTop: 4 }}>No alarm set</Txt>
              <Txt style={{ opacity: 0.6, marginTop: 4 }}>Tap “Add alarm” to get started</Txt>
            </>
          )}
        </Hero>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <Txt style={{ fontSize: 20, fontWeight: '700' }}>My alarms</Txt>
          <Txt style={{ opacity: 0.5 }}>{alarms.length}</Txt>
        </View>

        {sorted.length === 0 && (
          <Glass style={{ alignItems: 'center', paddingVertical: 30 }}>
            <Txt style={{ fontSize: 34 }}>⏰</Txt>
            <Txt style={{ opacity: 0.6, marginTop: 8 }}>No alarms yet</Txt>
          </Glass>
        )}

        {sorted.map((a) => (
          <Glass key={a.id} style={{ opacity: a.enabled ? 1 : 0.6 }}>
            <Pressable onPress={() => setRoute({ name: 'editor', alarm: a })} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <BigTime h={a.h} m={a.m} h24={prefs.h24} size={38} weight="300" />
                <Txt style={{ opacity: 0.7, marginTop: 2 }} numberOfLines={1}>{a.label}  ·  {a.challenge}</Txt>
                <Txt style={{ opacity: 0.45, fontSize: 12, marginTop: 2 }} numberOfLines={1}>♪ {soundLabel(a.sound, a.soundName)}</Txt>
                {a.days.length === 0 ? (
                  <Txt style={{ opacity: 0.45, fontSize: 13, marginTop: 8 }}>Once</Txt>
                ) : (
                  <DayDots days={a.days} compact />
                )}
              </View>
              <Switch
                value={a.enabled}
                onValueChange={(v) => toggle(a, v)}
                thumbColor="#fff"
                trackColor={{ false: 'rgba(255,255,255,0.25)', true: ACCENT_SOLID }}
              />
            </Pressable>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              <Pressable onPress={() => setRoute({ name: 'ring', alarm: a, preview: true })} style={{ paddingVertical: 6, paddingHorizontal: 12 }}>
                <Txt style={{ opacity: 0.6, fontSize: 14 }}>Try challenge</Txt>
              </Pressable>
              <Pressable onPress={() => remove(a)} style={{ paddingVertical: 6, paddingHorizontal: 12 }}>
                <Txt style={{ color: '#ff8f9c', fontSize: 14 }}>Delete</Txt>
              </Pressable>
            </View>
          </Glass>
        ))}

        <Pressable onPress={requestPermissions} style={{ padding: 16, alignItems: 'center' }}>
          <Txt style={{ opacity: 0.5, fontSize: 13 }}>Alarm permissions</Txt>
        </Pressable>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 }}>
        <Btn title="＋  Add alarm" onPress={() => setRoute({ name: 'editor' })} />
      </View>
    </View>
  );

  // ----- bottom tab bar -----
  const tabBar = (
    <View style={{
      flexDirection: 'row', marginHorizontal: 14, marginBottom: 14, marginTop: 4, padding: 6, borderRadius: 28,
      backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    }}>
      {TABS.map((t) => {
        const on = tab === t.k;
        return (
          <Pressable
            key={t.k}
            onPress={() => selectTab(t.k)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 22, backgroundColor: on ? 'rgba(255,138,115,0.22)' : 'transparent' }}
          >
            <Txt style={{ fontSize: 20 }}>{t.icon}</Txt>
            <Txt style={{ fontSize: 11, marginTop: 2, opacity: on ? 1 : 0.55, fontWeight: on ? '700' : '500' }}>{t.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );

  // ----- full-screen routes (editor, settings, ring ...) -----
  let overlay: React.ReactNode = null;
  if (route.name === 'editor') {
    overlay = (
      <Editor
        key={route.alarm?.id ?? 'new'}
        alarm={route.alarm}
        template={route.template}
        dark={prefs.dark}
        h24={prefs.h24}
        onSave={saveAlarm}
        onBack={() => setRoute({ name: 'home' })}
      />
    );
  } else if (route.name === 'settings') {
    overlay = <Settings prefs={prefs} onChange={(p) => setPrefs((o) => ({ ...o, ...p }))} onBack={() => setRoute({ name: 'home' })} />;
  } else if (route.name === 'history') {
    overlay = <History items={history} dark={prefs.dark} onBack={() => setRoute({ name: 'home' })} />;
  } else if (route.name === 'ring') {
    overlay = <Ring key={`${route.alarm.id}-${route.preview}`} alarm={route.alarm} dark={prefs.dark} h24={prefs.h24} preview={route.preview} onFinish={onRingFinish} />;
  } else if (route.name === 'utilRing') {
    overlay = <UtilRing kind={route.kind} dark={prefs.dark} onStop={onUtilStop} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      {/* Tabs stay mounted (hidden) while a full-screen route is open, so the stopwatch / timer keep running */}
      <View style={{ flex: 1, display: home ? 'flex' : 'none' }}>
        <Screen dark={prefs.dark}>
          <View style={{ flex: 1 }}>
            <View style={tabStyle('alarm')}>{alarmTab}</View>
            {visited.world && <View style={tabStyle('world')}><WorldClock h24={prefs.h24} /></View>}
            {visited.bed && (
              <View style={tabStyle('bed')}>
                <Bedtime
                  cfg={bed}
                  h24={prefs.h24}
                  onChange={changeBed}
                  onCreateAlarm={(h, m) => { selectTab('alarm'); setRoute({ name: 'editor', template: { h, m } }); }}
                />
              </View>
            )}
            {visited.stopwatch && <View style={tabStyle('stopwatch')}><Stopwatch /></View>}
            {visited.timer && <View style={tabStyle('timer')}><Timer /></View>}
          </View>
          {tabBar}
        </Screen>
      </View>
      {!home && overlay}
    </View>
  );
}
