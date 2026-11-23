import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { T } from './theme';
import { GLOW, LOGO, Screen, Txt, glowText } from './ui';

export function Splash({ dark }: { dark: boolean }) {
  const prog = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(prog, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start();
  }, [prog]);
  const width = prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Screen variant="full" dark={dark} safeTop={false}>
      <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 54, paddingHorizontal: 34 }}>
        <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={GLOW} style={{ position: 'absolute', width: 340, height: 340, tintColor: T.colors.violet, opacity: 0.6 }} />
          <Image source={LOGO} style={{ width: 170, height: 170 }} />
        </View>
        <Txt style={[{ fontSize: 40, fontWeight: '300', letterSpacing: 7, marginTop: 4 }, glowText(T.colors.violet, 16)]}>AURORA</Txt>
        <Txt style={{ fontSize: 20, color: T.colors.muted, letterSpacing: 2, marginTop: 2 }}>Alarm</Txt>
        <Txt style={{ fontSize: 15, marginTop: 22 }}>Wake Up Brighter ♡</Txt>
        <View style={{ alignSelf: 'stretch', height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)', marginTop: 34, overflow: 'hidden' }}>
          <Animated.View style={{ width, height: 5 }}>
            <LinearGradient colors={T.grad.neon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
          </Animated.View>
        </View>
        <Txt style={{ fontSize: 13, color: T.colors.muted, marginTop: 14 }}>Loading... ♡</Txt>
      </View>
    </Screen>
  );
}
