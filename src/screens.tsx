import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { Alarm, AlarmNative, CHALLENGES, SNOOZES, nativeEvents, nextOccurrence, untilText } from './lib';
import { BUILTIN_SOUNDS, soundLabel } from './sounds';
import {
  ACCENT_SOLID, BackRow, BigTime, Btn, Chip, DayDots, Glass, GhostBtn, Label, Pulse, Screen, SlideToStop, TimePicker, Txt,
} from './ui';

const inputStyle = {
  color: '#fff', fontSize: 18, paddingVertical: 8, paddingHorizontal: 0,
  borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.25)',
} as const;

const switchProps = {
  thumbColor: '#fff',
  trackColor: { false: 'rgba(255,255,255,0.25)', true: ACCENT_SOLID },
};

const CHALLENGE_HINT: Record<string, string> = {
  Math: 'Solve a quick sum to switch the alarm off',
  Shake: 'Shake your phone 20 times to wake up',
  Slide: 'Slide the button across to stop the alarm',
  None: 'Tap one button to stop the alarm',
};


// ================= Sound sheet =================
function SoundSheet({
  visible, current, onSelect, onClose,
}: { visible: boolean; current: string; onSelect: (sound: string, name?: string) => void; onClose: () => void }) {
  const close = () => { AlarmNative.stopPreview().catch(() => {}); onClose(); };

  const choose = (sound: string, name?: string) => {
    onSelect(sound, name);
    AlarmNative.previewSound(sound).catch(() => {});
  };

  const pickFromPhone = async () => {
    try {
      AlarmNative.stopPreview().catch(() => {});
      const res = await AlarmNative.pickSound(current);
      if (res) { onSelect(res.uri, res.title); AlarmNative.previewSound(res.uri).catch(() => {}); }
    } catch (e: any) {
      Alert.alert('Ringtone picker', String(e?.message ?? e));
    }
  };

  const Row = ({ id, name, desc }: { id: string; name: string; desc?: string }) => {
    const on = current === id;
    return (
      <Pressable onPress={() => choose(id)} style={sheetStyles.row}>
        <View style={[sheetStyles.radio, on && { borderColor: ACCENT_SOLID }]}>
          {on && <View style={sheetStyles.radioDot} />}
        </View>
        <View style={{ flex: 1 }}>
          <Txt style={{ fontSize: 17, fontWeight: on ? '700' : '500' }}>{name}</Txt>
          {desc ? <Txt style={{ opacity: 0.5, fontSize: 13, marginTop: 2 }}>{desc}</Txt> : null}
        </View>
        <Txt style={{ opacity: 0.6, fontSize: 18 }}>▶</Txt>
      </Pressable>
    );
  };

  const customOn = !!current && !current.startsWith('raw:');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} onPress={close} />
        <View style={sheetStyles.sheet}>
          <Txt style={{ fontSize: 22, fontWeight: '700', marginBottom: 6 }}>Alarm sound</Txt>
          <Txt style={{ opacity: 0.5, fontSize: 13, marginBottom: 10 }}>Tap a sound to hear it</Txt>
          <Row id="" name="Default alarm tone" desc="Your phone’s standard alarm" />
          {BUILTIN_SOUNDS.map((b) => <Row key={b.id} id={b.id} name={b.name} desc={b.desc} />)}
          <Pressable onPress={pickFromPhone} style={[sheetStyles.row, { borderBottomWidth: 0 }]}>
            <View style={[sheetStyles.radio, customOn && { borderColor: ACCENT_SOLID }]}>
              {customOn && <View style={sheetStyles.radioDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <Txt style={{ fontSize: 17, fontWeight: customOn ? '700' : '500' }}>Choose from phone…</Txt>
              <Txt style={{ opacity: 0.5, fontSize: 13, marginTop: 2 }}>Pick any ringtone installed on this phone</Txt>
            </View>
            <Txt style={{ opacity: 0.6, fontSize: 20 }}>›</Txt>
          </Pressable>
          <Btn title="Done" onPress={close} style={{ marginTop: 14 }} />
        </View>
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  sheet: { backgroundColor: '#1a1640', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 30 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', marginRight: 14, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ACCENT_SOLID },
});

// ================= Editor =================
export function Editor({
  alarm, template, dark, h24, onSave, onBack,
}: { alarm?: Alarm; template?: Partial<Alarm>; dark: boolean; h24: boolean; onSave: (a: Alarm) => void; onBack: () => void }) {
  const [a, setA] = useState<Alarm>(() => {
    if (alarm) return { ...alarm, days: [...alarm.days], sound: alarm.sound ?? '' };
    const n = new Date(); // new alarms start at the current time
    return {
      id: Date.now() % 2000000000, h: n.getHours(), m: n.getMinutes(),
      label: 'Wake Up', challenge: 'Math', enabled: true, snooze: 5, days: [], sound: '',
      ...template,
    };
  });
  const [soundOpen, setSoundOpen] = useState(false);

  const toggleDay = (d: number) =>
    setA((p) => ({ ...p, days: p.days.includes(d) ? p.days.filter((x) => x !== d) : [...p.days, d].sort() }));

  return (
    <Screen dark={dark}>
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <BackRow title={alarm ? 'Edit alarm' : 'New alarm'} onBack={() => { AlarmNative.stopPreview().catch(() => {}); onBack(); }} />

        <Glass style={{ paddingVertical: 14 }}>
          <TimePicker h={a.h} m={a.m} h24={h24} onChange={(h, m) => setA((p) => ({ ...p, h, m }))} />
          <Txt style={{ textAlign: 'center', marginTop: 10, color: ACCENT_SOLID, fontWeight: '600' }}>
            Rings {untilText(nextOccurrence(a))}
          </Txt>
        </Glass>

        <Glass>
          <Label>Label</Label>
          <TextInput
            style={inputStyle}
            value={a.label}
            onChangeText={(v) => setA((p) => ({ ...p, label: v }))}
            placeholder="Wake Up"
            placeholderTextColor="rgba(255,255,255,0.35)"
          />
        </Glass>

        <Glass>
          <Label>Repeat</Label>
          <DayDots days={a.days} onToggle={toggleDay} />
          <Txt style={{ opacity: 0.5, fontSize: 13, marginTop: 10 }}>
            {a.days.length === 0 ? 'No days selected — rings once' : 'Repeats on the selected days'}
          </Txt>
        </Glass>

        <Pressable onPress={() => setSoundOpen(true)}>
          <Glass style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Label>Sound</Label>
              <Txt style={{ fontSize: 18, fontWeight: '600' }} numberOfLines={1}>{soundLabel(a.sound, a.soundName)}</Txt>
            </View>
            <Txt style={{ opacity: 0.6, fontSize: 24 }}>›</Txt>
          </Glass>
        </Pressable>

        <Glass>
          <Label>Wake-up challenge</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: -8 }}>
            {CHALLENGES.map((c) => (
              <Chip key={c} label={c} selected={a.challenge === c} onPress={() => setA((p) => ({ ...p, challenge: c }))} />
            ))}
          </View>
          <Txt style={{ opacity: 0.5, fontSize: 13, marginTop: 12 }}>{CHALLENGE_HINT[a.challenge]}</Txt>
        </Glass>

        <Glass>
          <Label>Snooze</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: -8 }}>
            {SNOOZES.map((n) => (
              <Chip key={n} label={`${n} min`} selected={a.snooze === n} onPress={() => setA((p) => ({ ...p, snooze: n }))} />
            ))}
          </View>
        </Glass>

        <Txt style={{ opacity: 0.45, fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
          Plays at your phone’s alarm volume
        </Txt>
        <Btn title="Save alarm" onPress={() => { AlarmNative.stopPreview().catch(() => {}); onSave({ ...a, label: a.label.trim() || 'Wake Up' }); }} />
      </ScrollView>
      <SoundSheet
        visible={soundOpen}
        current={a.sound ?? ''}
        onSelect={(sound, name) => setA((p) => ({ ...p, sound, soundName: name }))}
        onClose={() => setSoundOpen(false)}
      />
    </Screen>
  );
}

// ================= Settings =================
export interface Prefs { name: string; photo: string; dark: boolean; h24: boolean }

export function Settings({ prefs, onChange, onBack }: { prefs: Prefs; onChange: (p: Partial<Prefs>) => void; onBack: () => void }) {
  const pickPhoto = async () => {
    try {
      const res = await launchImageLibrary({ mediaType: 'photo', maxWidth: 400, maxHeight: 400, quality: 0.7, includeBase64: true });
      const asset = res.assets?.[0];
      if (asset?.base64) onChange({ photo: `data:${asset.type || 'image/jpeg'};base64,${asset.base64}` });
    } catch (e) {
      Alert.alert('Photo', String(e));
    }
  };

  const Row = ({ title, sub, value, onValueChange }: { title: string; sub: string; value: boolean; onValueChange: (v: boolean) => void }) => (
    <Glass style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
      <View style={{ flex: 1 }}>
        <Txt style={{ fontSize: 17, fontWeight: '600' }}>{title}</Txt>
        <Txt style={{ opacity: 0.5, fontSize: 13, marginTop: 2 }}>{sub}</Txt>
      </View>
      <Switch value={value} onValueChange={onValueChange} {...switchProps} />
    </Glass>
  );

  const features = ['Math, Shake and Slide challenges', 'Snooze and repeat days', 'Private: everything stays on your phone'];

  return (
    <Screen dark={prefs.dark}>
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <BackRow title="Settings" onBack={onBack} />

        <Glass style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={pickPhoto}>
            <View style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 2, borderColor: ACCENT_SOLID, padding: 3 }}>
              {prefs.photo ? (
                <Image source={{ uri: prefs.photo }} style={{ width: '100%', height: '100%', borderRadius: 36 }} />
              ) : (
                <View style={{ flex: 1, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Txt style={{ fontSize: 26 }}>📷</Txt>
                </View>
              )}
            </View>
          </Pressable>
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Txt style={{ fontSize: 22, fontWeight: '700' }} numberOfLines={1}>{prefs.name || 'Your name'}</Txt>
            <Txt style={{ opacity: 0.5, fontSize: 13, marginTop: 2 }}>Tap the photo to change it</Txt>
          </View>
        </Glass>

        <Glass>
          <Label>Your name</Label>
          <TextInput style={inputStyle} value={prefs.name} onChangeText={(v) => onChange({ name: v })} placeholderTextColor="rgba(255,255,255,0.35)" />
        </Glass>

        <Row title="Dark theme" sub="Midnight aurora look" value={prefs.dark} onValueChange={(v) => onChange({ dark: v })} />
        <Row title="24-hour clock" sub="Show 18:30 instead of 6:30 PM" value={prefs.h24} onValueChange={(v) => onChange({ h24: v })} />

        <Glass>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Txt style={{ fontSize: 20, fontWeight: '700', letterSpacing: 2 }}>AURORA</Txt>
            <Txt style={{ opacity: 0.5, fontSize: 13 }}>Version 1.0</Txt>
          </View>
          <Txt style={{ opacity: 0.6, marginTop: 4, marginBottom: 12 }}>A smarter way to wake up</Txt>
          {features.map((f) => (
            <View key={f} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: ACCENT_SOLID, marginRight: 12 }} />
              <Txt style={{ flex: 1, opacity: 0.85, fontSize: 14 }}>{f}</Txt>
            </View>
          ))}
        </Glass>

        <Btn title="Done" onPress={onBack} style={{ marginTop: 6 }} />
      </ScrollView>
    </Screen>
  );
}

// ================= History =================
export function History({ items, dark, onBack }: { items: string[]; dark: boolean; onBack: () => void }) {
  return (
    <Screen dark={dark}>
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <BackRow title="History" onBack={onBack} />
        {items.length === 0 ? (
          <Glass><Txt style={{ textAlign: 'center', opacity: 0.6 }}>No alarm events yet</Txt></Glass>
        ) : (
          items.map((e, i) => {
            const [when, label, result] = e.split(' • ');
            return (
              <Glass key={i} style={{ paddingVertical: 14 }}>
                <Txt style={{ fontSize: 17, fontWeight: '600' }}>{label ?? e}</Txt>
                <Txt style={{ opacity: 0.55, fontSize: 13, marginTop: 3 }}>{[when, result].filter(Boolean).join('  ·  ')}</Txt>
              </Glass>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

// ================= Ring screen =================
export type RingResult = 'dismissed' | 'snooze' | 'emergency stop';

const RING_TITLE: Record<string, string> = {
  Math: 'Solve to wake up', Shake: 'Shake to wake up', Slide: 'Slide to wake up', None: 'Ready to wake up?',
};

export function Ring({
  alarm, dark, h24, preview, onFinish,
}: { alarm: Alarm; dark: boolean; h24: boolean; preview: boolean; onFinish: (r: RingResult) => void }) {
  const [x] = useState(() => Math.floor(Math.random() * 20) + 5);
  const [y] = useState(() => Math.floor(Math.random() * 20) + 5);
  const [answer, setAnswer] = useState('');
  const [shakes, setShakes] = useState(0);
  const shakeCount = useRef(0);
  const done = useRef(false);

  const finish = (r: RingResult) => {
    if (done.current) return;
    done.current = true;
    onFinish(r);
  };

  useEffect(() => {
    if (alarm.challenge !== 'Shake') return;
    const sub = nativeEvents.addListener('AuroraShake', () => {
      shakeCount.current += 1;
      setShakes(shakeCount.current);
      if (shakeCount.current >= 20) finish('dismissed');
    });
    AlarmNative.startShake()
      .then((ok) => { if (!ok) Alert.alert('Sensor unavailable', 'This phone has no motion sensor. Use Snooze or Emergency stop.'); })
      .catch(() => {});
    return () => { sub.remove(); AlarmNative.stopShake().catch(() => {}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const check = () => {
    if (parseInt(answer, 10) === x + y) finish('dismissed');
    else Alert.alert('Not quite', 'Try again');
  };

  return (
    <Screen dark={dark}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 30 }} scrollEnabled={alarm.challenge === 'Math'} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', justifyContent: 'center', height: 250, marginTop: 10 }}>
          <Pulse />
          <Label>Alarm</Label>
          <BigTime h={alarm.h} m={alarm.m} h24={h24} size={84} weight="200" />
          <Txt style={{ fontSize: 20, opacity: 0.85, marginTop: 4 }}>{alarm.label}</Txt>
        </View>

        <Glass style={{ paddingVertical: 22 }}>
          <Txt style={{ fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 18 }}>{RING_TITLE[alarm.challenge]}</Txt>
          {alarm.challenge === 'Math' && (
            <View>
              <Txt style={{ fontSize: 46, fontWeight: '300', textAlign: 'center' }}>{x} + {y} = ?</Txt>
              <TextInput
                style={[inputStyle, { textAlign: 'center', fontSize: 26, marginVertical: 16 }]}
                keyboardType="number-pad"
                value={answer}
                onChangeText={setAnswer}
                placeholder="Your answer"
                placeholderTextColor="rgba(255,255,255,0.35)"
              />
              <Btn title="Check answer" onPress={check} />
            </View>
          )}
          {alarm.challenge === 'Shake' && (
            <View style={{ alignItems: 'center' }}>
              <Txt style={{ fontSize: 64 }}>📳</Txt>
              <Txt style={{ fontSize: 44, fontWeight: '300' }}>{shakes} / 20</Txt>
              <Txt style={{ opacity: 0.6, marginVertical: 10 }}>Shake your phone — hold it securely</Txt>
              <View style={{ alignSelf: 'stretch', height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <View style={{ width: `${Math.min(shakes / 20, 1) * 100}%`, height: 8, borderRadius: 4, backgroundColor: ACCENT_SOLID }} />
              </View>
            </View>
          )}
          {alarm.challenge === 'Slide' && <SlideToStop onComplete={() => finish('dismissed')} />}
          {alarm.challenge === 'None' && <Btn title="Stop alarm" onPress={() => finish('dismissed')} />}
        </Glass>

        <GhostBtn title={`Snooze ${alarm.snooze} min`} onPress={() => finish('snooze')} />
        <Pressable onPress={() => finish('emergency stop')} style={{ padding: 18, alignItems: 'center' }}>
          <Txt style={{ fontSize: 15, opacity: 0.55 }}>Emergency stop</Txt>
        </Pressable>
        {preview && <Txt style={{ textAlign: 'center', opacity: 0.5, fontSize: 13 }}>Preview only — no alarm sound is playing</Txt>}
      </ScrollView>
    </Screen>
  );
}
