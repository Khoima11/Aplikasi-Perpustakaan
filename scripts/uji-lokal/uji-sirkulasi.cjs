// Uji halaman sirkulasi. Login memakai akun contoh di Supabase (peran ditirukan menjadi petugas
// hanya di browser uji). SEMUA data /rest/v1 dijawab database uji LOKAL: fungsi transaksi,
// RLS, dan pesan penolakannya sungguhan, tetapi tidak ada yang menyentuh Supabase pemilik.
const { chromium } = require('playwright');
const { jawab, pemilik } = require('./db-lokal.cjs');
const dir = require('path').join(__dirname, 'keluaran'); require('fs').mkdirSync(dir, { recursive: true });
const B = 'http://localhost:4173';
let lulus = 0, gagal = 0;
const cek = (n, ok, info = '') => {
  ok ? lulus++ : gagal++;
  console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : ' => ' + (typeof info === 'string' ? info : JSON.stringify(info))));
};
const tgl = (geser) => pemilik("select to_char(public.hari_ini_wib() + " + geser + ", 'DD/MM/YYYY');");
const statusEks = (no) => pemilik("select status from public.eksemplar where nomor_induk = '" + no + "';");

(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(B); break; } catch { await new Promise((r) => setTimeout(r, 300)); } }
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 850 } });
  const page = await ctx.newPage();
  const galatHalaman = [];
  page.on('pageerror', (e) => galatHalaman.push(e.message));
  const tidakDitangani = [];

  await page.route(/supabase\.co\/(rest|functions|storage)\/v1\//, async (route) => {
    const req = route.request(); const url = req.url(); const m = req.method();
    if (m === 'GET' && url.includes('/rest/v1/profil_pengguna')) {
      const resp = await route.fetch(); const d = await resp.json();
      for (const x of (Array.isArray(d) ? d : [d])) if (x) { x.role = 'petugas'; x.wajib_ganti_password = false; x.nama = 'Petugas Perpustakaan'; }
      return route.fulfill({ response: resp, json: d });
    }
    let isi = null; try { isi = req.postDataJSON(); } catch { isi = null; }
    const r = url.includes('/rest/v1/') ? jawab(m, url, isi) : null;
    if (!r) { tidakDitangani.push(m + ' ' + url.split('/v1/')[1]); return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); }
    return route.fulfill({ status: r.status, contentType: 'application/json', headers: { 'access-control-expose-headers': 'content-range' }, body: r.body });
  });

  const pesan = async () => (await page.locator('main [role=status], main [role=alert]').allTextContents()).join(' | ');
  const tunggu = (t) => page.waitForSelector('text=' + t);

  await page.goto(B + '/login'); await page.fill('#username', '240002'); await page.fill('#sandi', '240002'); await page.click('button[type=submit]');
  await page.waitForURL('**/petugas');

  // ================= DAFTAR KETERLAMBATAN =================
  await page.click('nav >> text=Keterlambatan'); await tunggu('Eko Saputra');
  const kartu = await page.locator('.text-3xl').allTextContents();
  cek('Keterlambatan: ringkasan 3 pinjaman terlambat, 3 anggota, 1 lebih dari 30 hari', kartu.join(',') === '3,3,1', kartu);
  let baris = await page.locator('tbody tr').allTextContents();
  cek('Keterlambatan: urutan awal terlama dulu (Eko 38, Indah 6, Cahyo 5 hari)', baris.length === 3 && baris[0].includes('Eko') && baris[0].includes('38 hari') && baris[1].includes('Indah') && baris[2].includes('Cahyo') && baris[2].includes('5 hari'), baris);
  cek('Keterlambatan: catatan "tidak otomatis dianggap hilang" tampil', (await page.textContent('main')).includes('Pinjaman terlambat tidak otomatis dianggap hilang'));
  await page.screenshot({ path: dir + '/t5-keterlambatan.png' });
  await page.fill('[aria-label="Cari keterlambatan"]', 'cahyo'); await page.click('button:has-text("Tampilkan")');
  cek('Keterlambatan: cari "cahyo" -> 1 baris', await page.locator('tbody tr').count() === 1);
  await page.fill('[aria-label="Cari keterlambatan"]', ''); await page.selectOption('[aria-label="Saring kelas"]', '8B'); await page.click('button:has-text("Tampilkan")');
  cek('Keterlambatan: saring kelas 8B -> Eko', (await page.locator('tbody tr').allTextContents()).join().includes('Eko') && await page.locator('tbody tr').count() === 1);
  await page.selectOption('[aria-label="Saring kelas"]', ''); await page.selectOption('[aria-label="Urutan"]', 'nama'); await page.click('button:has-text("Tampilkan")');
  baris = await page.locator('tbody tr').allTextContents();
  cek('Keterlambatan: urut nama -> Cahyo, Eko, Indah', baris[0].includes('Cahyo') && baris[1].includes('Eko') && baris[2].includes('Indah'), baris);
  await page.locator('tbody tr', { hasText: 'Eko Saputra' }).locator('button:has-text("Detail")').click();
  const rinci = await page.textContent('[role=dialog]');
  cek('Keterlambatan: detail menampilkan NIS, no HP, buku, dan lama terlambat', rinci.includes('230005') && rinci.includes('081200000005') && rinci.includes('Bumi Manusia') && rinci.includes('B0019') && rinci.includes('38 hari'), rinci);
  cek('AB-08: setelah daftar keterlambatan dibuka, eksemplar terlambat 38 hari tetap "dipinjam"', statusEks('B0019') === 'dipinjam', statusEks('B0019'));
  await page.click('[role=dialog] >> text=Proses Pengembalian'); await page.waitForURL('**/pengembalian?no=B0019'); await tunggu('Data Pinjaman');
  cek('Keterlambatan -> Proses Pengembalian: data pinjaman langsung terbuka', (await page.textContent('main')).includes('Eko Saputra (230005)') && (await page.inputValue('[aria-label="Nomor induk eksemplar"]')) === 'B0019');

  // ================= PEMINJAMAN =================
  await page.click('nav >> text=Peminjaman'); await tunggu('1. Data Anggota');
  const cariAnggota = async (n) => { await page.fill('[aria-label="NIS atau NIP anggota"]', n); await page.click('button:has-text("Cari")'); };
  const tambah = async (n) => { await page.fill('[aria-label="Nomor induk eksemplar"]', n); await page.click('button:has-text("+ Tambah")'); };
  await tunggu('Dewi Anggraini');
  cek('Peminjaman: daftar hari ini memuat transaksi contoh (Dewi, 1 buku, nama petugas)', (await page.locator('section:has-text("Peminjaman Terakhir Hari Ini") tbody tr').first().textContent()).includes('Petugas Perpustakaan'));
  await cariAnggota('999999'); await tunggu('tidak ditemukan');
  cek('Peminjaman: NIS tidak dikenal -> pesan dari database', (await pesan()).includes('Anggota dengan nomor induk "999999" tidak ditemukan'));
  await cariAnggota('240003'); await tunggu('Tidak boleh meminjam');
  cek('AB-02: anggota terlambat -> "Tidak boleh meminjam" + alasan, kolom buku terkunci', (await page.textContent('main')).includes('melewati jatuh tempo') && await page.isDisabled('[aria-label="Nomor induk eksemplar"]'));
  await cariAnggota('240002'); await tunggu('sudah mencapai batas');
  cek('AB-02: anggota yang sudah di batas pinjam (2 dari 2) -> ditolak', (await page.textContent('main')).includes('2 / 2'));
  await cariAnggota('220007'); await tunggu('nonaktif');
  cek('AB-10: anggota nonaktif -> ditolak', (await page.textContent('main')).includes('Anggota berstatus nonaktif'));
  await cariAnggota('240001'); await tunggu('Boleh meminjam');
  const dataAnggota = await page.textContent('section:has-text("1. Data Anggota")');
  cek('Peminjaman: anggota layak -> nama, jenis/kelas, pinjaman 1 / 2, terlambat 0', dataAnggota.includes('Andi Pratama') && dataAnggota.includes('siswa / 7A') && dataAnggota.includes('1 / 2'), dataAnggota);
  await tambah('b0054'); await tunggu('dibaca di tempat');
  cek('AB-03: buku referensi ditolak dengan alasan', (await pesan()).includes('hanya untuk dibaca di tempat'));
  await tambah('B0017'); await tunggu('Status saat ini: dipinjam');
  cek('AB-03: eksemplar yang sedang dipinjam ditolak dengan alasan', true);
  await tambah('B9999'); await tunggu('"B9999" tidak ditemukan');
  cek('AB-03: nomor induk tidak dikenal ditolak', true);
  await tambah('b0001'); await page.waitForSelector('tbody >> text=B0001');
  const barisBuku = await page.locator('section:has-text("2. Buku yang Dipinjam") tbody tr').first().textContent();
  cek('AB-04: buku masuk daftar dengan jatuh tempo hari ini + 7 (nomor huruf kecil diterima)', barisBuku.includes('B0001') && barisBuku.includes('Matematika') && barisBuku.includes(tgl(7)), barisBuku + ' vs ' + tgl(7));
  await tambah('B0001'); await tunggu('sudah ada di daftar');
  cek('Peminjaman: nomor induk yang sama dua kali ditolak', true);
  await tambah('B0002'); await tunggu('batas pinjam');
  cek('AB-02: menambah buku melebihi batas ditolak sebelum disimpan', (await pesan()).includes('adalah 2 buku'));
  await page.screenshot({ path: dir + '/t5-peminjaman.png' });
  await page.click('button:has-text("Simpan Peminjaman")'); await page.waitForURL('**/peminjaman/bukti/*');
  await tunggu('No. Transaksi');
  const idBaru = Number(page.url().split('/').pop());
  const bukti = await page.textContent('main');
  cek('Peminjaman tersimpan -> halaman bukti dengan nomor transaksi, anggota, petugas, buku, jatuh tempo',
    bukti.includes('PJ-' + String(idBaru).padStart(6, '0')) && bukti.includes('Andi Pratama (240001) - Kelas 7A') && bukti.includes('Petugas Perpustakaan') && bukti.includes('B0001') && bukti.includes(tgl(7)) && bukti.includes('Harap kembalikan buku sebelum tanggal jatuh tempo'), bukti);
  cek('Database: eksemplar B0001 kini "dipinjam" dan jatuh tempo tersimpan', statusEks('B0001') === 'dipinjam' && pemilik("select to_char(tanggal_jatuh_tempo, 'DD/MM/YYYY') from public.detail_peminjaman where id_peminjaman = " + idBaru + ';') === tgl(7));
  await page.screenshot({ path: dir + '/t5-bukti.png' });
  await page.emulateMedia({ media: 'print' });
  cek('Bukti (mode cetak): menu samping, header, dan tombol tersembunyi; isi bukti tetap tampil',
    !(await page.isVisible('aside')) && !(await page.isVisible('header')) && !(await page.isVisible('button:has-text("Cetak")')) && await page.isVisible('text=No. Transaksi'));
  await page.pdf({ path: dir + '/t5-bukti.pdf', format: 'A5' });
  await page.emulateMedia({ media: 'screen' });
  await page.click('a:has-text("Kembali")'); await tunggu('Peminjaman Terakhir Hari Ini'); await tunggu('Andi Pratama');
  const hariIni = await page.locator('section:has-text("Peminjaman Terakhir Hari Ini") tbody tr').allTextContents();
  cek('Peminjaman: transaksi baru muncul di daftar hari ini (paling atas) dengan tombol Cetak Bukti', hariIni.length === 2 && hariIni[0].includes('Andi Pratama') && hariIni[0].includes('Cetak Bukti'), hariIni);

  // database menolak walau tampilan sempat meloloskan (keadaan berubah di tengah jalan)
  await cariAnggota('230004'); await tunggu('Boleh meminjam'); await tambah('B0002'); await page.waitForSelector('tbody >> text=B0002');
  pemilik("update public.eksemplar set status = 'rusak' where nomor_induk = 'B0002';");
  await page.click('button:has-text("Simpan Peminjaman")'); await tunggu('Status saat ini: rusak');
  cek('Aturan ditegakkan database: eksemplar berubah status setelah masuk daftar -> penyimpanan ditolak, tetap di halaman', page.url().endsWith('/petugas/peminjaman') && Number(pemilik("select count(*) from public.peminjaman where id_anggota = (select id_anggota from public.anggota where nomor_induk = '230004') and tanggal_pinjam > now() - interval '1 minute';")) <= 1);
  pemilik("update public.eksemplar set status = 'tersedia' where nomor_induk = 'B0002';");
  await page.click('button:has-text("Batal")');
  cek('Peminjaman: Batal mengosongkan anggota dan daftar', (await page.inputValue('[aria-label="NIS atau NIP anggota"]')) === '' && !(await page.textContent('main')).includes('Boleh meminjam'));
  await cariAnggota('198501012010011001'); await tunggu('Boleh meminjam'); await tambah('B0003'); await page.waitForSelector('tbody >> text=B0003');
  cek('AB-04: guru -> jatuh tempo hari ini + 14, pinjaman 4 / 5', (await page.textContent('main')).includes(tgl(14)) && (await page.textContent('main')).includes('4 / 5'));
  await page.click('button:has-text("Batal")');

  // ================= PENGEMBALIAN & PERPANJANGAN =================
  await page.click('nav >> text=Pengembalian'); await tunggu('Denda Belum Lunas');
  const cariPinjaman = async (n) => { await page.fill('[aria-label="Nomor induk eksemplar"]', n); await page.click('button:has-text("Cari Pinjaman")'); };
  await cariPinjaman('B9999'); await tunggu('tidak ditemukan');
  cek('Pengembalian: nomor induk tidak dikenal -> pesan jelas', true);
  await cariPinjaman('B0002'); await tunggu('tidak sedang dipinjam');
  cek('Pengembalian: eksemplar yang tidak dipinjam -> pesan jelas', true);
  await cariPinjaman('b0018'); await tunggu('Data Pinjaman');
  let data = await page.textContent('section:has-text("Data Pinjaman")');
  cek('Pengembalian: data pinjaman tepat waktu (Andi, Sang Pemimpi, 0 dari 1 kali, denda Rp0)', data.includes('Andi Pratama (240001)') && data.includes('Sang Pemimpi / B0018') && data.includes('0 dari 1 kali') && data.includes('Rp0') && data.includes(tgl(4)), data);
  cek('Pengembalian: tanpa denda -> kolom status denda terkunci "Tidak ada denda"', await page.isDisabled('#status-denda') && (await page.inputValue('#status-denda')) === 'Tidak ada denda');
  await page.click('button:has-text("Perpanjang Pinjaman")');
  const konf = await page.textContent('[role=dialog]');
  cek('AB-05: konfirmasi perpanjangan menampilkan jatuh tempo lama dan baru (hari ini + 7)', konf.includes(tgl(4)) && konf.includes(tgl(7)), konf);
  await page.click('[role=dialog] button:has-text("Perpanjang")'); await tunggu('diperpanjang sampai');
  cek('AB-05: perpanjangan tersimpan (jatuh tempo baru, perpanjangan ke-1)', (await pesan()).includes(tgl(7)) && (await pesan()).includes('Perpanjangan ke-1') && pemilik("select jumlah_perpanjangan || ',' || to_char(tanggal_jatuh_tempo, 'DD/MM/YYYY') from public.v_pinjaman where nomor_induk_eksemplar = 'B0018' and status = 'dipinjam';") === '1,' + tgl(7));
  await cariPinjaman('B0018'); await tunggu('Tidak bisa diperpanjang');
  cek('AB-05: perpanjangan kedua -> tombol terkunci dengan alasan batas tercapai', await page.isDisabled('button:has-text("Perpanjang Pinjaman")') && (await page.textContent('main')).includes('Batas perpanjangan sudah tercapai (1 dari 1 kali)'));
  await cariPinjaman('B0048'); await tunggu('Cahyo Nugroho');
  data = await page.textContent('section:has-text("Data Pinjaman")');
  cek('AB-06/07: pinjaman terlambat 5 hari -> denda Rp5.000 ditampilkan sebelum disimpan', data.includes('5 hari') && data.includes('Rp5.000'), data);
  cek('AB-05: pinjaman terlambat -> perpanjangan terkunci', await page.isDisabled('button:has-text("Perpanjang Pinjaman")') && (await page.textContent('main')).includes('sudah terlambat 5 hari'));
  await page.screenshot({ path: dir + '/t5-pengembalian.png' });
  await page.click('button:has-text("Simpan Pengembalian")'); await tunggu('berhasil dicatat');
  cek('Pengembalian (baik, denda belum lunas) tersimpan dengan ringkasan', (await pesan()).includes('Terlambat 5 hari, denda Rp5.000 (belum lunas)') && (await pesan()).includes('Eksemplar kembali tersedia') && statusEks('B0048') === 'tersedia', await pesan());
  await page.waitForSelector('section:has-text("Denda Belum Lunas") >> text=Cahyo Nugroho');
  const tunggak = await page.locator('section:has-text("Denda Belum Lunas") tbody tr').allTextContents();
  cek('Denda belum lunas: Cahyo Rp5.000 muncul di daftar', tunggak.length === 1 && tunggak[0].includes('Rp5.000') && tunggak[0].includes('5 hari'), tunggak);
  await page.click('button:has-text("Tandai Lunas")');
  cek('Denda: konfirmasi menyebut nominal dan nama', (await page.textContent('[role=dialog]')).includes('Rp5.000') && (await page.textContent('[role=dialog]')).includes('Cahyo Nugroho'));
  await page.click('[role=dialog] button:has-text("Tandai Lunas")'); await tunggu('ditandai lunas'); await tunggu('Tidak ada denda yang belum lunas');
  cek('Denda: ditandai lunas -> hilang dari daftar, tersimpan "lunas" di database', pemilik("select status_denda from public.v_pinjaman where nomor_induk_eksemplar = 'B0048' order by id_detail desc limit 1;") === 'lunas');

  await cariPinjaman('B0043'); await tunggu('Indah Permatasari');
  await page.selectOption('#status-denda', 'lunas'); await page.locator('label', { hasText: 'Rusak' }).click(); await page.fill('#catatan', 'Halaman 10-12 sobek');
  await page.click('button:has-text("Simpan Pengembalian")');
  cek('AB-08: kondisi Rusak meminta konfirmasi petugas dulu', (await page.textContent('[role=dialog]')).includes('Rusak') && statusEks('B0043') === 'dipinjam');
  await page.click('[role=dialog] button:has-text("Ya, Rusak")'); await tunggu('berhasil dicatat');
  cek('Pengembalian rusak + denda lunas: eksemplar "rusak", catatan dan denda Rp6.000 lunas tersimpan',
    pemilik("select e.status || '|' || e.keterangan || '|' || d.denda::int || '|' || d.status_denda || '|' || d.catatan_kembali from public.eksemplar e join public.detail_peminjaman d using (id_eksemplar) where e.nomor_induk = 'B0043' order by d.id_detail desc limit 1;") === 'rusak|Halaman 10-12 sobek|6000|lunas|Halaman 10-12 sobek');
  await cariPinjaman('B0019'); await tunggu('Eko Saputra');
  await page.locator('label', { hasText: 'Hilang' }).click(); await page.click('button:has-text("Simpan Pengembalian")');
  cek('AB-08: kondisi Hilang meminta konfirmasi dan mengingatkan untuk memastikan dulu', (await page.textContent('[role=dialog]')).includes('Pilih Hilang hanya setelah dipastikan'));
  await page.click('[role=dialog] button:has-text("Batal")');
  cek('AB-08: konfirmasi dibatalkan -> tidak ada yang berubah', statusEks('B0019') === 'dipinjam');
  await page.click('button:has-text("Simpan Pengembalian")'); await page.click('[role=dialog] button:has-text("Ya, Hilang")'); await tunggu('berhasil dicatat');
  cek('AB-08: petugas memilih Hilang -> eksemplar "hilang", denda 38 hari x Rp1.000 belum lunas',
    statusEks('B0019') === 'hilang' && pemilik("select status || '|' || denda::int || '|' || status_denda from public.detail_peminjaman where id_eksemplar = (select id_eksemplar from public.eksemplar where nomor_induk = 'B0019') order by id_detail desc limit 1;") === 'hilang|38000|belum_lunas');
  await page.screenshot({ path: dir + '/t5-pengembalian-akhir.png', fullPage: true });

  // setelah buku kembali, anggota boleh meminjam lagi; daftar keterlambatan kosong
  await page.click('nav >> text=Peminjaman'); await cariAnggota('240003'); await tunggu('Boleh meminjam');
  cek('AB-02: setelah buku terlambat dikembalikan, Cahyo boleh meminjam lagi (0 / 2)', (await page.textContent('main')).includes('0 / 2'));
  await page.click('nav >> text=Keterlambatan'); await tunggu('Tidak ada pinjaman yang terlambat');
  cek('Keterlambatan: kosong setelah semua pinjaman terlambat diproses', (await page.locator('.text-3xl').allTextContents()).join(',') === '0,0,0');

  cek('Semua permintaan data dijawab alat uji (tidak ada yang lolos tak tertangani)', tidakDitangani.length === 0, tidakDitangani);
  cek('Tidak ada error JavaScript selama pengujian', galatHalaman.length === 0, galatHalaman);
  await b.close();
  console.log('\n' + lulus + ' LULUS, ' + gagal + ' GAGAL');
})().catch((e) => { console.error('ERROR', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
