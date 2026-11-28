# Panduan Deployment TESTING Lapak Kue Assyifa

Dokumen ini menjelaskan jalur uji yang terpisah dari aplikasi produksi. Ikuti urutan ini setiap kali akan menguji perubahan backend Google Apps Script.

## Prinsip keselamatan

- Gunakan project Google Apps Script TESTING yang terpisah dari project produksi.
- Gunakan Google Spreadsheet TESTING yang terpisah dan berisi data contoh/salinan yang sudah disamarkan.
- Jangan pernah menempelkan URL Web App produksi pada halaman TESTING.
- Jangan menguji transaksi dengan data usaha nyata. Transaksi pada mode TESTING tetap dapat menulis ke Spreadsheet yang dituju oleh URL API.
- Repository menyediakan workflow deployment otomatis khusus GAS TESTING (`.github/workflows/gas-testing-deploy.yml`). Workflow hanya mengirim `code.gs` ke project TESTING setelah pemeriksaan lulus dan hanya memakai Script ID/deployment ID/kredensial TESTING yang disimpan sebagai GitHub Secrets. Jika secrets belum lengkap, deployment dilewati dengan peringatan; tidak ada fallback ke project produksi.

## Menyiapkan backend TESTING (sekali saja)

1. Buat salinan Spreadsheet produksi untuk pengujian. Hapus atau samarkan data pribadi dan transaksi sensitif.
2. Buat project Apps Script TESTING yang terpisah. Salin kode backend yang akan diuji ke project tersebut melalui proses review.
3. Pastikan konfigurasi/ID Spreadsheet pada project TESTING menunjuk hanya ke Spreadsheet TESTING.
4. Deploy sebagai Web App dari project TESTING. Catat URL dengan pola `https://script.google.com/macros/s/.../exec`.
5. Jangan menyimpan URL deployment atau token di repository publik.

## Mengaktifkan deployment GAS TESTING otomatis

Atur tiga repository secrets di GitHub (Settings → Secrets and variables → Actions):

- `GAS_TESTING_SCRIPT_ID`: Script ID dari Project Settings Apps Script TESTING (bukan URL `/exec`).
- `GAS_TESTING_DEPLOYMENT_ID`: ID deployment Web App TESTING yang sudah aktif.
- `GAS_TESTING_CLASPRC_JSON`: isi file autentikasi `.clasprc.json` milik akun Google yang berwenang mengedit project TESTING. Simpan langsung sebagai secret; jangan kirim ke chat atau commit ke repository.

Workflow memvalidasi sintaks dan regression test, mengambil file project Apps Script yang sudah ada, mengganti `code.gs`, lalu memperbarui deployment TESTING yang sama. Pemicu otomatis hanya push ke `main` yang mengubah `code.gs`; workflow juga dapat dijalankan manual. Jangan gunakan Script ID atau deployment ID produksi.
## Membuka frontend TESTING

1. Buka halaman `index.testing.html` yang dipublikasikan melalui GitHub Pages, bukan `index.html`.
2. Saat diminta, tempel URL Web App dari project Apps Script TESTING.
3. Pastikan banner **MODE TESTING** terlihat.
4. Uji login, pencarian, stok, setoran, invoice, pembayaran supplier, dan saldo lebih hanya dengan data uji.
5. Setelah selesai, tutup tab. URL API hanya disimpan di memori tab oleh `config.testing.js`.

## Batasan penting

- Validasi `config.testing.js` hanya memeriksa bahwa URL berasal dari host dan pola path Google Apps Script. Kode tersebut **tidak dapat membuktikan** bahwa deployment yang ditempel benar-benar TESTING. Operator tetap wajib memastikan URL berasal dari project TESTING.
- Halaman TESTING tidak mendaftarkan service worker produksi; jangan mengubahnya agar menggunakan cache aplikasi produksi tanpa pengujian terpisah.
- URL `/exec` dapat menjalankan kode dan menulis ke Spreadsheet yang terhubung. Memakai URL yang salah dapat mengubah data produksi.
- Perubahan frontend pada GitHub Pages dan perubahan backend Apps Script adalah dua proses berbeda.

## Checklist sebelum menyatakan pengujian selesai

- [ ] URL API berasal dari project Apps Script TESTING.
- [ ] Spreadsheet tujuan adalah Spreadsheet TESTING.
- [ ] Banner MODE TESTING terlihat.
- [ ] Tidak ada data/transaksi produksi yang dipakai.
- [ ] Pengujian otomatis GitHub Actions lulus.
- [ ] Hasil skenario transaksi dicatat, termasuk saldo awal dan saldo akhir.
- [ ] Perubahan belum di-merge/deploy ke produksi tanpa persetujuan eksplisit.

## Jalur perubahan yang disarankan

Buat branch `feat/*` atau `fix/*` → jalankan GitHub Actions → buka Pull Request → tinjau diff dan hasil uji → persetujuan pemilik → merge. Deployment backend produksi tetap langkah terpisah dan harus mendapat persetujuan khusus.
