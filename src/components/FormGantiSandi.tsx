import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { usernameKeEmail } from '../lib/config'
import { useAuth } from '../auth/KonteksAuth'

const PANJANG_MIN = 6
const kelasInput =
  'mt-1 h-12 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-utama-600 focus:ring-2 focus:ring-utama-100'

interface Props {
  /** true = minta kata sandi lama dulu (dipakai di halaman profil) */
  mintaSandiLama?: boolean
  labelTombol?: string
  onBerhasil?: () => void
}

export default function FormGantiSandi({ mintaSandiLama = false, labelTombol = 'Simpan Kata Sandi', onBerhasil }: Props) {
  const { profil, muatUlangProfil } = useAuth()
  const [lama, setLama] = useState('')
  const [baru, setBaru] = useState('')
  const [ulang, setUlang] = useState('')
  const [tampil, setTampil] = useState(false)
  const [galat, setGalat] = useState('')
  const [sukses, setSukses] = useState('')
  const [sibuk, setSibuk] = useState(false)

  async function simpan(e: FormEvent) {
    e.preventDefault()
    setGalat('')
    setSukses('')
    if (!profil) return

    if (baru.length < PANJANG_MIN) return setGalat(`Kata sandi baru minimal ${PANJANG_MIN} karakter.`)
    if (baru.toLowerCase() === profil.username.toLowerCase()) {
      return setGalat('Kata sandi baru tidak boleh sama dengan username (NIS/NIP/ID).')
    }
    if (baru !== ulang) return setGalat('Ulangi kata sandi baru dengan sama persis.')
    if (mintaSandiLama && !lama) return setGalat('Isi kata sandi lama.')

    setSibuk(true)
    try {
      if (mintaSandiLama) {
        const { error } = await supabase.auth.signInWithPassword({
          email: usernameKeEmail(profil.username),
          password: lama,
        })
        if (error) return setGalat('Kata sandi lama salah.')
      }

      const { error } = await supabase.auth.updateUser({ password: baru })
      if (error) {
        if (error.code === 'same_password' || /different from the old/i.test(error.message)) {
          return setGalat('Kata sandi baru harus berbeda dari kata sandi sebelumnya.')
        }
        if (error.code === 'weak_password') return setGalat(`Kata sandi terlalu lemah. Gunakan minimal ${PANJANG_MIN} karakter.`)
        return setGalat('Gagal menyimpan kata sandi. Coba lagi.')
      }

      const { error: galatTanda } = await supabase.rpc('tandai_sandi_sudah_diganti')
      if (galatTanda) return setGalat('Kata sandi tersimpan, tetapi gagal memperbarui status akun. Coba login ulang.')

      await muatUlangProfil()
      setLama('')
      setBaru('')
      setUlang('')
      setSukses('Kata sandi berhasil diganti.')
      onBerhasil?.()
    } finally {
      setSibuk(false)
    }
  }

  const jenis = tampil ? 'text' : 'password'
  return (
    <form onSubmit={simpan} noValidate>
      {mintaSandiLama && (
        <>
          <label className="block text-sm font-medium" htmlFor="sandi-lama">Kata sandi lama</label>
          <input id="sandi-lama" type={jenis} value={lama} onChange={(e) => setLama(e.target.value)}
            autoComplete="current-password" className={kelasInput} />
        </>
      )}

      <label className={`block text-sm font-medium ${mintaSandiLama ? 'mt-4' : ''}`} htmlFor="sandi-baru">
        Kata sandi baru
      </label>
      <input id="sandi-baru" type={jenis} value={baru} onChange={(e) => setBaru(e.target.value)}
        autoComplete="new-password" className={kelasInput} />
      <p className="mt-1 text-xs text-slate-500">Minimal {PANJANG_MIN} karakter dan tidak sama dengan username.</p>

      <label className="mt-4 block text-sm font-medium" htmlFor="sandi-ulang">Ulangi kata sandi baru</label>
      <input id="sandi-ulang" type={jenis} value={ulang} onChange={(e) => setUlang(e.target.value)}
        autoComplete="new-password" className={kelasInput} />

      <label className="mt-3 flex min-h-11 items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={tampil} onChange={(e) => setTampil(e.target.checked)} className="h-5 w-5" />
        Tampilkan kata sandi
      </label>

      {galat && <p role="alert" className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">{galat}</p>}
      {sukses && <p role="status" className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{sukses}</p>}

      <button type="submit" disabled={sibuk}
        className="mt-4 h-12 w-full rounded-lg bg-utama-700 font-semibold text-white hover:bg-utama-800 disabled:opacity-60">
        {sibuk ? 'Menyimpan...' : labelTombol}
      </button>
    </form>
  )
}
