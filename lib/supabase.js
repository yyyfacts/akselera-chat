import { createClient } from '@supabase/supabase-js';

// Anon key memang publik. Keamanan data dijaga Row Level Security di database.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
