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

## Status implementasi

Perlindungan awal pada endpoint pembayaran telah ditambahkan: jika invoice pending memiliki invoice saudara dengan kunci draft yang sama dan invoice saudara itu sudah menerima pembayaran aktif, karyawan tidak dapat mengubah invoice pending tersebut melalui form pembayaran. Aplikasi mengarahkan koreksi ke admin.

Fitur pengajuan/persetujuan koreksi dan buku saldo kredit supplier belum diimplementasikan dalam tahap ini. Keduanya memerlukan perubahan backend, UI admin/karyawan, skema sheet non-destruktif, serta pengujian integrasi sebelum digunakan.
