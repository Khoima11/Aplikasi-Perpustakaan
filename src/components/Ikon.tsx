// Kumpulan ikon garis sederhana (tanpa library tambahan)
const jalur: Record<string, string> = {
  dashboard: 'M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z',
  kategori: 'M4 6h16M4 12h16M4 18h10',
  buku: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 0v16M8 7h7',
  anggota: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0',
  pinjam: 'M12 5v14M5 12h14',
  kembali: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  terlambat: 'M12 8v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  laporan: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  pengaturan: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  beranda: 'M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  katalog: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm10 3-5-5',
  profil: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0',
  menu: 'M4 6h16M4 12h16M4 18h16',
  tutup: 'M6 6l12 12M18 6 6 18',
  keluar: 'M15 4h4v16h-4M10 16l-4-4 4-4M6 12h10',
}

export type NamaIkon = keyof typeof jalur

export default function Ikon({ nama, className = 'h-5 w-5' }: { nama: NamaIkon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={jalur[nama]} />
    </svg>
  )
}
