import { createClient } from '@supabase/supabase-js';

const isBrowser = typeof window !== 'undefined';

const getEnv = (key: string): string | undefined => {
  if (isBrowser) {
    return (import.meta.env as Record<string, string>)[key];
  }
  return process.env[key];
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') 
  || process.env.SUPABASE_URL
  || 'https://aganpaepissvuamstmol.supabase.co';

const key = getEnv('VITE_SUPABASE_ANON_KEY') || process.env.SUPABASE_ANON_KEY || '';

if (!key) {
  console.warn('Supabase URL or Key not configured');
}

export const supabase = createClient(SUPABASE_URL, key || 'unconfigured');
export const supabaseData = supabase;