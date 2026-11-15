const { chromium, devices } = require('playwright');
// Uji login, pengalihan per peran, dan form ganti kata sandi, langsung ke Supabase di .env.
// Memakai akun contoh 240003, 240001, 220007 dengan kata sandi awal; TIDAK mengubah kata sandi apa pun.
const dir = require('path').join(__dirname, 'keluaran');
require('fs').mkdirSync(dir, { recursive: true });
const B = 'http://localhost:4173';
let lulus = 0, gagal = 0;
const cek = (n, ok, info='') => { ok ? lulus++ : gagal++; console.log((ok?'LULUS ':'GAGAL ')+n+(ok?'':' => '+info)); };
async function login(page, u, p) {
  await page.goto(B + '/login');
  await page.fill('#username', u); await page.fill('#sandi', p);
  await page.click('button[type=submit]');
}
// Tiruan: anggap akun sudah mengganti kata sandi (hanya di browser uji; database tidak diubah)
async function anggapSudahGanti(page) {
  await page.route('**/rest/v1/profil_pengguna*', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const resp = await route.fetch(); let j = await resp.json();
    for (const x of (Array.isArray(j) ? j : [j])) if (x) x.wajib_ganti_password = false;
    await route.fulfill({ response: resp, json: j });
  });
}
(async () => {
  for (let i=0;i<40;i++){ try { await fetch(B); break } catch { await new Promise(r=>setTimeout(r,300)) } }
  const b = await chromium.launch();

  // 1. Tanpa login
  let ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }); let page = await ctx.newPage();
  await page.goto(B + '/petugas/buku'); await page.waitForURL('**/login');
  cek('tanpa login membuka /petugas/buku -> dialihkan ke /login', page.url().endsWith('/login'));
  await page.goto(B + '/anggota'); await page.waitForURL('**/login');
  cek('tanpa login membuka /anggota -> dialihkan ke /login', page.url().endsWith('/login'));

  // 2. Sandi salah
  await login(page, 'PTG001', 'salah-sandi');
  await page.waitForSelector('[role=alert]');
  cek('sandi salah -> pesan Bahasa Indonesia', (await page.textContent('[role=alert]')).includes('Username atau kata sandi salah'), await page.textContent('[role=alert]'));

  // 3. Akun nonaktif
  await login(page, '220007', '220007');
  await page.waitForSelector('[role=alert]');
  const t = await page.textContent('[role=alert]');
  cek('akun nonaktif 220007 -> ditolak', t.includes('dinonaktifkan'), t);
  cek('akun nonaktif tetap di halaman login', page.url().endsWith('/login'));

  // 4. Petugas, login pertama -> wajib ganti kata sandi (username huruf kecil juga diterima)
  await login(page, '240003', '240003');
  await page.waitForURL('**/ganti-kata-sandi');
  cek('akun baru login pertama -> dialihkan ke /ganti-kata-sandi', true);
  await page.screenshot({ path: dir + '/t3-ganti-sandi.png' });
  await page.goto(B + '/anggota'); await page.waitForURL('**/ganti-kata-sandi');
  cek('belum ganti sandi lalu membuka /petugas -> tetap dipaksa ke /ganti-kata-sandi', page.url().endsWith('/ganti-kata-sandi'));
  await page.fill('#sandi-baru', '240003'); await page.fill('#sandi-ulang', '240003'); await page.click('button[type=submit]');
  await page.waitForSelector('[role=alert]');
  cek('sandi baru = username -> ditolak', (await page.textContent('[role=alert]')).includes('tidak boleh sama'));
  await page.fill('#sandi-baru', 'abc'); await page.fill('#sandi-ulang', 'abc'); await page.click('button[type=submit]');
  cek('sandi baru terlalu pendek -> ditolak', (await page.textContent('[role=alert]')).includes('minimal 6'));
  await page.fill('#sandi-baru', 'rahasia123'); await page.fill('#sandi-ulang', 'rahasia124'); await page.click('button[type=submit]');
  cek('pengulangan tidak sama -> ditolak', (await page.textContent('[role=alert]')).includes('sama persis'));
  await page.click('text=Batal dan logout'); await page.waitForURL('**/login');
  cek('batal dan logout -> kembali ke /login', true);
  await ctx.close();

  // 5. Petugas yang sudah ganti sandi (ditirukan) -> dashboard petugas
  ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }); page = await ctx.newPage(); await anggapSudahGanti(page);
  await page.route('**/rest/v1/profil_pengguna*', async (route) => { if (route.request().method() !== 'GET') return route.continue(); const resp = await route.fetch(); let j = await resp.json(); for (const x of (Array.isArray(j) ? j : [j])) if (x) { x.wajib_ganti_password = false; x.role = 'petugas'; x.nama = 'Petugas Perpustakaan'; } await route.fulfill({ response: resp, json: j }); }); await login(page, '240003', '240003'); await page.waitForURL('**/petugas');
  cek('petugas -> diarahkan ke /petugas', true);
  await page.waitForSelector('text=Petugas Perpustakaan');
  cek('nama petugas tampil di header', true);
  await page.screenshot({ path: dir + '/t3-petugas.png' });
  await page.goto(B + '/anggota/katalog'); await page.waitForURL('**/petugas');
  cek('petugas membuka halaman anggota -> dikembalikan ke /petugas', true);
  await page.goto(B + '/login'); await page.waitForURL('**/petugas');
  cek('sudah login membuka /login -> langsung ke beranda', true);
  await page.reload(); await page.waitForSelector('text=Petugas Perpustakaan');
  cek('muat ulang halaman -> sesi tetap ada', page.url().endsWith('/petugas'));
  await page.click('button[aria-expanded]'); await page.click('text=Ubah Kata Sandi'); await page.waitForURL('**/ubah-kata-sandi');
  await page.fill('#sandi-lama', 'bukan-sandi-lama'); await page.fill('#sandi-baru', 'rahasia123'); await page.fill('#sandi-ulang', 'rahasia123'); await page.click('main button[type=submit]');
  await page.waitForSelector('[role=alert]');
  cek('ubah sandi dengan sandi lama salah -> ditolak', (await page.textContent('[role=alert]')).includes('Kata sandi lama salah'));
  await page.click('text=Logout'); await page.waitForURL('**/login');
  cek('logout -> kembali ke /login', true);
  await page.goto(B + '/petugas'); await page.waitForURL('**/login');
  cek('setelah logout membuka /petugas -> ditolak', true);
  await ctx.close();

  // 6. Anggota (HP)
  ctx = await b.newContext({ ...devices['iPhone 13'] }); page = await ctx.newPage(); await anggapSudahGanti(page);
  await login(page, '240001', '240001'); await page.waitForURL('**/anggota');
  cek('anggota -> diarahkan ke /anggota', true);
  await page.goto(B + '/petugas/anggota'); await page.waitForURL('**/anggota');
  cek('anggota membuka halaman petugas -> dikembalikan ke /anggota', page.url().endsWith('/anggota'));
  await page.goto(B + '/anggota/profil'); await page.waitForSelector('text=Andi Pratama');
  cek('profil anggota menampilkan nama, NIS, kelas', (await page.textContent('main')).includes('240001') && (await page.textContent('main')).includes('7A'));
  await page.screenshot({ path: dir + '/t3-profil-anggota.png', fullPage: true });
  await page.click('text=Logout'); await page.waitForURL('**/login');
  cek('anggota logout -> /login', true);
  await b.close();
  console.log(`\n${lulus} LULUS, ${gagal} GAGAL`);
})().catch(e => { console.error('ERROR', e.message); process.exit(1) });
