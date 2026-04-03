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

export function getRememberMePreference(): boolean {
  const storedValue = localStorage.getItem(REMEMBER_ME_STORAGE_KEY);
  return storedValue !== 'false';
}

export function setRememberMePreference(rememberMe: boolean): void {
  localStorage.setItem(REMEMBER_ME_STORAGE_KEY, String(rememberMe));
}

const authStorage = {
  getItem(key: string): string | null {
    if (getRememberMePreference()) {
      return localStorage.getItem(key) ?? sessionStorage.getItem(key);
    }
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    if (getRememberMePreference()) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
      return;
    }
    sessionStorage.setItem(key, value);
    localStorage.removeItem(key);
  },
  removeItem(key: string): void {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
  },
});
