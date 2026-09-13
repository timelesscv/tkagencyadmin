import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://urifbfgwxfhhkicoizwp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyaWZiZmd3eGZoaGtpY29pendwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMjYyMjMsImV4cCI6MjEwNDcwMjIyM30.InfbtDKuukzHG5ke5t_8jIfJJJ960_ReyXZR0PppchQ';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Supabase URL or Anon Key is missing. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
