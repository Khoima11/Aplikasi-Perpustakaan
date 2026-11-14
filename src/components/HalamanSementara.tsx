// Penanda halaman yang isinya akan dibuat pada tahap berikutnya
export default function HalamanSementara({ judul, tahap }: { judul: string; tahap: number }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800">{judul}</h1>
      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-500">
        Isi halaman ini akan dibuat pada Tahap {tahap}.
      </div>
    </div>
  )
}
