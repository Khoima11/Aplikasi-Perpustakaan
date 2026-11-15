import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { kelolaAkun } from '../../lib/akun'
import { atauMengandung } from '../../lib/cari'
import { pesanGalat } from '../../lib/galat'
import type { JenisAnggota, StatusAktif } from '../../lib/tipe'
import { BarisInfo, JudulHalaman, Konfirmasi, Lencana, Modal, Paginasi, Pemberitahuan, kelas, type Pesan } from '../../components/ui'
import ImporAnggota from './ImporAnggota'

interface Anggota {
  id_anggota: number
  id_pengguna: string
  nomor_induk: string
  nama: string
  jenis_anggota: JenisAnggota
  kelas: string | null
  jenis_kelamin: 'L' | 'P' | null
  no_hp: string | null
  status_anggota: StatusAktif
  wajib_ganti_password: boolean
  pinjaman_aktif: number
  pinjaman_terlambat: number
}

type Tab = 'semua' | JenisAnggota
const PER_HALAMAN = 20

const formKosong = {
  id_anggota: null as number | null,
  id_pengguna: '',
  nomor_induk_awal: '',
  nomor_induk: '',
  nama: '',
  jenis_anggota: 'siswa' as JenisAnggota,
  kelas: '',
  jenis_kelamin: '',
  no_hp: '',
}

type Tindakan = { jenis: 'reset' | 'nonaktif' | 'aktif'; anggota: Anggota }

export default function DataAnggota() {
  const [tab, setTab] = useState<Tab>('semua')
  const [cari, setCari] = useState('')
  const [kelasDipilih, setKelasDipilih] = useState('')
  const [saringan, setSaringan] = useState({ kata: '', kelas: '' })
  const [halaman, setHalaman] = useState(1)
  const [baris, setBaris] = useState<Anggota[]>([])
  const [total, setTotal] = useState(0)
  const [daftarKelas, setDaftarKelas] = useState<string[]>([])
  const [memuat, setMemuat] = useState(true)
  const [pesan, setPesan] = useState<Pesan | null>(null)
  const [versi, setVersi] = useState(0) // dinaikkan untuk memuat ulang daftar

  const [form, setForm] = useState<typeof formKosong | null>(null)
  const [pesanForm, setPesanForm] = useState<Pesan | null>(null)
  const [tindakan, setTindakan] = useState<Tindakan | null>(null)
  const [imporTerbuka, setImporTerbuka] = useState(false)
  const [sibuk, setSibuk] = useState(false)

  const muatUlang = useCallback(() => setVersi((v) => v + 1), [])

  useEffect(() => {
    void supabase
      .from('anggota')
      .select('kelas')
      .not('kelas', 'is', null)
      .then(({ data }) => {
        const unik = [...new Set((data ?? []).map((d) => d.kelas as string).filter(Boolean))]
        setDaftarKelas(unik.sort((a, b) => a.localeCompare(b, 'id', { numeric: true })))
      })
  }, [versi])

  useEffect(() => {
    let batal = false
    setMemuat(true)
    ;(async () => {
      let q = supabase
        .from('v_anggota')
        .select(
          'id_anggota, id_pengguna, nomor_induk, nama, jenis_anggota, kelas, jenis_kelamin, no_hp, status_anggota, wajib_ganti_password, pinjaman_aktif, pinjaman_terlambat',
          { count: 'exact' },
        )
      if (tab !== 'semua') q = q.eq('jenis_anggota', tab)
      if (saringan.kelas) q = q.eq('kelas', saringan.kelas)
      if (saringan.kata.trim()) q = q.or(atauMengandung(['nama', 'nomor_induk'], saringan.kata))
      const awal = (halaman - 1) * PER_HALAMAN
      const { data, error, count } = await q.order('nama').order('id_anggota').range(awal, awal + PER_HALAMAN - 1)
      if (batal) return
      if (error) setPesan({ jenis: 'galat', teks: pesanGalat(error) })
      else {
        setBaris((data ?? []) as Anggota[])
        setTotal(count ?? 0)
      }
      setMemuat(false)
    })()
    return () => {
      batal = true
    }
  }, [tab, saringan, halaman, versi])

  function terapkan(e: FormEvent) {
    e.preventDefault()
    setHalaman(1)
    setSaringan({ kata: cari, kelas: kelasDipilih })
  }

  function gantiTab(t: Tab) {
    setTab(t)
    setHalaman(1)
  }

  function bukaTambah() {
    setPesanForm(null)
    setForm({ ...formKosong, jenis_anggota: tab === 'guru' ? 'guru' : 'siswa' })
  }

  function bukaEdit(a: Anggota) {
    setPesanForm(null)
    setForm({
      id_anggota: a.id_anggota,
      id_pengguna: a.id_pengguna,
      nomor_induk_awal: a.nomor_induk,
      nomor_induk: a.nomor_induk,
      nama: a.nama,
      jenis_anggota: a.jenis_anggota,
      kelas: a.kelas ?? '',
      jenis_kelamin: a.jenis_kelamin ?? '',
      no_hp: a.no_hp ?? '',
    })
  }

  async function simpan(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    setPesanForm(null)
    const nomor = form.nomor_induk.trim()
    const nama = form.nama.trim()
    const kelasAnggota = form.jenis_anggota === 'guru' ? null : form.kelas.trim() || null
    const noHp = form.no_hp.trim() || null

    if (!nomor) return setPesanForm({ jenis: 'galat', teks: 'NIS/NIP wajib diisi.' })
    if (!nama) return setPesanForm({ jenis: 'galat', teks: 'Nama wajib diisi.' })
    if (form.jenis_anggota === 'siswa' && !kelasAnggota) return setPesanForm({ jenis: 'galat', teks: 'Kelas wajib diisi untuk siswa.' })
    if (noHp && !/^[0-9+]{6,15}$/.test(noHp)) return setPesanForm({ jenis: 'galat', teks: 'Nomor HP hanya angka, 6 sampai 15 digit.' })

    setSibuk(true)
    try {
      if (!form.id_anggota) {
        // Anggota baru: akun login dibuat oleh Edge Function
        const { pesan: teks } = await kelolaAkun('buat_anggota', {
          anggota: {
            nomor_induk: nomor,
            nama,
            jenis_anggota: form.jenis_anggota,
            kelas: kelasAnggota,
            jenis_kelamin: form.jenis_kelamin || null,
            no_hp: noHp,
          },
        })
        setForm(null)
        setPesan({ jenis: 'sukses', teks })
      } else {
        // Ubah data: nomor induk lewat Edge Function, sisanya langsung (dibatasi RLS untuk petugas)
        if (nomor !== form.nomor_induk_awal) {
          await kelolaAkun('ubah_nomor_induk', { id_anggota: form.id_anggota, nomor_induk: nomor })
        }
        const { error: galatNama } = await supabase.from('profil_pengguna').update({ nama }).eq('id', form.id_pengguna)
        if (galatNama) throw new Error(pesanGalat(galatNama))
        const { error: galatAnggota } = await supabase
          .from('anggota')
          .update({
            jenis_anggota: form.jenis_anggota,
            kelas: kelasAnggota,
            jenis_kelamin: form.jenis_kelamin || null,
            no_hp: noHp,
          })
          .eq('id_anggota', form.id_anggota)
        if (galatAnggota) throw new Error(pesanGalat(galatAnggota))
        setForm(null)
        setPesan({ jenis: 'sukses', teks: `Data ${nama} diperbarui.` })
      }
      muatUlang()
    } catch (galat) {
      setPesanForm({ jenis: 'galat', teks: galat instanceof Error ? galat.message : 'Gagal menyimpan.' })
    } finally {
      setSibuk(false)
    }
  }

  async function jalankanTindakan() {
    if (!tindakan) return
    setSibuk(true)
    try {
      const { pesan: teks } =
        tindakan.jenis === 'reset'
          ? await kelolaAkun('reset_sandi', { id_anggota: tindakan.anggota.id_anggota })
          : await kelolaAkun('ubah_status', {
              id_anggota: tindakan.anggota.id_anggota,
              status: tindakan.jenis === 'nonaktif' ? 'nonaktif' : 'aktif',
            })
      setPesan({ jenis: 'sukses', teks })
      muatUlang()
    } catch (galat) {
      setPesan({ jenis: 'galat', teks: galat instanceof Error ? galat.message : 'Tindakan gagal.' })
    } finally {
      setSibuk(false)
      setTindakan(null)
    }
  }

  const totalHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN))
  const tabs: { kunci: Tab; label: string }[] = [
    { kunci: 'semua', label: 'Semua' },
    { kunci: 'siswa', label: 'Siswa' },
    { kunci: 'guru', label: 'Guru' },
  ]

  return (
    <div>
      <JudulHalaman>Data Anggota</JudulHalaman>

      <div className={kelas.barisTab} role="tablist">
        {tabs.map((t) => (
          <button
            key={t.kunci}
            role="tab"
            aria-selected={tab === t.kunci}
            onClick={() => gantiTab(t.kunci)}
            className={kelas.tab(tab === t.kunci)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={terapkan} className="mt-3 flex flex-wrap gap-2">
        <input
          className={`${kelas.input} min-w-48 flex-1`}
          placeholder="Cari NIS / NIP / nama..."
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          aria-label="Cari anggota"
        />
        <select className={`${kelas.input} w-full sm:w-44`} value={kelasDipilih} onChange={(e) => setKelasDipilih(e.target.value)} aria-label="Saring kelas">
          <option value="">Semua kelas</option>
          {daftarKelas.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <button className={kelas.tombol} type="submit">Cari</button>
        <button className={kelas.tombolUtama} type="button" onClick={bukaTambah}>+ Tambah Anggota</button>
        <button className={kelas.tombol} type="button" onClick={() => setImporTerbuka(true)}>Impor Excel</button>
      </form>

      <div className="mt-3">
        <Pemberitahuan pesan={pesan} onTutup={() => setPesan(null)} />
      </div>

      <section className={`${kelas.kartu} mt-3 p-4`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-utama-100 bg-utama-50/70">
              <tr>
                <th className={kelas.th}>No.</th>
                <th className={kelas.th}>NIS/NIP</th>
                <th className={kelas.th}>Nama</th>
                <th className={kelas.th}>Jenis</th>
                <th className={kelas.th}>Kelas</th>
                <th className={kelas.th}>Pinjaman Aktif</th>
                <th className={kelas.th}>Status</th>
                <th className={kelas.th}>Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-utama-100/70">
              {memuat ? (
                <BarisInfo kolom={8}>Memuat data...</BarisInfo>
              ) : baris.length === 0 ? (
                <BarisInfo kolom={8}>
                  {saringan.kata || saringan.kelas ? 'Tidak ada anggota yang cocok dengan pencarian.' : 'Belum ada data anggota.'}
                </BarisInfo>
              ) : (
                baris.map((a, i) => (
                  <tr key={a.id_anggota} className={a.status_anggota === 'nonaktif' ? 'text-slate-400' : ''}>
                    <td className={kelas.td}>{(halaman - 1) * PER_HALAMAN + i + 1}</td>
                    <td className={kelas.td}>{a.nomor_induk}</td>
                    <td className={`${kelas.td} font-medium`}>{a.nama}</td>
                    <td className={`${kelas.td} capitalize`}>{a.jenis_anggota}</td>
                    <td className={kelas.td}>{a.kelas || '-'}</td>
                    <td className={kelas.td}>
                      {a.pinjaman_aktif}
                      {a.pinjaman_terlambat > 0 && (
                        <span className="ml-2"><Lencana warna="oranye">{a.pinjaman_terlambat} terlambat</Lencana></span>
                      )}
                    </td>
                    <td className={kelas.td}>
                      <Lencana warna={a.status_anggota === 'aktif' ? 'hijau' : 'abu'}>
                        {a.status_anggota === 'aktif' ? 'Aktif' : 'Nonaktif'}
                      </Lencana>
                    </td>
                    <td className={kelas.td}>
                      <div className="flex flex-wrap gap-1.5">
                        <button className={kelas.tombolKecil} onClick={() => bukaEdit(a)}>Edit</button>
                        <button className={kelas.tombolKecil} onClick={() => setTindakan({ jenis: 'reset', anggota: a })}>Reset Sandi</button>
                        {a.status_anggota === 'aktif' ? (
                          <button className={kelas.tombolKecil} onClick={() => setTindakan({ jenis: 'nonaktif', anggota: a })}>Nonaktifkan</button>
                        ) : (
                          <button className={kelas.tombolKecil} onClick={() => setTindakan({ jenis: 'aktif', anggota: a })}>Aktifkan</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-sm text-slate-500">{total} anggota</div>
        <Paginasi halaman={halaman} totalHalaman={totalHalaman} onUbah={setHalaman} />
      </section>

      {/* ---------- Dialog tambah / edit ---------- */}
      {form && (
        <Modal judul={form.id_anggota ? 'Ubah Data Anggota' : 'Tambah Anggota'} onTutup={() => setForm(null)}>
          <form onSubmit={simpan} className="space-y-3">
            <Pemberitahuan pesan={pesanForm} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={kelas.label} htmlFor="a-jenis">Jenis Anggota</label>
                <select
                  id="a-jenis"
                  className={kelas.input}
                  value={form.jenis_anggota}
                  onChange={(e) => setForm({ ...form, jenis_anggota: e.target.value as JenisAnggota })}
                >
                  <option value="siswa">Siswa</option>
                  <option value="guru">Guru</option>
                </select>
              </div>
              <div>
                <label className={kelas.label} htmlFor="a-nomor">{form.jenis_anggota === 'guru' ? 'NIP' : 'NIS'}</label>
                <input
                  id="a-nomor"
                  className={kelas.input}
                  maxLength={20}
                  autoCapitalize="none"
                  value={form.nomor_induk}
                  onChange={(e) => setForm({ ...form, nomor_induk: e.target.value })}
                />
              </div>
            </div>
            <p className="-mt-1 text-xs text-slate-500">
              {form.id_anggota
                ? 'Mengubah NIS/NIP ikut mengubah username login. Kata sandi tidak berubah.'
                : 'NIS/NIP menjadi username sekaligus kata sandi awal (minimal 6 karakter) dan wajib diganti saat login pertama.'}
            </p>
            <div>
              <label className={kelas.label} htmlFor="a-nama">Nama</label>
              <input id="a-nama" className={kelas.input} maxLength={100} value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={kelas.label} htmlFor="a-kelas">Kelas</label>
                <input
                  id="a-kelas"
                  className={kelas.input}
                  maxLength={10}
                  disabled={form.jenis_anggota === 'guru'}
                  placeholder={form.jenis_anggota === 'guru' ? 'Tidak perlu' : 'Misalnya 7A'}
                  value={form.jenis_anggota === 'guru' ? '' : form.kelas}
                  onChange={(e) => setForm({ ...form, kelas: e.target.value })}
                />
              </div>
              <div>
                <label className={kelas.label} htmlFor="a-jk">Jenis Kelamin</label>
                <select id="a-jk" className={kelas.input} value={form.jenis_kelamin} onChange={(e) => setForm({ ...form, jenis_kelamin: e.target.value })}>
                  <option value="">-</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              <div>
                <label className={kelas.label} htmlFor="a-hp">No. HP</label>
                <input id="a-hp" className={kelas.input} maxLength={15} inputMode="tel" value={form.no_hp} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className={kelas.tombol} onClick={() => setForm(null)} disabled={sibuk}>Batal</button>
              <button type="submit" className={kelas.tombolUtama} disabled={sibuk}>{sibuk ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ---------- Konfirmasi reset / nonaktif / aktif ---------- */}
      {tindakan?.jenis === 'reset' && (
        <Konfirmasi judul="Reset kata sandi?" labelYa="Reset Sandi" sibuk={sibuk} onYa={() => void jalankanTindakan()} onBatal={() => setTindakan(null)}>
          Kata sandi <b>{tindakan.anggota.nama}</b> akan dikembalikan menjadi nomor induknya
          (<b>{tindakan.anggota.nomor_induk}</b>) dan wajib diganti saat login berikutnya.
        </Konfirmasi>
      )}
      {tindakan?.jenis === 'nonaktif' && (
        <Konfirmasi judul="Nonaktifkan anggota?" labelYa="Nonaktifkan" bahaya sibuk={sibuk} onYa={() => void jalankanTindakan()} onBatal={() => setTindakan(null)}>
          <b>{tindakan.anggota.nama}</b> tidak akan bisa login maupun meminjam. Data dan riwayat pinjamannya tetap tersimpan,
          dan anggota bisa diaktifkan kembali kapan saja.
          {tindakan.anggota.pinjaman_aktif > 0 && (
            <p className="mt-2 text-orange-700">
              Perhatian: anggota ini masih meminjam {tindakan.anggota.pinjaman_aktif} buku yang belum dikembalikan.
            </p>
          )}
        </Konfirmasi>
      )}
      {tindakan?.jenis === 'aktif' && (
        <Konfirmasi judul="Aktifkan kembali anggota?" labelYa="Aktifkan" sibuk={sibuk} onYa={() => void jalankanTindakan()} onBatal={() => setTindakan(null)}>
          <b>{tindakan.anggota.nama}</b> akan bisa login dan meminjam kembali.
        </Konfirmasi>
      )}

      {imporTerbuka && <ImporAnggota onTutup={() => setImporTerbuka(false)} onSelesai={muatUlang} />}
    </div>
  )
}
