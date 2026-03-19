import { createClient } from '@supabase/supabase-js';

function getEnv(name: string) {
  const v = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[name];
  return typeof v === 'string' ? v.trim() : '';
}

export function getSupabaseClient() {
  const url = getEnv('VITE_SUPABASE_URL');
  const key = getEnv('VITE_SUPABASE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');
  if (!url || !key) {
    throw new Error('Supabase env fehlt: VITE_SUPABASE_URL + VITE_SUPABASE_KEY');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
