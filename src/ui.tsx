import React, { memo, useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Image, ImageStyle, PanResponder, Pressable, ScrollView, StatusBar,
  StyleProp, StyleSheet, Switch, Text, TextProps, View, ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { ICONS, IconName } from './icons';
import { T } from './theme';
import { pad } from './lib';
import { useInsets } from './insets';

const BG = require('../assets/aurora-bg.jpg');
const SPARKLES = require('../assets/sparkles.png');
export const GLOW = require('../assets/glow.png');
const BF_VIOLET = require('../assets/butterfly-violet.png');
const BF_CYAN = require('../assets/butterfly-cyan.png');
export const LOGO = require('../assets/logo-alarm.png');
export const AVATAR = require('../assets/avatar.png');

export const ACCENT_SOLID = T.colors.violet;

// ---------------------------------------------------------------- basics
export const Txt = ({ style, ...p }: TextProps) => <Text {...p} style={[{ color: '#fff' }, style]} />;

export const glowText = (color: string = T.colors.magenta, radius = 14) => ({
  textShadowColor: color,
  textShadowRadius: radius,
  textShadowOffset: { width: 0, height: 0 },
});

export function Icon({
  name, size = 24, color = '#fff', style,
}: { name: IconName; size?: number; color?: string; style?: StyleProp<ImageStyle> }) {
  return <Image source={ICONS[name]} resizeMode="contain" style={[{ width: size, height: size, tintColor: color }, style]} />;
}

export const Label = ({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) => (
  <Txt style={[{ fontSize: 12, letterSpacing: 1.8, color: T.colors.dim, fontWeight: '700', marginBottom: 8 }, style as any]}>
    {children.toUpperCase()}
  </Txt>
);

// ---------------------------------------------------------------- background shell
// Decorative butterfly: static (no animation), fixed position.
export function Butterfly({
  src, size, rotate = 0, style,
}: { src: any; size: number; rotate?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', transform: [{ rotate: `${rotate}deg` }] }, style]}>
      <Image source={src} resizeMode="contain" style={{ width: size, height: size * 0.8, opacity: 0.92 }} />
    </View>
  );
}

type Variant = 'full' | 'soft' | 'plain';

const OVERLAY: Record<string, string[]> = {
  'night-full': ['rgba(8,2,24,0)', 'rgba(8,2,24,0.14)', 'rgba(8,2,24,0.48)'],
  'night-soft': ['rgba(8,2,24,0.30)', 'rgba(8,2,24,0.44)', 'rgba(8,2,24,0.64)'],
  'dawn-full': ['rgba(80,25,140,0)', 'rgba(70,20,120,0.10)', 'rgba(30,8,70,0.42)'],
  'dawn-soft': ['rgba(90,30,150,0.20)', 'rgba(70,20,120,0.34)', 'rgba(30,8,70,0.56)'],
};

export function Screen({
  children, variant = 'soft', dark = true, butterflies = true, safeTop = true,
}: { children: React.ReactNode; variant?: Variant; dark?: boolean; butterflies?: boolean; safeTop?: boolean }) {
  const key = `${dark ? 'night' : 'dawn'}-${variant === 'full' ? 'full' : 'soft'}`;
  const insets = useInsets();
  return (
    <View style={{ flex: 1, backgroundColor: dark ? T.colors.bg : '#1b0a3d' }}>
      {variant !== 'plain' && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image source={BG} resizeMode="cover" style={StyleSheet.absoluteFill as any} />
        </View>
      )}
      <LinearGradient pointerEvents="none" colors={OVERLAY[key]} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}>
        <Image source={SPARKLES} resizeMode="cover" style={StyleSheet.absoluteFill as any} />
      </View>
      {butterflies && (
        <>
          <Butterfly src={BF_VIOLET} size={78} rotate={14} style={{ top: 112, right: 14 }} />
          <Butterfly src={BF_CYAN} size={56} rotate={-20} style={{ top: 330, left: 6 }} />
          <Butterfly src={BF_VIOLET} size={66} rotate={24} style={{ bottom: 190, right: 10 }} />
        </>
      )}
      {/* Safe-area insets keep content (and the bottom navigation) clear of the Android system bars */}
      <View
        style={{
          flex: 1,
          paddingTop: safeTop ? insets.top + 4 : 0,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}
      >
        {children}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- cards & buttons
export const GlassCard = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[s.glass, style]}>{children}</View>
);

export function NeonButton({
  title, onPress, icon, variant = 'primary', style, height = 56,
}: {
  title: string; onPress: () => void; icon?: IconName; variant?: 'primary' | 'magenta' | 'ghost'; style?: StyleProp<ViewStyle>; height?: number;
}) {
  if (variant === 'ghost') {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.ghost, { minHeight: height }, pressed && { opacity: 0.75 }, style]}>
        {icon && <Icon name={icon} size={20} />}
        <Txt style={{ fontSize: 16, fontWeight: '700' }}>{title}</Txt>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.neonWrap, pressed && { opacity: 0.88 }, style]}>
      <LinearGradient
        colors={variant === 'magenta' ? T.grad.magenta : T.grad.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.neon, { minHeight: height }]}
      >
        {icon && <Icon name={icon} size={21} />}
        <Txt style={{ fontSize: 16.5, fontWeight: '700', letterSpacing: 0.3 }}>{title}</Txt>
      </LinearGradient>
    </Pressable>
  );
}

export function IconBubble({ icon, tint = T.colors.magenta, size = 52 }: { icon: IconName; tint?: string; size?: number }) {
  return (
    <LinearGradient colors={T.grad.bubble} style={[s.bubble, { width: size, height: size, borderRadius: size / 2 }]}>
      <Icon name={icon} size={size * 0.46} color={tint} />
    </LinearGradient>
  );
}

export function CircleBtn({
  icon, onPress, size = 44, tint = '#fff', filled = false, style,
}: { icon: IconName; onPress: () => void; size?: number; tint?: string; filled?: boolean; style?: StyleProp<ViewStyle> }) {
  const inner = <Icon name={icon} size={size * 0.46} color={tint} />;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, opacity: pressed ? 0.75 : 1 }, style]}
    >
      {filled ? (
        <LinearGradient colors={T.grad.primary} style={[s.circle, { width: size, height: size, borderRadius: size / 2, borderColor: '#C9A0FF' }]}>
          {inner}
        </LinearGradient>
      ) : (
        <View style={[s.circle, { width: size, height: size, borderRadius: size / 2 }]}>{inner}</View>
      )}
    </Pressable>
  );
}

export const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={[s.chip, selected && s.chipOn]}>
    <Txt style={{ fontSize: 14, fontWeight: selected ? '700' : '500', color: selected ? '#fff' : T.colors.muted }}>{label}</Txt>
  </Pressable>
);

export function DayDots({
  days, onToggle, compact = false,
}: { days: number[]; onToggle?: (d: number) => void; compact?: boolean }) {
  const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const size = compact ? 22 : 38;
  return (
    <View style={{ flexDirection: 'row', justifyContent: compact ? 'flex-start' : 'space-between', marginTop: compact ? 6 : 12 }}>
      {letters.map((l, i) => {
        const on = days.includes(i + 1);
        const style = {
          width: size, height: size, borderRadius: size / 2, marginRight: compact ? 5 : 0,
          alignItems: 'center' as const, justifyContent: 'center' as const,
          backgroundColor: on ? T.colors.purple : 'rgba(255,255,255,0.07)',
          borderWidth: 1, borderColor: on ? '#D8A5FF' : 'rgba(190,116,255,0.25)',
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

export const NeonSwitch = ({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) => (
  <Switch value={value} onValueChange={onValueChange} thumbColor="#fff" trackColor={{ false: T.colors.trackOff, true: T.colors.trackOn }} />
);

export function OptionRow({
  icon, title, subtitle, right, onPress, children,
}: { icon: IconName; title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void; children?: React.ReactNode }) {
  return (
    <GlassCard style={{ padding: 12, marginBottom: 10 }}>
      <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconBubble icon={icon} size={46} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Txt style={{ fontSize: 16, fontWeight: '600' }}>{title}</Txt>
          {subtitle ? <Txt style={{ fontSize: 13, color: T.colors.muted, marginTop: 2 }} numberOfLines={1}>{subtitle}</Txt> : null}
        </View>
        {right}
      </Pressable>
      {children}
    </GlassCard>
  );
}

// ---------------------------------------------------------------- headers
export function TabHeader({ icon, title, right }: { icon: IconName; title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingTop: 6, paddingBottom: 14 }}>
      <Icon name={icon} size={26} color={T.colors.muted} />
      <Txt style={{ flex: 1, fontSize: 21, fontWeight: '700', marginLeft: 12 }}>{title}</Txt>
      {right}
    </View>
  );
}

export function StackHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, paddingTop: 6 }}>
      <CircleBtn icon="chevron-left" onPress={onBack} />
      <Txt style={{ flex: 1, textAlign: 'center', fontSize: 19, fontWeight: '700' }}>{title}</Txt>
      <View style={{ width: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

// ---------------------------------------------------------------- time display
export function BigTime({
  h, m, h24, size = 40, weight = '300', glow = false,
}: { h: number; m: number; h24: boolean; size?: number; weight?: '200' | '300' | '400' | '600' | '700'; glow?: boolean }) {
  const t = h24 ? `${pad(h)}:${pad(m)}` : `${h % 12 === 0 ? 12 : h % 12}:${pad(m)}`;
  return (
    <Text style={[{ color: '#fff', fontSize: size, fontWeight: weight }, glow ? glowText(T.colors.violet, 18) : null]}>
      {t}
      {!h24 && <Text style={{ fontSize: size * 0.34, fontWeight: '500', color: T.colors.muted }}> {h >= 12 ? 'PM' : 'AM'}</Text>}
    </Text>
  );
}

// ---------------------------------------------------------------- alarm card
export function alarmIcon(h: number): IconName {
  if (h >= 20 || h < 5) return 'moon-star';
  if (h >= 9 && h < 17) return 'briefcase';
  return 'alarm-clock';
}

export function AlarmCard({
  h, m, h24, repeat, label, enabled, onToggle, onPress, onMenu,
}: {
  h: number; m: number; h24: boolean; repeat: string; label: string; enabled: boolean;
  onToggle: (v: boolean) => void; onPress: () => void; onMenu: () => void;
}) {
  const icon = alarmIcon(h);
  return (
    <Pressable onPress={onPress} style={[s.alarmCard, !enabled && { opacity: 0.62 }]}>
      <IconBubble icon={icon} size={58} tint={icon === 'briefcase' ? '#FF9A5C' : T.colors.magenta} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <BigTime h={h} m={m} h24={h24} size={29} weight="600" />
        <Txt style={{ color: T.colors.muted, fontSize: 13, marginTop: 1 }} numberOfLines={1}>{repeat}</Txt>
        <Txt style={{ fontSize: 14, fontWeight: '600', marginTop: 1 }} numberOfLines={1}>{label}</Txt>
      </View>
      <View style={{ alignItems: 'center' }}>
        <NeonSwitch value={enabled} onValueChange={onToggle} />
        <Pressable onPress={onMenu} hitSlop={10} style={{ paddingTop: 4 }}>
          <Icon name="ellipsis" size={22} color={T.colors.muted} />
        </Pressable>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------- bottom navigation
export type NavKey = 'home' | 'world' | 'stopwatch' | 'timer' | 'settings';
const NAV: { key: NavKey; label: string; icon: IconName }[] = [
  { key: 'home', label: 'Home', icon: 'house' },
  { key: 'world', label: 'World Clock', icon: 'globe' },
  { key: 'stopwatch', label: 'Stopwatch', icon: 'timer' },
  { key: 'timer', label: 'Timer', icon: 'hourglass' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

export function BottomNav({ active, onSelect }: { active: NavKey; onSelect: (k: NavKey) => void }) {
  return (
    <View style={s.nav}>
      {NAV.map((it) => {
        const on = active === it.key;
        return (
          <Pressable key={it.key} onPress={() => onSelect(it.key)} accessibilityLabel={it.label} style={[s.navItem, on && s.navActive]}>
            <Icon name={it.icon} size={21} color={on ? '#fff' : T.colors.dim} />
            <Txt
              style={{ fontSize: 10, fontWeight: '600', color: on ? '#fff' : T.colors.dim, marginTop: 3, alignSelf: 'stretch', textAlign: 'center' }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {it.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- scroll-wheel time picker
export const WHEEL_ITEM = 54;
const ITEM = WHEEL_ITEM;

export function Wheel({
  data, index, onChange, width,
}: { data: string[]; index: number; onChange: (i: number) => void; width: number }) {
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
        {data.map((d, i) => {
          const dist = Math.abs(i - cur);
          return (
            <Pressable
              key={d + i}
              style={{ height: ITEM, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => { ref.current?.scrollTo({ y: i * ITEM, animated: true }); setCur(i); last.current = i; onChange(i); }}
            >
              <Txt
                style={[
                  { fontSize: dist === 0 ? 36 : 25, fontWeight: dist === 0 ? '700' : '400', opacity: dist === 0 ? 1 : dist === 1 ? 0.5 : 0.22 },
                  dist === 0 ? glowText(T.colors.violet, 12) : null,
                ]}
              >
                {d}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function WheelBand({ children, strong = false, style }: { children: React.ReactNode; strong?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: ITEM, height: ITEM, left: 0, right: 0, borderRadius: 24,
          backgroundColor: strong ? 'rgba(124,58,237,0.38)' : 'rgba(168,85,247,0.14)',
          borderWidth: strong ? 2 : 1, borderColor: strong ? '#C88AFF' : 'rgba(200,138,255,0.4)',
        }}
      />
      {children}
    </View>
  );
}

export function TimePicker({
  h, m, h24, onChange,
}: { h: number; m: number; h24: boolean; onChange: (h: number, m: number) => void }) {
  const hours = h24 ? Array.from({ length: 24 }, (_, i) => pad(i)) : Array.from({ length: 12 }, (_, i) => pad(i + 1));
  const minutes = Array.from({ length: 60 }, (_, i) => pad(i));
  const hourIdx = h24 ? h : (h % 12 === 0 ? 12 : h % 12) - 1;
  const pm = h >= 12;

  const setHour = (i: number) => {
    if (h24) onChange(i, m);
    else onChange((i + 1) % 12 + (pm ? 12 : 0), m);
  };
  const setPeriod = (i: number) => onChange((h % 12) + (i === 1 ? 12 : 0), m);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      <WheelBand>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Wheel data={hours} index={hourIdx} onChange={setHour} width={86} />
          <Txt style={{ fontSize: 32, fontWeight: '600', marginTop: -4 }}>:</Txt>
          <Wheel data={minutes} index={m} onChange={(i) => onChange(h, i)} width={86} />
        </View>
      </WheelBand>
      {!h24 && (
        <WheelBand strong style={{ marginLeft: 10 }}>
          <Wheel data={['AM', 'PM']} index={pm ? 1 : 0} onChange={setPeriod} width={84} />
        </WheelBand>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- neon orb (ringing / big buttons)
export function Pulse({ size = 250 }: { size?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(v, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [v]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.55] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        borderWidth: 3, borderColor: T.colors.magenta, opacity, transform: [{ scale }],
      }}
    />
  );
}

export function NeonOrb({
  size = 170, onPress, children, pulse = true,
}: { size?: number; onPress?: () => void; children: React.ReactNode; pulse?: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size * 1.7, height: size * 1.7, alignSelf: 'center' }}>
      <Image source={GLOW} style={{ position: 'absolute', width: size * 1.7, height: size * 1.7, tintColor: T.colors.violet, opacity: 0.65 }} />
      {pulse && <Pulse size={size} />}
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={{
          width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(80,30,160,0.55)', borderWidth: 3, borderColor: T.colors.magenta,
        }}
      >
        <View
          style={{
            width: size - 26, height: size - 26, borderRadius: (size - 26) / 2, alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(40,12,100,0.8)', borderWidth: 2, borderColor: 'rgba(200,138,255,0.8)',
          }}
        >
          {children}
        </View>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------- circular progress ring (no SVG dependency)
const TICKS = 90;

function mix(a: number[], b: number[], t: number) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}
function tickColor(i: number) {
  const t = i / (TICKS - 1);
  const stops = [[156, 230, 255], [168, 85, 247], [232, 121, 249]];
  const c = t < 0.5 ? mix(stops[0], stops[1], t / 0.5) : mix(stops[1], stops[2], (t - 0.5) / 0.5);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const Tick = memo(({ i, size, on }: { i: number; size: number; on: boolean }) => (
  <View
    pointerEvents="none"
    style={{ position: 'absolute', width: size, height: size, alignItems: 'center', transform: [{ rotate: `${(i * 360) / TICKS}deg` }] }}
  >
    <View
      style={{
        width: 5, height: 15, borderRadius: 3,
        backgroundColor: on ? tickColor(i) : 'rgba(168,85,247,0.16)',
      }}
    />
  </View>
));

export function TickRing({ size = 250, progress, children }: { size?: number; progress: number; children?: React.ReactNode }) {
  const lit = Math.round(Math.max(0, Math.min(1, progress)) * TICKS);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
      <Image source={GLOW} style={{ position: 'absolute', width: size * 1.35, height: size * 1.35, tintColor: T.colors.violet, opacity: 0.35 }} />
      {Array.from({ length: TICKS }, (_, i) => <Tick key={i} i={i} size={size} on={i < lit} />)}
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}

// ---------------------------------------------------------------- big round action button
export function BigRoundButton({ icon, onPress, size = 92 }: { icon: IconName; onPress: () => void; size?: number }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        width: size, height: size, borderRadius: size / 2, opacity: pressed ? 0.85 : 1,
        shadowColor: T.colors.violet, shadowOpacity: 0.9, shadowRadius: 16, elevation: 12,
      }]}
    >
      <LinearGradient
        colors={T.grad.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: T.colors.magenta }}
      >
        <Icon name={icon} size={size * 0.38} />
      </LinearGradient>
    </Pressable>
  );
}

// ---------------------------------------------------------------- slide to dismiss
export function SlideToDismiss({ onComplete, label = 'Slide to Dismiss' }: { onComplete: () => void; label?: string }) {
  const KNOB = 56;
  const [w, setW] = useState(Dimensions.get('window').width - 48);
  const pan = useRef(new Animated.Value(0)).current;
  const max = useRef(1);
  const cb = useRef(onComplete);
  const done = useRef(false);
  max.current = Math.max(1, w - KNOB - 10);
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
      <Animated.Text style={[s.trackText, { opacity: fade }]}>{label}</Animated.Text>
      <Animated.View {...responder.panHandlers} style={[s.knobWrap, { transform: [{ translateX: pan }] }]}>
        <LinearGradient colors={T.grad.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.knob}>
          <Icon name="arrow-right" size={26} />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------- bottom sheet container
export const sheetStyle: ViewStyle = {
  backgroundColor: '#150a33',
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30,
  borderWidth: 1,
  borderBottomWidth: 0,
  borderColor: 'rgba(190,116,255,0.45)',
  padding: 22,
  paddingBottom: 28,
};

const s = StyleSheet.create({
  glass: {
    backgroundColor: T.colors.surface,
    borderWidth: 1,
    borderColor: T.colors.border,
    borderRadius: T.radius.lg,
    padding: 16,
    overflow: 'hidden',
    marginBottom: 14,
  },
  neonWrap: { borderRadius: 40, shadowColor: T.colors.violet, shadowOpacity: 0.8, shadowRadius: 14, elevation: 10 },
  neon: { borderRadius: 40, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ghost: {
    borderRadius: 40, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: T.colors.border, backgroundColor: 'rgba(30,10,70,0.7)',
  },
  bubble: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(220,170,255,0.55)' },
  circle: {
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.colors.border, backgroundColor: 'rgba(30,10,70,0.7)',
  },
  chip: {
    paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, marginRight: 8, marginTop: 8,
    borderWidth: 1, borderColor: 'rgba(190,116,255,0.28)', backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipOn: { backgroundColor: T.colors.purple, borderColor: '#D8A5FF' },
  alarmCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(43,17,83,0.7)',
    borderColor: T.colors.border, borderWidth: 1, borderRadius: 26, padding: 12, marginBottom: 12,
  },
  nav: {
    flexDirection: 'row', marginHorizontal: 12, marginBottom: 12, padding: 6, borderRadius: 30, gap: 2,
    backgroundColor: 'rgba(16,6,40,0.94)', borderWidth: 1, borderColor: T.colors.border,
  },
  navItem: { flex: 1, minHeight: 56, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  navActive: {
    backgroundColor: 'rgba(126,45,235,0.78)', borderWidth: 1, borderColor: '#C88AFF',
    shadowColor: T.colors.violet, shadowOpacity: 0.9, shadowRadius: 10, elevation: 8,
  },
  track: {
    height: 68, borderRadius: 34, backgroundColor: 'rgba(40,14,90,0.65)',
    borderWidth: 1, borderColor: T.colors.border, justifyContent: 'center', alignItems: 'center',
  },
  trackText: { color: '#fff', fontSize: 16, letterSpacing: 0.4, marginLeft: 40 },
  knobWrap: { position: 'absolute', left: 5, width: 56, height: 56 },
  knob: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
