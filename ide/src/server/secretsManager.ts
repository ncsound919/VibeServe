/**
 * Server-Side Secret Manager
 * Replaces client-side sessionStorage obfuscation with secure, per-user 
 * server-held state. Values are encrypted at rest with AES-256-GCM.
 * In production, this should interface with Supabase Vault or a KMS.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { logAuditEvent } from './auditLogService';
import { supabaseData } from '../services/supabaseClient';

const ENCRYPTION_PREFIX = 'nexus:v1:';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const raw = process.env.NEXUS_ENCRYPTION_KEY || process.env.SUPABASE_JWT_SECRET || 'nexus-alpha-dev-encryption-key-min-32-b';
  return createHash('sha256').update(raw).digest();
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${ENCRYPTION_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(raw: string): string {
  if (!raw.startsWith(ENCRYPTION_PREFIX)) {
    return raw; // backward compatible: unencrypted values pass through
  }
  const key = getEncryptionKey();
  const parts = raw.slice(ENCRYPTION_PREFIX.length).split(':');
  if (parts.length !== 3) return raw; // malformed but don't crash
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export type SecretKey =
  | "GEMINI_API_KEY"
  | "GITHUB_TOKEN"
  | "OPENROUTER_API_KEY"
  | "DEEPSEEK_API_KEY"
  | "SUPABASE_URL"
  | "SUPABASE_ANON_KEY"
  | "OPENCODE_API_KEY";

export const secretsManager = {
  async set(userId: string, key: SecretKey, value: string): Promise<void> {
    const encryptedValue = encrypt(value);
    const { error } = await supabaseData
      .from('user_secrets')
      .upsert({ user_id: userId, key, value: encryptedValue, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });

    if (error) throw new Error(`Secret store error: ${error.message}`);

    await logAuditEvent({
      actor: userId,
      action: 'secret_set',
      target: key,
      status: 'success',
      metadata: { key, encrypted: encryptedValue !== value }
    });
  },

  async get(userId: string, key: SecretKey): Promise<string | null> {
    const { data, error } = await supabaseData
      .from('user_secrets')
      .select('value')
      .eq('user_id', userId)
      .eq('key', key)
      .single();

    if (error || !data) return null;
    return decrypt(data.value);
  },

  async remove(userId: string, key: SecretKey): Promise<void> {
    await supabaseData
      .from('user_secrets')
      .delete()
      .eq('user_id', userId)
      .eq('key', key);

    await logAuditEvent({
      actor: userId,
      action: 'secret_remove',
      target: key,
      status: 'success',
      metadata: { key }
    });
  },

  async list(userId: string): Promise<SecretKey[]> {
    const { data, error } = await supabaseData
      .from('user_secrets')
      .select('key')
      .eq('user_id', userId);

    if (error || !data) return [];
    return data.map(d => d.key as SecretKey);
  }
};
