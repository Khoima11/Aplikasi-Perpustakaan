import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { usernameKeEmail } from '../lib/config'
import type { Profil } from '../lib/tipe'

type HasilMasuk = { ok: true; profil: Profil } | { ok: false; pesan: string }

interface NilaiAuth {
  /** true selama sesi dan profil sedang diperiksa saat aplikasi dibuka */
  memuat: boolean
  sesi: Session | null
  profil: Profil | null
  masuk: (username: string, kataSandi: string) => Promise<HasilMasuk>
  keluar: () => Promise<void>
  muatUlangProfil: () => Promise<void>
}

const Konteks = createContext<NilaiAuth | null>(null)

const PESAN_NONAKTIF = 'Akun Anda dinonaktifkan. Hubungi petugas perpustakaan.'

/** Mengambil profil + data anggota milik pengguna yang sedang login */
async function ambilProfil(idPengguna: string): Promise<{ profil: Profil | null; pesan?: string }> {
  const { data, error } = await supabase
    .from('profil_pengguna')
    .select('id, nama, username, role, status, wajib_ganti_password')
    .eq('id', idPengguna)
    .maybeSingle()

  if (error) return { profil: null, pesan: 'Gagal memuat data akun. Periksa koneksi internet lalu coba lagi.' }
  if (!data) return { profil: null, pesan: 'Akun ini belum terdaftar di SIMPUS. Hubungi petugas perpustakaan.' }
  if (data.status !== 'aktif') return { profil: null, pesan: PESAN_NONAKTIF }

  let anggota: Profil['anggota'] = null
  if (data.role === 'anggota') {
    const { data: a } = await supabase
      .from('anggota')
      .select('id_anggota, nomor_induk, jenis_anggota, kelas')
      .eq('id_pengguna', idPengguna)
      .maybeSingle()
    anggota = a ?? null
  }
  return { profil: { ...data, anggota } as Profil }
}

function terjemahkanGalatMasuk(galat: { message?: string; code?: string; status?: number }): string {
  const kode = galat.code ?? ''
  const pesan = galat.message ?? ''
  if (kode === 'user_banned' || /banned/i.test(pesan)) return PESAN_NONAKTIF
  if (kode === 'invalid_credentials' || /invalid login credentials/i.test(pesan)) {
    return 'Username atau kata sandi salah.'
  }
  if (kode === 'over_request_rate_limit' || galat.status === 429) {
    return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'
  }
  if (/fetch|network/i.test(pesan)) return 'Tidak dapat terhubung ke server. Periksa koneksi internet.'
  return 'Login gagal. Coba lagi beberapa saat.'
}

export function PenyediaAuth({ children }: { children: ReactNode }) {
  const [memuat, setMemuat] = useState(true)
  const [sesi, setSesi] = useState<Session | null>(null)
  const [profil, setProfil] = useState<Profil | null>(null)
  const idPenggunaAktif = useRef<string | null>(null)

  // Saat aplikasi dibuka: pulihkan sesi yang tersimpan di perangkat
  useEffect(() => {
    let batal = false
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (batal) return
      if (data.session) {
        const hasil = await ambilProfil(data.session.user.id)
        if (batal) return
        if (hasil.profil) {
          idPenggunaAktif.current = data.session.user.id
          setSesi(data.session)
          setProfil(hasil.profil)
        } else {
          await supabase.auth.signOut()
        }
      }
      setMemuat(false)
    })()

    const { data: langganan } = supabase.auth.onAuthStateChange((kejadian, sesiBaru) => {
      if (kejadian === 'SIGNED_OUT') {
        idPenggunaAktif.current = null
        setSesi(null)
        setProfil(null)
      } else if (kejadian === 'TOKEN_REFRESHED' && sesiBaru) {
        setSesi(sesiBaru)
      }
    })
    return () => {
      batal = true
      langganan.subscription.unsubscribe()
    }
  }, [])

  const masuk = useCallback(async (username: string, kataSandi: string): Promise<HasilMasuk> => {
    const nama = username.trim()
    if (!nama || !kataSandi) return { ok: false, pesan: 'Isi username dan kata sandi.' }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameKeEmail(nama),
      password: kataSandi,
    })
    if (error || !data.session) return { ok: false, pesan: terjemahkanGalatMasuk(error ?? {}) }

    const hasil = await ambilProfil(data.session.user.id)
    if (!hasil.profil) {
      await supabase.auth.signOut()
      return { ok: false, pesan: hasil.pesan ?? 'Login gagal.' }
    }

    idPenggunaAktif.current = data.session.user.id
    setSesi(data.session)
    setProfil(hasil.profil)
    void supabase.rpc('catat_login') // mencatat waktu login terakhir; tidak perlu ditunggu
    return { ok: true, profil: hasil.profil }
  }, [])

  const keluar = useCallback(async () => {
    await supabase.auth.signOut()
    idPenggunaAktif.current = null
    setSesi(null)
    setProfil(null)
  }, [])

  const muatUlangProfil = useCallback(async () => {
    const id = idPenggunaAktif.current
    if (!id) return
    const hasil = await ambilProfil(id)
    if (hasil.profil) setProfil(hasil.profil)
    else await keluar()
  }, [keluar])

  const nilai = useMemo<NilaiAuth>(
    () => ({ memuat, sesi, profil, masuk, keluar, muatUlangProfil }),
    [memuat, sesi, profil, masuk, keluar, muatUlangProfil],
  )
  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>
}

export function useAuth(): NilaiAuth {
  const nilai = useContext(Konteks)
  if (!nilai) throw new Error('useAuth harus dipakai di dalam PenyediaAuth')
  return nilai
}
