import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vbfckjroisrhplrpqzkd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiZmNranJvaXNyaHBscnBxemtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDQzODYsImV4cCI6MjA3NzQyMDM4Nn0.nIbdwysoW2dp59eqPh3M9axjxR74rGDkn8OdZciue4Y';

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
