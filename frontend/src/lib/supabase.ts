import { createClient } from '@supabase/supabase-js'

const defaultUrl = 'https://arthasetu-demo.supabase.co'
const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTkwMDAwMDAwMH0.demo_signature_arthasetu'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || defaultUrl
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || defaultKey

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.info('ArthaSetu: Running in offline/demo mode. Set VITE_SUPABASE_URL in Vercel settings for cloud sync.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
