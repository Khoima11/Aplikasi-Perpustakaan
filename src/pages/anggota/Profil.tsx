import { useAuth } from '../../auth/KonteksAuth'
import FormGantiSandi from '../../components/FormGantiSandi'
import { kelas } from '../../components/ui'

export default function Profil() {
  const { profil, keluar } = useAuth()
  if (!profil) return null
  const a = profil.anggota

  const inisial = profil.nama.trim().charAt(0).toUpperCase()
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-utama-900 md:text-2xl">Profil</h1>

      <section className="mt-4 flex flex-col items-center rounded-3xl bg-utama-600 px-5 pt-6 pb-5 text-center text-white shadow-kartu">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-3xl font-bold text-utama-700 ring-4 ring-white/30">{inisial}</span>
        <p className="mt-3 text-lg font-semibold">{profil.nama}</p>
        <p className="text-sm text-utama-100">
          {a?.jenis_anggota === 'guru' ? 'Guru' : 'Siswa'}{a?.kelas ? ` · Kelas ${a.kelas}` : ''}
        </p>
      </section>

      <section className={`${kelas.kartu} mt-4 p-5`}>
        <h2 className="font-semibold text-utama-900">Informasi Akun</h2>
        <dl className="mt-3 grid grid-cols-[7.5rem_1fr] gap-y-2.5 text-sm">
          <dt className="text-slate-500">Nama</dt>
          <dd className="font-medium">{profil.nama}</dd>
          <dt className="text-slate-500">{a?.jenis_anggota === 'guru' ? 'NIP' : 'NIS'}</dt>
          <dd>{a?.nomor_induk ?? profil.username}</dd>
          <dt className="text-slate-500">Jenis anggota</dt>
          <dd className="capitalize">{a?.jenis_anggota ?? '-'}</dd>
          {a?.jenis_anggota === 'siswa' && (
            <>
              <dt className="text-slate-500">Kelas</dt>
              <dd>{a.kelas ?? '-'}</dd>
            </>
          )}
        </dl>
      </section>

      <section className={`${kelas.kartu} mt-4 p-5`}>
        <h2 className="mb-3 font-semibold text-utama-900">Ubah Kata Sandi</h2>
        <FormGantiSandi mintaSandiLama />
      </section>

      <button onClick={() => void keluar()} className={`${kelas.tombol} mt-4 h-12 w-full border-orange-200 text-orange-700 hover:bg-orange-50`}>
        Logout
      </button>
    </div>
  )
}
