/**
 * Nexus Alpha Auth Service
 * Supabase-powered authentication with GitHub OAuth.
 * Falls back to guest mode when Supabase is not configured.
 */

import { createClient, type SupabaseClient, type User, type Session } from "@supabase/supabase-js";

// ─── Init ─────────────────────────────────────────────────────────────────────

let SUPABASE_URL = "";
let SUPABASE_KEY = "";
try {
  SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL ?? "";
  SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ?? "";
} catch (e) {
  SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
  SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? "";
}

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_KEY);
  return _client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

// ─── Auth Methods ──────────────────────────────────────────────────────────────

/** Sign in with GitHub OAuth */
export async function signInWithGitHub(): Promise<void> {
  const client = getClient();
  if (!client) throw new Error("Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");

  const { error } = await client.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: "read:user user:email repo",
    },
  });

  if (error) throw new Error(`GitHub OAuth failed: ${error.message}`);
}

/** Sign out */
export async function signOut(): Promise<void> {
  const client = getClient();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw new Error(`Sign out failed: ${error.message}`);
}

/** Get current session */
export async function getSession(): Promise<Session | null> {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) return null;
  return data.session;
}

/** Get current user */
export async function getUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user ?? null;
}

/** Get GitHub access token from session (for GitHub API calls) */
export async function getGitHubToken(): Promise<string | null> {
  const session = await getSession();
  return (session?.provider_token as string) ?? null;
}

/** Subscribe to auth state changes */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
): () => void {
  const client = getClient();
  if (!client) return () => {};

  const { data } = client.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

// ─── User Profile ──────────────────────────────────────────────────────────────

export interface NexusUser {
  id: string;
  email: string | undefined;
  name: string;
  avatar: string;
  githubUsername: string;
  githubToken: string | null;
}

export async function getCurrentNexusUser(): Promise<NexusUser | null> {
  const user = await getUser();
  if (!user) return null;

  const meta = user.user_metadata;
  return {
    id: user.id,
    email: user.email,
    name: meta?.full_name ?? meta?.name ?? "Unknown",
    avatar: meta?.avatar_url ?? "",
    githubUsername: meta?.user_name ?? meta?.preferred_username ?? "",
    githubToken: await getGitHubToken(),
  };
}

// ─── Guest Mode ──────────────────────────────────────────────────────────────

export const GUEST_USER: NexusUser = {
  id: "guest",
  email: undefined,
  name: "Guest",
  avatar: "",
  githubUsername: "",
  githubToken: null,
};
