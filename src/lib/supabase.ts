import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isConfigured = Boolean(
  rawUrl &&
  rawKey &&
  rawUrl.startsWith('https://') &&
  !rawUrl.includes('your_supabase_project_url_here') &&
  !rawKey.includes('your_supabase_anon_key_here')
);

// Fallback to valid URL structure so createClient doesn't throw Invalid URL
const supabaseUrl = rawUrl.startsWith('https://') || rawUrl.startsWith('http://')
  ? rawUrl
  : 'https://placeholder.supabase.co';
const supabaseAnonKey = rawKey || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

