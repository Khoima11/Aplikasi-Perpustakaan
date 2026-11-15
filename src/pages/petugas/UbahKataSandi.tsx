import FormGantiSandi from '../../components/FormGantiSandi'

export default function UbahKataSandi() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-utama-900">Ubah Kata Sandi</h1>
      <div className="mt-4 max-w-md rounded-2xl border border-utama-100/70 bg-white p-6 shadow-kartu">
        <FormGantiSandi mintaSandiLama />
      </div>
    </div>
  )
}
