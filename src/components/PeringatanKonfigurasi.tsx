import { supabaseSiap } from '../lib/supabase'

// Muncul jika file .env belum diisi, agar mudah diketahui saat uji coba
export default function PeringatanKonfigurasi() {
  if (supabaseSiap) return null
  return (
    <div className="no-print bg-orange-100 px-4 py-2 text-center text-sm text-orange-800">
      Koneksi Supabase belum diatur. Salin <code>.env.example</code> menjadi <code>.env</code> lalu isi alamat dan kuncinya.
    </div>
  )
}
