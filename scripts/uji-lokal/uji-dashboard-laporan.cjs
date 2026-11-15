// Uji Dashboard dan Laporan. Data dijawab database uji LOKAL (lihat db-lokal.cjs);
// angka yang diharapkan dihitung langsung dengan SQL pada database yang sama.
// Jalankan siapkan-db.sh dulu: uji ini mengubah data lokal.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { jawab, pemilik } = require('./db-lokal.cjs');
const dir = path.join(__dirname, 'keluaran');
fs.mkdirSync(dir, { recursive: true });
const B = 'http://localhost:4173';

let lulus = 0, gagal = 0;
const cek = (n, ok, info = '') => {
  ok ? lulus++ : gagal++;
  console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : ' => ' + (typeof info === 'string' ? info : JSON.stringify(info))));
};
const sql = (s) => pemilik(s);
const tgl = (geser) => sql("select to_char(public.hari_ini_wib() + (" + geser + "), 'DD/MM/YYYY');");
const iso = (geser) => sql("select (public.hari_ini_wib() + (" + geser + "))::text;");
const WIB = "(tanggal_pinjam at time zone 'Asia/Jakarta')::date";

(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(B); break; } catch { await new Promise((r) => setTimeout(r, 300)); } }

  // ---- siapkan keadaan: satu pengembalian tepat waktu dan satu pengembalian terlambat (ada denda) hari ini ----
  const R = 'https://x.supabase.co/rest/v1/rpc/';
  jawab('POST', R + 'catat_pengembalian', { p_nomor_induk_eksemplar: 'B0018', p_kondisi: 'baik', p_status_denda: null, p_catatan: null });
  jawab('POST', R + 'catat_pengembalian', { p_nomor_induk_eksemplar: 'B0048', p_kondisi: 'baik', p_status_denda: 'belum_lunas', p_catatan: null });

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const galatHalaman = []; page.on('pageerror', (e) => galatHalaman.push(e.message));
  const tidakDitangani = []; const tulis = [];
  await page.addInitScript(() => { window.__cetak = 0; window.print = () => { window.__cetak++; }; });

  await page.route(/supabase\.co\/(rest|functions|storage)\/v1\//, async (route) => {
    const req = route.request(); const url = req.url(); const m = req.method();
    if (m === 'GET' && url.includes('/rest/v1/profil_pengguna')) {
      const resp = await route.fetch(); const d = await resp.json();
      for (const x of (Array.isArray(d) ? d : [d])) if (x) { x.role = 'petugas'; x.wajib_ganti_password = false; x.nama = 'Petugas Perpustakaan'; }
      return route.fulfill({ response: resp, json: d });
    }
    let isi = null; try { isi = req.postDataJSON(); } catch { isi = null; }
    if (m !== 'GET' && m !== 'HEAD') tulis.push({ m, jalur: url.split('/v1/')[1], isi });
    const r = url.includes('/rest/v1/') ? jawab(m, url, isi, req.headers()) : null;
    if (!r) { tidakDitangani.push(m + ' ' + url.split('/v1/')[1]); return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); }
    return route.fulfill({ status: r.status, contentType: 'application/json', headers: { 'access-control-expose-headers': 'content-range', ...(r.headers || {}) }, body: r.body });
  });

  await page.goto(B + '/login'); await page.fill('#username', '240002'); await page.fill('#sandi', '240002'); await page.click('button[type=submit]');
  await page.waitForURL('**/petugas');

  // ================= DASHBOARD =================
  await page.waitForSelector('text=Ringkasan Koleksi'); await page.waitForFunction(() => !document.body.innerText.includes('Memuat data...') && !document.body.innerText.includes('…'));
  const harap = {
    pinjam: sql('select count(*) from public.v_pinjaman where ' + WIB + ' = public.hari_ini_wib();'),
    kembali: sql("select count(*) from public.v_pinjaman where (tanggal_kembali at time zone 'Asia/Jakarta')::date = public.hari_ini_wib();"),
    tempo: sql("select count(*) from public.v_pinjaman where status = 'dipinjam' and tanggal_jatuh_tempo = public.hari_ini_wib();"),
    telat: sql('select count(*) from public.v_keterlambatan;'),
  };
  const kartu = await page.locator('.text-3xl').allTextContents();
  cek('Dashboard: 4 angka ringkas = hitungan database (pinjam ' + harap.pinjam + ', kembali ' + harap.kembali + ', jatuh tempo ' + harap.tempo + ', terlambat ' + harap.telat + ')',
    kartu.join(',') === [harap.pinjam, harap.kembali, harap.tempo, harap.telat].join(','), kartu);
  cek('Dashboard: keadaan uji memang berisi pengembalian hari ini dan pinjaman terlambat', Number(harap.kembali) === 2 && Number(harap.telat) === 2 && Number(harap.pinjam) >= 1);

  const grafikHarap = sql('select string_agg(coalesce(n, 0)::text, \',\' order by d) from generate_series(public.hari_ini_wib() - 6, public.hari_ini_wib(), interval \'1 day\') d left join (select ' + WIB + ' as t, count(*) n from public.v_pinjaman group by 1) x on x.t = d::date;');
  const grafik = await page.locator('section:has(h2:text-is("Grafik Peminjaman 7 Hari Terakhir")) span.text-xs').allTextContents();
  cek('Dashboard: grafik 7 hari = jumlah buku dipinjam per hari (' + grafikHarap + ')', grafik.join(',') === grafikHarap, grafik);
  const label = await page.locator('section:has(h2:text-is("Grafik Peminjaman 7 Hari Terakhir")) div.text-center.text-xs').allTextContents();
  cek('Dashboard: label grafik dari 6 hari lalu sampai hari ini', label.length === 7 && label[0] === tgl(-6).slice(0, 5) && label[6] === tgl(0).slice(0, 5), label);

  const koleksiHarap = sql("select (select count(*) from public.buku) || ',' || count(*) || ',' || count(*) filter (where status = 'tersedia') || ',' || count(*) filter (where status = 'dipinjam') || ',' || count(*) filter (where status = 'rusak') || ',' || count(*) filter (where status = 'hilang') from public.eksemplar;");
  const koleksi = await page.locator('section:has(h2:text-is("Ringkasan Koleksi")) tbody td:nth-child(2)').allTextContents();
  cek('Dashboard: ringkasan koleksi (judul, eksemplar, tersedia, dipinjam, rusak, hilang) = ' + koleksiHarap, koleksi.join(',') === koleksiHarap, koleksi);

  const jt = await page.locator('section:has(h2:text-is("Jatuh Tempo Hari Ini")) tbody tr').allTextContents();
  cek('Dashboard: tabel jatuh tempo hari ini memuat Fitri (Filosofi Teras, B0036)', jt.length === 1 && jt[0].includes('Fitri Handayani') && jt[0].includes('9A') && jt[0].includes('Filosofi Teras') && jt[0].includes('B0036') && jt[0].includes(tgl(0)), jt);
  await page.screenshot({ path: path.join(dir, 't7-dashboard.png'), fullPage: true });
  await page.click('text=Lihat daftar'); await page.waitForURL('**/petugas/keterlambatan');
  cek('Dashboard: "Lihat daftar" membuka Daftar Keterlambatan', true);
  await page.click('nav >> text=Dashboard'); await page.waitForSelector('text=Ringkasan Koleksi');
  await page.click('a:has-text("+ Catat Peminjaman")'); await page.waitForURL('**/petugas/peminjaman');
  await page.click('nav >> text=Dashboard'); await page.click('a:has-text("Catat Pengembalian")'); await page.waitForURL('**/petugas/pengembalian');
  cek('Dashboard: tombol pintas Catat Peminjaman dan Catat Pengembalian berfungsi', true);
  await page.click('nav >> text=Dashboard'); await page.waitForSelector('a:has-text("B0036")'); await page.click('a:has-text("B0036")'); await page.waitForURL('**/pengembalian?no=B0036'); await page.waitForSelector('text=Data Pinjaman');
  cek('Dashboard: klik nomor induk jatuh tempo langsung membuka pengembaliannya', (await page.innerText('main')).includes('Fitri Handayani'));

  // ================= LAPORAN =================
  await page.click('nav >> text=Laporan'); await page.waitForSelector('h2:text-is("Hasil Laporan")');
  cek('Laporan: periode awal bawaan = tanggal 1 bulan ini s.d. hari ini', (await page.inputValue('#awal')) === iso(0).slice(0, 8) + '01' && (await page.inputValue('#akhir')) === iso(0));
  const atur = async (a, z) => { await page.fill('#awal', a); await page.fill('#akhir', z); await page.click('button:has-text("Tampilkan")'); await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled); };
  const ringkas = () => page.locator('.text-3xl').allTextContents();
  const barisTabel = (n = 0) => page.locator('table.tabel-laporan').nth(n).locator('tbody tr').allTextContents();
  const periode = (a, z) => WIB + " between '" + a + "' and '" + z + "'";

  // ---- peminjaman, seluruh data ----
  let a = iso(-70), z = iso(0);
  await atur(a, z);
  let h = sql("select count(distinct id_peminjaman) || ',' || count(*) || ',' || count(distinct id_anggota) || ',' || count(*) filter (where hari_terlambat > 0 or terlambat) from public.v_pinjaman where " + periode(a, z) + ';');
  cek('Laporan Peminjaman (70 hari): transaksi, buku, anggota, terlambat = ' + h, (await ringkas()).join(',') === h, await ringkas());
  let baris = await barisTabel();
  const jumlahBuku = Number(h.split(',')[1]);
  cek('Laporan Peminjaman: jumlah baris tabel = jumlah buku dipinjam (' + jumlahBuku + '), urut dari yang paling lama', baris.length === jumlahBuku && baris[0].includes(tgl(-60)) && baris[0].includes('Gilang Ramadhan') && baris[0].includes('Dikembalikan'), baris.slice(0, 2));
  const semuaTeks = baris.join('\n');
  cek('Laporan Peminjaman: kelima jenis status tampil sesuai data', ['Dipinjam', 'Dikembalikan', 'Kembali terlambat', 'Terlambat (belum kembali)'].every((s) => semuaTeks.includes(s)), semuaTeks.slice(0, 300));
  await page.screenshot({ path: path.join(dir, 't7-laporan-peminjaman.png'), fullPage: true });

  // ---- peminjaman, periode sempit ----
  a = iso(-3); z = iso(0);
  await atur(a, z);
  h = sql("select count(distinct id_peminjaman) || ',' || count(*) || ',' || count(distinct id_anggota) || ',' || count(*) filter (where hari_terlambat > 0 or terlambat) from public.v_pinjaman where " + periode(a, z) + ';');
  cek('Laporan Peminjaman (3 hari terakhir): angka ikut berubah = ' + h, (await ringkas()).join(',') === h && (await barisTabel()).length === Number(h.split(',')[1]), await ringkas());
  a = iso(-400); z = iso(-300);
  await atur(a, z);
  cek('Laporan Peminjaman: periode tanpa data -> angka 0 dan pesan kosong', (await ringkas()).join(',') === '0,0,0,0' && (await page.innerText('table.tabel-laporan')).includes('Tidak ada peminjaman pada periode ini'));

  // ---- cetak ----
  a = iso(-70); z = iso(0);
  await atur(a, z);
  await page.fill('#awal', iso(-10));
  cek('Laporan: periode diubah tanpa Tampilkan -> tombol Cetak dan Unduh PDF terkunci', await page.isDisabled('button:has-text("Cetak")') && await page.isDisabled('button:has-text("Unduh PDF")'));
  await page.fill('#awal', a);
  const sebelum = Number(sql('select count(*) from public.laporan;'));
  await page.click('button:has-text("Cetak")'); await page.waitForFunction(() => window.__cetak === 1);
  const t = tulis.filter((x) => x.jalur.startsWith('laporan')).pop();
  cek('Laporan: Cetak mencatat histori (jenis, periode, petugas) lalu membuka jendela cetak', t && t.isi.jenis_laporan === 'peminjaman' && t.isi.periode_awal === a && t.isi.periode_akhir === z && typeof t.isi.id_petugas === 'string' && Number(sql('select count(*) from public.laporan;')) === sebelum + 1, t);
  cek('Database: baris histori laporan tersimpan dengan jenis dan periode yang benar', sql("select jenis_laporan || '|' || periode_awal || '|' || periode_akhir from public.laporan order by id_laporan desc limit 1;") === 'peminjaman|' + a + '|' + z);
  await page.click('button:has-text("Unduh PDF")'); await page.waitForFunction(() => window.__cetak === 2);
  cek('Laporan: Unduh PDF juga membuka jendela cetak dan mencatat histori', Number(sql('select count(*) from public.laporan;')) === sebelum + 2);

  await page.emulateMedia({ media: 'print' });
  const cetak = await page.innerText('main');
  cek('Laporan (mode cetak): kepala laporan berisi nama perpustakaan, judul, dan periode', cetak.includes('PERPUSTAKAAN NAMA SEKOLAH') && cetak.includes('Laporan Peminjaman') && cetak.includes('Periode ' + tgl(-70) + ' s.d. ' + tgl(0)), cetak.slice(0, 200));
  cek('Laporan (mode cetak): ada keterangan dicetak oleh siapa dan kolom tanda tangan Kepala Sekolah', cetak.includes('Dicetak') && cetak.includes('oleh Petugas Perpustakaan') && cetak.includes('Kepala Sekolah') && cetak.includes('Mengetahui'));
  cek('Laporan (mode cetak): menu, tab, dan tombol tersembunyi', !(await page.isVisible('aside')) && !(await page.isVisible('[role=tablist]')) && !(await page.isVisible('button:has-text("Tampilkan")')));
  await page.pdf({ path: path.join(dir, 't7-laporan-peminjaman.pdf'), format: 'A4' });
  await page.emulateMedia({ media: 'screen' });

  // ---- keterlambatan ----
  await page.click('[role=tab]:has-text("Keterlambatan")'); await page.waitForSelector('th:has-text("Hari Terlambat")');
  await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled);
  h = sql("select count(*) || ',' || count(distinct id_anggota) || ',' || count(*) filter (where status = 'dipinjam') || ',' || coalesce(sum(denda), 0)::int from public.v_pinjaman where tanggal_jatuh_tempo between '" + a + "' and '" + z + "' and (hari_terlambat > 0 or terlambat);");
  let r = await ringkas();
  cek('Laporan Keterlambatan: jumlah, anggota, belum kembali, denda = ' + h, r.slice(0, 3).join(',') === h.split(',').slice(0, 3).join(',') && r[3].replace(/\D/g, '') === h.split(',')[3], r);
  baris = await barisTabel();
  cek('Laporan Keterlambatan: urut dari yang terlama; yang belum kembali ditandai', baris[0].includes('Eko Saputra') && baris[0].includes('Belum kembali') && baris[0].includes('38') && baris[0].includes('Dihitung saat kembali'), baris[0]);
  cek('Laporan Keterlambatan: denda yang sudah tercatat tampil dengan statusnya', baris.some((x) => x.includes('Cahyo Nugroho') && x.includes('Rp5.000 (belum lunas)')), baris);
  cek('Laporan Keterlambatan: menegaskan terlambat tidak otomatis hilang', (await page.innerText('main')).includes('Pinjaman terlambat tidak otomatis dianggap hilang'));
  await page.screenshot({ path: path.join(dir, 't7-laporan-keterlambatan.png'), fullPage: true });

  // ---- buku terpopuler ----
  await page.click('[role=tab]:has-text("Buku Terpopuler")'); await page.waitForSelector('th:has-text("Peringkat")');
  await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled);
  h = sql("select count(*) || ',' || count(distinct id_buku) || ',' || ((select count(*) from public.buku) - count(distinct id_buku)) from public.v_pinjaman where " + periode(a, z) + ';');
  const puncak = sql("select max(n) from (select count(*) n from public.v_pinjaman where " + periode(a, z) + ' group by id_buku) x;');
  r = await ringkas();
  cek('Laporan Buku Terpopuler: total, judul dipinjam, judul tidak dipinjam = ' + h + '; terbanyak ' + puncak + ' kali', r.slice(0, 3).join(',') === h && r[3] === puncak + ' kali', r);
  baris = await barisTabel();
  const juara = sql("select string_agg(judul, '|' order by judul) from (select judul from public.v_pinjaman where " + periode(a, z) + ' group by id_buku, judul having count(*) = ' + puncak + ') x;').split('|');
  cek('Laporan Buku Terpopuler: peringkat teratas = buku dengan peminjaman terbanyak (' + juara.join(', ') + ')', juara.every((jd, i) => baris[i].includes(jd)) && baris[0].startsWith('1') && baris[0].includes('Fiksi') && baris.length === Number(h.split(',')[1]), baris.slice(0, 4));
  await page.click('button:has-text("Cetak")'); await page.waitForFunction(() => window.__cetak === 3);
  cek('Laporan: histori mencatat jenis laporan sesuai tab (buku_terpopuler)', sql('select jenis_laporan from public.laporan order by id_laporan desc limit 1;') === 'buku_terpopuler');

  // ---- koleksi ----
  await page.click('[role=tab]:has-text("Koleksi")'); await page.waitForSelector('h2:text-is("Koleksi per Kategori")');
  await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled);
  h = sql("select (select count(*) from public.buku) || ',' || count(*) || ',' || count(*) filter (where status = 'rusak') || ',' || count(*) filter (where status = 'hilang') from public.eksemplar;");
  cek('Laporan Koleksi: judul, eksemplar, rusak, hilang = ' + h, (await ringkas()).join(',') === h, await ringkas());
  baris = await barisTabel(0);
  const fiksi = sql("select count(distinct b.id_buku) || '|' || count(e.id_eksemplar) || '|' || count(*) filter (where e.status = 'tersedia') || '|' || count(*) filter (where e.status = 'dipinjam') from public.buku b join public.kategori k using (id_kategori) left join public.eksemplar e using (id_buku) where k.nama_kategori = 'Fiksi';").split('|');
  const barisFiksi = await page.locator('table.tabel-laporan').first().locator('tbody tr', { hasText: 'Fiksi' }).locator('td').allTextContents();
  cek('Laporan Koleksi: baris kategori Fiksi (judul, eksemplar, tersedia, dipinjam) = ' + fiksi.join('/'), barisFiksi.slice(1, 5).join('|') === fiksi.join('|'), barisFiksi);
  cek('Laporan Koleksi: 6 kategori + baris JUMLAH', baris.length === 7 && baris[6].startsWith('JUMLAH'), baris);
  const bermasalah = await barisTabel(1);
  const harapBermasalah = sql("select string_agg(nomor_induk, ',' order by nomor_induk) from public.eksemplar where status in ('rusak', 'hilang');").split(',');
  cek('Laporan Koleksi: daftar eksemplar rusak/hilang (' + harapBermasalah.join(', ') + ') beserta judul dan keterangan', bermasalah.length === harapBermasalah.length && harapBermasalah.every((no, i) => bermasalah[i].includes(no)) && bermasalah.join().includes('Sampul sobek') && bermasalah.join().includes('Hilang') && bermasalah.join().includes('Rusak'), bermasalah);
  const masuk = sql("select count(*) from public.eksemplar where tanggal_masuk between '" + a + "' and '" + z + "';");
  cek('Laporan Koleksi: keterangan jumlah eksemplar masuk pada periode (' + masuk + ')', (await page.innerText('main')).includes(tgl(0) + ': ' + masuk + '.'));
  await page.screenshot({ path: path.join(dir, 't7-laporan-koleksi.png'), fullPage: true });
  await page.emulateMedia({ media: 'print' }); await page.pdf({ path: path.join(dir, 't7-laporan-koleksi.pdf'), format: 'A4' }); await page.emulateMedia({ media: 'screen' });

  cek('Semua permintaan data dijawab alat uji', tidakDitangani.length === 0, tidakDitangani);
  cek('Tidak ada error JavaScript selama pengujian', galatHalaman.length === 0, galatHalaman);
  await b.close();
  console.log('\n' + lulus + ' LULUS, ' + gagal + ' GAGAL');
})().catch((e) => { console.error('ERROR', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
