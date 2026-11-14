// Penjawab permintaan REST dari database uji LOKAL (PostgreSQL biasa + tiruan Supabase).
// Setiap permintaan dijalankan sebagai petugas PTG001 lewat role "authenticated",
// sehingga RLS dan pemeriksaan peran di fungsi tetap berlaku seperti di Supabase.
const { execFileSync } = require('child_process');

const AWAL_PETUGAS = [
  '\\o /dev/null',
  "select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profil_pengguna where username = 'PTG001'), 'role', 'authenticated')::text, false);",
  'set role authenticated;',
  '\\o',
  '',
].join('\n');

function psql(sqlText, sebagaiPetugas = true) {
  const masukan = '\\set VERBOSITY verbose\n' + (sebagaiPetugas ? AWAL_PETUGAS : '') + sqlText + '\n';
  try {
    const out = execFileSync('su', ['postgres', '-c', 'psql -X -At -q -v ON_ERROR_STOP=1 -d simpus_uji -f -'], {
      input: masukan,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { ok: true, teks: out.trim() };
  } catch (e) {
    const m = /ERROR:\s+(\w{5}):\s+([^\n]*)/.exec(String(e.stderr || ''));
    return { ok: false, code: m ? m[1] : 'XX000', message: m ? m[2] : String(e.stderr || e.message) };
  }
}

// literal SQL aman (dollar-quoting)
const q = (s) => '$v$' + String(s === null || s === undefined ? '' : s) + '$v$';
const j = (b) => q(JSON.stringify(b)) + '::jsonb';

const rpc = {
  cek_kelayakan_anggota: (b) => 'select public.cek_kelayakan_anggota(' + j(b) + " ->> 'p_nomor_induk');",
  catat_peminjaman: (b) =>
    "select public.catat_peminjaman(x.d ->> 'p_nomor_induk_anggota', array(select jsonb_array_elements_text(x.d -> 'p_daftar_nomor_induk_eksemplar'))) from (select " +
    j(b) + ' as d) x;',
  cari_pinjaman_aktif: (b) => 'select public.cari_pinjaman_aktif(' + j(b) + " ->> 'p_nomor_induk_eksemplar');",
  catat_perpanjangan: (b) => 'select public.catat_perpanjangan(' + j(b) + " ->> 'p_nomor_induk_eksemplar');",
  catat_pengembalian: (b) =>
    "select public.catat_pengembalian(x.d ->> 'p_nomor_induk_eksemplar', (x.d ->> 'p_kondisi')::public.kondisi_kembali, (x.d ->> 'p_status_denda')::public.status_denda, x.d ->> 'p_catatan') from (select " +
    j(b) + ' as d) x;',
  tandai_denda_lunas: (b) => 'select public.tandai_denda_lunas((' + j(b) + " ->> 'p_id_detail')::int);",
};

/** Mengembalikan {status, body} untuk URL /rest/v1/..., atau null jika tidak ditangani */
function jawab(method, url, isi) {
  const u = new URL(url);
  const jalur = u.pathname.split('/rest/v1/')[1];
  const p = u.searchParams;

  if (method === 'POST' && jalur.startsWith('rpc/')) {
    const nama = jalur.slice(4);
    if (nama === 'catat_login' || nama === 'tandai_sandi_sudah_diganti') return { status: 204, body: '' };
    if (!rpc[nama]) return { status: 404, body: JSON.stringify({ code: 'PGRST202', message: 'fungsi ' + nama + ' tidak dikenal alat uji' }) };
    const r = psql(rpc[nama](isi || {}));
    if (r.ok) return { status: 200, body: r.teks };
    return { status: 400, body: JSON.stringify({ code: r.code, message: r.message, details: null, hint: null }) };
  }
  if (method !== 'GET') return null;

  let sqlText = null;
  if (jalur === 'v_pinjaman') {
    const syarat = [];
    if (p.get('id_peminjaman')) syarat.push('id_peminjaman = ' + Number(p.get('id_peminjaman').replace('eq.', '')));
    if (p.get('status_denda')) syarat.push('status_denda = ' + q(p.get('status_denda').replace('eq.', '')));
    if (p.get('status')) syarat.push('status = ' + q(p.get('status').replace('eq.', '')));
    if (p.get('tanggal_pinjam')) syarat.push('tanggal_pinjam >= ' + q(p.get('tanggal_pinjam').replace('gte.', '')) + '::timestamptz');
    const urut = (p.get('order') || 'id_detail').replace('.desc', ' desc').replace('.asc', '').replace(/[^a-z_ ,]/g, '');
    sqlText = "select coalesce(json_agg(t), '[]') from (select * from public.v_pinjaman " +
      (syarat.length ? 'where ' + syarat.join(' and ') : '') + ' order by ' + urut + ') t;';
  } else if (jalur === 'v_keterlambatan') {
    sqlText = "select coalesce(json_agg(t), '[]') from (select * from public.v_keterlambatan order by hari_terlambat desc) t;";
  } else if (jalur === 'eksemplar' && (p.get('nomor_induk') || '').startsWith('ilike.')) {
    const nomor = p.get('nomor_induk').slice(6).replace(/\\(.)/g, '$1');
    sqlText = "select coalesce(json_agg(json_build_object('nomor_induk', e.nomor_induk, 'status', e.status, 'buku', json_build_object('judul', b.judul, 'dapat_dipinjam', b.dapat_dipinjam))), '[]') " +
      'from public.eksemplar e join public.buku b using (id_buku) where lower(e.nomor_induk) = lower(' + q(nomor) + ');';
  }
  if (!sqlText) return null;
  const r = psql(sqlText);
  if (r.ok) return { status: 200, body: r.teks };
  return { status: 400, body: JSON.stringify({ code: r.code, message: r.message }) };
}

/** Menjalankan SQL sebagai pemilik database (untuk menyiapkan/memeriksa keadaan) */
function pemilik(s) {
  const r = psql(s, false);
  if (!r.ok) throw new Error(r.message);
  return r.teks;
}

module.exports = { jawab, pemilik };
