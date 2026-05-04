import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL
  || process.env.VITE_SUPABASE_URL
  || 'https://aganpaepissvuamstmol.supabase.co';

// Module-level runtime; dotenv MUST have loaded .env.local before this file is imported.
// In server/index.ts, `dotenv.config()` runs at the top before importing integrationService.
const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

if (!key) {
  console.warn('Supabase URL or Key not configured');
}

export const supabase = createClient(SUPABASE_URL, key || 'unconfigured');
export const supabaseData = supabase;
