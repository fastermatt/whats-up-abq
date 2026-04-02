import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://bsmvfutebmbkjvlrhiyq.supabase.co';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXZmdXRlYm1ia2p2bHJoaXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMzgwMzIsImV4cCI6MjA4OTgxNDAzMn0.3rvMRErlF-HnKfbJ6rCNSeCJc39n4K48xjAeSGqf_rc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',            // PKCE is more secure than implicit; tokens not exposed in URL hash
    detectSessionInUrl: true,    // auto-read hash tokens on load
    persistSession: true,        // keep session in localStorage across app closes
    autoRefreshToken: true,      // proactively refresh access token before it expires
    storageKey: 'abq-unplugged-auth', // explicit key prevents conflicts
    // Bypass Navigator Locks API — the default lock can stall for 5+ seconds
    // on page load (orphaned lock from unmount / Strict Mode), which blocks
    // ALL Supabase queries and causes timeouts for data fetches.
    // Safe here: only one tab typically does admin auth at a time.
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
  },
});
