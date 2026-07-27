import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nxkhhpazrbzmxcwrfaqu.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54a2hocGF6cmJ6bXhjd3JmYXF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5OTgwMzQsImV4cCI6MjEwMDU3NDAzNH0.KvSc6EqWUm2GUt3bPHTJIWcyfy6XGMhRkJn_6aUrnG0';

let _client = null;

export function getSupabase() {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _client;
}
