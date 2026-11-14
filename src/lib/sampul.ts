import { supabase } from './supabase'

const BUCKET = 'sampul'
const LEBAR_MAKS = 480 // piksel; cukup tajam untuk tampilan HP, hemat kuota penyimpanan
const TINGGI_MAKS = 720

/** Alamat gambar sampul untuk ditampilkan, atau null jika buku belum punya sampul */
export function urlSampul(lokasi: string | null | undefined): string | null {
  if (!lokasi) return null
  if (/^https?:\/\//i.test(lokasi)) return lokasi
  return supabase.storage.from(BUCKET).getPublicUrl(lokasi).data.publicUrl
}

/** Mengecilkan gambar di browser sebelum diunggah */
async function kecilkan(berkas: File): Promise<Blob> {
  const gambar = await createImageBitmap(berkas)
  const skala = Math.min(1, LEBAR_MAKS / gambar.width, TINGGI_MAKS / gambar.height)
  const kanvas = document.createElement('canvas')
  kanvas.width = Math.round(gambar.width * skala)
  kanvas.height = Math.round(gambar.height * skala)
  kanvas.getContext('2d')!.drawImage(gambar, 0, 0, kanvas.width, kanvas.height)
  gambar.close()
  return new Promise((selesai, gagal) =>
    kanvas.toBlob((b) => (b ? selesai(b) : gagal(new Error('Gambar tidak bisa diproses.'))), 'image/jpeg', 0.82),
  )
}

/** Mengunggah sampul buku. Mengembalikan lokasi file untuk disimpan di kolom buku.sampul */
export async function unggahSampul(berkas: File, idBuku: number): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(berkas.type)) {
    throw new Error('Gambar sampul harus berformat JPG, PNG, atau WebP.')
  }
  if (berkas.size > 10 * 1024 * 1024) throw new Error('Ukuran gambar terlalu besar (maksimal 10 MB).')

  let isi: Blob
  try {
    isi = await kecilkan(berkas)
  } catch {
    throw new Error('Gambar tidak bisa dibaca. Coba gambar lain.')
  }
  const lokasi = `buku-${idBuku}/${Date.now()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(lokasi, isi, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
  })
  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error('Penyimpanan sampul belum disiapkan. Jalankan migrasi 07 di Supabase.')
    }
    throw new Error(`Gagal mengunggah sampul: ${error.message}`)
  }
  return lokasi
}

export async function hapusSampul(lokasi: string | null | undefined): Promise<void> {
  if (!lokasi || /^https?:\/\//i.test(lokasi)) return
  await supabase.storage.from(BUCKET).remove([lokasi])
}
