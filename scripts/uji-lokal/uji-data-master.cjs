// Uji halaman data master petugas.
// BACA  : sungguhan ke Supabase di .env (login akun contoh; RLS katalog). Nilai harapan diambil dari API.
// TULIS : SEMUA permintaan tulis dicegat di sini dan TIDAK PERNAH sampai ke server.
// Daftar anggota (v_anggota) dan jawaban Edge Function ditirukan, karena hanya terbaca petugas.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const butuh = require('module').createRequire(path.join(__dirname, '../../package.json'));
const dir = path.join(__dirname, 'keluaran');
fs.mkdirSync(dir, { recursive: true });
const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '../../.env'), 'utf8').split('\n').filter((b) => b.includes('=') && !b.startsWith('#')).map((b) => [b.slice(0, b.indexOf('=')).trim(), b.slice(b.indexOf('=') + 1).trim()]));
const U = env.VITE_SUPABASE_URL.replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, '');
const K = env.VITE_SUPABASE_ANON_KEY;
async function api(token, jalur, param = {}) {
  const u = new URL(U + '/rest/v1/' + jalur);
  for (const [k, v] of Object.entries(param)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { apikey: K, Authorization: 'Bearer ' + token, Prefer: 'count=exact' } });
  return { data: await r.json(), total: Number((r.headers.get('content-range') || '/0').split('/')[1]) };
}
async function buatFileImpor(tujuan) {
  const tulisXlsx = butuh('write-excel-file/node');
  const T = String;
  const teks = (a) => a.map((v) => ({ value: v, type: T }));
  await tulisXlsx([
    ['NIS', 'Nama', 'Jenis Anggota', 'Kelas', 'JK', 'No HP'].map((v) => ({ value: v })), // judul memakai nama lain yang dikenali
    teks(['250201', 'Sari Dewi', 'siswa', '7A', 'P', '081200000201']),
    [{ value: 250202, type: Number }, { value: 'Tono Wijaya' }, { value: 'siswa' }, { value: '7B' }, { value: 'L' }, { value: 81234567890, type: Number }],
    teks(['1234', 'NIS Pendek', 'siswa', '7A', '', '']),
    teks(['250203', 'Tanpa Kelas', 'siswa', '', '', '']),
    teks(['250201', 'Kembar', 'siswa', '7A', '', '']),
    [null, null, null, null, null, null],
    teks(['250204', 'Jenis Salah', 'murid', '7A', '', '']),
    teks(['250205', '', 'siswa', '7A', '', '']),
    teks(['250206', 'Yuni Astuti', 'siswa', '8A', 'Perempuan', '']),
    teks(['250901', 'Pak Guru Uji, S.Pd.', 'Guru', '9A', 'L', '']),
  ]).toFile(tujuan);
}
const B = 'http://localhost:4173';
let lulus = 0, gagal = 0;
const cek = (n, ok, info = '') => { ok ? lulus++ : gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : ' => ' + (typeof info === 'string' ? info : JSON.stringify(info)))); };
const tulis = [];            // catatan permintaan tulis yang dicegat
let paksaGalat = null;       // {cocok: 'kategori', status, body} untuk meniru penolakan database
const anggotaTiruan = [
  { id_anggota: 1, id_pengguna: 'u1', nomor_induk: '240001', nama: 'Andi Pratama', jenis_anggota: 'siswa', kelas: '7A', jenis_kelamin: 'L', no_hp: '081200000001', status_anggota: 'aktif', wajib_ganti_password: true, pinjaman_aktif: 1, pinjaman_terlambat: 0 },
  { id_anggota: 3, id_pengguna: 'u3', nomor_induk: '240003', nama: 'Cahyo Nugroho', jenis_anggota: 'siswa', kelas: '7B', jenis_kelamin: 'L', no_hp: null, status_anggota: 'aktif', wajib_ganti_password: true, pinjaman_aktif: 1, pinjaman_terlambat: 1 },
  { id_anggota: 7, id_pengguna: 'u7', nomor_induk: '220007', nama: 'Gilang Ramadhan', jenis_anggota: 'siswa', kelas: '9B', jenis_kelamin: 'L', no_hp: null, status_anggota: 'nonaktif', wajib_ganti_password: true, pinjaman_aktif: 0, pinjaman_terlambat: 0 },
];

(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(B); break } catch { await new Promise(r => setTimeout(r, 300)) } }
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 800 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const galatKonsol = [];
  page.on('pageerror', e => galatKonsol.push(e.message));

  await page.route(/supabase\.co\/(rest|functions|storage)\/v1\//, async (route) => {
    const req = route.request(); const url = req.url(); const m = req.method();
    if (m === 'GET' || m === 'HEAD') {
      if (url.includes('/rest/v1/profil_pengguna')) {
        const resp = await route.fetch(); const j = await resp.json();
        for (const x of (Array.isArray(j) ? j : [j])) if (x) { x.role = 'petugas'; x.wajib_ganti_password = false; x.nama = 'Petugas Uji'; }
        return route.fulfill({ response: resp, json: j });
      }
      if (url.includes('/rest/v1/v_anggota')) {
        const u = decodeURIComponent(url);
        let d = anggotaTiruan;
        if (u.includes('jenis_anggota=eq.guru')) d = [];
        if (u.includes('ilike')) d = d.filter(a => u.toLowerCase().includes(a.nama.toLowerCase().slice(0, 4)));
        return route.fulfill({ status: 200, headers: { 'content-range': `0-${Math.max(d.length - 1, 0)}/${d.length}`, 'content-type': 'application/json' }, body: JSON.stringify(d) });
      }
      return route.continue();
    }
    // ---- permintaan tulis: dicatat, tidak diteruskan ----
    let isi = null; try { isi = req.postDataJSON(); } catch { isi = '(biner)'; }
    tulis.push({ m, url: decodeURIComponent(url.split('/v1/')[1]), isi });
    if (paksaGalat && url.includes(paksaGalat.cocok)) { const g = paksaGalat; paksaGalat = null; return route.fulfill({ status: g.status, contentType: 'application/json', body: JSON.stringify(g.body) }); }
    if (url.includes('/functions/v1/kelola-akun')) {
      let jawab = { ok: true, pesan: 'Berhasil (tiruan).' };
      if (isi.aksi === 'buat_anggota') jawab = { ok: true, pesan: `Anggota ${isi.anggota.nama} (${isi.anggota.nomor_induk}) berhasil dibuat. Kata sandi awal sama dengan nomor induk.` };
      if (isi.aksi === 'impor_anggota') jawab = { ok: true, pesan: 'x', data: { rincian: isi.daftar.map((d, i) => ({ baris: i + 1, nomor_induk: d.nomor_induk, ok: i !== 1, pesan: i !== 1 ? 'Berhasil' : `Nomor induk ${d.nomor_induk} sudah terdaftar.` })) } };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(jawab) });
    }
    if (url.includes('/storage/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"sampul/x.jpg"}' });
    const prefer = req.headers()['prefer'] || '';
    if (m === 'POST' && url.includes('/rest/v1/buku') && prefer.includes('representation')) return route.fulfill({ status: 201, contentType: 'application/vnd.pgrst.object+json', body: '{"id_buku":999}' });
    if (m === 'PATCH' && url.includes('aturan_peminjaman')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[{"id_aturan":1}]' });
    return route.fulfill({ status: m === 'POST' ? 201 : 204, body: '' });
  });
  const terakhir = () => tulis[tulis.length - 1] || {};
  const teksPesan = async () => (await page.locator('[role=status],[role=alert]').allTextContents()).join(' | ');

  // ---- nilai harapan dari data yang sebenarnya ----
  const token = (await (await fetch(U + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: K, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: '240002@simpus.local', password: '240002' }) })).json()).access_token;
  const kat = (await api(token, 'kategori', { select: 'nama_kategori,keterangan,buku(count)' })).data;
  const nKat = kat.length;
  const totalJudul = kat.reduce((n, k) => n + k.buku[0].count, 0);
  const nFik = kat.filter((k) => (k.nama_kategori + ' ' + (k.keterangan || '')).toLowerCase().includes('fik')).length;
  const nRef = kat.find((k) => k.nama_kategori === 'Referensi').buku[0].count;
  const totalBuku = (await api(token, 'buku', { select: 'id_buku' })).total;
  const laskar = (await api(token, 'v_ketersediaan_buku', { select: '*', judul: 'eq.Laskar Pelangi' })).data[0];
  const eksLaskar = (await api(token, 'eksemplar', { select: 'nomor_induk,status', id_buku: 'eq.' + laskar.id_buku, order: 'nomor_induk' })).data;
  const eksDipinjam = eksLaskar.find((e) => e.status === 'dipinjam');
  const eksBebas = eksLaskar.find((e) => e.status !== 'dipinjam');
  const aturan = Object.fromEntries((await api(token, 'aturan_peminjaman', { select: '*' })).data.map((a) => [a.jenis_anggota, a]));
  const rp = (n) => 'Rp' + new Intl.NumberFormat('id-ID').format(Number(n));
  await buatFileImpor(path.join(dir, 'uji-impor.xlsx'));

  // ---- login (akun anggota contoh; peran ditirukan menjadi petugas hanya di browser uji) ----
  await page.goto(B + '/login'); await page.fill('#username', '240002'); await page.fill('#sandi', '240002'); await page.click('button[type=submit]');
  await page.waitForURL('**/petugas');

  // ================= DATA KATEGORI =================
  await page.click('nav >> text=Data Kategori'); await page.waitForSelector('tbody tr td:nth-child(2)');
  await page.waitForFunction((n) => document.querySelectorAll('tbody tr').length >= n, nKat);
  cek('Kategori: ' + nKat + ' kategori tampil (sesuai data)', await page.locator('tbody tr').count() === nKat);
  const ringkas = await page.locator('.text-3xl').allTextContents();
  cek('Kategori: ringkasan Total Kategori ' + nKat + ' dan Total Judul Buku ' + totalJudul, ringkas[0] === String(nKat) && ringkas[1] === String(totalJudul), ringkas);
  await page.fill('[aria-label="Cari kategori"]', 'fik'); await page.click('text=Cari');
  cek('Kategori: cari "fik" -> ' + nFik + ' baris', await page.locator('tbody tr').count() === nFik, await page.locator('tbody tr').count());
  await page.fill('[aria-label="Cari kategori"]', ''); await page.click('text=Cari');
  await page.screenshot({ path: dir + '/t4-kategori.png' });
  await page.click('button:has-text("Simpan")'); 
  cek('Kategori: simpan tanpa nama -> ditolak', (await teksPesan()).includes('wajib diisi'));
  await page.fill('#nama-kategori', '  Majalah  '); await page.fill('#ket-kategori', 'Terbitan berkala'); await page.click('button:has-text("Simpan")');
  await page.waitForSelector('text=ditambahkan');
  cek('Kategori: tambah -> POST kategori dengan nama dirapikan', terakhir().m === 'POST' && terakhir().url.startsWith('kategori') && terakhir().isi.nama_kategori === 'Majalah' && terakhir().isi.keterangan === 'Terbitan berkala', terakhir());
  await page.locator('tbody tr', { hasText: 'Fiksi' }).first().locator('text=Edit').click();
  cek('Kategori: klik Edit mengisi form', await page.inputValue('#nama-kategori') === 'Fiksi');
  await page.fill('#nama-kategori', 'Fiksi & Sastra'); await page.click('button:has-text("Simpan")'); await page.waitForSelector('text=diperbarui');
  cek('Kategori: ubah -> PATCH ke baris yang benar', terakhir().m === 'PATCH' && /id_kategori=eq\.\d+/.test(terakhir().url) && terakhir().isi.nama_kategori === 'Fiksi & Sastra', terakhir());
  paksaGalat = { cocok: '/rest/v1/kategori', status: 409, body: { code: '23505', message: 'duplicate key value violates unique constraint' } };
  await page.fill('#nama-kategori', 'Agama'); await page.click('button:has-text("Simpan")'); await page.waitForSelector('text=sudah ada');
  cek('Kategori: nama kembar -> pesan "sudah ada"', true);
  paksaGalat = { cocok: '/rest/v1/kategori', status: 409, body: { code: '23503', message: 'violates foreign key constraint' } };
  await page.locator('tbody tr', { hasText: 'Referensi' }).locator('text=Hapus').click();
  cek('Kategori: konfirmasi hapus memperingatkan kategori masih dipakai', (await page.textContent('[role=dialog]')).includes('masih dipakai ' + nRef + ' judul'));
  await page.click('[role=dialog] button:has-text("Hapus")'); await page.waitForSelector('text=tidak bisa dihapus');
  cek('Kategori: hapus yang masih dipakai -> DELETE ditolak dengan pesan jelas', terakhir().m === 'DELETE');

  // ================= DATA BUKU =================
  await page.click('nav >> text=Data Buku'); await page.waitForSelector('text=' + totalBuku + ' judul buku');
  cek('Buku: halaman 1 berisi 20 baris dari ' + totalBuku + ' judul', await page.locator('tbody tr').count() === Math.min(20, totalBuku));
  await page.screenshot({ path: dir + '/t4-buku.png' });
  await page.click('text=Berikutnya'); await page.waitForSelector('text=Halaman 2 dari 2');
  await page.waitForFunction((n) => document.querySelectorAll('tbody tr').length === n, totalBuku - 20);
  cek('Buku: halaman 2 berisi sisa ' + (totalBuku - 20) + ' baris, nomor urut lanjut dari 21', (await page.locator('tbody tr').first().locator('td').first().textContent()) === '21');
  await page.fill('[aria-label="Cari buku"]', 'laskar'); await page.click('button:has-text("Cari")'); await page.waitForSelector('text=/^1 judul buku$/');
  cek('Buku: cari "laskar" -> 1 hasil, ketersediaan ' + laskar.tersedia + ' / ' + laskar.total_eksemplar, (await page.textContent('tbody')).includes('Laskar Pelangi') && (await page.textContent('tbody')).includes(laskar.tersedia + ' / ' + laskar.total_eksemplar));
  await page.fill('[aria-label="Cari buku"]', ''); await page.selectOption('[aria-label="Saring kategori"]', { label: 'Referensi' }); await page.click('button:has-text("Cari")'); await page.waitForSelector('text=' + nRef + ' judul buku');
  cek('Buku: saring kategori Referensi -> ' + nRef + ' judul bertanda "Baca di tempat"', await page.locator('tbody >> text=Baca di tempat').count() === nRef);
  await page.fill('[aria-label="Cari buku"]', 'zzzz'); await page.click('button:has-text("Cari")'); await page.waitForSelector('text=Tidak ada buku yang cocok');
  cek('Buku: pencarian tanpa hasil -> pesan kosong yang jelas', true);

  // ================= DETAIL BUKU =================
  await page.selectOption('[aria-label="Saring kategori"]', ''); await page.fill('[aria-label="Cari buku"]', 'laskar'); await page.click('button:has-text("Cari")'); await page.waitForSelector('text=/^1 judul buku$/');
  await page.click('text=Detail / Edit'); await page.waitForSelector('#judul');
  await page.waitForFunction(() => document.querySelector('#judul').value !== '');
  cek('Detail: form terisi data buku', await page.inputValue('#judul') === 'Laskar Pelangi' && await page.inputValue('#pengarang') === 'Andrea Hirata' && await page.inputValue('#tahun') === '2005');
  await page.waitForSelector('text=' + eksLaskar[0].nomor_induk);
  if (eksDipinjam) {
    const barisDipinjam = page.locator('tbody tr', { hasText: eksDipinjam.nomor_induk });
    cek('Detail: eksemplar dipinjam (' + eksDipinjam.nomor_induk + ') -> tombol Ubah Status dan Hapus dinonaktifkan', await barisDipinjam.locator('text=Ubah Status').isDisabled() && await barisDipinjam.locator('text=Hapus').isDisabled());
  } else console.log('LEWATI Detail: tidak ada eksemplar Laskar Pelangi yang sedang dipinjam saat ini');
  await page.screenshot({ path: dir + '/t4-detail-buku.png' });
  await page.locator('tbody tr', { hasText: eksBebas.nomor_induk }).locator('text=Ubah Status').click();
  cek('Detail: dialog status tidak menawarkan pilihan Dipinjam', await page.locator('[role=dialog] input[type=radio]').count() === 3 && !(await page.textContent('[role=dialog] fieldset')).includes('Dipinjam'));
  await page.locator('[role=dialog] label', { hasText: 'Rusak' }).click(); await page.fill('#status-ket', 'Sampul sobek'); await page.click('text=Simpan Status'); await page.waitForSelector('text=diubah menjadi Rusak');
  cek('Detail: ubah status -> PATCH eksemplar {status: rusak, keterangan}', terakhir().m === 'PATCH' && terakhir().url.startsWith('eksemplar') && terakhir().isi.status === 'rusak' && terakhir().isi.keterangan === 'Sampul sobek', terakhir());
  await page.click('text=+ Tambah Eksemplar'); await page.click('[role=dialog] button[type=submit]');
  cek('Detail: tambah eksemplar tanpa nomor induk -> ditolak', (await page.textContent('[role=dialog]')).includes('wajib diisi'));
  await page.fill('#eks-nomor', 'B0999'); await page.fill('#eks-sumber', 'Hibah'); await page.click('text=Simpan & Tambah Lagi'); await page.waitForSelector('text=Silakan isi eksemplar berikutnya');
  const t = terakhir();
  cek('Detail: tambah eksemplar -> POST dengan id_buku, nomor induk, tanggal masuk hari ini', t.m === 'POST' && t.isi.id_buku === laskar.id_buku && t.isi.nomor_induk === 'B0999' && /^\d{4}-\d{2}-\d{2}$/.test(t.isi.tanggal_masuk), t);
  cek('Detail: "Simpan & Tambah Lagi" mengosongkan nomor induk tapi mempertahankan sumber', await page.inputValue('#eks-nomor') === '' && await page.inputValue('#eks-sumber') === 'Hibah');
  paksaGalat = { cocok: '/rest/v1/eksemplar', status: 409, body: { code: '23505', message: 'duplicate key' } };
  await page.fill('#eks-nomor', 'B0016'); await page.click('[role=dialog] button[type=submit]'); await page.waitForSelector('text=sudah dipakai eksemplar lain');
  cek('Detail: nomor induk kembar -> pesan jelas, dialog tetap terbuka', await page.locator('[role=dialog]').count() === 1);
  await page.click('[role=dialog] button:has-text("Tutup")');
  await page.fill('#tahun', '21'); await page.click('form >> text=Simpan');
  cek('Detail: tahun terbit tidak wajar -> ditolak', (await teksPesan()).includes('4 angka'));
  await page.fill('#tahun', '2006'); await page.selectOption('#dapat', 'tidak'); await page.click('form >> text=Simpan'); await page.waitForSelector('text=disimpan');
  cek('Detail: simpan buku -> PATCH buku dengan nilai bertipe benar', terakhir().m === 'PATCH' && terakhir().url.startsWith('buku?id_buku=eq.' + laskar.id_buku) && terakhir().isi.tahun_terbit === 2006 && terakhir().isi.dapat_dipinjam === false && typeof terakhir().isi.id_kategori === 'number', terakhir());
  // buku baru
  await page.goto(B + '/petugas/buku/baru'); await page.waitForSelector('text=Simpan data buku terlebih dahulu');
  await page.click('form >> text=Simpan'); cek('Buku baru: tanpa judul -> ditolak', (await teksPesan()).includes('Judul buku wajib'));
  await page.fill('#judul', 'Buku Uji'); await page.click('form >> text=Simpan'); cek('Buku baru: tanpa kategori -> ditolak', (await teksPesan()).includes('Pilih kategori'));
  await page.selectOption('#kategori', { label: 'Fiksi' }); await page.click('form >> text=Simpan'); await page.waitForURL('**/petugas/buku/999');
  const pb = tulis.filter(x => x.m === 'POST' && x.url.startsWith('buku')).pop();
  cek('Buku baru: POST buku lalu pindah ke halaman detailnya', pb && pb.isi.judul === 'Buku Uji' && pb.isi.dapat_dipinjam === true && pb.isi.isbn === null, pb);

  // ================= PENGATURAN =================
  await page.click('nav >> text=Pengaturan'); await page.waitForSelector('tbody >> text=Guru');
  const tabel = await page.textContent('tbody');
  cek('Pengaturan: tabel menampilkan aturan siswa & guru sesuai data', tabel.includes(aturan.siswa.maks_pinjam + ' buku') && tabel.includes(aturan.guru.maks_pinjam + ' buku') && tabel.includes(rp(aturan.siswa.denda_per_hari)), tabel);
  await page.waitForFunction(() => document.querySelector('#maks').value !== '');
  cek('Pengaturan: form awal terisi aturan siswa', await page.inputValue('#maks') === String(aturan.siswa.maks_pinjam) && await page.inputValue('#lama') === String(aturan.siswa.lama_pinjam_hari) && await page.inputValue('#denda') === String(Number(aturan.siswa.denda_per_hari)));
  await page.locator('tbody tr', { hasText: 'Guru' }).locator('text=Edit').click();
  cek('Pengaturan: Edit guru mengisi form guru', await page.inputValue('#jenis') === 'guru' && await page.inputValue('#lama') === String(aturan.guru.lama_pinjam_hari));
  await page.fill('#maks', '0'); await page.click('form >> text=Simpan');
  cek('Pengaturan: maksimal pinjam 0 -> ditolak', (await teksPesan()).includes('1 sampai 50'));
  await page.fill('#maks', '6'); await page.fill('#denda', '500'); await page.click('form >> text=Simpan'); await page.waitForSelector('text=Berlaku untuk transaksi berikutnya');
  cek('Pengaturan: simpan -> PATCH aturan guru dengan angka', terakhir().m === 'PATCH' && terakhir().url.includes('jenis_anggota=eq.guru') && terakhir().isi.maks_pinjam === 6 && terakhir().isi.denda_per_hari === 500 && terakhir().isi.lama_pinjam_hari === aturan.guru.lama_pinjam_hari, terakhir());
  cek('Pengaturan: keterangan "berlaku untuk transaksi baru" tampil', (await page.textContent('main')).includes('Jatuh tempo pada pinjaman yang sudah tercatat tidak berubah'));
  await page.screenshot({ path: dir + '/t4-pengaturan.png' });

  // ================= DATA ANGGOTA =================
  await page.click('nav >> text=Data Anggota'); await page.waitForSelector('text=Andi Pratama');
  cek('Anggota: daftar tampil dengan penanda terlambat dan nonaktif', (await page.textContent('tbody')).includes('1 terlambat') && (await page.textContent('tbody')).includes('Nonaktif'));
  cek('Anggota: anggota nonaktif mendapat tombol Aktifkan', await page.locator('tbody tr', { hasText: 'Gilang' }).locator('text=Aktifkan').count() === 1);
  await page.screenshot({ path: dir + '/t4-anggota.png' });
  await page.click('[role=tab] >> text=Guru'); await page.waitForSelector('text=Belum ada data anggota');
  cek('Anggota: tab Guru menyaring jenis anggota', true);
  await page.click('[role=tab] >> text=Semua'); await page.waitForSelector('text=Andi Pratama');
  await page.click('text=+ Tambah Anggota'); await page.click('[role=dialog] button[type=submit]');
  cek('Anggota: tambah tanpa NIS -> ditolak', (await page.textContent('[role=dialog]')).includes('wajib diisi'));
  await page.fill('#a-nomor', '250123'); await page.fill('#a-nama', 'Rina Wulandari'); await page.click('[role=dialog] button[type=submit]');
  cek('Anggota: siswa tanpa kelas -> ditolak', (await page.textContent('[role=dialog]')).includes('Kelas wajib'));
  await page.fill('#a-kelas', '7C'); await page.selectOption('#a-jk', 'P'); await page.click('[role=dialog] button[type=submit]'); await page.waitForSelector('text=berhasil dibuat');
  const ba = terakhir();
  cek('Anggota: tambah -> Edge Function buat_anggota dengan data lengkap', ba.url.startsWith('kelola-akun') && ba.isi.aksi === 'buat_anggota' && ba.isi.anggota.nomor_induk === '250123' && ba.isi.anggota.kelas === '7C' && ba.isi.anggota.jenis_kelamin === 'P' && ba.isi.anggota.no_hp === null, ba);
  cek('Anggota: tidak ada kunci rahasia yang dikirim dari browser', !JSON.stringify(ba).toLowerCase().includes('service') );
  await page.locator('tbody tr', { hasText: 'Andi Pratama' }).locator('text=Reset Sandi').click();
  cek('Anggota: konfirmasi reset menjelaskan sandi kembali ke nomor induk', (await page.textContent('[role=dialog]')).includes('240001'));
  await page.click('[role=dialog] button:has-text("Reset Sandi")'); await page.waitForSelector('[role=status]');
  cek('Anggota: reset -> Edge Function reset_sandi', terakhir().isi.aksi === 'reset_sandi' && terakhir().isi.id_anggota === 1, terakhir());
  await page.locator('tbody tr', { hasText: 'Andi Pratama' }).locator('text=Nonaktifkan').click();
  cek('Anggota: konfirmasi nonaktif memperingatkan buku belum kembali', (await page.textContent('[role=dialog]')).includes('masih meminjam 1 buku'));
  await page.click('[role=dialog] button:has-text("Nonaktifkan")'); await page.waitForFunction(() => !document.querySelector('[role=dialog]'));
  cek('Anggota: nonaktifkan -> Edge Function ubah_status nonaktif', terakhir().isi.aksi === 'ubah_status' && terakhir().isi.status === 'nonaktif', terakhir());
  await page.locator('tbody tr', { hasText: 'Gilang' }).locator('text=Aktifkan').click(); await page.click('[role=dialog] button:has-text("Aktifkan")'); await page.waitForFunction(() => !document.querySelector('[role=dialog]'));
  cek('Anggota: aktifkan -> Edge Function ubah_status aktif', terakhir().isi.status === 'aktif' && terakhir().isi.id_anggota === 7, terakhir());
  await page.locator('tbody tr', { hasText: 'Cahyo' }).locator('text=Edit').click();
  await page.fill('#a-nama', 'Cahyo Nugroho Putra'); await page.fill('#a-kelas', '8B'); await page.click('[role=dialog] button[type=submit]'); await page.waitForSelector('text=diperbarui');
  const dua = tulis.slice(-2);
  cek('Anggota: edit tanpa ganti NIS -> PATCH profil (nama) + PATCH anggota, tanpa Edge Function', dua[0].url.startsWith('profil_pengguna?id=eq.u3') && dua[0].isi.nama === 'Cahyo Nugroho Putra' && Object.keys(dua[0].isi).length === 1 && dua[1].url.startsWith('anggota?id_anggota=eq.3') && dua[1].isi.kelas === '8B', dua);
  await page.locator('tbody tr', { hasText: 'Cahyo' }).locator('text=Edit').click();
  await page.fill('#a-nomor', '240033'); await page.click('[role=dialog] button[type=submit]'); await page.waitForFunction(() => !document.querySelector('[role=dialog]'));
  cek('Anggota: ganti NIS -> Edge Function ubah_nomor_induk dipanggil lebih dulu', tulis.slice(-3)[0].isi.aksi === 'ubah_nomor_induk' && tulis.slice(-3)[0].isi.nomor_induk === '240033' && tulis.slice(-3)[0].isi.id_anggota === 3, tulis.slice(-3));

  // ---- impor Excel ----
  await page.click('button:has-text("Impor Excel")'); await page.waitForSelector('text=Cara impor');
  const [unduhan] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Unduh Template")')]);
  const fileTemplate = path.join(dir, 'template-unduhan.xlsx'); await unduhan.saveAs(fileTemplate);
  const { readSheet } = butuh('read-excel-file/node');
  const isiTemplate = await readSheet(fileTemplate);
  cek('Impor: template terunduh dengan 6 judul kolom yang benar', unduhan.suggestedFilename() === 'template-anggota-simpus.xlsx' && isiTemplate[0].join(',') === 'nomor_induk,nama,jenis_anggota,kelas,jenis_kelamin,no_hp', isiTemplate[0]);
  await page.setInputFiles('input[type=file][accept=".xlsx"]', path.join(dir, 'uji-impor.xlsx'));
  await page.waitForSelector('text=baris siap diimpor');
  const pratinjau = await page.textContent('[role=dialog]');
  cek('Impor: pratinjau 4 siap, 5 bermasalah', pratinjau.includes('4 baris siap diimpor') && pratinjau.includes('5 baris bermasalah'), pratinjau.slice(pratinjau.indexOf('baris siap') - 5, pratinjau.indexOf('baris siap') + 60));
  cek('Impor: alasan tiap baris bermasalah ditampilkan', ['minimal 6 karakter', 'Kelas wajib', 'sama dengan baris', 'harus "siswa" atau "guru"', 'Nama kosong'].every(x => pratinjau.includes(x)), pratinjau);
  await page.screenshot({ path: dir + '/t4-impor.png' });
  await page.click('button:has-text("Impor 4 Anggota")'); await page.waitForSelector('text=anggota berhasil dibuat');
  const ki = tulis.filter(x => x.isi && x.isi.aksi === 'impor_anggota').pop();
  cek('Impor: hanya 4 baris sah yang dikirim; NIS berupa angka di Excel dikirim sebagai teks; nol depan HP dipulihkan', ki.isi.daftar.length === 4 && ki.isi.daftar[1].nomor_induk === '250202' && typeof ki.isi.daftar[1].nomor_induk === 'string' && ki.isi.daftar[1].no_hp === '081234567890' && ki.isi.daftar[3].jenis_anggota === 'Guru', ki.isi.daftar);
  const hasil = await page.textContent('[role=dialog]');
  cek('Impor: ringkasan hasil 3 berhasil, 1 gagal dengan nomor baris Excel dan alasannya', hasil.includes('3 anggota berhasil dibuat') && hasil.includes('1 gagal') && hasil.includes('sudah terdaftar') && hasil.includes('3250202Nomor induk 250202'), hasil.slice(-300));
  await page.screenshot({ path: dir + '/t4-impor-hasil.png' });
  await page.click('[role=dialog] button:has-text("Selesai")');
  await page.setInputFiles('input[type=file]', []).catch(() => {});

  cek('Tidak ada error JavaScript selama pengujian', galatKonsol.length === 0, galatKonsol);
  await b.close();
  console.log(`\n${lulus} LULUS, ${gagal} GAGAL  (permintaan tulis dicegat: ${tulis.length}, tidak ada yang sampai ke server)`);
})().catch(e => { console.error('ERROR', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1) });
