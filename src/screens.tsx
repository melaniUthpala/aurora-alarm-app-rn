import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  Alarm, AlarmNative, CHALLENGES, SNOOZES, nativeEvents, nextOccurrence, repeatSummary, untilText,
} from './lib';
import { BUILTIN_SOUNDS, soundLabel } from './sounds';
import { T } from './theme';
import { useInsets } from './insets';
import {
  AVATAR, BigTime, Chip, CircleBtn, DayDots, GLOW, GlassCard, Icon, IconBubble, Label, LOGO, NeonButton, NeonOrb,
  NeonSwitch, OptionRow, Screen, SlideToDismiss, StackHeader, TabHeader, TimePicker, Txt, glowText, sheetStyle,
} from './ui';

const inputStyle = {
  color: '#fff', fontSize: 17, paddingVertical: 4, paddingHorizontal: 0,
} as const;

const CHALLENGE_HINT: Record<string, string> = {
  Math: 'Solve a quick sum to switch the alarm off',
  Shake: 'Shake your phone 20 times to wake up',
  Slide: 'Slide the button across to stop the alarm',
  None: 'Tap one button to stop the alarm',
};

// ================= Prefs =================
export interface Prefs {
  name: string; photo: string; dark: boolean; h24: boolean; defaultSound?: string; defaultSoundName?: string;
}

// ================= Sound sheet =================
function SoundRow({
  id, name, desc, current, onPick,
}: { id: string; name: string; desc?: string; current: string; onPick: (id: string) => void }) {
  const on = current === id;
  return (
    <Pressable onPress={() => onPick(id)} style={sheetStyles.row}>
      <View style={[sheetStyles.radio, on && { borderColor: T.colors.magenta }]}>{on && <View style={sheetStyles.radioDot} />}</View>
      <View style={{ flex: 1 }}>
        <Txt style={{ fontSize: 16, fontWeight: on ? '700' : '500' }}>{name}</Txt>
        {desc ? <Txt style={{ color: T.colors.muted, fontSize: 13, marginTop: 2 }}>{desc}</Txt> : null}
      </View>
      <Icon name="play" size={18} color={T.colors.muted} />
    </Pressable>
  );
}

export function SoundSheet({
  visible, current, onSelect, onClose,
}: { visible: boolean; current: string; onSelect: (sound: string, name?: string) => void; onClose: () => void }) {
  const insets = useInsets();
  const close = () => { AlarmNative.stopPreview().catch(() => {}); onClose(); };

  const choose = (sound: string) => {
    onSelect(sound, undefined);
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

  const customOn = !!current && !current.startsWith('raw:');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,0,18,0.7)' }]} onPress={close} />
        <View style={[sheetStyle, { paddingBottom: 28 + insets.bottom }]}>
          <Txt style={{ fontSize: 22, fontWeight: '800', marginBottom: 4 }}>Alarm sound</Txt>
          <Txt style={{ color: T.colors.muted, fontSize: 13, marginBottom: 8 }}>Tap a sound to hear it</Txt>
          <SoundRow id="" name="Default alarm tone" desc="Your phone’s standard alarm" current={current} onPick={choose} />
          {BUILTIN_SOUNDS.map((b) => (
            <SoundRow key={b.id} id={b.id} name={b.name} desc={b.desc} current={current} onPick={choose} />
          ))}
          <Pressable onPress={pickFromPhone} style={[sheetStyles.row, { borderBottomWidth: 0 }]}>
            <View style={[sheetStyles.radio, customOn && { borderColor: T.colors.magenta }]}>{customOn && <View style={sheetStyles.radioDot} />}</View>
            <View style={{ flex: 1 }}>
              <Txt style={{ fontSize: 16, fontWeight: customOn ? '700' : '500' }}>Choose from phone…</Txt>
              <Txt style={{ color: T.colors.muted, fontSize: 13, marginTop: 2 }}>Pick any ringtone installed on this phone</Txt>
            </View>
            <Icon name="chevron-right" size={20} color={T.colors.muted} />
          </Pressable>
          <NeonButton title="Done" onPress={close} style={{ marginTop: 14 }} />
        </View>
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(190,116,255,0.16)' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.28)', marginRight: 14, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.colors.magenta },
});

// ================= Alarm "..." menu =================
export function AlarmMenu({
  alarm, onClose, onEdit, onTry, onDelete,
}: { alarm: Alarm | null; onClose: () => void; onEdit: () => void; onTry: () => void; onDelete: () => void }) {
  const insets = useInsets();
  const item = (icon: any, title: string, onPress: () => void, color: string = '#fff') => (
    <Pressable onPress={() => { onClose(); onPress(); }} style={sheetStyles.row}>
      <IconBubble icon={icon} size={42} tint={color === '#fff' ? T.colors.magenta : color} />
      <Txt style={{ fontSize: 17, fontWeight: '600', marginLeft: 14, color }}>{title}</Txt>
    </Pressable>
  );
  return (
    <Modal visible={!!alarm} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,0,18,0.7)' }]} onPress={onClose} />
        <View style={[sheetStyle, { paddingBottom: 28 + insets.bottom }]}>
          <Txt style={{ fontSize: 20, fontWeight: '800', marginBottom: 6 }} numberOfLines={1}>{alarm?.label}</Txt>
          {item('pencil', 'Edit alarm', onEdit)}
          {item('zap', 'Try wake-up challenge', onTry)}
          {item('trash', 'Delete alarm', onDelete, T.colors.danger)}
        </View>
      </View>
    </Modal>
  );
}

// ================= Add / Edit alarm =================
export function Editor({
  alarm, template, defaults, dark, h24, onSave, onDelete, onBack,
}: {
  alarm?: Alarm; template?: Partial<Alarm>; defaults?: { sound?: string; soundName?: string };
  dark: boolean; h24: boolean; onSave: (a: Alarm) => void; onDelete?: (a: Alarm) => void; onBack: () => void;
}) {
  const isEdit = !!alarm;
  const [a, setA] = useState<Alarm>(() => {
    if (alarm) return { ...alarm, days: [...alarm.days], sound: alarm.sound ?? '', vibrate: alarm.vibrate !== false };
    const n = new Date(); // new alarms start at the current time
    return {
      id: Date.now() % 2000000000, h: n.getHours(), m: n.getMinutes(),
      label: 'Wake Up', challenge: 'Math', enabled: true, snooze: 5, days: [],
      sound: defaults?.sound ?? '', soundName: defaults?.soundName, vibrate: true,
      ...template,
    };
  });
  const [soundOpen, setSoundOpen] = useState(false);
  const [showWheel, setShowWheel] = useState(!isEdit);
  const [open, setOpen] = useState<'repeat' | 'challenge' | 'snooze' | null>(null);

  const stopPreview = () => { AlarmNative.stopPreview().catch(() => {}); };
  const back = () => { stopPreview(); onBack(); };
  const save = () => { stopPreview(); onSave({ ...a, label: a.label.trim() || 'Wake Up' }); };
  const confirmDelete = () =>
    Alert.alert('Delete alarm', 'Delete this alarm?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { stopPreview(); if (alarm) onDelete?.(alarm); } },
    ]);

  const toggleDay = (d: number) =>
    setA((p) => ({ ...p, days: p.days.includes(d) ? p.days.filter((x) => x !== d) : [...p.days, d].sort() }));
  const toggleOpen = (k: 'repeat' | 'challenge' | 'snooze') => setOpen((o) => (o === k ? null : k));

  return (
    <Screen dark={dark}>
      <StackHeader
        title={isEdit ? 'Edit Alarm' : 'Add Alarm'}
        onBack={back}
        right={isEdit ? <CircleBtn icon="trash" tint={T.colors.danger} onPress={confirmDelete} /> : <CircleBtn icon="check" filled onPress={save} />}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {isEdit && (
          <View style={{ alignItems: 'center', marginBottom: 10 }}>
            <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={GLOW} style={{ position: 'absolute', width: 230, height: 230, tintColor: T.colors.violet, opacity: 0.45 }} />
              <Image source={LOGO} style={{ width: 150, height: 150 }} />
            </View>
            <Pressable onPress={() => setShowWheel((v) => !v)} style={{ alignItems: 'center' }}>
              <BigTime h={a.h} m={a.m} h24={h24} size={54} weight="600" glow />
              <Txt style={{ color: T.colors.muted, marginTop: 2 }}>
                {repeatSummary(a.days)}  ·  tap to {showWheel ? 'hide' : 'change'} time
              </Txt>
            </Pressable>
          </View>
        )}

        {showWheel && (
          <GlassCard style={{ paddingVertical: 14 }}>
            <TimePicker h={a.h} m={a.m} h24={h24} onChange={(h, m) => setA((p) => ({ ...p, h, m }))} />
            <Txt style={{ textAlign: 'center', marginTop: 10, color: T.colors.magenta, fontWeight: '600' }}>
              Rings {untilText(nextOccurrence(a))}
            </Txt>
          </GlassCard>
        )}

        <OptionRow
          icon="bell"
          title="Repeat"
          subtitle={repeatSummary(a.days)}
          onPress={() => toggleOpen('repeat')}
          right={<Icon name={open === 'repeat' ? 'chevron-down' : 'chevron-right'} size={20} color={T.colors.muted} />}
        >
          {open === 'repeat' && (
            <View style={{ marginTop: 6 }}>
              <DayDots days={a.days} onToggle={toggleDay} />
              <Txt style={{ color: T.colors.dim, fontSize: 12, marginTop: 10 }}>
                {a.days.length === 0 ? 'No days selected — rings once' : 'Repeats on the selected days'}
              </Txt>
            </View>
          )}
        </OptionRow>

        <OptionRow
          icon="music"
          title="Sound"
          subtitle={soundLabel(a.sound, a.soundName)}
          onPress={() => setSoundOpen(true)}
          right={<CircleBtn icon="play" size={40} filled onPress={() => { AlarmNative.previewSound(a.sound ?? '').catch(() => {}); }} />}
        />

        <OptionRow
          icon="vibrate"
          title="Vibration"
          subtitle={a.vibrate !== false ? 'On' : 'Off'}
          right={<NeonSwitch value={a.vibrate !== false} onValueChange={(v) => setA((p) => ({ ...p, vibrate: v }))} />}
        />

        <GlassCard style={{ padding: 12, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconBubble icon="tag" size={46} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Txt style={{ fontSize: 13, color: T.colors.muted }}>Label</Txt>
              <TextInput
                style={inputStyle}
                value={a.label}
                onChangeText={(v) => setA((p) => ({ ...p, label: v }))}
                placeholder="Get Up 💪"
                placeholderTextColor="rgba(255,255,255,0.35)"
              />
            </View>
            <Icon name="pencil" size={18} color={T.colors.muted} />
          </View>
        </GlassCard>

        <OptionRow
          icon="zap"
          title="Wake-up challenge"
          subtitle={a.challenge}
          onPress={() => toggleOpen('challenge')}
          right={<Icon name={open === 'challenge' ? 'chevron-down' : 'chevron-right'} size={20} color={T.colors.muted} />}
        >
          {open === 'challenge' && (
            <View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {CHALLENGES.map((c) => (
                  <Chip key={c} label={c} selected={a.challenge === c} onPress={() => setA((p) => ({ ...p, challenge: c }))} />
                ))}
              </View>
              <Txt style={{ color: T.colors.dim, fontSize: 12, marginTop: 10 }}>{CHALLENGE_HINT[a.challenge]}</Txt>
            </View>
          )}
        </OptionRow>

        <OptionRow
          icon="clock"
          title="Snooze"
          subtitle={`${a.snooze} min`}
          onPress={() => toggleOpen('snooze')}
          right={<Icon name={open === 'snooze' ? 'chevron-down' : 'chevron-right'} size={20} color={T.colors.muted} />}
        >
          {open === 'snooze' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {SNOOZES.map((n) => (
                <Chip key={n} label={`${n} min`} selected={a.snooze === n} onPress={() => setA((p) => ({ ...p, snooze: n }))} />
              ))}
            </View>
          )}
        </OptionRow>

        <Txt style={{ color: T.colors.dim, fontSize: 12, textAlign: 'center', marginVertical: 12 }}>
          Plays at your phone’s alarm volume
        </Txt>

        {isEdit ? (
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, marginRight: 8 }}><NeonButton title="Cancel" variant="ghost" onPress={back} /></View>
            <View style={{ flex: 1, marginLeft: 8 }}><NeonButton title="Update" variant="magenta" onPress={save} /></View>
          </View>
        ) : (
          <NeonButton title="Save Alarm" icon="check" onPress={save} />
        )}
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

// ================= Settings (tab) =================
export function Settings({
  prefs, onChange, onOpenBedtime, onOpenHistory, onPermissions,
}: {
  prefs: Prefs; onChange: (p: Partial<Prefs>) => void;
  onOpenBedtime: () => void; onOpenHistory: () => void; onPermissions: () => void;
}) {
  const [soundOpen, setSoundOpen] = useState(false);

  const pickPhoto = async () => {
    try {
      const res = await launchImageLibrary({ mediaType: 'photo', maxWidth: 400, maxHeight: 400, quality: 0.7, includeBase64: true });
      const asset = res.assets?.[0];
      if (asset?.base64) onChange({ photo: `data:${asset.type || 'image/jpeg'};base64,${asset.base64}` });
    } catch (e) {
      Alert.alert('Photo', String(e));
    }
  };

  const chevron = <Icon name="chevron-right" size={20} color={T.colors.muted} />;

  return (
    <View style={{ flex: 1 }}>
      <TabHeader icon="settings" title="Settings" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <GlassCard style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={pickPhoto}>
            <View style={{ width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: T.colors.magenta, padding: 2 }}>
              <Image source={prefs.photo ? { uri: prefs.photo } : AVATAR} style={{ width: '100%', height: '100%', borderRadius: 33 }} />
            </View>
            <View style={{ position: 'absolute', right: -2, bottom: -2 }}>
              <IconBubble icon="camera" size={24} tint="#fff" />
            </View>
          </Pressable>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <TextInput
              value={prefs.name}
              onChangeText={(v) => onChange({ name: v })}
              placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={{ color: '#fff', fontSize: 20, fontWeight: '700', paddingVertical: 0 }}
            />
            <Txt style={{ color: T.colors.muted, fontSize: 13, marginTop: 3 }}>Wake Up Brighter ♡</Txt>
          </View>
          <Icon name="pencil" size={16} color={T.colors.dim} />
        </GlassCard>

        <OptionRow
          icon="palette"
          title="Appearance"
          subtitle={prefs.dark ? 'Dark · Aurora Night' : 'Aurora Dawn'}
          right={<NeonSwitch value={prefs.dark} onValueChange={(v) => onChange({ dark: v })} />}
        />
        <OptionRow
          icon="clock"
          title="24-hour clock"
          subtitle="Show 18:30 instead of 6:30 PM"
          right={<NeonSwitch value={prefs.h24} onValueChange={(v) => onChange({ h24: v })} />}
        />
        <OptionRow icon="bell" title="Notifications" subtitle="Alarms, reminders & full-screen access" onPress={onPermissions} right={chevron} />
        <OptionRow
          icon="music"
          title="Default alarm sound"
          subtitle={soundLabel(prefs.defaultSound, prefs.defaultSoundName)}
          onPress={() => setSoundOpen(true)}
          right={chevron}
        />
        <OptionRow icon="bed" title="Bedtime" subtitle="Sleep goal & daily reminder" onPress={onOpenBedtime} right={chevron} />
        <OptionRow icon="history" title="History" subtitle="Past alarm events" onPress={onOpenHistory} right={chevron} />
        <OptionRow
          icon="info"
          title="About AURORA"
          subtitle="Version 1.0.0"
          onPress={() =>
            Alert.alert(
              'AURORA Alarm',
              'Version 1.0.0\n\nAlarms with sounds, wake-up challenges (math, shake, slide), bedtime, world clock, stopwatch and timer.\n\nEverything stays on your phone.',
            )
          }
          right={chevron}
        />

        <Txt style={{ textAlign: 'center', color: T.colors.dim, marginTop: 8, fontSize: 13 }}>Made with ♡ AURORA</Txt>
      </ScrollView>

      <SoundSheet
        visible={soundOpen}
        current={prefs.defaultSound ?? ''}
        onSelect={(sound, name) => onChange({ defaultSound: sound, defaultSoundName: name })}
        onClose={() => setSoundOpen(false)}
      />
    </View>
  );
}

// ================= History =================
export function History({ items, dark, onBack }: { items: string[]; dark: boolean; onBack: () => void }) {
  return (
    <Screen dark={dark}>
      <StackHeader title="History" onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <GlassCard style={{ alignItems: 'center', paddingVertical: 30 }}>
            <Icon name="history" size={34} color={T.colors.muted} />
            <Txt style={{ color: T.colors.muted, marginTop: 10 }}>No alarm events yet</Txt>
          </GlassCard>
        ) : (
          items.map((e, i) => {
            const [when, label, result] = e.split(' • ');
            return (
              <GlassCard key={i} style={{ paddingVertical: 14, marginBottom: 10 }}>
                <Txt style={{ fontSize: 17, fontWeight: '600' }}>{label ?? e}</Txt>
                <Txt style={{ color: T.colors.muted, fontSize: 13, marginTop: 3 }}>{[when, result].filter(Boolean).join('  ·  ')}</Txt>
              </GlassCard>
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

  const c = alarm.challenge;

  return (
    <Screen variant="full" dark={dark}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: 28 }}
        scrollEnabled={c === 'Math'}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          <Icon name="bell-ring" size={34} color={T.colors.magenta} />
          <Txt style={[{ fontSize: 21, fontWeight: '600', marginTop: 6 }, glowText(T.colors.violet, 10)]}>Alarm Ringing</Txt>
          <View style={{ marginTop: 14 }}><BigTime h={alarm.h} m={alarm.m} h24={h24} size={72} weight="300" glow /></View>
          <Txt style={{ fontSize: 21, fontWeight: '600', marginTop: 4 }} numberOfLines={1}>{alarm.label}</Txt>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 16 }}>
          {c === 'Math' && (
            <GlassCard style={{ paddingVertical: 22 }}>
              <Label style={{ textAlign: 'center' }}>{RING_TITLE.Math}</Label>
              <Txt style={{ fontSize: 46, fontWeight: '300', textAlign: 'center' }}>{x} + {y} = ?</Txt>
              <TextInput
                style={[inputStyle, { textAlign: 'center', fontSize: 26, marginVertical: 14, borderBottomWidth: 1, borderBottomColor: T.colors.border }]}
                keyboardType="number-pad"
                value={answer}
                onChangeText={setAnswer}
                placeholder="Your answer"
                placeholderTextColor="rgba(255,255,255,0.35)"
              />
              <NeonButton title="Check answer" icon="check" onPress={check} />
            </GlassCard>
          )}
          {c === 'Shake' && (
            <View style={{ alignItems: 'center' }}>
              <NeonOrb>
                <Icon name="vibrate" size={48} />
                <Txt style={{ fontSize: 26, fontWeight: '600', marginTop: 4 }}>{shakes} / 20</Txt>
              </NeonOrb>
              <Txt style={{ color: T.colors.muted, marginTop: 10 }}>Shake your phone — hold it securely</Txt>
              <View style={{ alignSelf: 'stretch', height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 14 }}>
                <View style={{ width: `${Math.min(shakes / 20, 1) * 100}%`, height: 8, borderRadius: 4, backgroundColor: T.colors.magenta }} />
              </View>
            </View>
          )}
          {c === 'Slide' && (
            <NeonOrb><Icon name="pause" size={56} /></NeonOrb>
          )}
          {c === 'None' && (
            <View style={{ alignItems: 'center' }}>
              <NeonOrb onPress={() => finish('dismissed')}><Icon name="pause" size={56} /></NeonOrb>
              <Txt style={{ color: T.colors.muted, marginTop: 8 }}>Tap to stop the alarm</Txt>
            </View>
          )}
        </View>

        {c === 'Slide' && <SlideToDismiss onComplete={() => finish('dismissed')} />}

        <View style={{ marginTop: 14 }}>
          <NeonButton title={`Snooze ${alarm.snooze} min`} icon="moon" variant="ghost" onPress={() => finish('snooze')} />
        </View>
        <Pressable onPress={() => finish('emergency stop')} style={{ padding: 16, alignItems: 'center' }}>
          <Txt style={{ fontSize: 14, color: T.colors.muted }}>Emergency stop</Txt>
        </Pressable>
        {preview && <Txt style={{ textAlign: 'center', color: T.colors.dim, fontSize: 12 }}>Preview only — no alarm sound is playing</Txt>}
      </ScrollView>
    </Screen>
  );
}
