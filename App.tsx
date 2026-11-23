import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, AppState, BackHandler, Image, PermissionsAndroid, Platform, Pressable, ScrollView,
  StatusBar, ToastAndroid, View,
} from 'react-native';
import { storage } from './src/storage';
import {
  Alarm, AlarmNative, BEDTIME_ID, TIMER_ID, UTILITY_BASE, dateLabel, greeting, nextDaily, nextOccurrence,
  pad, repeatSummary, timeStr, untilText,
} from './src/lib';
import { T } from './src/theme';
import {
  AVATAR, AlarmCard, BigTime, BottomNav, CircleBtn, GlassCard, Icon, IconBubble, NavKey, NeonButton, Screen, Txt,
} from './src/ui';
import { AlarmMenu, Editor, History, Prefs, Ring, RingResult, Settings } from './src/screens';
import {
  BedtimeCfg, BedtimeScreen, DEFAULT_BEDTIME, Stopwatch, Timer, UtilRing, WorldClock, bedtimeOf,
} from './src/clocks';
import { Splash } from './src/Splash';
import { InsetsProvider } from './src/insets';

type Route =
  | { name: 'home' }
  | { name: 'editor'; alarm?: Alarm; template?: Partial<Alarm> }
  | { name: 'history' }
  | { name: 'bedtime' }
  | { name: 'ring'; alarm: Alarm; preview: boolean }
  | { name: 'utilRing'; kind: 'timer' | 'bedtime' };

function AppInner() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({ name: 'Alex', photo: '', dark: true, h24: false });
  const [bed, setBed] = useState<BedtimeCfg>(DEFAULT_BEDTIME);
  const [ready, setReady] = useState(false);
  const [splash, setSplash] = useState(true);
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [nav, setNav] = useState<NavKey>('home');
  const [visited, setVisited] = useState<Record<string, boolean>>({ home: true });
  const [menuAlarm, setMenuAlarm] = useState<Alarm | null>(null);
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

  const selectNav = (k: NavKey) => { setNav(k); setVisited((p) => ({ ...p, [k]: true })); };

  // ---------- splash ----------
  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 1900);
    return () => clearTimeout(t);
  }, []);

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
      if (nav !== 'home') { setNav('home'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [route, nav]);

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
      selectNav('home');
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

  const confirmRemove = (a: Alarm) =>
    Alert.alert('Delete alarm', `Delete “${a.label}”?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { remove(a); } },
    ]);

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

  // ---------- splash ----------
  if (!ready || (splash && route.name === 'home')) {
    return (
      <>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <Splash dark={prefs.dark} />
      </>
    );
  }

  const home = route.name === 'home';
  const tabStyle = (k: NavKey) => ({ flex: 1, display: nav === k ? ('flex' as const) : ('none' as const) });

  // ----- Home tab -----
  const now = new Date();
  const hr = now.getHours();
  const enabled = alarms.filter((a) => a.enabled).sort((a, b) => nextOccurrence(a).getTime() - nextOccurrence(b).getTime());
  const sorted = [...alarms].sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
  const nxt = enabled[0];
  const bt = bedtimeOf(bed);
  const day = hr >= 6 && hr < 18;

  const homeTab = (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 6 }}>
          <Pressable onPress={() => selectNav('settings')}>
            <View style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: T.colors.magenta, padding: 2 }}>
              <Image source={prefs.photo ? { uri: prefs.photo } : AVATAR} style={{ width: '100%', height: '100%', borderRadius: 25 }} />
            </View>
          </Pressable>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Txt style={{ color: T.colors.muted, fontSize: 14 }}>{greeting()}!</Txt>
            <Txt style={{ fontSize: 22, fontWeight: '700' }} numberOfLines={1}>{prefs.name || 'there'} ♡</Txt>
          </View>
          <CircleBtn icon="settings" onPress={() => selectNav('settings')} />
        </View>

        <View style={{ marginTop: 22, marginBottom: 20 }}>
          <BigTime h={hr} m={now.getMinutes()} h24={prefs.h24} size={64} weight="600" glow />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Txt style={{ color: T.colors.muted, fontSize: 16 }}>{dateLabel(now)}</Txt>
            <View style={{ marginLeft: 10 }}>
              <Icon name={day ? 'sun' : 'moon-star'} size={20} color={day ? T.colors.gold : T.colors.cyan} />
            </View>
          </View>
          <Txt style={{ color: T.colors.magenta, fontSize: 13, marginTop: 6 }}>
            {nxt ? `Next alarm ${untilText(nextOccurrence(nxt))}  ·  ${timeStr(nxt.h, nxt.m, prefs.h24)}` : 'No alarm set'}
          </Txt>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <Txt style={{ fontSize: 19, fontWeight: '700' }}>Your Alarms</Txt>
          <Txt style={{ color: T.colors.muted, fontSize: 13 }}>{alarms.length} {alarms.length === 1 ? 'Alarm' : 'Alarms'}</Txt>
        </View>

        {sorted.length === 0 && (
          <GlassCard style={{ alignItems: 'center', paddingVertical: 30 }}>
            <Icon name="alarm-clock" size={34} color={T.colors.muted} />
            <Txt style={{ color: T.colors.muted, marginTop: 10 }}>No alarms yet. Tap “Add Alarm”.</Txt>
          </GlassCard>
        )}

        {sorted.map((a) => (
          <AlarmCard
            key={a.id}
            h={a.h}
            m={a.m}
            h24={prefs.h24}
            repeat={repeatSummary(a.days)}
            label={a.label}
            enabled={a.enabled}
            onToggle={(v) => toggle(a, v)}
            onPress={() => setRoute({ name: 'editor', alarm: a })}
            onMenu={() => setMenuAlarm(a)}
          />
        ))}

        <View style={{ flexDirection: 'row', marginTop: 2 }}>
          <Pressable style={{ flex: 1, marginRight: 6 }} onPress={() => setRoute({ name: 'bedtime' })}>
            <GlassCard style={{ padding: 12, marginBottom: 0, flexDirection: 'row', alignItems: 'center' }}>
              <IconBubble icon="bed" size={40} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Txt style={{ fontWeight: '700' }}>Bedtime</Txt>
                <Txt style={{ color: T.colors.muted, fontSize: 12 }} numberOfLines={1}>{timeStr(bt.h, bt.m, prefs.h24)}{bed.enabled ? ' · on' : ''}</Txt>
              </View>
            </GlassCard>
          </Pressable>
          <Pressable style={{ flex: 1, marginLeft: 6 }} onPress={() => setRoute({ name: 'history' })}>
            <GlassCard style={{ padding: 12, marginBottom: 0, flexDirection: 'row', alignItems: 'center' }}>
              <IconBubble icon="history" size={40} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Txt style={{ fontWeight: '700' }}>History</Txt>
                <Txt style={{ color: T.colors.muted, fontSize: 12 }} numberOfLines={1}>{history.length} events</Txt>
              </View>
            </GlassCard>
          </Pressable>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 }}>
        <NeonButton title="Add Alarm" icon="plus" onPress={() => setRoute({ name: 'editor' })} />
      </View>
    </View>
  );

  // ----- full-screen routes -----
  let overlay: React.ReactNode = null;
  if (route.name === 'editor') {
    overlay = (
      <Editor
        key={route.alarm?.id ?? 'new'}
        alarm={route.alarm}
        template={route.template}
        defaults={{ sound: prefs.defaultSound, soundName: prefs.defaultSoundName }}
        dark={prefs.dark}
        h24={prefs.h24}
        onSave={saveAlarm}
        onDelete={(a) => { remove(a); setRoute({ name: 'home' }); }}
        onBack={() => setRoute({ name: 'home' })}
      />
    );
  } else if (route.name === 'history') {
    overlay = <History items={history} dark={prefs.dark} onBack={() => setRoute({ name: 'home' })} />;
  } else if (route.name === 'bedtime') {
    overlay = (
      <BedtimeScreen
        cfg={bed}
        h24={prefs.h24}
        dark={prefs.dark}
        onChange={changeBed}
        onCreateAlarm={(h, m) => { selectNav('home'); setRoute({ name: 'editor', template: { h, m } }); }}
        onBack={() => setRoute({ name: 'home' })}
      />
    );
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
            <View style={tabStyle('home')}>{homeTab}</View>
            {visited.world && <View style={tabStyle('world')}><WorldClock h24={prefs.h24} /></View>}
            {visited.stopwatch && <View style={tabStyle('stopwatch')}><Stopwatch /></View>}
            {visited.timer && <View style={tabStyle('timer')}><Timer /></View>}
            {visited.settings && (
              <View style={tabStyle('settings')}>
                <Settings
                  prefs={prefs}
                  onChange={(p) => setPrefs((o) => ({ ...o, ...p }))}
                  onOpenBedtime={() => setRoute({ name: 'bedtime' })}
                  onOpenHistory={() => setRoute({ name: 'history' })}
                  onPermissions={requestPermissions}
                />
              </View>
            )}
          </View>
          <BottomNav active={nav} onSelect={selectNav} />
        </Screen>
      </View>
      {!home && overlay}

      <AlarmMenu
        alarm={menuAlarm}
        onClose={() => setMenuAlarm(null)}
        onEdit={() => menuAlarm && setRoute({ name: 'editor', alarm: menuAlarm })}
        onTry={() => menuAlarm && setRoute({ name: 'ring', alarm: menuAlarm, preview: true })}
        onDelete={() => menuAlarm && confirmRemove(menuAlarm)}
      />
    </View>
  );
}

export default function App() {
  return (
    <InsetsProvider>
      <AppInner />
    </InsetsProvider>
  );
}
