# Aturan Koreksi Stok, Invoice, dan Saldo Supplier

Dokumen ini menjadi spesifikasi bisnis untuk perubahan sistem titipan supplier.

## Prinsip

1. Satu kewajiban supplier untuk lapak, produk, dan periode/draft yang sama tidak boleh ditagihkan dua kali.
2. Pembayaran selalu terikat pada ID invoice dan tidak boleh hilang ketika stok dikoreksi.
3. Koreksi yang memengaruhi nilai kewajiban setelah laporan dikirim harus diajukan karyawan dan disetujui admin.
4. Kelebihan pembayaran disimpan sebagai kredit per supplier dan otomatis mengurangi kewajiban berikutnya dari supplier yang sama.
5. Riwayat asli, koreksi, persetujuan, dan pemakaian kredit harus dapat diaudit.
6. Metode Tunai, Transfer, dan QRIS adalah metadata metode pembayaran; jangan membuat debit Kas Utama terpisah untuk pembayaran supplier.

## Perilaku menurut status

- Draft sebelum laporan dikirim: karyawan dapat mengubah sisa fisik dan sistem menghitung ulang draft yang sama.
- Laporan sudah dikirim: karyawan mengajukan koreksi; data invoice tidak berubah sampai admin menyetujui.
- Laporan disetujui atau invoice sudah dibayar: perubahan kewajiban selalu berupa koreksi terotorisasi yang tertaut ke invoice asli; jangan menimpa atau menghapus pembayaran historis.
- Koreksi ditolak: nilai invoice dan alokasi pembayaran tetap seperti sebelum pengajuan.

## Perhitungan

Untuk satu invoice:

`kewajiban_baru = qty_terjual_disetujui * harga_titip`

`saldo_invoice = max(0, kewajiban_baru - pembayaran_teralokasi - kredit_supplier_dipakai)`

Jika pembayaran/kredit melebihi kewajiban baru, selisih disimpan sebagai saldo kredit supplier, tidak hilang dan tidak dipindah ke supplier lain.

## Persetujuan koreksi

Pengajuan minimal menyimpan:
- ID koreksi dan ID invoice sumber;
- nilai qty, harga, dan kewajiban sebelum/sesudah;
- alasan koreksi;
- ID/nama pengaju dan waktu pengajuan;
- status Pending/Approved/Rejected;
- ID/nama penyetuju, waktu, dan catatan keputusan.

Admin wajib meninjau dampak nilai sebelum menyetujui. Persetujuan harus idempoten: klik/permintaan berulang tidak boleh menerapkan koreksi atau kredit dua kali.

## Validasi sebelum setoran

Pengiriman/persetujuan setoran ditahan jika ada koreksi kewajiban yang masih menunggu persetujuan, invoice ganda yang belum direkonsiliasi, atau pembayaran yang belum dapat dialokasikan.

## Migrasi dan data lama

- Jangan hapus baris Konsinyasi atau BayarTitipanKaryawan secara otomatis.
- Rekonsiliasi data lama harus berdasarkan ID invoice dan alokasi pembayaran.
- Duplikasi historis memerlukan tinjauan admin sebelum penyesuaian nilai.
- Uji terlebih dahulu pada spreadsheet TESTING dengan salinan/fixture; jangan menjalankan migrasi otomatis pada produksi.

## Pengujian wajib

1. Koreksi draft sebelum pembayaran.
2. Koreksi setelah pembayaran sebagian.
3. Koreksi setelah lunas.
4. Tagihan bertambah dan berkurang.
5. Kredit supplier dipakai pada invoice berikutnya dari supplier yang sama.
6. Koreksi ditolak.
7. Persetujuan/pembayaran ganda akibat retry.
8. Invoice duplikat historis.
9. Submit dan approval setoran tidak menggandakan dampak Kas Utama.

## Implementasi koreksi dan saldo kredit

- Sheet `SupplierCorrectionRequests` menyimpan pengajuan karyawan, snapshot nilai sebelum/sesudah, alasan, status, dan keputusan admin.
- Sheet `SupplierCreditLedger` adalah ledger append-only: `CREDIT` menambah hak kredit supplier dan `APPLY` mencatat kredit yang dipakai pada invoice.
- Sheet finance dibuat otomatis saat endpoint terkait dipanggil; bila sheet ada, kolom yang kurang ditambahkan di sisi kanan tanpa memindahkan atau menghapus data lama.
- Karyawan hanya dapat mengajukan koreksi untuk invoice dari lapaknya yang sudah terhubung ke setoran. Permintaan ganda yang masih Pending pada invoice yang sama ditolak.
- Admin menyetujui atau menolak permintaan. Persetujuan memperbarui invoice sumber, detail setoran, jumlah penjualan/selisih setoran, dan ledger stok dalam satu write journal yang dapat di-rollback.
- Jika pembayaran/kredit yang sudah diterima lebih besar dari kewajiban baru, selisih dicatat sebagai event CREDIT untuk supplier yang sama.
- Kredit dipakai ke invoice Pending tertua dari supplier yang sama saat karyawan mengonfirmasi pembayaran titipan, saat laporan baru disubmit, saat pembelian susulan dibuat, atau sebelum admin membayar supplier. Event APPLY mencatat invoice tujuan sehingga penggunaan kredit dapat diaudit.
- Jika karyawan mengubah jumlah draft sebelum laporan dikirim setelah pembayaran tunai/kredit teralokasi, draft yang sama dihitung ulang dengan mempertahankan alokasi lama. Bila pembayaran akhirnya melebihi kewajiban draft yang disetujui saat submit, selisih menjadi event CREDIT.
- Pada pembayaran melalui login karyawan, nominal tunai dibatasi pada sisa tagihan sesudah kredit dipakai; jika kredit melunasi semua tagihan, tidak dibuat pembayaran tunai baru.
- Pembayaran admin hanya mengeluarkan uang tunai untuk sisa tagihan setelah kredit diterapkan. Bila seluruh tagihan tertutup kredit, tidak dibuat baris pengeluaran Kas.
- Edit langsung invoice oleh admin ditolak untuk invoice Pending yang sudah menerima pembayaran sebagian; koreksi harus melewati pengajuan dan persetujuan agar alokasi pembayaran tidak hilang.
- Jika nilai invoice berubah setelah pengajuan dan sebelum keputusan, permintaan ditandai Stale dan harus diajukan ulang.

## Batasan yang harus diuji saat penerapan

- Perubahan koreksi memperbarui nilai penjualan historis dan selisih setoran; penerimaan fisik tunai/QRIS/transfer tidak diubah otomatis.
- Kredit supplier adalah hak tagih terhadap supplier, bukan uang tunai di Kas. Kredit baru mengurangi jumlah kas yang dikeluarkan pada pembayaran berikutnya ketika dipakai.
- Invoice dan pembayaran lama tidak dihapus. Kredit lama tidak dibuat secara otomatis dari data historis yang tidak memiliki alokasi per invoice; diperlukan rekonsiliasi admin untuk data legacy yang tidak dapat ditelusuri dengan pasti.

## Status implementasi

Backend, UI karyawan/admin, skema sheet non-destruktif, dan regression tests untuk alur koreksi serta ledger kredit ditambahkan pada perubahan ini. Pengujian otomatis kode tidak menggantikan verifikasi transaksi pada spreadsheet nyata. Deployment Apps Script harus memakai `code.gs` versi yang sama dengan GitHub `main`; tidak ada migrasi atau deployment yang dijalankan oleh PR ini.
