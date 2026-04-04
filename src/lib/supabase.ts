import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
      'Copy .env.example to .env and fill in your project credentials.'
  );
}

const REMEMBER_ME_STORAGE_KEY = 'auth.rememberMe';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
}

function resolveStorage(kind: 'localStorage' | 'sessionStorage'): StorageLike {
  const candidate = globalThis[kind];
  if (
    candidate &&
    typeof candidate.getItem === 'function' &&
    typeof candidate.setItem === 'function' &&
    typeof candidate.removeItem === 'function'
  ) {
    return candidate;
  }
  return createMemoryStorage();
}

const safeLocalStorage = resolveStorage('localStorage');
const safeSessionStorage = resolveStorage('sessionStorage');

export function getRememberMePreference(): boolean {
  const storedValue = safeLocalStorage.getItem(REMEMBER_ME_STORAGE_KEY);
  return storedValue !== 'false';
}

export function setRememberMePreference(rememberMe: boolean): void {
  safeLocalStorage.setItem(REMEMBER_ME_STORAGE_KEY, String(rememberMe));
}

const authStorage = {
  getItem(key: string): string | null {
    if (getRememberMePreference()) {
      return safeLocalStorage.getItem(key) ?? safeSessionStorage.getItem(key);
    }
    return safeSessionStorage.getItem(key) ?? safeLocalStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    if (getRememberMePreference()) {
      safeLocalStorage.setItem(key, value);
      safeSessionStorage.removeItem(key);
      return;
    }
    safeSessionStorage.setItem(key, value);
    safeLocalStorage.removeItem(key);
  },
  removeItem(key: string): void {
    safeLocalStorage.removeItem(key);
    safeSessionStorage.removeItem(key);
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
  },
});
