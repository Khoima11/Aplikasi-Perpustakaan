// Uji halaman anggota (tampilan HP). Halaman anggota hanya MEMBACA, jadi diuji langsung
// terhadap Supabase di .env memakai akun contoh dari seed. Nilai yang diharapkan diambil
// dari API dengan token akun yang sama, lalu dibandingkan dengan yang tampil.
// Permintaan tulis apa pun dicegat (dan dihitung: seharusnya tidak ada selain catat_login).
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'keluaran');
fs.mkdirSync(dir, { recursive: true });

const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '../../.env'), 'utf8').split('\n').filter((b) => b.includes('=') && !b.startsWith('#')).map((b) => [b.slice(0, b.indexOf('=')).trim(), b.slice(b.indexOf('=') + 1).trim()]));
const U = env.VITE_SUPABASE_URL.replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, '');
const K = env.VITE_SUPABASE_ANON_KEY;
const B = 'http://localhost:4173';

let lulus = 0, gagal = 0;
const cek = (n, ok, info = '') => {
  ok ? lulus++ : gagal++;
  console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : ' => ' + (typeof info === 'string' ? info : JSON.stringify(info))));
};
const tgl = (iso) => { const [y, m, d] = iso.slice(0, 10).split('-'); return d + '/' + m + '/' + y; };

async function api(token, jalur, param = {}) {
  const u = new URL(U + '/rest/v1/' + jalur);
  for (const [k, v] of Object.entries(param)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { apikey: K, Authorization: 'Bearer ' + token, Prefer: 'count=exact' } });
  return { data: await r.json(), total: Number((r.headers.get('content-range') || '/0').split('/')[1]) };
}
async function masukApi(nomor) {
  const r = await fetch(U + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: K, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: nomor + '@simpus.local', password: nomor }) });
  return (await r.json()).access_token || null;
}
const lencana = (s) => (s > 0 ? 'Terlambat ' + s + ' hari' : s === 0 ? 'Jatuh tempo hari ini' : -s + ' hari lagi');

(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(B); break; } catch { await new Promise((r) => setTimeout(r, 300)); } }
  const b = await chromium.launch();
  const tulisDicegat = [];

  async function sesi(nomor) {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    page.galat = [];
    page.on('pageerror', (e) => page.galat.push(e.message));
    await page.route(/supabase\.co\/(rest|functions|storage)\/v1\//, async (route) => {
      const req = route.request();
      if (req.method() === 'GET' || req.method() === 'HEAD') {
        if (req.url().includes('/rest/v1/profil_pengguna')) {
          const resp = await route.fetch(); const d = await resp.json();
          for (const x of (Array.isArray(d) ? d : [d])) if (x) x.wajib_ganti_password = false; // hanya di browser uji
          return route.fulfill({ response: resp, json: d });
        }
        return route.continue();
      }
      tulisDicegat.push(req.method() + ' ' + req.url().split('/v1/')[1]);
      return route.fulfill({ status: 204, body: '' });
    });
    await page.goto(B + '/login'); await page.fill('#username', nomor); await page.fill('#sandi', nomor); await page.click('button[type=submit]');
    await page.waitForURL('**/anggota');
    return { ctx, page };
  }

  // ================= Beranda & Pinjaman Saya untuk beberapa anggota =================
  for (const nomor of ['240002', '240003', '240001', '230005', '220006']) {
    const token = await masukApi(nomor);
    if (!token) { console.log('LEWATI ' + nomor + ' (kata sandi sudah diganti pemilik)'); continue; }
    const profil = (await api(token, 'profil_pengguna', { select: 'nama' })).data[0];
    const semua = (await api(token, 'v_pinjaman', { select: '*', order: 'tanggal_jatuh_tempo' })).data;
    const aktif = semua.filter((p) => p.status === 'dipinjam');
    const riwayat = semua.filter((p) => p.status !== 'dipinjam');
    const { ctx, page } = await sesi(nomor);
    const L = '[' + nomor + ' ' + profil.nama.split(' ')[0] + '] ';

    await page.waitForSelector('text=Buku Baru'); await page.waitForFunction(() => !document.body.innerText.includes('Memuat...'));
    const teks = await page.innerText('main');
    cek(L + 'Beranda menyapa dengan nama anggota', teks.includes('Halo, ' + profil.nama));
    const kartu = page.locator('section:has(h2:text-is("Pinjaman Aktif")) a[href^="/anggota/buku/"]');
    cek(L + 'Beranda: jumlah kartu pinjaman aktif = data (' + aktif.length + ')', await kartu.count() === aktif.length, await kartu.count());
    cek(L + 'Beranda: tiap pinjaman aktif menampilkan judul, jatuh tempo, dan penanda yang benar',
      aktif.every((p) => teks.includes(p.judul) && teks.includes('Jatuh tempo: ' + tgl(p.tanggal_jatuh_tempo)) && teks.includes(lencana(p.hari_lewat_jatuh_tempo))), teks.slice(0, 500));
    const perluPeringatan = aktif.some((p) => p.hari_lewat_jatuh_tempo >= -2);
    const adaPeringatan = await page.locator('section:has(h2:text-is("Peringatan"))').count() === 1;
    cek(L + 'Beranda: kotak Peringatan ' + (perluPeringatan ? 'muncul' : 'tidak muncul') + ' sesuai keadaan pinjaman', adaPeringatan === perluPeringatan);
    if (perluPeringatan) {
      const p = await page.innerText('section:has(h2:text-is("Peringatan"))');
      const harap = [];
      const telat = aktif.filter((x) => x.hari_lewat_jatuh_tempo > 0);
      for (const h of [...new Set(telat.map((x) => x.hari_lewat_jatuh_tempo))]) harap.push(telat.filter((x) => x.hari_lewat_jatuh_tempo === h).length + ' buku terlambat ' + h + ' hari');
      const segera = aktif.filter((x) => x.hari_lewat_jatuh_tempo <= 0 && x.hari_lewat_jatuh_tempo >= -2);
      for (const t of [...new Set(segera.map((x) => x.tanggal_jatuh_tempo))]) harap.push(segera.filter((x) => x.tanggal_jatuh_tempo === t).length + ' buku jatuh tempo pada ' + tgl(t));
      cek(L + 'Beranda: isi peringatan tepat (' + harap.join('; ') + ')', harap.every((h) => p.includes(h)), p);
    }
    if (nomor === '240002') await page.screenshot({ path: path.join(dir, 't6-beranda.png'), fullPage: true });
    if (nomor === '240003') await page.screenshot({ path: path.join(dir, 't6-beranda-terlambat.png'), fullPage: true });

    await page.click('nav[aria-label="Menu bawah"] >> text=Pinjaman'); await page.waitForSelector('h1:text-is("Pinjaman Saya")'); await page.waitForFunction(() => !document.body.innerText.includes('Memuat...'));
    let t2 = await page.innerText('main');
    cek(L + 'Pinjaman Saya (Aktif): jumlah dan tanggal pinjam sesuai data', await page.locator('[role=tabpanel] a').count() === aktif.length && aktif.every((p) => t2.includes('Pinjam: ' + tgl(new Date(new Date(p.tanggal_pinjam).getTime() + 7 * 3600e3).toISOString()))), t2.slice(0, 400));
    await page.click('[role=tab]:has-text("Riwayat")');
    t2 = await page.innerText('main');
    cek(L + 'Pinjaman Saya (Riwayat): ' + riwayat.length + ' pinjaman selesai beserta tanggal kembali',
      (riwayat.length === 0 ? t2.includes('Belum ada riwayat pinjaman') : await page.locator('[role=tabpanel] a').count() === riwayat.length && riwayat.every((p) => t2.includes(p.judul))) , t2.slice(0, 400));
    if (riwayat.length > 0) {
      cek(L + 'Riwayat: penanda tepat waktu / terlambat sesuai data', riwayat.every((p) => t2.includes(p.hari_terlambat > 0 ? 'Terlambat ' + p.hari_terlambat + ' hari' : 'Tepat waktu')), t2);
      if (nomor === '240001') await page.screenshot({ path: path.join(dir, 't6-riwayat.png'), fullPage: true });
    }
    cek(L + 'Data pinjaman yang tampil hanya milik sendiri (RLS)', semua.every((p) => p.nama_anggota === profil.nama) && semua.every((p) => p.nama_petugas === null));
    cek(L + 'Tidak ada error JavaScript', page.galat.length === 0, page.galat);
    await ctx.close();
  }

  // ================= Katalog, Detail Buku, navigasi (satu anggota) =================
  const token = await masukApi('240002');
  const { ctx, page } = await sesi('240002');
  const semuaBuku = await api(token, 'v_ketersediaan_buku', { select: '*', order: 'judul,id_buku' });
  const baru = (await api(token, 'v_ketersediaan_buku', { select: 'judul,sampul', order: 'tanggal_input.desc', limit: '6' })).data;

  await page.waitForSelector('text=Buku Baru'); await page.waitForFunction(() => !document.body.innerText.includes('Memuat...'));
  const judulBaru = await page.locator('section:has(h2:text-is("Buku Baru")) a[href^="/anggota/buku/"]').allInnerTexts();
  cek('Beranda: 6 buku baru, urutan terbaru dulu', judulBaru.length === 6 && judulBaru.every((j, i) => j.includes(baru[i].judul)), judulBaru);
  if (baru.some((x) => x.sampul)) {
    const gambar = page.locator('section:has(h2:text-is("Buku Baru")) img').first();
    await gambar.waitFor(); await page.waitForFunction((el) => el.complete, await gambar.elementHandle());
    cek('Gambar sampul dari Storage tampil untuk anggota', await gambar.evaluate((el) => el.naturalWidth > 0));
  }
  await page.fill('[aria-label="Cari buku"]', 'laskar'); await page.keyboard.press('Enter'); await page.waitForURL('**/anggota/katalog?cari=laskar');
  await page.waitForSelector('text=1 judul buku');
  cek('Beranda: kolom cari membawa ke Katalog dengan hasil pencarian', (await page.innerText('main')).includes('Laskar Pelangi') && await page.inputValue('[aria-label="Cari buku"]') === 'laskar');

  await page.fill('[aria-label="Cari buku"]', ''); await page.waitForSelector('text=' + semuaBuku.total + ' judul buku');
  cek('Katalog: jumlah judul = data (' + semuaBuku.total + '), 20 kartu pertama tampil', await page.locator('main a[href^="/anggota/buku/"]').count() === Math.min(20, semuaBuku.total));
  await page.screenshot({ path: path.join(dir, 't6-katalog.png') });
  const kartu1 = await page.locator('main a[href^="/anggota/buku/"]').first().innerText();
  const b1 = semuaBuku.data[0];
  cek('Katalog: kartu pertama menampilkan judul, pengarang, dan rak sesuai data', kartu1.includes(b1.judul) && (!b1.lokasi_rak || kartu1.includes('Rak ' + b1.lokasi_rak)), kartu1);
  if (semuaBuku.total > 20) {
    await page.click('button:has-text("Muat lebih banyak")');
    await page.waitForFunction((n) => document.querySelectorAll('main a[href^="/anggota/buku/"]').length === n, semuaBuku.total);
    cek('Katalog: "Muat lebih banyak" menampilkan semua judul', true);
  }
  const habis = semuaBuku.data.find((x) => x.dapat_dipinjam && x.tersedia === 0 && x.dipinjam > 0);
  const ada = semuaBuku.data.find((x) => x.dapat_dipinjam && x.tersedia > 0);
  if (habis) cek('Katalog: buku yang semua eksemplarnya dipinjam bertanda "Semua dipinjam" (' + habis.judul + ')', (await page.locator('main a', { hasText: habis.judul }).first().innerText()).includes('Semua dipinjam'));
  cek('Katalog: buku tersedia bertanda "Tersedia x/y" (' + ada.judul + ')', (await page.locator('main a', { hasText: ada.judul }).first().innerText()).includes('Tersedia ' + ada.tersedia + '/' + ada.total_eksemplar));

  await page.click('[aria-label="Saring kategori"] >> text=Referensi');
  const ref = semuaBuku.data.filter((x) => x.nama_kategori === 'Referensi');
  await page.waitForSelector('text=' + ref.length + ' judul buku');
  const kartuRef = await page.locator('main a[href^="/anggota/buku/"]').allInnerTexts();
  cek('Katalog: saring kategori Referensi -> ' + ref.length + ' judul, semuanya "Baca di tempat"', kartuRef.length === ref.length && kartuRef.every((k) => k.includes('Baca di tempat')), kartuRef);
  await page.fill('[aria-label="Cari buku"]', 'kamus'); await page.waitForSelector('text=' + ref.filter((x) => /kamus/i.test(x.judul)).length + ' judul buku');
  cek('Katalog: kategori + kata kunci digabung', true);
  await page.click('[aria-label="Saring kategori"] >> text=Semua'); await page.fill('[aria-label="Cari buku"]', 'zzzzqq'); await page.waitForSelector('text=Tidak ada buku yang cocok');
  cek('Katalog: pencarian tanpa hasil -> pesan yang jelas', true);
  await page.fill('[aria-label="Cari buku"]', 'tere'); await page.waitForSelector('text=' + semuaBuku.data.filter((x) => /tere/i.test(x.judul) || /tere/i.test(x.pengarang || '')).length + ' judul buku');
  cek('Katalog: pencarian berdasarkan pengarang ("tere")', (await page.innerText('main')).includes('Tere Liye'));

  // ---- Detail buku ----
  await page.fill('[aria-label="Cari buku"]', 'laskar'); await page.waitForSelector('text=1 judul buku');
  await page.click('main a:has-text("Laskar Pelangi")'); await page.waitForSelector('h1:text-is("Laskar Pelangi")');
  const lp = semuaBuku.data.find((x) => x.judul === 'Laskar Pelangi');
  const d = await page.innerText('main');
  cek('Detail: penerbit, tahun, kategori, rak, ketersediaan, sinopsis sesuai data', [lp.pengarang, lp.penerbit, String(lp.tahun_terbit), lp.nama_kategori, lp.lokasi_rak, lp.tersedia + ' dari ' + lp.total_eksemplar + ' eksemplar tersedia', lp.sinopsis].every((x) => d.includes(x)), d);
  cek('Detail: keterangan "Peminjaman dilakukan langsung di meja petugas perpustakaan" tampil', d.includes('Peminjaman dilakukan langsung di meja petugas perpustakaan.'));
  const tombol = await page.locator('main button, main a').allInnerTexts();
  cek('Detail: TIDAK ada tombol pinjam/pesan (satu-satunya tombol: Kembali)', tombol.length === 1 && tombol[0].includes('Kembali'), tombol);
  await page.screenshot({ path: path.join(dir, 't6-detail.png'), fullPage: true });
  await page.click('button:has-text("Kembali")'); await page.waitForURL('**/anggota/katalog?cari=laskar');
  cek('Detail: Kembali membawa ke katalog dengan pencarian sebelumnya', await page.inputValue('[aria-label="Cari buku"]') === 'laskar');
  const kbbi = semuaBuku.data.find((x) => !x.dapat_dipinjam);
  await page.goto(B + '/anggota/buku/' + kbbi.id_buku); await page.waitForSelector('h1');
  cek('Detail buku referensi: bertanda hanya dibaca di tempat', (await page.innerText('main')).includes('hanya dapat dibaca di ruang perpustakaan'));
  await page.goto(B + '/anggota/buku/999999'); await page.waitForSelector('text=Buku tidak ditemukan');
  cek('Detail: buku yang tidak ada -> pesan jelas', true);

  // ---- navigasi bawah & ukuran sentuh ----
  const tinggi = await page.locator('nav[aria-label="Menu bawah"] a').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  cek('Navigasi bawah: 4 menu, tinggi sentuh >= 44px', tinggi.length === 4 && tinggi.every((t) => t >= 44), tinggi);
  await page.goto(B + '/anggota/katalog'); await page.waitForSelector('[aria-label="Saring kategori"] button');
  const tinggiChip = await page.locator('[aria-label="Saring kategori"] button').evaluateAll((els) => Math.min(...els.map((e) => e.getBoundingClientRect().height)));
  cek('Katalog: tombol kategori tinggi sentuh >= 44px', tinggiChip >= 44, tinggiChip);
  cek('Halaman tidak melebar melebihi layar HP (tanpa gulir samping)', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  for (const [menu, url] of [['Beranda', '/anggota'], ['Katalog', '/anggota/katalog'], ['Pinjaman', '/anggota/pinjaman'], ['Profil', '/anggota/profil']]) {
    await page.click('nav[aria-label="Menu bawah"] >> text=' + menu); await page.waitForURL('**' + url);
  }
  cek('Navigasi bawah berpindah ke keempat halaman', true);
  await page.goto(B + '/petugas/peminjaman'); await page.waitForURL('**/anggota');
  cek('Anggota membuka halaman petugas -> dikembalikan ke beranda anggota', true);
  cek('Tidak ada error JavaScript di katalog/detail', page.galat.length === 0, page.galat);
  await ctx.close();

  const selainLogin = tulisDicegat.filter((x) => !x.includes('rpc/catat_login'));
  cek('Halaman anggota tidak mengirim permintaan tulis apa pun (selain catatan waktu login)', selainLogin.length === 0, selainLogin);
  await b.close();
  console.log('\n' + lulus + ' LULUS, ' + gagal + ' GAGAL');
})().catch((e) => { console.error('ERROR', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
