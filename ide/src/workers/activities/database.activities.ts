import { supabaseData } from '../../services/supabaseClient';

// Type-safe interface for the Supabase operations used by activities
interface SupabaseDataService {
  saveSecret(key: string, value: string): Promise<boolean>;
  getSecret(key: string): Promise<string | null>;
  logEvent(type: string, details: Record<string, unknown>): Promise<void>;
}

// Use a typed wrapper; Supabase client doesn't expose these directly
// so we use RPC calls under the hood
const db: SupabaseDataService = {
  async saveSecret(key: string, value: string): Promise<boolean> {
    const { error } = await supabaseData.rpc('save_secret', { p_key: key, p_value: value });
    return !error;
  },
  async getSecret(key: string): Promise<string | null> {
    const { data, error } = await supabaseData.rpc('get_secret', { p_key: key });
    if (error) return null;
    return data ?? null;
  },
  async logEvent(type: string, details: Record<string, unknown>): Promise<void> {
    await supabaseData.from('events').insert({ type, details, created_at: new Date().toISOString() });
  },
};

export async function saveSecretActivity(key: string, value: string): Promise<boolean> {
  return db.saveSecret(key, value);
}

export async function getSecretActivity(key: string): Promise<string | null> {
  return db.getSecret(key);
}

export async function logEventActivity(type: string, details: Record<string, unknown>): Promise<void> {
  await db.logEvent(type, details);
}
