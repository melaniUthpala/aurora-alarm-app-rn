# AURORA — Alarm & Clock (React Native, Android)

A premium alarm and clock app built with **React Native** and a native **Kotlin** alarm engine.

## Features
- **Alarms** — repeat days, label, snooze (1/5/10/15 min), per-alarm sound
- **Sounds** — built-in tones (Chime, Pulse, Sunrise), your phone's default alarm tone, or any ringtone installed on the phone, with live preview
- **Wake-up challenges** — Math, real accelerometer Shake, Slide to Stop, or None
- **Bedtime** — pick your wake-up time and sleep goal, get your bedtime and an optional daily reminder
- **World clock** — add/remove cities with live local time and day/night
- **Stopwatch** — start/pause/resume with laps (fastest/slowest highlighted)
- **Timer** — rings even when the app is closed
- History, profile name and photo, dark/light theme, 12/24-hour clock

## How alarms work
Alarms are scheduled with Android `AlarmManager.setAlarmClock`, play through a foreground service on the alarm
audio stream, show over the lock screen, and are restored after a reboot. The Timer and Bedtime reminder use the
same native engine.

## Requirements
Node.js 20+, JDK 17, Android Studio (Android SDK), an Android phone with USB debugging.

## Run (debug)
```bash
npm install
npx react-native start        # terminal 1
npx react-native run-android  # terminal 2
```
If the phone cannot reach Metro over USB: `adb reverse tcp:8081 tcp:8081`.

## Build a release APK
```bash
cd android
./gradlew assembleRelease
# android/app/build/outputs/apk/release/app-release.apk
```
The release build is currently signed with the debug key (fine for demos, not for the Play Store).

## Project structure
```
App.tsx                      app shell, tabs, navigation, alarm scheduling
src/lib.ts                   types, helpers, native bridge
src/ui.tsx                   theme and shared components (wheel time picker, slide to stop ...)
src/screens.tsx              Editor, Settings, History, Ring
src/clocks.tsx               World clock, Stopwatch, Timer, Bedtime
src/sounds.ts, storage.ts    sound list, storage helper
android/.../AlarmCore.kt     scheduler, receiver, ringing service
android/.../AlarmModule.kt   React Native bridge (alarms, sound picker, shake sensor)
android/.../res/raw/*.wav    built-in alarm tones
```

## Known limits
- Android only. Some phone makers (Xiaomi, Oppo, Realme ...) restrict background apps — allow AURORA to run in the background / disable battery optimisation.
- Only one Timer at a time.
- Custom phone ringtones stored on external storage may fall back to the default tone if Android blocks access.
