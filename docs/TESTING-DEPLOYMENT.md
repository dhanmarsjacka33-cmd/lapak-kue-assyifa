# Panduan Deployment TESTING Lapak Kue Assyifa

Dokumen ini menjelaskan jalur uji yang terpisah dari aplikasi produksi. Ikuti urutan ini setiap kali akan menguji perubahan backend Google Apps Script.

## Prinsip keselamatan

- Gunakan project Google Apps Script TESTING yang terpisah dari project produksi.
- Gunakan Google Spreadsheet TESTING yang terpisah dan berisi data contoh/salinan yang sudah disamarkan.
- Jangan pernah menempelkan URL Web App produksi pada halaman TESTING.
- Jangan menguji transaksi dengan data usaha nyata. Transaksi pada mode TESTING tetap dapat menulis ke Spreadsheet yang dituju oleh URL API.
- Repository ini belum memiliki deployment otomatis untuk Google Apps Script. Perubahan `code.gs` di GitHub tidak otomatis mengubah backend Apps Script.

## Menyiapkan backend TESTING (sekali saja)

1. Buat salinan Spreadsheet produksi untuk pengujian. Hapus atau samarkan data pribadi dan transaksi sensitif.
2. Buat project Apps Script TESTING yang terpisah. Salin kode backend yang akan diuji ke project tersebut melalui proses review.
3. Pastikan konfigurasi/ID Spreadsheet pada project TESTING menunjuk hanya ke Spreadsheet TESTING.
4. Deploy sebagai Web App dari project TESTING. Catat URL dengan pola `https://script.google.com/macros/s/.../exec`.
5. Jangan menyimpan URL deployment atau token di repository publik.

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
