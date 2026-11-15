// Penjawab permintaan REST dari database uji LOKAL (PostgreSQL biasa + tiruan Supabase).
// Setiap permintaan dijalankan sebagai petugas PTG001 lewat role "authenticated",
// sehingga RLS dan pemeriksaan peran di fungsi tetap berlaku seperti di Supabase.
//
// Yang didukung (cukup untuk halaman sirkulasi, dashboard, dan laporan):
//   - POST /rpc/<fungsi transaksi>
//   - GET/HEAD tabel & view dengan saringan sederhana (eq, neq, gt, gte, lt, lte, is, in),
//     order, Range, dan Prefer: count=exact
//   - POST laporan (histori cetak)
// Yang TIDAK didukung: or=(...), embed (kecuali eksemplar+buku untuk halaman Peminjaman).
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
      maxBuffer: 64 * 1024 * 1024,
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
const nama = (s) => String(s).replace(/[^a-z0-9_]/g, '');

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

const TABEL = ['v_pinjaman', 'v_keterlambatan', 'v_ketersediaan_buku', 'v_anggota', 'buku', 'eksemplar', 'kategori', 'anggota', 'aturan_peminjaman', 'laporan'];
const OPERATOR = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };

function syaratDari(p) {
  const syarat = [];
  for (const [kunci, nilai] of p.entries()) {
    if (['select', 'order', 'limit', 'offset'].includes(kunci)) continue;
    const m = /^(eq|neq|gt|gte|lt|lte|is|in)\.([\s\S]*)$/.exec(nilai);
    if (!m) throw new Error('saringan tidak didukung alat uji: ' + kunci + '=' + nilai);
    const kolom = nama(kunci);
    if (OPERATOR[m[1]]) syarat.push(kolom + ' ' + OPERATOR[m[1]] + ' ' + q(m[2]));
    else if (m[1] === 'is') syarat.push(kolom + ' is ' + (m[2] === 'null' ? 'null' : m[2] === 'true' ? 'true' : 'false'));
    else syarat.push(kolom + '::text in (' + m[2].replace(/^\(|\)$/g, '').split(',').map((x) => q(x.replace(/^"|"$/g, ''))).join(', ') + ')');
  }
  return syarat.length ? ' where ' + syarat.join(' and ') : '';
}

/** Mengembalikan {status, body, headers} untuk URL /rest/v1/..., atau null jika tidak ditangani */
function jawab(method, url, isi, headers = {}) {
  const u = new URL(url);
  const jalur = u.pathname.split('/rest/v1/')[1];
  const p = u.searchParams;

  if (method === 'POST' && jalur.startsWith('rpc/')) {
    const fungsi = jalur.slice(4);
    if (fungsi === 'catat_login' || fungsi === 'tandai_sandi_sudah_diganti') return { status: 204, body: '' };
    if (!rpc[fungsi]) return { status: 404, body: JSON.stringify({ code: 'PGRST202', message: 'fungsi ' + fungsi + ' tidak dikenal alat uji' }) };
    const r = psql(rpc[fungsi](isi || {}));
    if (r.ok) return { status: 200, body: r.teks };
    return { status: 400, body: JSON.stringify({ code: r.code, message: r.message, details: null, hint: null }) };
  }

  if (method === 'POST' && jalur === 'laporan') {
    // id_petugas dari browser uji adalah akun tiruan; di database lokal diganti petugas lokal
    const r = psql("insert into public.laporan (id_petugas, jenis_laporan, periode_awal, periode_akhir) select auth.uid(), (x.d ->> 'jenis_laporan')::public.jenis_laporan, (x.d ->> 'periode_awal')::date, (x.d ->> 'periode_akhir')::date from (select " + j(isi) + ' as d) x;');
    if (r.ok) return { status: 201, body: '' };
    return { status: 400, body: JSON.stringify({ code: r.code, message: r.message }) };
  }

  if (method !== 'GET' && method !== 'HEAD') return null;
  if (!TABEL.includes(jalur)) return null;

  let sqlData;
  let dari = 'public.' + jalur;
  try {
    const where = syaratDari(p);
    // kasus khusus: halaman Peminjaman mencari eksemplar + data bukunya
    if (jalur === 'eksemplar' && (p.get('select') || '').includes('buku(')) return null;
    const urut = (p.get('order') || '').split(',').filter(Boolean).map((o) => {
      const [kolom, arah] = o.split('.');
      return nama(kolom) + (arah === 'desc' ? ' desc' : '');
    }).join(', ');
    let batas = '';
    const rentang = /^(\d+)-(\d+)$/.exec(headers.range || '');
    if (rentang) batas = ' offset ' + Number(rentang[1]) + ' limit ' + (Number(rentang[2]) - Number(rentang[1]) + 1);
    else if (p.get('limit')) batas = ' limit ' + Number(p.get('limit')) + (p.get('offset') ? ' offset ' + Number(p.get('offset')) : '');
    sqlData = "select json_build_object('total', (select count(*) from " + dari + where + "), 'data', (select coalesce(json_agg(t), '[]') from (select * from " +
      dari + where + (urut ? ' order by ' + urut : '') + batas + ') t));';
  } catch (e) {
    return { status: 400, body: JSON.stringify({ code: 'UJI', message: e.message }) };
  }
  const r = psql(sqlData);
  if (!r.ok) return { status: 400, body: JSON.stringify({ code: r.code, message: r.message }) };
  const hasil = JSON.parse(r.teks);
  const jumlah = hasil.data.length;
  const kepala = { 'content-range': (jumlah ? '0-' + (jumlah - 1) : '*') + '/' + hasil.total };
  if (method === 'HEAD') return { status: 200, body: '', headers: kepala };
  return { status: 200, body: JSON.stringify(hasil.data), headers: kepala };
}

/** Pencarian eksemplar + buku (dipakai halaman Peminjaman) */
function jawabEksemplarBuku(url) {
  const p = new URL(url).searchParams;
  const nomor = (p.get('nomor_induk') || '').slice(6).replace(/\\(.)/g, '$1');
  const r = psql("select coalesce(json_agg(json_build_object('nomor_induk', e.nomor_induk, 'status', e.status, 'buku', json_build_object('judul', b.judul, 'dapat_dipinjam', b.dapat_dipinjam))), '[]') " +
    'from public.eksemplar e join public.buku b using (id_buku) where lower(e.nomor_induk) = lower(' + q(nomor) + ');');
  return r.ok ? { status: 200, body: r.teks } : { status: 400, body: JSON.stringify({ code: r.code, message: r.message }) };
}

function jawabSemua(method, url, isi, headers) {
  const u = new URL(url);
  if (method === 'GET' && u.pathname.endsWith('/rest/v1/eksemplar') && (u.searchParams.get('select') || '').includes('buku(')) return jawabEksemplarBuku(url);
  return jawab(method, url, isi, headers);
}

/** Menjalankan SQL sebagai pemilik database (untuk menyiapkan/memeriksa keadaan) */
function pemilik(s) {
  const r = psql(s, false);
  if (!r.ok) throw new Error(r.message);
  return r.teks;
}

module.exports = { jawab: jawabSemua, pemilik };
