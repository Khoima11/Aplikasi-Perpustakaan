import { useState, type FormEvent } from 'react'
import Logo from '../components/Logo'
import PeringatanKonfigurasi from '../components/PeringatanKonfigurasi'

// Tampilan login sesuai wireframe. Proses login sebenarnya dihubungkan pada Tahap 3.
export default function Login() {
  const [username, setUsername] = useState('')
  const [kataSandi, setKataSandi] = useState('')
  const [pesan, setPesan] = useState('')

  function masuk(e: FormEvent) {
    e.preventDefault()
    setPesan('Fitur login akan aktif pada Tahap 3.')
  }

  function reset() {
    setUsername('')
    setKataSandi('')
    setPesan('')
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <PeringatanKonfigurasi />
      <div className="flex flex-1 items-center justify-center p-4">
        <form onSubmit={masuk} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-center text-center">
            <Logo className="h-16 w-16" />
            <h1 className="mt-3 text-2xl font-bold text-utama-700">SIMPUS</h1>
            <p className="text-sm italic text-slate-500">Sistem Informasi Perpustakaan Sekolah</p>
          </div>

          <label className="mt-6 block text-sm font-medium" htmlFor="username">
            Username (NIS / NIP / ID Petugas)
          </label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            className="mt-1 h-12 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-utama-600 focus:ring-2 focus:ring-utama-100"
            required
          />

          <label className="mt-4 block text-sm font-medium" htmlFor="sandi">Kata Sandi</label>
          <input
            id="sandi"
            type="password"
            value={kataSandi}
            onChange={(e) => setKataSandi(e.target.value)}
            autoComplete="current-password"
            className="mt-1 h-12 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-utama-600 focus:ring-2 focus:ring-utama-100"
            required
          />

          {pesan && <p className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">{pesan}</p>}

          <div className="mt-5 flex gap-2">
            <button type="submit" className="h-12 flex-1 rounded-lg bg-utama-700 font-semibold text-white hover:bg-utama-800">
              Masuk
            </button>
            <button type="button" onClick={reset} className="h-12 rounded-lg border border-slate-300 px-4 hover:bg-slate-50">
              Reset
            </button>
          </div>

          <p className="mt-5 text-center text-sm italic text-slate-500">
            Lupa kata sandi? Hubungi petugas perpustakaan.
          </p>
        </form>
      </div>
    </div>
  )
}
