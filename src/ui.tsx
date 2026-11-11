import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, PanResponder, Pressable, ScrollView, StatusBar,
  StyleProp, StyleSheet, Text, TextProps, View, ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { pad } from './lib';

export const ACCENT = ['#ff9a6c', '#ff5f8d'];
export const ACCENT_SOLID = '#ff8a73';

export const Txt = ({ style, ...p }: TextProps) => <Text {...p} style={[{ color: '#fff' }, style]} />;

export const Label = ({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) => (
  <Txt style={[{ fontSize: 12, letterSpacing: 1.6, opacity: 0.55, fontWeight: '600', marginBottom: 6 }, style as any]}>
    {children.toUpperCase()}
  </Txt>
);

// ---------- Background ----------
export function Screen({ dark = true, children }: { dark?: boolean; children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={dark ? ['#0b0d1f', '#1b1646', '#3b1f5e'] : ['#6a5a9c', '#c8789f', '#ffb07c']}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={{ flex: 1 }}
    >
      <View pointerEvents="none" style={[s.orb, { top: -90, right: -110, backgroundColor: 'rgba(255,110,160,0.10)' }]} />
      <View pointerEvents="none" style={[s.orb, { bottom: -130, left: -130, backgroundColor: 'rgba(90,190,255,0.08)' }]} />
      <View style={{ flex: 1, paddingTop: (StatusBar.currentHeight ?? 24) + 6 }}>{children}</View>
    </LinearGradient>
  );
}

// ---------- Cards ----------
export const Glass = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[s.glass, style]}>{children}</View>
);

export const Hero = ({ children }: { children: React.ReactNode }) => (
  <LinearGradient
    colors={['rgba(255,154,108,0.30)', 'rgba(255,95,141,0.12)']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={s.hero}
  >
    {children}
  </LinearGradient>
);

// ---------- Buttons ----------
export const Btn = ({ title, onPress, style }: { title: string; onPress: () => void; style?: StyleProp<ViewStyle> }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }, style]}>
    <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btn}>
      <Txt style={s.btnText}>{title}</Txt>
    </LinearGradient>
  </Pressable>
);

export const GhostBtn = ({ title, onPress, style }: { title: string; onPress: () => void; style?: StyleProp<ViewStyle> }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [s.ghost, pressed && { opacity: 0.7 }, style]}>
    <Txt style={{ fontSize: 17, fontWeight: '600' }}>{title}</Txt>
  </Pressable>
);

export const IconBtn = ({ icon, onPress }: { icon: string; onPress: () => void }) => (
  <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.7 }]}>
    <Txt style={{ fontSize: 20 }}>{icon}</Txt>
  </Pressable>
);

export const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    style={[s.chip, selected && { backgroundColor: ACCENT_SOLID, borderColor: ACCENT_SOLID }]}
  >
    <Txt style={{ fontWeight: selected ? '700' : '500', opacity: selected ? 1 : 0.8 }}>{label}</Txt>
  </Pressable>
);

export const BackRow = ({ title, onBack }: { title: string; onBack: () => void }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
    <Pressable onPress={onBack} hitSlop={10} style={[s.iconBtn, { marginRight: 14 }]}>
      <Txt style={{ fontSize: 22, marginTop: -2 }}>‹</Txt>
    </Pressable>
    <Txt style={{ fontSize: 28, fontWeight: '700' }}>{title}</Txt>
  </View>
);

// ---------- Time display ----------
export function BigTime({
  h, m, h24, size = 40, weight = '300',
}: { h: number; m: number; h24: boolean; size?: number; weight?: '200' | '300' | '400' | '700' }) {
  const t = h24 ? `${pad(h)}:${pad(m)}` : `${h % 12 === 0 ? 12 : h % 12}:${pad(m)}`;
  return (
    <Text style={{ color: '#fff', fontSize: size, fontWeight: weight }}>
      {t}
      {!h24 && <Text style={{ fontSize: size * 0.36, fontWeight: '500', opacity: 0.7 }}> {h >= 12 ? 'PM' : 'AM'}</Text>}
    </Text>
  );
}

// ---------- Day dots ----------
export function DayDots({
  days, onToggle, compact = false,
}: { days: number[]; onToggle?: (d: number) => void; compact?: boolean }) {
  const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const size = compact ? 24 : 38;
  return (
    <View style={{ flexDirection: 'row', justifyContent: compact ? 'flex-start' : 'space-between', marginTop: compact ? 8 : 4 }}>
      {letters.map((l, i) => {
        const on = days.includes(i + 1);
        const style = {
          width: size, height: size, borderRadius: size / 2, marginRight: compact ? 6 : 0,
          alignItems: 'center' as const, justifyContent: 'center' as const,
          backgroundColor: on ? ACCENT_SOLID : 'rgba(255,255,255,0.08)',
        };
        const inner = <Txt style={{ fontSize: size * 0.42, fontWeight: '700', opacity: on ? 1 : 0.55 }}>{l}</Txt>;
        return onToggle ? (
          <Pressable key={i} onPress={() => onToggle(i + 1)} style={style}>{inner}</Pressable>
        ) : (
          <View key={i} style={style}>{inner}</View>
        );
      })}
    </View>
  );
}

// ---------- Scroll-wheel time picker ----------
export const WHEEL_ITEM = 58;
const ITEM = WHEEL_ITEM;

export function Wheel({ data, index, onChange, width }: { data: string[]; index: number; onChange: (i: number) => void; width: number }) {
  const ref = useRef<ScrollView>(null);
  const [cur, setCur] = useState(index);
  const last = useRef(index);

  useEffect(() => {
    const t = setTimeout(() => ref.current?.scrollTo({ y: index * ITEM, animated: false }), 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idxOf = (y: number) => Math.max(0, Math.min(data.length - 1, Math.round(y / ITEM)));
  const settle = (y: number) => {
    const i = idxOf(y);
    setCur(i);
    if (i !== last.current) { last.current = i; onChange(i); }
  };

  return (
    <View style={{ height: ITEM * 3, width, overflow: 'hidden' }}>
      <ScrollView
        ref={ref}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM}
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: ITEM }}
        onScroll={(e) => {
          const i = idxOf(e.nativeEvent.contentOffset.y);
          if (i !== cur) setCur(i);
        }}
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => settle(e.nativeEvent.contentOffset.y)}
      >
        {data.map((d, i) => (
          <Pressable
            key={d + i}
            style={{ height: ITEM, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => { ref.current?.scrollTo({ y: i * ITEM, animated: true }); setCur(i); last.current = i; onChange(i); }}
          >
            <Txt style={{ fontSize: i === cur ? 40 : 28, fontWeight: i === cur ? '300' : '200', opacity: i === cur ? 1 : 0.3 }}>{d}</Txt>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function TimePicker({ h, m, h24, onChange }: { h: number; m: number; h24: boolean; onChange: (h: number, m: number) => void }) {
  const hours = h24
    ? Array.from({ length: 24 }, (_, i) => pad(i))
    : Array.from({ length: 12 }, (_, i) => String(i + 1));
  const minutes = Array.from({ length: 60 }, (_, i) => pad(i));
  const hourIdx = h24 ? h : (h % 12 === 0 ? 12 : h % 12) - 1;
  const pm = h >= 12;

  const setHour = (i: number) => {
    if (h24) onChange(i, m);
    else onChange((i + 1) % 12 + (pm ? 12 : 0), m);
  };
  const setPeriod = (i: number) => {
    const base = h % 12;
    onChange(base + (i === 1 ? 12 : 0), m);
  };

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', height: ITEM, left: 8, right: 8, borderRadius: 20,
          backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Wheel data={hours} index={hourIdx} onChange={setHour} width={84} />
        <Txt style={{ fontSize: 36, fontWeight: '300', marginHorizontal: 2, marginTop: -4 }}>:</Txt>
        <Wheel data={minutes} index={m} onChange={(i) => onChange(h, i)} width={84} />
        {!h24 && <Wheel data={['AM', 'PM']} index={pm ? 1 : 0} onChange={setPeriod} width={84} />}
      </View>
    </View>
  );
}

// ---------- Pulse (ring screen) ----------
export function Pulse({ size = 250 }: { size?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    a.start();
    return () => a.stop();
  }, [v]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.5] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        backgroundColor: '#ff7aa0', opacity, transform: [{ scale }],
      }}
    />
  );
}

// ---------- Slide to Stop ----------
export function SlideToStop({ onComplete, label = 'Slide to stop' }: { onComplete: () => void; label?: string }) {
  const KNOB = 64;
  const [w, setW] = useState(Dimensions.get('window').width - 80);
  const pan = useRef(new Animated.Value(0)).current;
  const max = useRef(1);
  const cb = useRef(onComplete);
  const done = useRef(false);
  max.current = Math.max(1, w - KNOB - 8);
  cb.current = onComplete;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => pan.setValue(Math.min(Math.max(0, g.dx), max.current)),
      onPanResponderRelease: (_, g) => {
        if (g.dx >= max.current * 0.9 && !done.current) {
          done.current = true;
          Animated.timing(pan, { toValue: max.current, duration: 100, useNativeDriver: false }).start(() => cb.current());
        } else {
          Animated.spring(pan, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    }),
  ).current;

  const fade = pan.interpolate({ inputRange: [0, Math.max(2, max.current * 0.6)], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View style={s.track} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Animated.Text style={[s.trackText, { opacity: fade }]}>{label}   ›››</Animated.Text>
      <Animated.View {...responder.panHandlers} style={[s.knobWrap, { transform: [{ translateX: pan }] }]}>
        <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.knob}>
          <Txt style={{ fontSize: 28, fontWeight: '700', marginTop: -2 }}>→</Txt>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  orb: { position: 'absolute', width: 340, height: 340, borderRadius: 170 },
  glass: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    marginBottom: 14,
  },
  hero: {
    borderRadius: 32, padding: 24, marginBottom: 22,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },
  btn: { borderRadius: 32, paddingVertical: 18, alignItems: 'center' },
  btnText: { fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },
  ghost: {
    borderRadius: 32, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.06)',
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', marginLeft: 8,
  },
  chip: {
    paddingVertical: 9, paddingHorizontal: 16, borderRadius: 22, marginRight: 8, marginTop: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.06)',
  },
  track: {
    height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center',
  },
  trackText: { color: '#fff', fontSize: 17, letterSpacing: 0.4 },
  knobWrap: { position: 'absolute', left: 4, width: 64, height: 64 },
  knob: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
