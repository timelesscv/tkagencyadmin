import { createClient } from '@supabase/supabase-js';

const getEnvVar = (key: string, defaultVal: string = ''): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
    return (import.meta as any).env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return defaultVal;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', 'https://urifbfgwxfhhkicoizwp.supabase.co');
const supabaseAnonKey = getEnvVar(
  'VITE_SUPABASE_ANON_KEY',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyaWZiZmd3eGZoaGtpY29pendwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMjYyMjMsImV4cCI6MjEwNDcwMjIyM30.InfbtDKuukzHG5ke5t_8jIfJJJ960_ReyXZR0PppchQ'
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

