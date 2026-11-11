import * as AS from '@react-native-async-storage/async-storage';

// Works with both the classic AsyncStorage API and the newer createAsyncStorage() API.
const mod: any = AS;
const def: any = mod.default ?? mod;
let impl: any = null;

function getImpl() {
  if (impl) return impl;
  if (typeof def?.getItem === 'function' && typeof def?.setItem === 'function') impl = def;
  else if (typeof mod.createAsyncStorage === 'function') impl = mod.createAsyncStorage('aurora');
  else throw new Error('AsyncStorage API not found. Exports: ' + Object.keys(mod).join(', '));
  return impl;
}

export const storage = {
  getItem: async (key: string): Promise<string | null> => getImpl().getItem(key),
  setItem: async (key: string, value: string): Promise<void> => {
    await getImpl().setItem(key, value);
  },
};
