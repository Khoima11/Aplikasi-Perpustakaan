import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Alamat project boleh ditempel apa adanya dari dashboard; akhiran seperti
// "/rest/v1/" dan garis miring di belakang dibuang otomatis.
function rapikanUrl(nilai: string | undefined): string {
  return (nilai ?? '').trim().replace(/\/(rest|auth)\/v1\/?$/i, '').replace(/\/+$/, '')
}

const url = rapikanUrl(import.meta.env.VITE_SUPABASE_URL)
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

/** true jika .env sudah diisi dengan alamat dan kunci Supabase */
export const supabaseSiap = Boolean(url && anonKey)

// Frontend HANYA memakai kunci publik (anon / publishable).
// Kunci service role / secret tidak boleh ada di sini.
export const supabase: SupabaseClient = createClient(
  url || 'http://localhost:54321',
  anonKey || 'belum-diisi',
)
