import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** true jika .env sudah diisi dengan alamat dan kunci Supabase */
export const supabaseSiap = Boolean(url && anonKey)

// Frontend HANYA memakai anon key. Service role key tidak boleh ada di sini.
export const supabase: SupabaseClient = createClient(
  url || 'http://localhost:54321',
  anonKey || 'belum-diisi',
)
