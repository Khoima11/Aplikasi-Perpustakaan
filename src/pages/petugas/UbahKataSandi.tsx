import FormGantiSandi from '../../components/FormGantiSandi'

export default function UbahKataSandi() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800">Ubah Kata Sandi</h1>
      <div className="mt-4 max-w-md rounded-xl border border-slate-200 bg-white p-6">
        <FormGantiSandi mintaSandiLama />
      </div>
    </div>
  )
}
