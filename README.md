# AURORA — Alarm & Clock (React Native, Android)

A neon-glass alarm and clock app built with **React Native** and a native **Kotlin** alarm engine.

## Features
- **Alarms** — repeat days, label, snooze (1/5/10/15 min), per-alarm sound and vibration
- **Sounds** — built-in tones (Chime, Pulse, Sunrise), the phone's default alarm tone, or any ringtone installed on the phone, with live preview
- **Wake-up challenges** — Math, real accelerometer Shake, Slide to Dismiss, or None
- **Bedtime** — wake-up time + sleep goal → bedtime and an optional daily reminder
- **World clock**, **Stopwatch** (laps), **Timer** (rings even when the app is closed)
- History, profile name/photo, Night/Dawn theme, 12/24-hour clock

## How alarms work
Alarms use Android `AlarmManager.setAlarmClock`, play through a foreground service on the alarm audio stream,
show over the lock screen and are restored after a reboot. The Timer and Bedtime reminder use the same engine.
Safe-area insets are read natively so the UI never sits under the Android system bars.

## Requirements
Node.js 20+, JDK 17, Android Studio (Android SDK), an Android phone with USB debugging.

## Build
```bash
npm install
cd android
./gradlew assembleRelease
# android/app/build/outputs/apk/release/app-release.apk
```
Debug on a phone: `npx react-native start` + `npx react-native run-android`.
The release build is signed with the debug key (fine for demos, not for the Play Store).

## Structure
```
App.tsx                      app shell, navigation, alarm scheduling
src/lib.ts                   types, helpers, native bridge
src/ui.tsx, theme.ts         neon-glass design system (icons, wheel picker, nav, ...)
src/screens.tsx              Add/Edit alarm, Settings, History, Ring
src/clocks.tsx               World clock, Stopwatch, Timer, Bedtime
src/insets.tsx               safe-area insets provider
android/.../AlarmCore.kt     scheduler, receiver, ringing service
android/.../AlarmModule.kt   React Native bridge (alarms, sounds, shake sensor, insets)
android/.../res/raw/*.wav    built-in alarm tones
assets/                      icons, aurora background, butterflies, logo
```

## Known limits
Android only. Some phone makers (Xiaomi, Oppo, Realme, ...) restrict background apps: allow AURORA to run in the background.
Only one Timer at a time.
