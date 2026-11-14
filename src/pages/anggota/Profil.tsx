import { useAuth } from '../../auth/KonteksAuth'
import FormGantiSandi from '../../components/FormGantiSandi'

export default function Profil() {
  const { profil, keluar } = useAuth()
  if (!profil) return null
  const a = profil.anggota

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800">Profil</h1>

      <section className="mt-4 rounded-xl border border-slate-200 p-4">
        <h2 className="font-semibold">Informasi Akun</h2>
        <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-y-1.5 text-sm">
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

      <section className="mt-4 rounded-xl border border-slate-200 p-4">
        <h2 className="mb-3 font-semibold">Ubah Kata Sandi</h2>
        <FormGantiSandi mintaSandiLama />
      </section>

      <button
        onClick={() => void keluar()}
        className="mt-4 h-12 w-full rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50"
      >
        Logout
      </button>
    </div>
  )
}
