import { createClient } from '@supabase/supabase-js'

const defaultUrl = 'https://ccnnvyiohexgpmgnhhkg.supabase.co'
const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjbm52eWlvaGV4Z3BtZ25oaGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNzg1NzcsImV4cCI6MjEwNTc1NDU3N30.bDq3muw8-Pxd_GFO5bd8FEacvVGBalIxf-LKaxoNt-g'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || defaultUrl
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || defaultKey

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'arthasetu_supabase_auth_token',
  },
})

