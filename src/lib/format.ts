export function formatRupiah(nilai: number | string | null | undefined): string {
  const angka = Number(nilai ?? 0)
  return 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(angka)
}
