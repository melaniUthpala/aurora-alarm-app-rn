import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState, Dimensions, StatusBar, View } from 'react-native';
import { AlarmNative } from './lib';

export interface Insets { top: number; bottom: number; left: number; right: number }

// Until the native side reports the real values, assume the status-bar height and no bottom overlap.
const DEFAULT: Insets = { top: Math.max(StatusBar.currentHeight ?? 0, 24), bottom: 0, left: 0, right: 0 };
const Ctx = createContext<Insets>(DEFAULT);

export const useInsets = () => useContext(Ctx);

const r = (n: number) => Math.round(n * 2) / 2;

export function InsetsProvider({ children }: { children: React.ReactNode }) {
  const [insets, setInsets] = useState<Insets>(DEFAULT);

  const refresh = useCallback(async () => {
    try {
      const v = await AlarmNative.getInsets();
      if (!v) return;
      // The status bar is always translucent over the app, so the top padding can never be below it.
      const minTop = Math.max(StatusBar.currentHeight ?? 0, 24);
      const next = { top: r(Math.max(v.top, minTop)), bottom: r(v.bottom), left: r(v.left), right: r(v.right) };
      setInsets((p) =>
        p.top === next.top && p.bottom === next.bottom && p.left === next.left && p.right === next.right ? p : next,
      );
    } catch {
      /* native module without getInsets: keep defaults */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t1 = setTimeout(refresh, 300);
    const t2 = setTimeout(refresh, 1200);
    const app = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    const dim = Dimensions.addEventListener('change', () => { refresh(); });
    return () => { clearTimeout(t1); clearTimeout(t2); app.remove(); dim.remove(); };
  }, [refresh]);

  return (
    <Ctx.Provider value={insets}>
      <View style={{ flex: 1 }} onLayout={refresh}>{children}</View>
    </Ctx.Provider>
  );
}
