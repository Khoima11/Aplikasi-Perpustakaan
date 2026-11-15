// Supabase membatasi jumlah baris per permintaan (bawaan 1.000 baris).
// Fungsi ini mengambil seluruh baris dengan beberapa permintaan berurutan,
// dipakai laporan yang bisa mencakup satu semester.
const PER_PERMINTAAN = 1000
const BATAS_AMAN = 50_000

type Hasil = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>

export async function ambilSemua<T>(buat: (dari: number, sampai: number) => Hasil): Promise<T[]> {
  const semua: T[] = []
  for (let dari = 0; dari < BATAS_AMAN; dari += PER_PERMINTAAN) {
    const { data, error } = await buat(dari, dari + PER_PERMINTAAN - 1)
    if (error) throw error
    semua.push(...((data ?? []) as T[]))
    if (!data || data.length < PER_PERMINTAAN) break
  }
  return semua
}
