const SUPABASE_URL = 'https://jdyugaunigzbrsgxdhpy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkeXVnYXVuaWd6YnJzZ3hkaHB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjA1NzgsImV4cCI6MjA4MTAzNjU3OH0.8Goy85_YFftyfgJbmSe33OcmzFC0HplpJbIHoh4n-0k';

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
