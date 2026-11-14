import { supabase } from './supabase'

interface JawabanFungsi<T> {
  ok: boolean
  pesan: string
  data?: T
}

/**
 * Memanggil Edge Function "kelola-akun" (buat anggota, impor, reset sandi,
 * nonaktifkan). Kunci rahasia hanya ada di server; dari sini cukup sesi login petugas.
 * Mengembalikan { pesan, data } jika berhasil, atau melempar Error berisi pesan penolakan.
 */
export async function kelolaAkun<T = unknown>(
  aksi: 'cek' | 'buat_anggota' | 'impor_anggota' | 'reset_sandi' | 'ubah_status' | 'ubah_nomor_induk',
  isi: Record<string, unknown> = {},
): Promise<{ pesan: string; data: T | undefined }> {
  const { data, error } = await supabase.functions.invoke<JawabanFungsi<T>>('kelola-akun', {
    body: { aksi, ...isi },
  })

  if (error) {
    // Jawaban berstatus bukan 2xx: coba baca pesan dari isi jawabannya
    let pesan = ''
    const konteks = (error as { context?: unknown }).context
    if (konteks instanceof Response) {
      try {
        pesan = ((await konteks.clone().json()) as JawabanFungsi<T>).pesan ?? ''
      } catch {
        pesan = ''
      }
      if (!pesan && konteks.status === 404) {
        pesan = 'Edge Function "kelola-akun" belum dipasang di Supabase.'
      }
    }
    throw new Error(pesan || 'Tidak dapat menghubungi server pengelola akun. Periksa koneksi internet.')
  }
  if (!data?.ok) throw new Error(data?.pesan || 'Permintaan ditolak.')
  return { pesan: data.pesan, data: data.data }
}
