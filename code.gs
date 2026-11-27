/**
 * Kue As-Syifa POS v5.10 — Backend
 * v5.10: Karyawan bisa bayar supplier titipan KAPAN SAJA + PARTIAL
 *        (kompatibel dengan app.js v6.5)
 */

const CONFIG = {
  SESSION_TTL: 21600, SESSION_TTL_DAYS: 30, LOCK_TIMEOUT: 15000,
  MAX_LOGIN_ATTEMPTS: 5, LOGIN_WINDOW: 300,
  BACKUP_FOLDER: 'Kue As-Syifa Backups', BACKUP_RETENTION_DAYS: 30,
  TIME_LOCK_HOUR: 23,
  FONNTE_TOKEN: '',
  NOTIF_EMAIL: 'loversazkia@gmail.com',
  NOTIF_EMAIL_PESANAN: '',
  JAM_STANDAR_MASUK: '05:15',
  STOK_KRITIS_THRESHOLD: 10,
  CACHE_TTL_MASTER: 120, CACHE_TTL_DASHBOARD: 60,
  HASH_ITERATIONS: 1000
};

const SESSION_CACHE = CacheService.getScriptCache();
const ATTEMPT_CACHE = CacheService.getScriptCache();
const DATA_CACHE = CacheService.getScriptCache();
let __sheetCache = {};
function _clearSheetCache(name) { if (name) { delete __sheetCache[name]; return; } __sheetCache = {}; }

// ============================================================
//  ENTRY
// ============================================================
function doGet() { return json({ ok: true, message: 'Kue As-Syifa v5.10' }); }

function doPost(e) {
  try {
    if (!e || !e.postData) return json({ ok: false, error: 'Empty' });
    const body = JSON.parse(e.postData.contents);
    const h = ROUTES[body.action];
    if (!h) return json({ ok: false, error: 'Unknown: ' + body.action });
    return json({ ok: true, data: h(body.payload || {}) });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String((err && err.message) || err) });
  }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  ROUTES
// ============================================================
const ROUTES = {
  login: p => apiLogin(p.username, p.password),
  bootstrap: p => apiBootstrap(p.token),
  getMe: p => apiGetMe(p.token),
  logout: p => apiLogout(p.token),
  changePassword: p => apiChangePassword(p.token, p.oldPwd, p.newPwd),
  adminResetPassword: p => apiAdminResetPassword(p.token, p.userId),
  getMyLapak: p => apiGetMyLapak(p.token),
  setLapakAktif: p => apiSetLapakAktif(p.token, p.lapakId),
  getLapak: p => apiGetLapak(p.token),
  saveLapak: p => apiSaveLapak(p.token, p.item),
  deleteLapak: p => apiDeleteLapak(p.token, p.id),
  getSuppliers: p => apiGetSuppliers(p.token),
  saveSupplier: p => apiSaveSupplier(p.token, p.item),
  deleteSupplier: p => apiDeleteSupplier(p.token, p.id),
  getKatalog: p => apiGetKatalog(p.token),
  saveKatalog: p => apiSaveKatalog(p.token, p.item),
  deleteKatalog: p => apiDeleteKatalog(p.token, p.id),
  getUsers: p => apiGetUsers(p.token),
  saveUser: p => apiSaveUser(p.token, p.item),
  deleteUser: p => apiDeleteUser(p.token, p.id),
  getDistribusiHariIni: p => apiGetDistribusiHariIni(p.token, p.lapakId, p.tanggal),
  saveDistribusi: p => apiSaveDistribusi(p.token, p.lapakId, p.tanggal, p.items),
  bukaLapak: p => apiBukaLapak(p.token),
  tutupLapak: p => apiTutupLapak(p.token),
  getKaryawanDashboard: p => apiGetKaryawanDashboard(p.token),
  karyawanInputDrop: p => apiKaryawanInputDrop(p.token, p.items),
  editDropStok: p => apiEditDropStok(p.token, p.items),
  submitRekap: p => apiSubmitRekap(p.token, p.payload),
  saveRekapDraft: p => apiSaveRekapDraft(p.token, p.payload),
  getAdminDashboard: p => apiGetAdminDashboard(p.token),
  getSetoranList: p => apiGetSetoranList(p.token, p.filter),
  getSetoranDetail: p => apiGetSetoranDetail(p.token, p.id),
  addSetoranPembelianSusulan: p => apiAddSetoranPembelianSusulan(p.token, p.payload),
  approveSetoran: p => apiApproveSetoran(p.token, p.id),
  rejectSetoran: p => apiRejectSetoran(p.token, p.id, p.reason),
  editSetoran: p => apiEditSetoran(p.token, p.id, p.updates),
  getKas: p => apiGetKas(p.token, p.limit),
  addKas: p => apiAddKas(p.token, p.item),
  getBelanja: p => apiGetBelanja(p.token, p.filter),
  saveBelanja: p => apiSaveBelanja(p.token, p.item),
  checkBelanja: p => apiCheckBelanja(p.token, p.id, p.checked, p.hargaAktual),
  deleteBelanja: p => apiDeleteBelanja(p.token, p.id),
  getJadwal: p => apiGetJadwal(p.token, p.days),
  saveJadwal: p => apiSaveJadwal(p.token, p.item),
  toggleJadwal: p => apiToggleJadwal(p.token, p.id, p.done),
  deleteJadwal: p => apiDeleteJadwal(p.token, p.id),
  getKasbon: p => apiGetKasbon(p.token, p.filter),
  addKasbon: p => apiAddKasbon(p.token, p.payload),
  rejectKasbon: p => apiRejectKasbon(p.token, p.id),
  deleteKasbon: p => apiDeleteKasbon(p.token, p.id),
  getOutstandingKasbon: p => apiGetOutstandingKasbon(p.token, p.userId),
  getSettingGaji: p => apiGetSettingGaji(p.token),
  saveSettingGaji: p => apiSaveSettingGaji(p.token, p.item),
  rekapGaji: p => apiRekapGaji(p.token, p.filter),
  getGaji: p => apiGetGaji(p.token, p.filter),
  bayarGaji: p => apiBayarGaji(p.token, p.payload),
  bayarGajiBulk: p => apiBayarGajiBulk(p.token, p.payload),
  getPesanan: p => apiGetPesanan(p.token, p.filter),
  savePesanan: p => apiSavePesanan(p.token, p.item),
  updatePesananStatus: p => apiUpdatePesananStatus(p.token, p.id, p.status),
  deletePesanan: p => apiDeletePesanan(p.token, p.id),
  rekapPesanan: p => apiRekapPesanan(p.token, p.filter),
  getLaporan: p => apiGetLaporan(p.token, p.filter),
  sendSupplierReport: p => apiSendSupplierReport(p.token, p.payload),
  exportSetoranCSV: p => apiExportSetoranCSV(p.token, p.dari, p.sampai),
  getKartuStok: p => apiGetKartuStok(p.token, p.filter),
  getStokSaldo: p => apiGetStokSaldo(p.token),
  getStokAudit: p => apiGetStokAudit(p.token),
  getReturList: p => apiGetReturList(p.token, p.filter),
  submitRetur: p => apiSubmitRetur(p.token, p.payload),
  approveRetur: p => apiApproveRetur(p.token, p.id, p.tujuanLapakId),
  rejectRetur: p => apiRejectRetur(p.token, p.id, p.reason),
  getStrukData: p => apiGetStrukData(p.token, p.setoranId),
  backupAll: p => apiBackupAll(p.token),
  restoreAll: p => apiRestoreAll(p.token, p.data, p.mode),
  getHargaTingkat: p => apiGetHargaTingkat(p.token, p.katalogId),
  saveHargaTingkat: p => apiSaveHargaTingkat(p.token, p.item),
  deleteHargaTingkat: p => apiDeleteHargaTingkat(p.token, p.id),
  getTutupBukuList: p => apiGetTutupBukuList(p.token),
  lockPeriode: p => apiLockPeriode(p.token, p.payload),
  unlockPeriode: p => apiUnlockPeriode(p.token, p.id),
  getNotifikasi: p => apiGetNotifikasi(p.token, p.filter),
  markNotifRead: p => apiMarkNotifRead(p.token, p.id),
  testNotifikasi: p => apiTestNotifikasi(p.token),
  absenMasuk: p => apiAbsenMasuk(p.token, p.lapakId),
  absenKeluar: p => apiAbsenKeluar(p.token),
  absensiHariIni: p => apiAbsensiHariIni(p.token),
  getAbsensiKaryawan: p => apiGetAbsensiKaryawan(p.token, p.filter),
  editAbsensi: p => apiEditAbsensi(p.token, p.id, p.updates),
  deleteAbsensi: p => apiDeleteAbsensi(p.token, p.id),
  isiAbsensiOrangLain: p => apiIsiAbsensiOrangLain(p.token, p.payload),
  getBonusAntar: p => apiGetBonusAntar(p.token, p.filter),
  saveBonusAntar: p => apiSaveBonusAntar(p.token, p.item),
  deleteBonusAntar: p => apiDeleteBonusAntar(p.token, p.id),
  getSettingPayroll: p => apiGetSettingPayroll(p.token),
  saveSettingPayroll: p => apiSaveSettingPayroll(p.token, p.item),
  deleteSettingPayroll: p => apiDeleteSettingPayroll(p.token, p.id),
  getHariEfektif: p => apiGetHariEfektif(p.token, p.bulan),
  saveHariEfektif: p => apiSaveHariEfektif(p.token, p.item),
  autoHariEfektif: p => apiAutoHariEfektif(p.token, p.bulan),
  rekapPayroll: p => apiRekapPayroll(p.token, p.bulan),
  bayarPayroll: p => apiBayarPayroll(p.token, p.userId, p.bulan),
  bayarPayrollBulk: p => apiBayarPayrollBulk(p.token, p.bulan, p.userIds),
  getPayrollHistory: p => apiGetPayrollHistory(p.token, p.filter),
  getKonsinyasi: p => apiGetKonsinyasi(p.token, p.filter),
  editKonsinyasi: p => apiEditKonsinyasi(p.token, p.id, p.updates),
  getSaldoSupplier: p => apiGetSaldoSupplier(p.token),
  bayarSupplier: p => apiBayarSupplier(p.token, p.payload),
  getRiwayatBayarSupplier: p => apiGetRiwayatBayarSupplier(p.token, p.filter),
  getKonsinyasiDetailSupplier: p => apiGetKonsinyasiDetailSupplier(p.token, p.supplierId),
  submitSupplierCorrection: p => apiSubmitSupplierCorrection(p.token, p.payload),
  getSupplierFinanceOverview: p => apiGetSupplierFinanceOverview(p.token),
  approveSupplierCorrection: p => apiApproveSupplierCorrection(p.token, p.id, p.note),
  rejectSupplierCorrection: p => apiRejectSupplierCorrection(p.token, p.id, p.note),
  getTitipanKaryawan: p => apiGetTitipanKaryawan(p.token),
  bayarTitipanKaryawan: p => apiKaryawanBayarSupplier(p.token, p.payload),
  bayarTitipan: p => apiKaryawanBayarSupplier(p.token, p),
  batalBayarTitipan: p => apiBatalBayarTitipan(p.token, p.bayarId),
  preloadTab: p => apiPreloadTab(p.token, p.tab),
  getTemplateBox: p => apiGetTemplateBox(p.token),
  saveTemplateBox: p => apiSaveTemplateBox(p.token, p.payload),
  deleteTemplateBox: p => apiDeleteTemplateBox(p.token, p.id),
  getPesananPelanggan: p => apiGetPesananPelanggan(p.token, p.filter),
  getPesananPelangganDetail: p => apiGetPesananPelangganDetail(p.token, p.id),
  savePesananPelanggan: p => apiSavePesananPelanggan(p.token, p.payload),
  updateStatusPesanan: p => apiUpdateStatusPesanan(p.token, p.id, p.status),
  selesaikanPesanan: p => apiSelesaikanPesanan(p.token, p.id, p.payload),
  deletePesananPelanggan: p => apiDeletePesananPelanggan(p.token, p.id),
  getPesananKalender: p => apiGetPesananKalender(p.token, p.bulan),
  getAnalytics: p => apiGetAnalytics(p.token, p.filter),
  getAnalisisPerforma: p => apiGetAnalisisPerforma(p.token, p),
  getStrukPesanan: p => apiGetStrukPesanan(p.token, p.id),
  sendEmailManual: p => apiSendEmailManual(p.token, p.payload)
};

// ============================================================
//  SETUP DATABASE
// ============================================================
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const schema = [
    { name: 'Users',           headers: ['id','username','passwordHash','salt','role','name','lapakId','aktif','lapakIds','mustChangePassword','email'] },
    { name: 'Lapak',           headers: ['id','nama','alamat','aktif'] },
    { name: 'Suppliers',       headers: ['id','nama','kontak','jadwalPesan','catatan','tipeTransaksi','aktif'] },
    { name: 'Katalog',         headers: ['id','nama','supplierId','hargaBeli','hargaJual','kategori','aktif'] },
    { name: 'Distribusi',      headers: ['id','tanggal','lapakId','katalogId','qtyDrop','droppedBy','droppedAt'] },
    { name: 'Absensi',         headers: ['id','tanggal','lapakId','userId','jamBuka','jamTutup','catatan'] },
    { name: 'Setoran',         headers: ['id','tanggal','lapakId','userId','totalTunai','totalQris','totalTransfer','totalSistem','pengeluaran','expectedSetoran','uangDisetor','selisih','status','approvedAt','approvedBy','catatan','editHistory','locked'] },
    { name: 'SetoranDetail',   headers: ['id','setoranId','katalogId','qtyDrop','qtySisa','qtyLaku','hargaJual','hargaBeli','subtotal','tipePelanggan'] },
    { name: 'PengeluaranLapak',headers: ['id','setoranId','keterangan','kategori','nominal'] },
    { name: 'Belanja',         headers: ['id','tanggal','item','supplierId','qty','estimasiHarga','hargaAktual','checked','checkedAt','kasId','keterangan'] },
    { name: 'Kas',             headers: ['id','tanggal','keterangan','tipe','kategori','metode','nominal','saldo'] },
    { name: 'Jadwal',          headers: ['id','tanggal','supplierId','tipe','keterangan','done'] },
    { name: 'Kasbon',          headers: ['id','tanggal','userId','nominal','keterangan','tipe','status','approvedBy','approvedAt','gajiId'] },
    { name: 'Gaji',            headers: ['id','tanggal','userId','periode','gajiPokok','potonganKasbon','tunjangan','gajiBersih','kasId','catatan','dibayarBy'] },
    { name: 'SettingGaji',     headers: ['id','userId','tipe','nominal','aktif','berlakuDari'] },
    { name: 'Pesanan',         headers: ['id','tanggal','supplierId','item','qty','hargaSatuan','subtotal','status','keterangan','dibuatOleh','updatedAt'] },
    { name: 'Sessions',        headers: ['token','userId','username','role','name','lapakId','lapakIds','expiresAt'] },
    { name: 'KartuStok',       headers: ['id','tanggal','katalogId','lapakId','tipe','masuk','keluar','saldo','refId','keterangan'] },
    { name: 'StokAudit',       headers: ['id','waktu','katalogId','namaItem','lapakId','stokLama','stokBaru','userId','user','role'] },
    { name: 'Retur',           headers: ['id','tanggal','dariLapakId','katalogId','qty','kondisi','tujuanLapakId','setoranId','status','approvedBy','approvedAt','keterangan'] },
    { name: 'HargaTingkat',    headers: ['id','katalogId','tipePelanggan','minimalQty','hargaJual','aktif'] },
    { name: 'TutupBuku',       headers: ['id','periode','tanggalMulai','tanggalAkhir','status','ditutupBy','ditutupAt','catatan'] },
    { name: 'Notifikasi',      headers: ['id','tanggal','tipe','penerima','subjek','pesan','status','refId','channel'] },
    { name: 'AbsensiKaryawan', headers: ['id','tanggal','userId','lapakId','jamMasuk','jamKeluar','status','filledBy','catatan'] },
    { name: 'BonusAntar',      headers: ['id','tanggal','userId','tujuan','jarakKm','qty','nominal','keterangan','createdBy','pesananId'] },
    { name: 'SettingPayroll',  headers: ['id','lapakId','bonusMerekap','tunjanganLapak','berlakuDari','aktif'] },
    { name: 'HariEfektif',     headers: ['id','bulan','lapakId','jumlahHari','catatan'] },
    { name: 'RekapPayroll',    headers: ['id','bulan','userId','userName','rincianJSON','totalBersih','kasId','dibayarAt','dibayarBy'] },
    { name: 'Konsinyasi',      headers: ['id','tanggal','supplierId','lapakId','katalogId','qtyLaku','hargaTitip','utang','status','kasId','bayarAt','bayarBy','setoranId','catatan'] },
    { name: 'BayarTitipanKaryawan', headers: ['id','tanggal','lapakId','supplierId','userName','totalBayar','konsinyasiIds','setoranId','createdAt','catatan','noNota','metode','status'] },
    { name: 'SupplierCorrectionRequests', headers: ['id','requestKey','createdAt','requestedBy','requestedByName','lapakId','supplierId','katalogId','konsinyasiId','setoranId','oldQtyLaku','requestedQtyLaku','hargaTitip','oldObligation','newObligation','reason','status','reviewedBy','reviewedAt','reviewNote','appliedAt','paidAmount','creditCreated'] },
    { name: 'SupplierCreditLedger', headers: ['id','createdAt','supplierId','eventType','amount','correctionId','sourceInvoiceId','referenceInvoiceId','createdBy','notes','requestKey'] },
    { name: 'TemplateBox',     headers: ['id','nama','hargaPaket','keterangan','aktif'] },
    { name: 'TemplateBoxItem', headers: ['id','templateBoxId','katalogId','qty'] },
    { name: 'PesananPelanggan',headers: ['id','tanggal','pelangganNama','pelangganHp','tanggalAmbil','jenisAmbil','metodeAmbil','alamat','catatan','totalSistem','dp','sisaBayar','metodeBayar','status','bonusAntarId','kasIdDp','kasIdLunas','createdAt','createdBy','updatedAt','pelangganEmail'] },
    { name: 'PesananPelangganItem', headers: ['id','pesananId','katalogId','namaItem','qty','hargaJual','subtotal','dariBoxId','dariBoxNama'] },
    { name: 'Log',             headers: ['timestamp','user','action','details'] },
    { name: 'EmailLog',        headers: ['timestamp','to','subject','status','error'] }
  ];
  schema.forEach(s => {
    let sheet = ss.getSheetByName(s.name);
    if (!sheet) {
      sheet = ss.insertSheet(s.name);
      sheet.getRange(1, 1, 1, s.headers.length).setValues([s.headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, s.headers.length).setFontWeight('bold').setBackground('#fef3c7');
    }
  });
  seedIfEmpty('Lapak', [['L01','Lapak 1','Alamat 1',true],['L02','Lapak 2','Alamat 2',true],['L03','Lapak 3','Alamat 3',true]]);
  seedIfEmpty('Suppliers', [
    ['SP1','Bu Tejo','08123','Senin,Kamis','Pastel & kue basah','TitipJual',true],
    ['SP2','Pak Budi','08456','Selasa,Jumat','Pastel ayam','TitipJual',true],
    ['SP3','Sendiri','-','-','Produksi sendiri','BeliPutus',true]
  ]);
  seedIfEmpty('Katalog', [
    ['K1','Pastel Sayur (Bu Tejo)','SP1',2000,2500,'Pastel',true],
    ['K2','Pastel Ayam (Pak Budi)','SP2',2400,3000,'Pastel',true],
    ['K3','Lemper Ayam','SP3',1500,2000,'Lemper',true],
    ['K4','Risoles Mayo','SP1',2200,2800,'Risoles',true]
  ]);
  seedIfEmpty('Kas', [['KS1', new Date(), 'Modal Awal', 'Masuk', 'Modal', 'Internal', 1500000, 1500000]]);
  seedIfEmpty('SettingPayroll', [
    ['SPL1', 'L01', 50000, 50000, new Date(), true],
    ['SPL2', 'L02', 70000, 50000, new Date(), true],
    ['SPL3', 'L03', 30000, 0, new Date(), true]
  ]);
  seedIfEmpty('TemplateBox', [
    ['TB1', 'Box Hemat', 25000, '5 Pastel + 3 Lemper', true],
    ['TB2', 'Box Spesial', 40000, '10 Pastel + 5 Risoles', true]
  ]);
  seedIfEmpty('TemplateBoxItem', [
    ['TBI1', 'TB1', 'K1', 5],
    ['TBI2', 'TB1', 'K3', 3],
    ['TBI3', 'TB2', 'K1', 10],
    ['TBI4', 'TB2', 'K4', 5]
  ]);
  const usersSheet = ss.getSheetByName('Users');
  if (usersSheet.getLastRow() <= 1) {
    const seed = [
      { id:'U1', username:'admin',  role:'admin',    name:'Owner As-Syifa', lapakId:'',    lapakIds:'',           aktif:true },
      { id:'U2', username:'wiwin',  role:'karyawan', name:'Wiwin',          lapakId:'L01', lapakIds:'L01',        aktif:true },
      { id:'U3', username:'siti',   role:'karyawan', name:'Siti',           lapakId:'L01', lapakIds:'L01',        aktif:true },
      { id:'U4', username:'dewi',   role:'karyawan', name:'Dewi',           lapakId:'L02', lapakIds:'L02',        aktif:true },
      { id:'U5', username:'rina',   role:'karyawan', name:'Rina',           lapakId:'L03', lapakIds:'L01,L02,L03', aktif:true }
    ];
    const credentials = [];
    const rows = seed.map(u => {
      const salt = Utilities.getUuid();
      const pwd = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
      credentials.push(u.username + ': ' + pwd);
      return [u.id, u.username, hashPassword(pwd, salt), salt, u.role, u.name, u.lapakId, u.aktif, u.lapakIds, false, ''];
    });
    usersSheet.getRange(2, 1, rows.length, 11).setValues(rows);
    _clearSheetCache();
    return 'Setup v5.10 selesai. Password awal:\\n' + credentials.join('\\n');
  }
  _clearSheetCache();
  return 'Setup v5.10 selesai. Sheet Users sudah berisi akun; tidak ada perubahan akun.';
}

// Migrasi header akuntansi non-destruktif. Jalankan manual satu kali dari Apps Script.
function migrateUnifiedCashSchema() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) throw new Error('Sistem sedang sibuk. Coba lagi.');
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const required = { Setoran: ['totalTransfer'], Kas: ['metode'] };
    const result = [];
    Object.keys(required).forEach(name => {
      const sheet = ss.getSheetByName(name);
      if (!sheet) throw new Error('Sheet ' + name + ' tidak ditemukan. Tidak ada header yang ditambahkan.');
      const lastCol = Math.max(sheet.getLastColumn(), 1);
      const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(v => String(v).trim());
      required[name].forEach(header => {
        if (headers.indexOf(header) !== -1) { result.push(name + '.' + header + ': sudah ada'); return; }
        const nextCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, nextCol).setValue(header);
        result.push(name + '.' + header + ': ditambahkan di kolom ' + nextCol);
      });
    });
    _clearSheetCache();
    return 'Migrasi selesai tanpa mengubah baris historis. ' + result.join('; ');
  } finally { lock.releaseLock(); }
}

function seedIfEmpty(name, rows) {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (s && s.getLastRow() <= 1) s.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function resetUsersSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Users');
  if (sheet) { sheet.clear(); sheet.clearFormats(); }
  else sheet = ss.insertSheet('Users');
  const headers = ['id','username','passwordHash','salt','role','name','lapakId','aktif','lapakIds','mustChangePassword','email'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#fef3c7');
  const seed = [
    { id:'U1', username:'admin',  role:'admin',    name:'Owner As-Syifa', lapakId:'',    lapakIds:'',           aktif:true },
    { id:'U2', username:'wiwin',  role:'karyawan', name:'Wiwin',          lapakId:'L01', lapakIds:'L01',        aktif:true },
    { id:'U3', username:'siti',   role:'karyawan', name:'Siti',           lapakId:'L01', lapakIds:'L01',        aktif:true },
    { id:'U4', username:'dewi',   role:'karyawan', name:'Dewi',           lapakId:'L02', lapakIds:'L02',        aktif:true },
    { id:'U5', username:'rina',   role:'karyawan', name:'Rina',           lapakId:'L03', lapakIds:'L01,L02,L03', aktif:true }
  ];
  const credentials = [];
  const rows = seed.map(u => {
    const salt = Utilities.getUuid();
    const pwd = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
    credentials.push(u.username + ': ' + pwd);
    return [u.id, u.username, hashPassword(pwd, salt), salt, u.role, u.name, u.lapakId, u.aktif, u.lapakIds, false, ''];
  });
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  _clearSheetCache();
  return 'Users direset. Password awal:\\n' + credentials.join('\\n');
}

function tambahUserWiwin() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return 'Sheet Users tidak ada. Jalankan setupDatabase() dulu.';
  const data = sheet.getDataRange().getValues();
  const iUser = data[0].indexOf('username');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][iUser]).toLowerCase() === 'wiwin') return 'User Wiwin sudah ada.';
  }
  const salt = Utilities.getUuid();
  const pwd = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  sheet.appendRow(['U-NEW-WIWIN', 'wiwin', hashPassword(pwd, salt), salt, 'karyawan', 'Wiwin', 'L01', true, 'L01', false, '']);
  _clearSheetCache();
  return 'Wiwin ditambahkan. Password awal: ' + pwd;
}

function upgradeDatabase_v55() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const newSheets = [{ name: 'EmailLog', headers: ['timestamp','to','subject','status','error'] }];
  newSheets.forEach(s => {
    let sheet = ss.getSheetByName(s.name);
    if (!sheet) {
      sheet = ss.insertSheet(s.name);
      sheet.getRange(1, 1, 1, s.headers.length).setValues([s.headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, s.headers.length).setFontWeight('bold').setBackground('#fef3c7');
    }
  });
  addColumnIfMissing('Users', 'email', '');
  addColumnIfMissing('Suppliers', 'email', '');
  addColumnIfMissing('PesananPelanggan', 'pelangganEmail', '');
  addColumnIfMissing('Notifikasi', 'channel', '');
  _clearSheetCache();
  return 'Upgrade v5.5 selesai.';
}

function addColumnIfMissing(sheetName, colName, defaultValue) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return;
  const h = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (h.indexOf(colName) !== -1) return;
  sheet.getRange(1, h.length + 1).setValue(colName).setFontWeight('bold').setBackground('#fef3c7');
  if (sheet.getLastRow() > 1) {
    const vals = [];
    for (let i = 1; i < sheet.getLastRow(); i++) vals.push([defaultValue]);
    if (vals.length) sheet.getRange(2, h.length + 1, vals.length, 1).setValues(vals);
  }
}

function upgradeDatabase_v51() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const newSheets = [
    { name: 'AbsensiKaryawan', headers: ['id','tanggal','userId','lapakId','jamMasuk','jamKeluar','status','filledBy','catatan'] },
    { name: 'BonusAntar', headers: ['id','tanggal','userId','tujuan','jarakKm','qty','nominal','keterangan','createdBy','pesananId'] },
    { name: 'SettingPayroll', headers: ['id','lapakId','bonusMerekap','tunjanganLapak','berlakuDari','aktif'] },
    { name: 'HariEfektif', headers: ['id','bulan','lapakId','jumlahHari','catatan'] },
    { name: 'RekapPayroll', headers: ['id','bulan','userId','userName','rincianJSON','totalBersih','kasId','dibayarAt','dibayarBy'] }
  ];
  newSheets.forEach(s => {
    let sheet = ss.getSheetByName(s.name);
    if (!sheet) {
      sheet = ss.insertSheet(s.name);
      sheet.getRange(1, 1, 1, s.headers.length).setValues([s.headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, s.headers.length).setFontWeight('bold').setBackground('#fef3c7');
    }
  });
  _clearSheetCache();
  return 'Upgrade v5.1 done.';
}
function upgradeDatabase_v52() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Konsinyasi');
  if (!sheet) {
    sheet = ss.insertSheet('Konsinyasi');
    sheet.getRange(1, 1, 1, 14).setValues([['id','tanggal','supplierId','lapakId','katalogId','qtyLaku','hargaTitip','utang','status','kasId','bayarAt','bayarBy','setoranId','catatan']]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 14).setFontWeight('bold').setBackground('#fef3c7');
  }
  addColumnIfMissing('Suppliers', 'tipeTransaksi', 'BeliPutus');
  _clearSheetCache();
  return 'Upgrade v5.2 done.';
}
function upgradeDatabase_v54() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const newSheets = [
    { name: 'TemplateBox', headers: ['id','nama','hargaPaket','keterangan','aktif'] },
    { name: 'TemplateBoxItem', headers: ['id','templateBoxId','katalogId','qty'] },
    { name: 'PesananPelanggan', headers: ['id','tanggal','pelangganNama','pelangganHp','tanggalAmbil','jenisAmbil','metodeAmbil','alamat','catatan','totalSistem','dp','sisaBayar','metodeBayar','status','bonusAntarId','kasIdDp','kasIdLunas','createdAt','createdBy','updatedAt','pelangganEmail'] },
    { name: 'PesananPelangganItem', headers: ['id','pesananId','katalogId','namaItem','qty','hargaJual','subtotal','dariBoxId','dariBoxNama'] }
  ];
  newSheets.forEach(s => {
    let sheet = ss.getSheetByName(s.name);
    if (!sheet) {
      sheet = ss.insertSheet(s.name);
      sheet.getRange(1, 1, 1, s.headers.length).setValues([s.headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, s.headers.length).setFontWeight('bold').setBackground('#fef3c7');
    }
  });
  addColumnIfMissing('BonusAntar', 'pesananId', '');
  _clearSheetCache();
  return 'Upgrade v5.4 done.';
}

function upgradeDatabase_v58() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const newSheets = [
    { name: 'BayarTitipanKaryawan', headers: ['id','tanggal','lapakId','supplierId','userName','totalBayar','konsinyasiIds','setoranId','createdAt','catatan','noNota','metode','status'] }
  ];
  newSheets.forEach(s => {
    let sheet = ss.getSheetByName(s.name);
    if (!sheet) {
      sheet = ss.insertSheet(s.name);
      sheet.getRange(1, 1, 1, s.headers.length).setValues([s.headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, s.headers.length).setFontWeight('bold').setBackground('#fef3c7');
    }
  });
  _clearSheetCache();
  return 'Upgrade v5.8 selesai. Sheet BayarTitipanKaryawan ditambahkan.';
}

function upgradeDatabase_v510() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('BayarTitipanKaryawan');
  if (!sheet) {
    sheet = ss.insertSheet('BayarTitipanKaryawan');
    sheet.getRange(1, 1, 1, 13).setValues([['id','tanggal','lapakId','supplierId','userName','totalBayar','konsinyasiIds','setoranId','createdAt','catatan','noNota','metode','status']]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 13).setFontWeight('bold').setBackground('#fef3c7');
  } else {
    addColumnIfMissing('BayarTitipanKaryawan', 'catatan', '');
    addColumnIfMissing('BayarTitipanKaryawan', 'noNota', '');
    addColumnIfMissing('BayarTitipanKaryawan', 'metode', 'Tunai');
    addColumnIfMissing('BayarTitipanKaryawan', 'status', 'Active');
    const data = sheet.getDataRange().getValues();
    const h = data[0];
    const iStatus = h.indexOf('status');
    if (iStatus >= 0 && data.length > 1) {
      const col = [];
      let anyEmpty = false;
      for (let i = 1; i < data.length; i++) {
        const v = String(data[i][iStatus] || '').trim();
        if (!v) anyEmpty = true;
        col.push([v || 'Active']);
      }
      if (anyEmpty && col.length) sheet.getRange(2, iStatus + 1, col.length, 1).setValues(col);
    }
  }
  _clearSheetCache();
  return 'Upgrade v5.10 selesai. Kolom BayarTitipanKaryawan: catatan, noNota, metode, status.';
}

function upgradeDatabase_v511() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('StokAudit');
  if (!sheet) {
    sheet = ss.insertSheet('StokAudit');
    const headers = ['id','waktu','katalogId','namaItem','lapakId','stokLama','stokBaru','userId','user','role'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#fef3c7');
  }
  _clearSheetCache();
  return 'Upgrade v5.11 selesai. Sheet StokAudit tersedia.';
}

// ============================================================
//  PASSWORD HASHING
// ============================================================
function hashPassword(pwd, salt, iterations) {
  iterations = iterations || CONFIG.HASH_ITERATIONS || 1000;
  let str = String(pwd) + '|' + String(salt);
  for (let i = 0; i < iterations; i++) {
    const d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
    str = d.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  }
  return str;
}

function hashPasswordLegacy(pwd, salt) {
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pwd) + '|' + String(salt), Utilities.Charset.UTF_8);
  return d.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function safeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ============================================================
//  HELPERS
// ============================================================
function getSheetData(name) {
  if (__sheetCache[name]) return __sheetCache[name];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) { __sheetCache[name] = []; return []; }
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) { __sheetCache[name] = []; return []; }
  const headers = data[0].map(h => String(h).trim());
  const result = data.slice(1).filter(r => r.some(c => c !== '' && c !== null)).map(r => {
    const o = {};
    headers.forEach((h, i) => { if (h) o[h] = r[i]; });
    if (name === 'Setoran') {
      if ((o.lapakId === undefined || o.lapakId === '') && o.lapak !== undefined) o.lapakId = o.lapak;
      if ((o.totalTunai === undefined || o.totalTunai === '') && o.totalCash !== undefined) o.totalTunai = o.totalCash;
      if (o.totalQris === undefined || o.totalQris === '') o.totalQris = 0;
      if ((o.totalSistem === undefined || o.totalSistem === '') && o.expectedSetoran !== undefined) o.totalSistem = (Number(o.expectedSetoran) || 0) + (Number(o.pengeluaran) || 0);
    }
    if (name === 'SetoranDetail') {
      if ((o.qtyLaku === undefined || o.qtyLaku === '') && o.terjual !== undefined) o.qtyLaku = o.terjual;
      if ((o.qtySisa === undefined || o.qtySisa === '') && o.sisa !== undefined) o.qtySisa = o.sisa;
      if (o.qtyDrop === undefined || o.qtyDrop === '') o.qtyDrop = (Number(o.qtyLaku) || 0) + (Number(o.qtySisa) || 0);
    }
    return o;
  });
  __sheetCache[name] = result;
  return result;
}

function appendObjectsByHeaders(sheet, objects) {
  if (!sheet || !objects || !objects.length) return;
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) throw new Error('Header sheet tidak ditemukan: ' + sheet.getName());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(h => String(h).trim());
  const rows = objects.map(obj => headers.map(header => header && Object.prototype.hasOwnProperty.call(obj, header) ? obj[header] : ''));
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

function hasHeaders(sheet, required) {
  if (!sheet || sheet.getLastColumn() < 1) return false;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(h => String(h).trim());
  return required.every(name => headers.indexOf(name) >= 0);
}
function beginWriteJournal(sheetNames) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const journal = { sheets: [], changes: [] };
  sheetNames.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) throw new Error('Sheet tidak ditemukan: ' + name);
    journal.sheets.push({ sheet, lastRow: sheet.getLastRow() });
  });
  return journal;
}
function journalSetValue(journal, sheet, row, col, value) {
  const cell = sheet.getRange(row, col);
  journal.changes.push({ sheet, row, col, oldValue: cell.getValue() });
  cell.setValue(value);
}
function rollbackWriteJournal(journal) {
  const errors = [];
  for (let i = journal.changes.length - 1; i >= 0; i--) {
    const c = journal.changes[i];
    try { c.sheet.getRange(c.row, c.col).setValue(c.oldValue); }
    catch (err) { errors.push('restore ' + c.sheet.getName() + '!R' + c.row + 'C' + c.col + ': ' + err.message); }
  }
  for (let i = journal.sheets.length - 1; i >= 0; i--) {
    const entry = journal.sheets[i];
    try {
      const last = entry.sheet.getLastRow();
      if (last > entry.lastRow) entry.sheet.deleteRows(entry.lastRow + 1, last - entry.lastRow);
    } catch (err) { errors.push('delete appended rows ' + entry.sheet.getName() + ': ' + err.message); }
  }
  if (errors.length) throw new Error('Rollback tidak sepenuhnya berhasil: ' + errors.join('; '));
}

function getMasterCached(key, fetcher, ttl) {
  const cacheKey = 'master_' + key;
  const cached = DATA_CACHE.get(cacheKey);
  if (cached) { try { return JSON.parse(cached); } catch (e) {} }
  const data = fetcher();
  try { DATA_CACHE.put(cacheKey, JSON.stringify(data), ttl || CONFIG.CACHE_TTL_MASTER); } catch (e) {}
  return data;
}
function invalidateMasterCache() {
  ['lapak','suppliers','katalog','users','templateBox'].forEach(k => DATA_CACHE.remove('master_' + k));
}

function createSession(user) {
  const token = Utilities.getUuid();
  const lapakIds = String(user.lapakIds || user.lapakId || '');
  const payload = { id:user.id, username:user.username, role:user.role, name:user.name, lapakId:user.lapakId || '', lapakIds: lapakIds, email: user.email || '' };
  const exp = Date.now() + CONFIG.SESSION_TTL_DAYS * 86400000;
  SESSION_CACHE.put('sess_' + token, JSON.stringify(payload), CONFIG.SESSION_TTL);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
  if (sheet) sheet.appendRow([token, user.id, user.username, user.role, user.name, user.lapakId || '', lapakIds, new Date(exp)]);
  return token;
}
function getSession(token) {
  if (!token) throw new Error('UNAUTHORIZED');
  const cached = SESSION_CACHE.get('sess_' + token);
  if (cached) return JSON.parse(cached);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
  if (!sheet) throw new Error('UNAUTHORIZED');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(token)) {
      const exp = data[i][7] instanceof Date ? data[i][7].getTime() : new Date(data[i][7]).getTime();
      if (Date.now() > exp) { sheet.deleteRow(i + 1); throw new Error('UNAUTHORIZED'); }
      const sess = { id:data[i][1], username:data[i][2], role:data[i][3], name:data[i][4], lapakId:data[i][5] || '', lapakIds:data[i][6] || '', email: '' };
      SESSION_CACHE.put('sess_' + token, JSON.stringify(sess), CONFIG.SESSION_TTL);
      return sess;
    }
  }
  throw new Error('UNAUTHORIZED');
}
function requireRole(token, roles) {
  const s = getSession(token);
  if (roles && roles.length && roles.indexOf(s.role) === -1) throw new Error('FORBIDDEN');
  return s;
}
function updateSessionLapak(token, lapakId) {
  const sess = getSession(token);
  sess.lapakId = lapakId;
  SESSION_CACHE.put('sess_' + token, JSON.stringify(sess), CONFIG.SESSION_TTL);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
  if (!sheet) return sess;
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const iTok = h.indexOf('token'), iLapak = h.indexOf('lapakId');
  for (let i = 1; i < data.length; i++) if (String(data[i][iTok]) === String(token)) { sheet.getRange(i + 1, iLapak + 1).setValue(lapakId); break; }
  return sess;
}
function deleteSession(token) {
  SESSION_CACHE.remove('sess_' + token);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) if (String(data[i][0]) === String(token)) { sheet.deleteRow(i + 1); break; }
}
function toPosNum(v, fb) { fb = fb === undefined ? 0 : fb; const n = Number(v); if (!isFinite(n) || n < 0) return fb; return Math.floor(n); }
function toPosNumF(v, fb) { fb = fb === undefined ? 0 : fb; const n = Number(v); if (!isFinite(n) || n < 0) return fb; return Math.round(n * 100) / 100; }
function logAction(user, action, details) {
  try {
    const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Log');
    if (s) s.appendRow([new Date(), user || '-', action, JSON.stringify(details || {})]);
  } catch (e) {}
}
function checkRateLimit(u) { return (parseInt(ATTEMPT_CACHE.get('login_' + u) || '0', 10)) < CONFIG.MAX_LOGIN_ATTEMPTS; }
function incRateLimit(u) { const k = 'login_' + u; const n = (parseInt(ATTEMPT_CACHE.get(k) || '0', 10)) + 1; ATTEMPT_CACHE.put(k, String(n), CONFIG.LOGIN_WINDOW); }
function resetRateLimit(u) { ATTEMPT_CACHE.remove('login_' + u); }
function todayStr() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function formatDate(d) {
  if (!d) return '';
  if (d instanceof Date) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(d);
}
function formatDateTime(d) {
  if (d instanceof Date) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd MMM yyyy HH:mm');
  return String(d || '');
}
function nowHour() { return Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'H')); }
function fmtRpLocal(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); }

// ============================================================
//  EMAIL NOTIFICATION HELPERS
// ============================================================
function logEmail(to, subject, status, error) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('EmailLog');
    if (!sheet) return;
    sheet.appendRow([new Date(), to, subject, status, error || '']);
  } catch (e) {}
}

function kirimEmail(to, subjek, isiHtml, isiText) {
  if (!to) return false;
  try {
    const opts = {
      to: to,
      subject: subjek,
      htmlBody: isiHtml || isiText,
      body: isiText || (isiHtml || '').replace(/<[^>]+>/g, '')
    };
    MailApp.sendEmail(opts);
    logEmail(to, subjek, 'sent', '');
    return true;
  } catch (e) {
    console.error('Email fail:', e);
    logEmail(to, subjek, 'failed', e.message);
    return false;
  }
}

function getAdminEmail() { return CONFIG.NOTIF_EMAIL || ''; }
function getPesananEmail() { return CONFIG.NOTIF_EMAIL_PESANAN || CONFIG.NOTIF_EMAIL || ''; }

function emailWrapper(title, content, footer) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;background:#f8fafc;padding:20px;"><div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);"><div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:20px 24px;"><div style="font-size:20px;font-weight:700;color:#fff;">🍪 Kue As-Syifa</div><div style="font-size:12px;color:rgba(255,255,255,.85);margin-top:4px;">Sistem Manajemen POS &amp; ERP</div></div><div style="padding:24px;"><h2 style="margin:0 0 16px;font-size:18px;color:#0f172a;font-weight:700;">${title}</h2>${content}</div><div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">${footer || 'Email otomatis dari sistem Kue As-Syifa POS'}</div></div></div>`;
}

function tableRow(label, value, isBold) {
  const style = isBold ? 'font-weight:700;color:#059669;font-size:15px;' : '';
  return `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;">${label}</td><td style="padding:6px 0;text-align:right;font-size:13px;${style}">${value}</td></tr>`;
}

function notifySetoranMasuk(setoran, lapakNama) {
  const to = getAdminEmail();
  if (!to) {
    catatNotifikasi('setoran-masuk', 'admin', 'Setoran Baru dari ' + lapakNama, 'Setoran Rp ' + (Number(setoran.expectedSetoran) || 0).toLocaleString('id-ID'), setoran.id, 'in-app');
    return;
  }
  const subjek = '🍪 Setoran Baru: ' + lapakNama;
  const content = `<p style="margin:0 0 16px;color:#334155;font-size:14px;">Setoran baru dari <strong>${lapakNama}</strong> menunggu persetujuan Anda.</p><table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;padding:12px;">${tableRow('Total Sistem', 'Rp ' + (Number(setoran.totalSistem) || 0).toLocaleString('id-ID'))}${tableRow('Pengeluaran', 'Rp ' + (Number(setoran.pengeluaran) || 0).toLocaleString('id-ID'))}${tableRow('Setoran', 'Rp ' + (Number(setoran.expectedSetoran) || 0).toLocaleString('id-ID'), true)}</table><p style="margin:16px 0 0;color:#64748b;font-size:12px;">Buka aplikasi → Tab Setoran untuk menyetujui.</p>`;
  kirimEmail(to, subjek, emailWrapper('Setoran Baru Masuk', content));
  catatNotifikasi('setoran-masuk', 'admin', subjek, 'Setoran Rp ' + (Number(setoran.expectedSetoran) || 0).toLocaleString('id-ID'), setoran.id, 'email');
}

function notifySetoranApproved(setoran, lapakNama, userEmail, userUsername) {
  const subjek = '✅ Setoran Disetujui: ' + lapakNama;
  const pesan = 'Setoran Anda tanggal ' + setoran.tanggal + ' sebesar Rp ' + (Number(setoran.expectedSetoran) || 0).toLocaleString('id-ID') + ' telah disetujui.';
  if (userUsername) {
    catatNotifikasi('setoran-approved', userUsername, subjek, pesan, setoran.id || '', 'in-app');
  }
  if (userEmail) {
    const content = `<p style="margin:0 0 16px;color:#334155;font-size:14px;">Setoran Anda dari <strong>${lapakNama}</strong> tanggal <strong>${setoran.tanggal}</strong> telah disetujui admin.</p><table style="width:100%;border-collapse:collapse;background:#ecfdf5;border-radius:8px;padding:12px;">${tableRow('Total Setoran', 'Rp ' + (Number(setoran.expectedSetoran) || 0).toLocaleString('id-ID'), true)}</table><p style="margin:16px 0 0;color:#64748b;font-size:12px;">Terima kasih atas kerja keras Anda! 🎉</p>`;
    kirimEmail(userEmail, subjek, emailWrapper('Setoran Disetujui', content));
  }
}

function notifyPesananBaru(pesanan) {
  const to = getPesananEmail();
  if (!to) {
    catatNotifikasi('pesanan-baru', 'admin', 'Pesanan Baru: ' + pesanan.pelangganNama, 'Ambil: ' + pesanan.tanggalAmbil, pesanan.id, 'in-app');
    return;
  }
  const subjek = '🛍️ Pesanan Baru: ' + pesanan.pelangganNama;
  const content = `<p style="margin:0 0 16px;color:#334155;font-size:14px;">Pesanan baru masuk dari <strong>${pesanan.pelangganNama}</strong>.</p><table style="width:100%;border-collapse:collapse;background:#fef3c7;border-radius:8px;padding:12px;">${tableRow('Tanggal Ambil', pesanan.tanggalAmbil)}${tableRow('Jenis', pesanan.jenisAmbil)}${tableRow('Metode', pesanan.metodeAmbil)}${tableRow('Total', 'Rp ' + (Number(pesanan.totalSistem) || 0).toLocaleString('id-ID'))}${pesanan.dp > 0 ? tableRow('DP', 'Rp ' + Number(pesanan.dp).toLocaleString('id-ID')) : ''}${tableRow('Sisa', 'Rp ' + (Number(pesanan.sisaBayar) || 0).toLocaleString('id-ID'), true)}</table>${pesanan.pelangganHp ? `<p style="margin:12px 0 0;color:#64748b;font-size:12px;">HP: ${pesanan.pelangganHp}</p>` : ''}`;
  kirimEmail(to, subjek, emailWrapper('Pesanan Baru Masuk', content));
  catatNotifikasi('pesanan-baru', 'admin', subjek, pesanan.pelangganNama, pesanan.id, 'email');
}

function notifyStokKritis(items) {
  const to = getAdminEmail();
  if (!to || !items.length) return;
  const subjek = '⚠️ Stok Kritis: ' + items.length + ' item';
  const content = `<p style="margin:0 0 16px;color:#334155;font-size:14px;">Ada <strong>${items.length} item</strong> dengan stok di bawah ${CONFIG.STK_KRITIS_THRESHOLD} pcs:</p><table style="width:100%;border-collapse:collapse;background:#fef2f2;border-radius:8px;padding:12px;">${items.map(it => tableRow(it.nama, it.saldo + ' pcs', false)).join('')}</table><p style="margin:16px 0 0;color:#64748b;font-size:12px;">Segera restock agar tidak kehabisan.</p>`;
  kirimEmail(to, subjek, emailWrapper('Peringatan Stok Kritis', content));
  catatNotifikasi('stok-kritis', 'admin', subjek, items.length + ' item', '', 'email');
}

function catatNotifikasi(tipe, penerima, subjek, pesan, refId, channel) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Notifikasi');
    if (!sheet) return;
    sheet.appendRow(['N' + Utilities.getUuid().slice(0,8).toUpperCase(), new Date(), tipe, penerima || '', subjek || '', pesan || '', 'unread', refId || '', channel || 'in-app']);
  } catch (e) {}
}

function apiTestNotifikasi(token) {
  requireRole(token, ['admin']);
  const result = [];
  const to = getAdminEmail();
  if (!to) {
    result.push('❌ Email admin belum diset di CONFIG.NOTIF_EMAIL');
  } else {
    const r = kirimEmail(to, '🍪 Test Notifikasi Kue As-Syifa', emailWrapper('Test Berhasil ✅', `<p style="margin:0;color:#334155;font-size:14px;">Selamat! Notifikasi email Anda sudah berfungsi dengan baik.</p>`));
    result.push(r ? '✅ Email test dikirim ke ' + to : '❌ Gagal kirim email');
  }
  return { success: true, message: result.join(' | '), email: to };
}

function apiSendEmailManual(token, payload) {
  requireRole(token, ['admin']);
  const to = String(payload.to || '').trim();
  const subjek = String(payload.subjek || '').trim();
  const isi = String(payload.isi || '').trim();
  if (!to || !subjek || !isi) return { success: false, message: 'Lengkapi to, subjek, isi.' };
  const r = kirimEmail(to, subjek, emailWrapper(subjek, `<p style="margin:0;color:#334155;font-size:14px;white-space:pre-wrap;">${isi}</p>`));
  return { success: r, message: r ? 'Email terkirim.' : 'Gagal kirim.' };
}

// ============================================================
//  AUTH
// ============================================================
function apiLogin(username, password) {
  const raw = String(username || '').trim();
  const norm = raw.toLowerCase();
  password = String(password || '');
  if (!norm || !password) return { success: false, message: 'Username & password wajib diisi.' };
  if (!checkRateLimit(norm)) return { success: false, message: 'Terlalu banyak percobaan. Coba lagi dalam 5 menit.' };
  const users = getSheetData('Users');
  const lower = s => String(s || '').trim().toLowerCase();
  let user = users.find(u => lower(u.username) === norm);
  if (!user) user = users.find(u => lower(u.name) === norm);
  if (!user) user = users.find(u => lower(u.name).split(/\s+/)[0] === norm);
  if (!user) { incRateLimit(norm); return { success: false, message: 'Username atau password salah.' }; }
  if (String(user.aktif) === 'false' || user.aktif === false) return { success: false, message: 'Akun Anda dinonaktifkan. Hubungi admin.' };
  if (!user.passwordHash || !user.salt) return { success: false, message: 'Database user belum siap. Hubungi admin.' };
  const newHash = hashPassword(password, user.salt);
  const legacyHash = hashPasswordLegacy(password, user.salt);
  const isNewOk = safeEqual(newHash, user.passwordHash);
  const isLegacyOk = safeEqual(legacyHash, user.passwordHash);
  if (!isNewOk && !isLegacyOk) {
    incRateLimit(norm); logAction(norm, 'LOGIN_FAILED', {});
    return { success: false, message: 'Username atau password salah.' };
  }
  if (isLegacyOk && !isNewOk) {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
      const data = sheet.getDataRange().getValues();
      const h = data[0];
      const iId = h.indexOf('id'), iHash = h.indexOf('passwordHash');
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][iId]) === String(user.id)) {
          sheet.getRange(i + 1, iHash + 1).setValue(newHash);
          _clearSheetCache();
          break;
        }
      }
    } catch (e) {}
  }
  resetRateLimit(norm);
  const token = createSession(user);
  logAction(user.username, 'LOGIN_SUCCESS', {});
  const bootstrap = buildBootstrapData(user);
  return {
    success: true, token,
    user: { id:user.id, username:user.username, role:user.role, name:user.name,
      lapakId:user.lapakId || '', lapakIds: String(user.lapakIds || user.lapakId || ''),
      email: user.email || '',
      mustChangePassword: String(user.mustChangePassword) === 'true' || user.mustChangePassword === true },
    bootstrap
  };
}

function apiGetMe(token) { return getSession(token); }
function apiLogout(token) {
  try { const s = getSession(token); deleteSession(token); logAction(s.username, 'LOGOUT', {}); } catch (e) {}
  return { success: true };
}

function apiChangePassword(token, oldPwd, newPwd) {
  const sess = getSession(token);
  newPwd = String(newPwd || '');
  if (newPwd.length < 6) return { success: false, message: 'Password minimal 6 karakter.' };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const iId = h.indexOf('id'), iHash = h.indexOf('passwordHash'), iSalt = h.indexOf('salt'), iMust = h.indexOf('mustChangePassword');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][iId]) === String(sess.id)) {
      const oldOk = safeEqual(hashPassword(oldPwd, data[i][iSalt]), data[i][iHash]) || safeEqual(hashPasswordLegacy(oldPwd, data[i][iSalt]), data[i][iHash]);
      if (!oldOk) return { success: false, message: 'Password lama salah.' };
      const ns = Utilities.getUuid();
      sheet.getRange(i + 1, iHash + 1).setValue(hashPassword(newPwd, ns));
      sheet.getRange(i + 1, iSalt + 1).setValue(ns);
      if (iMust >= 0) sheet.getRange(i + 1, iMust + 1).setValue(false);
      logAction(sess.username, 'CHANGE_PASSWORD', {});
      deleteSession(token);
      _clearSheetCache(); invalidateMasterCache();
      return { success: true, message: 'Password diubah.' };
    }
  }
  return { success: false, message: 'User tidak ditemukan.' };
}

function apiAdminResetPassword(token, userId) {
  const sess = requireRole(token, ['admin']);
  if (!userId) return { success: false, message: 'User wajib.' };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const iId = h.indexOf('id'), iHash = h.indexOf('passwordHash'), iSalt = h.indexOf('salt'), iMust = h.indexOf('mustChangePassword');
  const newPwd = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][iId]) === String(userId)) {
      const ns = Utilities.getUuid();
      sheet.getRange(i + 1, iHash + 1).setValue(hashPassword(newPwd, ns));
      sheet.getRange(i + 1, iSalt + 1).setValue(ns);
      if (iMust >= 0) sheet.getRange(i + 1, iMust + 1).setValue(false);
      _clearSheetCache(); invalidateMasterCache();
      return { success: true, message: 'Password direset ke: ' + newPwd, newPassword: newPwd };
    }
  }
  return { success: false, message: 'User tidak ditemukan.' };
}

// ============================================================
//  FAST BOOTSTRAP
// ============================================================
function buildBootstrapData(user) {
  const result = { role: user.role };
  result.lapak = getMasterCached('lapak', () => getSheetData('Lapak').map(l => ({ id:l.id, nama:l.nama, alamat:l.alamat, aktif: String(l.aktif) !== 'false' && l.aktif !== false })));
  result.suppliers = getMasterCached('suppliers', () => getSheetData('Suppliers').map(s => ({ id:s.id, nama:s.nama, kontak:s.kontak, email:s.email || '', jadwalPesan:s.jadwalPesan, catatan:s.catatan, tipeTransaksi: s.tipeTransaksi || 'BeliPutus', aktif: String(s.aktif) !== 'false' && s.aktif !== false })));
  result.katalog = getMasterCached('katalog', () => {
    const supMap = {}; getSheetData('Suppliers').forEach(s => supMap[s.id] = s.nama);
    const isAdmin = user.role === 'admin';
    return getSheetData('Katalog').map(k => {
      const supplierId = String(k.supplierId || k.supplier || '').trim();
      const supplierNama = supplierId ? (supMap[supplierId] || '') : '';
      const base = { id:k.id, nama:k.nama, supplierId:supplierId, supplierNama:supplierNama, hargaJual: Number(k.hargaJual)||0, kategori:k.kategori||'', aktif: k.aktif !== undefined ? (String(k.aktif) !== 'false' && k.aktif !== false) : (k.stokDefault !== undefined ? (String(k.stokDefault) !== 'false' && k.stokDefault !== false) : true) };
      if (isAdmin) { base.hargaBeli = Number(k.hargaBeli)||0; base.margin = (Number(k.hargaJual)||0)-(Number(k.hargaBeli)||0); }
      return base;
    });
  });
  if (user.role === 'admin') {
    const lapakMap = {}; getSheetData('Lapak').forEach(l => lapakMap[l.id] = l.nama);
    result.users = getMasterCached('users', () => getSheetData('Users').map(u => ({ id:u.id, username:u.username, role:u.role, name:u.name, lapakId:u.lapakId||'', lapakNama: lapakMap[u.lapakId]||'', lapakIds: u.lapakIds || u.lapakId || '', email: u.email || '', mustChangePassword: String(u.mustChangePassword) === 'true' || u.mustChangePassword === true, aktif: String(u.aktif) !== 'false' && u.aktif !== false })));
    result.templateBox = getTemplateBoxFullData();
    const tgl = todayStr();
    const setoran = getSheetData('Setoran');
    const kas = getSheetData('Kas');
    const pending = setoran.filter(s => s.status === 'pending');
    const titipanTotals = buildTitipanTotalsBySetoran();
    const saldoKas = kas.length ? Number(kas[kas.length - 1].saldo) || 0 : 0;
    const todaySetoran = setoran.filter(s => formatDate(s.tanggal) === tgl);
    const todayPenjualan = todaySetoran.reduce((s, x) => s + (Number(x.totalSistem) || 0), 0);
    const todayTunai = todaySetoran.reduce((s, x) => s + (Number(x.totalTunai) || 0), 0);
    const todayQris = todaySetoran.reduce((s, x) => s + (Number(x.totalQris) || 0), 0);
    const recentKas = kas.slice(-10).reverse().map(k => ({ tanggal: formatDateTime(k.tanggal), keterangan: k.keterangan || '', tipe: k.tipe || '', metode: k.metode || ((String(k.keterangan || '').match(/\[(Tunai|QRIS|Transfer)\]\s*$/i) || [])[1] || ''), kategori: k.kategori || '', nominal: Number(k.nominal) || 0, saldo: Number(k.saldo) || 0 }));
    const unreadNotif = getSheetData('Notifikasi').filter(n => n.status === 'unread').length;
    const utangKonsinyasi = getSheetData('Konsinyasi').filter(k => k.status === 'Pending').reduce((s, k) => s + (Number(k.utang) || 0), 0);
    const todayPesanan = getSheetData('PesananPelanggan').filter(p => formatDate(p.tanggalAmbil) === tgl || formatDate(p.tanggal) === tgl);
    result.dash = { kasBesar: saldoKas, pendingCount: pending.length, pendingSetoran: pending.map(s => mapSetoran(s, titipanTotals)), todayPenjualan, todayTunai, todayQris, todaySetoranCount: todaySetoran.length, recentKas, unreadNotif, utangKonsinyasi, todayPesananCount: todayPesanan.length };
    result.setoran = setoran.map(s => mapSetoran(s, titipanTotals)).reverse().slice(0, 200);
    result.kas = kas.reverse().slice(0, 100).map(k => ({ id:k.id, tanggal:formatDateTime(k.tanggal), keterangan:k.keterangan || '', tipe:k.tipe || '', kategori:k.kategori || '', nominal:Number(k.nominal) || 0, saldo:Number(k.saldo) || 0 }));
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    result.laporan = buildLaporanForRange(firstDay, now);
  } else {
    result.karyawan = null;
  }
  return result;
}

function apiBootstrap(token) {
  const user = getSession(token);
  return buildBootstrapData(user);
}

function apiPreloadTab(token, tab) {
  requireRole(token, ['admin']);
  try {
    if (tab === 'katalog') return { katalog: getMasterCached('katalog', () => getSheetData('Katalog')) };
    if (tab === 'suppliers') return { suppliers: getMasterCached('suppliers', () => getSheetData('Suppliers')) };
    if (tab === 'lapak') return { lapak: getMasterCached('lapak', () => getSheetData('Lapak')) };
    if (tab === 'kasbon') return { kasbon: apiGetKasbon(token, {}) };
    if (tab === 'setoran') return { setoran: apiGetSetoranList(token, {}) };
    if (tab === 'belanja') return { belanja: apiGetBelanja(token, {}) };
    if (tab === 'jadwal') return { jadwal: apiGetJadwal(token, 30) };
    if (tab === 'konsinyasi') return { konsinyasi: apiGetKonsinyasi(token, {}), saldoSupplier: apiGetSaldoSupplier(token) };
    if (tab === 'pesanan-pelanggan') return { pesananPelanggan: apiGetPesananPelanggan(token, {}) };
    if (tab === 'template-box') return { templateBox: apiGetTemplateBox(token) };
    if (tab === 'analytics') return { analytics: apiGetAnalytics(token, { range: 30 }) };
    if (tab === 'analisis-performa') return { analisisPerforma: apiGetAnalisisPerforma(token, { range: 30, groupBy: 'item' }) };
    return { ok: true };
  } catch (e) { return { error: e.message }; }
}

function buildLaporanForRange(dari, sampai, lapakId) {
  const fromMs = dari.getTime(), toMs = sampai.getTime() + 86400000;
  const setoran = getSheetData('Setoran').filter(s => {
    if (s.status !== 'approved' && s.status !== 'pending') return false;
    if (lapakId && String(s.lapakId) !== String(lapakId)) return false;
    const t = s.tanggal instanceof Date ? s.tanggal.getTime() : new Date(s.tanggal).getTime();
    return t >= fromMs && t <= toMs;
  });
  const setoranIds = {}; setoran.forEach(s => setoranIds[s.id] = s);
  const katMap = {}; getSheetData('Katalog').forEach(k => katMap[k.id] = k);
  const supMap = {}; getSheetData('Suppliers').forEach(s => supMap[s.id] = s.nama);
  const lapakMap = {}; getSheetData('Lapak').forEach(l => lapakMap[l.id] = l.nama);
  const perItem = {}, perSupplier = {}, perLapak = {};
  getSheetData('SetoranDetail').forEach(d => {
    const s = setoranIds[d.setoranId]; if (!s) return;
    const k = katMap[d.katalogId]; if (!k) return;
    const qtyLaku = Number(d.qtyLaku) || 0;
    const subtotal = Number(d.subtotal) || 0;
    const hpp = qtyLaku * (Number(d.hargaBeli) || Number(k.hargaBeli) || 0);
    const profit = subtotal - hpp;
    if (!perItem[d.katalogId]) perItem[d.katalogId] = { katalogId:d.katalogId, nama:k.nama, supplierNama: supMap[k.supplierId] || '', qtyLaku:0, omzet:0, profit:0 };
    perItem[d.katalogId].qtyLaku += qtyLaku;
    perItem[d.katalogId].omzet += subtotal;
    perItem[d.katalogId].profit += profit;
    const supId = k.supplierId || 'unknown';
    if (!perSupplier[supId]) perSupplier[supId] = { supplierId:supId, nama: supMap[supId] || supId, qtyLaku:0, omzet:0, profit:0, itemCount:{} };
    perSupplier[supId].qtyLaku += qtyLaku;
    perSupplier[supId].omzet += subtotal;
    perSupplier[supId].profit += profit;
    perSupplier[supId].itemCount[d.katalogId] = (perSupplier[supId].itemCount[d.katalogId] || 0) + qtyLaku;
    if (!perLapak[s.lapakId]) perLapak[s.lapakId] = { lapakId:s.lapakId, nama: lapakMap[s.lapakId] || s.lapakId, qtyLaku:0, omzet:0, profit:0, setoranCount:0 };
    perLapak[s.lapakId].qtyLaku += qtyLaku;
    perLapak[s.lapakId].omzet += subtotal;
    perLapak[s.lapakId].profit += profit;
  });
  setoran.forEach(s => { if (perLapak[s.lapakId]) perLapak[s.lapakId].setoranCount++; });
  const itemArr = Object.values(perItem).sort((a, b) => b.qtyLaku - a.qtyLaku);
  const pembelianSusulan = getSheetData('Konsinyasi').filter(k => {
    if (String(k.catatan || '').indexOf('PEMBELIAN_SUSULAN|') !== 0) return false;
    if (lapakId && String(k.lapakId) !== String(lapakId)) return false;
    const t = k.tanggal instanceof Date ? k.tanggal.getTime() : new Date(k.tanggal).getTime();
    return t >= fromMs && t <= toMs;
  });
  const susulanBySupplier = {};
  pembelianSusulan.forEach(k => {
    const sid=String(k.supplierId), amount=Number(k.utang)||0;
    if(!susulanBySupplier[sid]) susulanBySupplier[sid]={supplierId:sid,nama:supMap[sid]||sid,count:0,qty:0,total:0,pending:0,paid:0};
    const x=susulanBySupplier[sid]; x.count++; x.qty+=Number(k.qtyLaku)||0; x.total+=amount;
    if(k.status==='Pending') x.pending+=amount; else if(k.status==='Bayar') x.paid+=amount;
  });
  return {
    periode: { dari: formatDate(dari), sampai: formatDate(new Date(toMs - 86400000)) },
    ringkasan: { totalOmzet: itemArr.reduce((s, x) => s + x.omzet, 0), totalProfit: itemArr.reduce((s, x) => s + x.profit, 0), totalQty: itemArr.reduce((s, x) => s + x.qtyLaku, 0), totalSetoran: setoran.length, totalPembelianSusulan: pembelianSusulan.reduce((s,k)=>s+(Number(k.utang)||0),0), utangPembelianSusulan: pembelianSusulan.filter(k=>k.status==='Pending').reduce((s,k)=>s+(Number(k.utang)||0),0), dibayarPembelianSusulan: pembelianSusulan.filter(k=>k.status==='Bayar').reduce((s,k)=>s+(Number(k.utang)||0),0) },
    perItem: itemArr, topItems: itemArr.slice(0, 10), bottomItems: itemArr.slice(-10).reverse(),
    perSupplier: Object.values(perSupplier).map(s => ({ supplierId:s.supplierId, nama:s.nama, qtyLaku:s.qtyLaku, omzet:s.omzet, profit:s.profit, itemCount: Object.keys(s.itemCount).length, margin: s.omzet > 0 ? (s.profit / s.omzet * 100) : 0 })).sort((a, b) => b.profit - a.profit),
    pembelianSusulanPerSupplier: Object.values(susulanBySupplier).sort((a,b)=>b.total-a.total),
    perLapak: Object.values(perLapak).map(l => ({ lapakId:l.lapakId, nama:l.nama, qtyLaku:l.qtyLaku, omzet:l.omzet, profit:l.profit, setoranCount:l.setoranCount, margin: l.omzet > 0 ? (l.profit / l.omzet * 100) : 0 })).sort((a, b) => b.omzet - a.omzet)
  };
}

function getTemplateBoxFullData() {
  const katMap = {}; getSheetData('Katalog').forEach(k => katMap[k.id] = k);
  const boxes = getSheetData('TemplateBox');
  const items = getSheetData('TemplateBoxItem');
  return boxes.map(b => {
    const boxItems = items.filter(it => String(it.templateBoxId) === String(b.id)).map(it => {
      const k = katMap[it.katalogId] || {};
      return { katalogId: it.katalogId, nama: k.nama || it.katalogId, hargaJual: Number(k.hargaJual) || 0, qty: Number(it.qty) || 0 };
    });
    return { id: b.id, nama: b.nama, hargaPaket: Number(b.hargaPaket) || 0, keterangan: b.keterangan || '', aktif: String(b.aktif) !== 'false' && b.aktif !== false, items: boxItems };
  }).filter(b => b.aktif);
}

// ============================================================
//  TRIGGERS
// ============================================================
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => {
    const fn = t.getHandlerFunction();
    if (fn === 'backupDatabase' || fn === 'cleanupExpiredSessions' || fn === 'dailyReminderPesanan' || fn === 'dailyCheckStokKritis') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('backupDatabase').timeBased().atHour(2).everyDays(1).create();
  ScriptApp.newTrigger('cleanupExpiredSessions').timeBased().atHour(3).everyDays(1).create();
  ScriptApp.newTrigger('dailyReminderPesanan').timeBased().atHour(8).everyDays(1).create();
  ScriptApp.newTrigger('dailyCheckStokKritis').timeBased().atHour(9).everyDays(1).create();
  return 'OK: 4 triggers created.';
}

function cleanupExpiredSessions() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
  if (!sheet) return 'No sheet';
  const data = sheet.getDataRange().getValues();
  let removed = 0;
  for (let i = data.length - 1; i >= 1; i--) {
    const exp = data[i][7] instanceof Date ? data[i][7].getTime() : new Date(data[i][7]).getTime();
    if (Date.now() > exp) { sheet.deleteRow(i + 1); removed++; }
  }
  return 'Removed ' + removed;
}

function backupDatabase() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const file = DriveApp.getFileById(ss.getId());
    const it = DriveApp.getFoldersByName(CONFIG.BACKUP_FOLDER);
    const folder = it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.BACKUP_FOLDER);
    const ds = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
    file.makeCopy('Backup_' + ds, folder);
    const cutoff = Date.now() - CONFIG.BACKUP_RETENTION_DAYS * 86400000;
    const files = folder.getFiles();
    while (files.hasNext()) { const f = files.next(); if (f.getDateCreated().getTime() < cutoff) f.setTrashed(true); }
    return 'OK: ' + ds;
  } catch (e) { return 'Fail: ' + e.message; }
}

function dailyReminderPesanan() {
  const to = getPesananEmail();
  if (!to) return 'No email config';
  const besok = new Date(Date.now() + 86400000);
  const besokStr = Utilities.formatDate(besok, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const list = getSheetData('PesananPelanggan').filter(p => formatDate(p.tanggalAmbil) === besokStr && p.status !== 'Selesai' && p.status !== 'Batal');
  if (!list.length) return 'No pesanan besok';
  const subjek = '📅 Reminder: ' + list.length + ' pesanan untuk besok';
  const content = `<p style="margin:0 0 16px;color:#334155;font-size:14px;">Besok (${besokStr}) ada <strong>${list.length} pesanan</strong> yang harus disiapkan:</p><table style="width:100%;border-collapse:collapse;background:#fef3c7;border-radius:8px;padding:12px;">${list.map(p => `<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;"><strong style="color:#0f172a;">${p.pelangganNama}</strong><div style="font-size:11px;color:#64748b;margin-top:2px;">${p.metodeAmbil} · ${p.jenisAmbil} · Rp ${Number(p.totalSistem || 0).toLocaleString('id-ID')}</div></td></tr>`).join('')}</table>`;
  kirimEmail(to, subjek, emailWrapper('Reminder Pesanan Besok', content));
  return 'Sent reminder for ' + list.length + ' pesanan';
}

function dailyCheckStokKritis() {
  const saldo = apiGetStokSaldo(null, true);
  const kritis = saldo.filter(s => s.saldo < CONFIG.STK_KRITIS_THRESHOLD && s.saldo >= 0);
  if (!kritis.length) return 'No kritis';
  notifyStokKritis(kritis);
  return 'Notified ' + kritis.length + ' items';
}

function diagnoseLogin() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet) return 'No Users sheet';
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return 'Empty';
  const h = data[0];
  const iUser = h.indexOf('username'), iHash = h.indexOf('passwordHash'), iSalt = h.indexOf('salt');
  const r = ['Diag Users:'];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][iUser]) continue;
    const configured = Boolean(data[i][iHash] && data[i][iSalt]);
    r.push(data[i][iUser] + ' -> ' + (configured ? 'CREDENTIALS_SET' : 'CREDENTIALS_MISSING'));
  }
  const out = r.join('\n'); console.log(out); return out;
}

// ============================================================
//  MASTER — LAPAK / SUPPLIERS / KATALOG / USERS
// ============================================================
function apiGetLapak(token) {
  requireRole(token, ['admin','karyawan']);
  return getSheetData('Lapak').map(l => ({ id:l.id, nama:l.nama, alamat:l.alamat, aktif: String(l.aktif) !== 'false' && l.aktif !== false }));
}
function apiSaveLapak(token, item) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Lapak');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  const nama = String(item.nama || '').trim(); if (!nama) return { success: false, message: 'Nama wajib.' };
  const row = [item.id || ('L' + Utilities.getUuid().slice(0,6).toUpperCase()), nama, String(item.alamat||''), item.aktif !== false];
  if (item.id) { for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(item.id)) { sheet.getRange(i+1,1,1,4).setValues([row]); _clearSheetCache(); invalidateMasterCache(); return { success:true, message:'Lapak diperbarui.' }; } return { success:false, message:'Lapak tidak ditemukan.' }; }
  appendObjectsByHeaders(sheet, [{id:row[0], nama:row[1], alamat:row[2], aktif:row[3]}]); _clearSheetCache(); invalidateMasterCache(); return { success:true, message:'Lapak ditambahkan.' };
}
function apiDeleteLapak(token, id) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Lapak');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(id)) { sheet.deleteRow(i+1); _clearSheetCache(); invalidateMasterCache(); return { success:true, message:'Lapak dihapus.' }; }
  return { success:false, message:'Lapak tidak ditemukan.' };
}

function apiGetSuppliers(token) {
  requireRole(token, ['admin','karyawan']);
  return getSheetData('Suppliers').map(s => ({ id:s.id, nama:s.nama, kontak:s.kontak, email:s.email || '', jadwalPesan:s.jadwalPesan, catatan:s.catatan, tipeTransaksi: s.tipeTransaksi || 'BeliPutus', aktif: String(s.aktif) !== 'false' && s.aktif !== false }));
}
function apiSaveSupplier(token, item) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Suppliers');
  const data = sheet.getDataRange().getValues();
  const h = data[0]; const iId = h.indexOf('id'); const iTipe = h.indexOf('tipeTransaksi');
  const nama = String(item.nama || '').trim();
  if (!nama) return { success:false, message:'Nama wajib.' };
  const email = String(item.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success:false, message:'Format email supplier tidak valid.' };
  const tipe = ['BeliPutus','TitipJual'].indexOf(item.tipeTransaksi) !== -1 ? item.tipeTransaksi : 'BeliPutus';
  const row = { id:item.id || ('SP' + Utilities.getUuid().slice(0,6).toUpperCase()), nama, kontak:String(item.kontak || ''), jadwalPesan:String(item.jadwalPesan || ''), catatan:String(item.catatan || ''), tipeTransaksi:tipe, aktif:item.aktif !== false, email };
  if (item.id) {
    for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(item.id)) {
      if (iTipe !== -1) {
        sheet.getRange(i+1, h.indexOf('nama')+1).setValue(nama);
        sheet.getRange(i+1, h.indexOf('kontak')+1).setValue(String(item.kontak||''));
        sheet.getRange(i+1, h.indexOf('jadwalPesan')+1).setValue(String(item.jadwalPesan||''));
        sheet.getRange(i+1, h.indexOf('catatan')+1).setValue(String(item.catatan||''));
        sheet.getRange(i+1, iTipe+1).setValue(tipe);
        sheet.getRange(i+1, h.indexOf('aktif')+1).setValue(item.aktif !== false);
        if (h.indexOf('email') !== -1) sheet.getRange(i+1, h.indexOf('email')+1).setValue(email);
      } else {
        const updates = {id:row.id, nama:row.nama, kontak:row.kontak, jadwalPesan:row.jadwalPesan, catatan:row.catatan, tipeTransaksi:row.tipeTransaksi, aktif:row.aktif, email:row.email};
        Object.keys(updates).forEach(key => {
          const col = h.indexOf(key);
          if (col >= 0) sheet.getRange(i+1, col+1).setValue(updates[key]);
        });
      }
      _clearSheetCache(); invalidateMasterCache(); return { success:true, message:'Supplier diperbarui.' };
    }
    return { success:false, message:'Supplier tidak ditemukan.' };
  }
  appendObjectsByHeaders(sheet, [row]); _clearSheetCache(); invalidateMasterCache();
  return { success:true, message:'Supplier ditambahkan.' };
}
function apiDeleteSupplier(token, id) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Suppliers');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(id)) { sheet.deleteRow(i+1); _clearSheetCache(); invalidateMasterCache(); return { success:true, message:'Supplier dihapus.' }; }
  return { success:false, message:'Supplier tidak ditemukan.' };
}

function apiGetKatalog(token) {
  const sess = requireRole(token, ['admin','karyawan']);
  const supMap = {};
  getSheetData('Suppliers').forEach(s => { supMap[String(s.id)] = s.nama; });
  const isAdmin = sess.role === 'admin';
  return getSheetData('Katalog').map(k => {
    const supplierId = String(k.supplierId || k.supplier || '').trim();
    let supplierNama = '';
    if (supplierId) supplierNama = supMap[supplierId] || ('(supplier tidak dikenal: ' + supplierId + ')');
    const base = { id: k.id, nama: k.nama, supplierId: supplierId, supplierNama: supplierNama, hargaJual: Number(k.hargaJual) || 0, kategori: k.kategori || '', aktif: k.aktif !== undefined ? (String(k.aktif) !== 'false' && k.aktif !== false) : (k.stokDefault !== undefined ? (String(k.stokDefault) !== 'false' && k.stokDefault !== false) : true) };
    if (isAdmin) { base.hargaBeli = Number(k.hargaBeli) || 0; base.margin = (Number(k.hargaJual) || 0) - (Number(k.hargaBeli) || 0); }
    return base;
  });
}
function apiSaveKatalog(token, item) {
  requireRole(token, ['admin']);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success:false, message:'Sistem sibuk. Coba lagi.' };
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Katalog');
    const data = sheet.getDataRange().getValues();
    const h = data[0].map(x => String(x).trim());
    const iId = h.indexOf('id');
    const nama = String(item.nama || '').trim();
    const hb = toPosNum(item.hargaBeli);
    const hj = toPosNum(item.hargaJual);
    if (!nama) return { success:false, message:'Nama wajib.' };
    if (!item.supplierId) return { success:false, message:'Supplier wajib dipilih.' };
    if (hj <= 0) return { success:false, message:'Harga jual harus lebih dari 0.' };
    if (hj < hb) return { success:false, message:'Harga jual harus ≥ harga beli.' };
    const id = item.id || ('K' + Utilities.getUuid().slice(0,6).toUpperCase());
    let rowIdx = -1;
    if (item.id) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][iId]) === String(item.id)) { rowIdx = i + 1; break; }
      }
    }
    const rowValues = h.map(colName => {
      switch (colName) {
        case 'id': return id;
        case 'nama': return nama;
        case 'supplierId':
        case 'supplier': return item.supplierId;
        case 'hargaBeli': return hb;
        case 'hargaJual': return hj;
        case 'kategori': return String(item.kategori || '');
        case 'aktif':
        case 'stokDefault': return item.aktif !== false;
        default: return '';
      }
    });
    if (rowIdx > 0) {
      sheet.getRange(rowIdx, 1, 1, rowValues.length).setValues([rowValues]);
      _clearSheetCache(); invalidateMasterCache();
      return { success:true, message:'Item diperbarui.' };
    }
    sheet.appendRow(rowValues);
    _clearSheetCache(); invalidateMasterCache();
    return { success:true, message:'Item ditambahkan.' };
  } finally { lock.releaseLock(); }
}
function apiDeleteKatalog(token, id) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Katalog');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(id)) { sheet.deleteRow(i+1); _clearSheetCache(); invalidateMasterCache(); return { success:true, message:'Item dihapus.' }; }
  return { success:false, message:'Item tidak ditemukan.' };
}

function apiGetUsers(token) {
  requireRole(token, ['admin']);
  const lapakMap = {}; getSheetData('Lapak').forEach(l => lapakMap[l.id] = l.nama);
  return getSheetData('Users').map(u => ({ id:u.id, username:u.username, role:u.role, name:u.name, lapakId:u.lapakId||'', lapakNama: lapakMap[u.lapakId]||'', lapakIds: u.lapakIds || u.lapakId || '', email: u.email || '', mustChangePassword: String(u.mustChangePassword) === 'true' || u.mustChangePassword === true, aktif: String(u.aktif) !== 'false' && u.aktif !== false }));
}
function apiSaveUser(token, item) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues(); const h = data[0];
  const iId = h.indexOf('id'), iUser = h.indexOf('username');
  const username = String(item.username || '').trim().toLowerCase();
  if (!username) return { success:false, message:'Username wajib diisi.' };
  const role = item.role === 'admin' ? 'admin' : 'karyawan';
  const name = String(item.name || '').trim(); if (!name) return { success:false, message:'Nama wajib diisi.' };
  for (let i=1;i<data.length;i++) {
    if (item.id && String(data[i][iId])===String(item.id)) continue;
    if (String(data[i][iUser]).toLowerCase() === username) return { success:false, message:'Username sudah dipakai.' };
  }
  const emailBaru = item.email !== undefined ? String(item.email || '').trim() : null;
  if (item.id) {
    for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(item.id)) {
      sheet.getRange(i+1, iUser+1).setValue(username);
      sheet.getRange(i+1, h.indexOf('role')+1).setValue(role);
      sheet.getRange(i+1, h.indexOf('name')+1).setValue(name);
      sheet.getRange(i+1, h.indexOf('lapakId')+1).setValue(item.lapakId || '');
      sheet.getRange(i+1, h.indexOf('aktif')+1).setValue(item.aktif !== false);
      if (h.indexOf('lapakIds') !== -1) sheet.getRange(i+1, h.indexOf('lapakIds')+1).setValue(item.lapakIds || item.lapakId || '');
      if (emailBaru !== null && h.indexOf('email') !== -1) sheet.getRange(i+1, h.indexOf('email')+1).setValue(emailBaru);
      if (item.password && String(item.password).length >= 6) {
        const salt = Utilities.getUuid();
        sheet.getRange(i+1, h.indexOf('passwordHash')+1).setValue(hashPassword(item.password, salt));
        sheet.getRange(i+1, h.indexOf('salt')+1).setValue(salt);
      }
      _clearSheetCache(); invalidateMasterCache(); return { success:true, message:'User diperbarui.' };
    }
    return { success:false, message:'User tidak ditemukan.' };
  }
  if (!item.password || String(item.password).length < 6) return { success:false, message:'Password wajib (min 6 karakter).' };
  const salt = Utilities.getUuid();
  sheet.appendRow(['U' + Utilities.getUuid().slice(0,6).toUpperCase(), username, hashPassword(item.password, salt), salt, role, name, item.lapakId || '', item.aktif !== false, item.lapakIds || item.lapakId || '', false, emailBaru || '']);
  _clearSheetCache(); invalidateMasterCache();
  return { success:true, message:'User ditambahkan.' };
}
function apiDeleteUser(token, id) {
  const sess = requireRole(token, ['admin']);
  if (String(id) === String(sess.id)) return { success:false, message:'Tidak bisa menghapus akun sendiri.' };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(id)) { sheet.deleteRow(i+1); _clearSheetCache(); invalidateMasterCache(); return { success:true, message:'User dihapus.' }; }
  return { success:false, message:'User tidak ditemukan.' };
}

// ============================================================
//  MULTI-LAPAK
// ============================================================
function apiGetMyLapak(token) {
  const sess = getSession(token);
  if (sess.role === 'admin') {
    return getSheetData('Lapak').filter(l => String(l.aktif) !== 'false' && l.aktif !== false).map(l => ({ id:l.id, nama:l.nama, alamat:l.alamat || '' }));
  }
  const ids = String(sess.lapakIds || sess.lapakId || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) return [];
  return getSheetData('Lapak').filter(l => ids.indexOf(String(l.id)) !== -1).map(l => ({ id:l.id, nama:l.nama, alamat:l.alamat || '' }));
}
function apiSetLapakAktif(token, lapakId) {
  const sess = getSession(token);
  if (sess.role === 'admin') return { success: true, lapakId };
  const ids = String(sess.lapakIds || sess.lapakId || '').split(',').map(s => s.trim());
  if (ids.indexOf(String(lapakId)) === -1) return { success: false, message: 'Anda tidak punya akses ke lapak ini.' };
  updateSessionLapak(token, lapakId);
  logAction(sess.username, 'SWITCH_LAPAK', { lapakId });
  return { success: true, lapakId };
}

// ============================================================
//  KARTU STOK
// ============================================================
function catatKartuStok(katalogId, lapakId, tipe, masuk, keluar, refId, keterangan) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('KartuStok');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const iKat = h.indexOf('katalogId'), iMasuk = h.indexOf('masuk'), iKeluar = h.indexOf('keluar');
  let saldo = 0;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][iKat]) === String(katalogId)) saldo += (Number(data[i][iMasuk]) || 0) - (Number(data[i][iKeluar]) || 0);
  }
  saldo += masuk - keluar;
  appendObjectsByHeaders(sheet, [{id:'KS'+Utilities.getUuid().slice(0,8).toUpperCase(),tanggal:new Date(),katalogId,lapakId:lapakId||'',tipe,masuk:masuk||0,keluar:keluar||0,saldo,refId:refId||'',keterangan:String(keterangan||'')}]);
}
function apiGetKartuStok(token, filter) {
  requireRole(token, ['admin']);
  filter = filter || {};
  const katMap = {}; getSheetData('Katalog').forEach(k => katMap[k.id] = k.nama);
  const lapakMap = {}; getSheetData('Lapak').forEach(l => lapakMap[l.id] = l.nama);
  let list = getSheetData('KartuStok').map(k => ({ id: k.id, tanggal: formatDateTime(k.tanggal), katalogId: k.katalogId, nama: katMap[k.katalogId] || k.katalogId, lapakId: k.lapakId, lapakNama: lapakMap[k.lapakId] || k.lapakId, tipe: k.tipe || '', masuk: Number(k.masuk) || 0, keluar: Number(k.keluar) || 0, saldo: Number(k.saldo) || 0, refId: k.refId || '', keterangan: k.keterangan || '' }));
  if (filter.katalogId) list = list.filter(k => String(k.katalogId) === String(filter.katalogId));
  if (filter.lapakId) list = list.filter(k => String(k.lapakId) === String(filter.lapakId));
  if (filter.tipe) list = list.filter(k => k.tipe === filter.tipe);
  return list.reverse();
}
function apiGetStokSaldo(token, internal) {
  if (!internal) requireRole(token, ['admin']);
  const katMap = {}; getSheetData('Katalog').forEach(k => katMap[k.id] = k);
  const saldoMap = {};
  getSheetData('KartuStok').forEach(k => {
    const key = String(k.katalogId);
    if (!saldoMap[key]) saldoMap[key] = { katalogId: key, nama: (katMap[key] || {}).nama || key, masuk: 0, keluar: 0, saldo: 0 };
    saldoMap[key].masuk += Number(k.masuk) || 0;
    saldoMap[key].keluar += Number(k.keluar) || 0;
    saldoMap[key].saldo = Number(k.saldo) || 0;
  });
  return Object.values(saldoMap).sort((a, b) => a.nama.localeCompare(b.nama));
}
function catatAuditStok(katalogId, namaItem, lapakId, stokLama, stokBaru, sess) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('StokAudit');
  if (!sheet) throw new Error('Sheet StokAudit belum tersedia. Jalankan upgradeDatabase_v511().');
  sheet.appendRow(['SA' + Utilities.getUuid().slice(0, 8).toUpperCase(), new Date(), katalogId, namaItem, lapakId, stokLama, stokBaru, sess.id, sess.name || sess.username, sess.role]);
}
function apiGetStokAudit(token) {
  requireRole(token, ['admin']);
  const lapakMap = {};
  getSheetData('Lapak').forEach(l => { lapakMap[String(l.id)] = l.nama; });
  return getSheetData('StokAudit').map(a => ({
    id: a.id,
    waktu: formatDateTime(a.waktu),
    namaItem: a.namaItem || a.katalogId,
    lapakNama: lapakMap[String(a.lapakId)] || a.lapakId || '',
    stokLama: Number(a.stokLama) || 0,
    stokBaru: Number(a.stokBaru) || 0,
    user: a.user || a.userId || ''
  })).reverse().slice(0, 100);
}

// ============================================================
//  RETUR
// ============================================================
function apiSubmitRetur(token, payload) {
  const sess = requireRole(token, ['karyawan']);
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return { success: false, message: 'Tidak ada item retur.' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Retur');
    const rows = [];
    items.forEach(it => {
      const qty = toPosNum(it.qty);
      if (qty <= 0) return;
      const kondisi = it.kondisi === 'Buang' ? 'Buang' : 'Layak';
      rows.push(['R' + Utilities.getUuid().slice(0, 8).toUpperCase(), new Date(), sess.lapakId, it.katalogId, qty, kondisi, '', '', 'pending', '', '', String(it.keterangan || '')]);
    });
    if (!rows.length) return { success: false, message: 'Semua qty bernilai 0.' };
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    _clearSheetCache();
    return { success: true, message: rows.length + ' item retur diajukan.' };
  } finally { lock.releaseLock(); }
}
function apiGetReturList(token, filter) {
  const sess = getSession(token);
  filter = filter || {};
  const katMap = {}; getSheetData('Katalog').forEach(k => katMap[k.id] = k.nama);
  const lapakMap = {}; getSheetData('Lapak').forEach(l => lapakMap[l.id] = l.nama);
  let list = getSheetData('Retur').map(r => ({ id: r.id, tanggal: formatDate(r.tanggal), dariLapakId: r.dariLapakId, dariLapakNama: lapakMap[r.dariLapakId] || r.dariLapakId, katalogId: r.katalogId, nama: katMap[r.katalogId] || r.katalogId, qty: Number(r.qty) || 0, kondisi: r.kondisi || 'Layak', tujuanLapakId: r.tujuanLapakId || '', tujuanLapakNama: lapakMap[r.tujuanLapakId] || '', setoranId: r.setoranId || '', status: r.status || 'pending', approvedBy: r.approvedBy || '', approvedAt: formatDateTime(r.approvedAt), keterangan: r.keterangan || '' }));
  if (sess.role === 'karyawan') list = list.filter(r => String(r.dariLapakId) === String(sess.lapakId));
  if (filter.status) list = list.filter(r => r.status === filter.status);
  return list.reverse();
}
function apiApproveRetur(token, id, tujuanLapakId) {
  const sess = requireRole(token, ['admin']);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Retur');
    const data = sheet.getDataRange().getValues();
    const h = data[0];
    const iId = h.indexOf('id'), iStatus = h.indexOf('status');
    const iBy = h.indexOf('approvedBy'), iAt = h.indexOf('approvedAt');
    const iKat = h.indexOf('katalogId'), iQty = h.indexOf('qty'), iKondisi = h.indexOf('kondisi');
    const iDari = h.indexOf('dariLapakId'), iTujuan = h.indexOf('tujuanLapakId');
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][iId]) === String(id)) {
        if (data[i][iStatus] !== 'pending') return { success: false, message: 'Retur sudah diproses.' };
        const katalogId = data[i][iKat], qty = Number(data[i][iQty]) || 0;
        const kondisi = data[i][iKondisi] || 'Layak';
        const dariLapak = data[i][iDari];
        const tujuan = kondisi === 'Layak' ? (tujuanLapakId || dariLapak) : '';
        sheet.getRange(i + 1, iStatus + 1).setValue('approved');
        if (iBy >= 0) sheet.getRange(i + 1, iBy + 1).setValue(sess.username);
        if (iAt >= 0) sheet.getRange(i + 1, iAt + 1).setValue(new Date());
        if (iTujuan >= 0) sheet.getRange(i + 1, iTujuan + 1).setValue(tujuan);
        if (kondisi === 'Layak') catatKartuStok(katalogId, tujuan, 'Retur-Layak', qty, 0, id, 'Retur dari ' + dariLapak);
        else catatKartuStok(katalogId, dariLapak, 'Retur-Buang', 0, qty, id, 'Buang');
        _clearSheetCache();
        return { success: true, message: kondisi === 'Layak' ? 'Retur diterima.' : 'Retur dibuang.' };
      }
    }
    return { success: false, message: 'Retur tidak ditemukan.' };
  } finally { lock.releaseLock(); }
}
function apiRejectRetur(token, id, reason) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Retur');
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const iId = h.indexOf('id'), iStatus = h.indexOf('status'), iKet = h.indexOf('keterangan');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][iId]) === String(id)) {
      sheet.getRange(i + 1, iStatus + 1).setValue('rejected');
      if (iKet >= 0) sheet.getRange(i + 1, iKet + 1).setValue('REJECTED: ' + (reason || ''));
      _clearSheetCache();
      return { success: true, message: 'Retur ditolak.' };
    }
  }
  return { success: false, message: 'Retur tidak ditemukan.' };
}

// ============================================================
//  STRUK
// ============================================================
function apiGetStrukData(token, setoranId) {
  requireRole(token, ['admin','karyawan']);
  const setoran = getSheetData('Setoran').find(s => String(s.id) === String(setoranId));
  if (!setoran) return { success: false, message: 'Setoran tidak ditemukan.' };
  const details = getSheetData('SetoranDetail').filter(d => String(d.setoranId) === String(setoranId));
  const katMap = {}; getSheetData('Katalog').forEach(k => katMap[k.id] = k.nama);
  const lapak = getSheetData('Lapak').find(l => String(l.id) === String(setoran.lapakId)) || {};
  return { success: true, id: setoran.id, tanggal: formatDateTime(setoran.tanggal), lapakNama: lapak.nama || setoran.lapakId, items: details.map(d => ({ nama: katMap[d.katalogId] || d.katalogId, qty: Number(d.qtyLaku) || 0, harga: Number(d.hargaJual) || 0, subtotal: Number(d.subtotal) || 0 })), totalSistem: Number(setoran.totalSistem) || 0, totalTunai: Number(setoran.totalTunai) || 0, totalQris: Number(setoran.totalQris) || 0, totalTransfer: Number(setoran.totalTransfer) || 0, pengeluaran: Number(setoran.pengeluaran) || 0 };
}
function apiGetStrukPesanan(token, id) {
  requireRole(token, ['admin']);
  const p = getSheetData('PesananPelanggan').find(x => String(x.id) === String(id));
  if (!p) return { success: false, message: 'Pesanan tidak ditemukan.' };
  const items = getSheetData('PesananPelangganItem').filter(it => String(it.pesananId) === String(id)).map(it => ({ nama: it.namaItem, qty: Number(it.qty) || 0, harga: Number(it.hargaJual) || 0, subtotal: Number(it.subtotal) || 0, dariBoxNama: it.dariBoxNama || '' }));
  return { success: true, id: p.id, tanggal: formatDate(p.tanggal), pelangganNama: p.pelangganNama || '', pelangganHp: p.pelangganHp || '', tanggalAmbil: formatDate(p.tanggalAmbil), metodeAmbil: p.metodeAmbil || 'Ambil', jenisAmbil: p.jenisAmbil || 'Terjadwal', alamat: p.alamat || '', items, totalSistem: Number(p.totalSistem) || 0, dp: Number(p.dp) || 0, sisaBayar: Number(p.sisaBayar) || 0, metodeBayar: p.metodeBayar || 'Tunai', status: p.status || 'Dipesan' };
}

// ============================================================
//  BACKUP/RESTORE
// ============================================================
function apiBackupAll(token) {
  requireRole(token, ['admin']);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = { _meta: { version: '5.10', exportedAt: new Date().toISOString() }, sheets: {} };
  ss.getSheets().forEach(sh => {
    const name = sh.getName();
    if (name === 'Sessions') return;
    const data = sh.getDataRange().getValues();
    const cleaned = data.map(row => row.map(c => c instanceof Date ? { _type: 'Date', v: c.toISOString() } : c));
    result.sheets[name] = cleaned;
  });
  return { success: true, filename: 'KueAsSyifa_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm') + '.json', data: JSON.stringify(result) };
}
function apiRestoreAll(token, dataStr, mode) {
  const sess = requireRole(token, ['admin']);
  if (!dataStr) return { success: false, message: 'Data kosong.' };
  let parsed;
  try { parsed = JSON.parse(dataStr); } catch (e) { return { success: false, message: 'Format JSON salah.' }; }
  if (!parsed.sheets) return { success: false, message: 'Struktur file salah.' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const isMerge = mode === 'merge';
    let count = 0;
    Object.keys(parsed.sheets).forEach(sheetName => {
      if (sheetName === 'Sessions') return;
      const rows = parsed.sheets[sheetName];
      if (!Array.isArray(rows) || !rows.length) return;
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) { sheet = ss.insertSheet(sheetName); sheet.setFrozenRows(1); }
      const cleaned = rows.map(row => row.map(c => (c && typeof c === 'object' && c._type === 'Date') ? new Date(c.v) : c));
      if (isMerge) {
        const dataRows = cleaned.slice(1);
        if (dataRows.length) sheet.getRange(sheet.getLastRow() + 1, 1, dataRows.length, dataRows[0].length).setValues(dataRows);
      } else {
        sheet.clear();
        sheet.getRange(1, 1, cleaned.length, cleaned[0].length).setValues(cleaned);
        sheet.setFrozenRows(1);
      }
      count++;
    });
    _clearSheetCache(); invalidateMasterCache();
    return { success: true, message: count + ' sheet di-restore.' };
  } finally { lock.releaseLock(); }
}

// ============================================================
//  HARGA TINGKAT
// ============================================================
function apiGetHargaTingkat(token, katalogId) {
  requireRole(token, ['admin']);
  let list = getSheetData('HargaTingkat');
  if (katalogId) list = list.filter(h => String(h.katalogId) === String(katalogId));
  return list.map(h => ({ id: h.id, katalogId: h.katalogId, tipePelanggan: h.tipePelanggan || 'Umum', minimalQty: Number(h.minimalQty) || 1, hargaJual: Number(h.hargaJual) || 0, aktif: String(h.aktif) !== 'false' && h.aktif !== false }));
}
function apiSaveHargaTingkat(token, item) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('HargaTingkat');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  if (!item.katalogId) return { success: false, message: 'Pilih item terlebih dahulu.' };
  const tipe = ['Umum','Reseller','Grosir'].indexOf(item.tipePelanggan) !== -1 ? item.tipePelanggan : 'Umum';
  const row = [item.id || ('HT' + Utilities.getUuid().slice(0,6).toUpperCase()), item.katalogId, tipe, toPosNum(item.minimalQty) || 1, toPosNum(item.hargaJual), item.aktif !== false];
  if (item.id) { for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(item.id)) { sheet.getRange(i+1,1,1,6).setValues([row]); _clearSheetCache(); return { success:true, message:'Harga diperbarui.' }; } return { success:false, message:'Harga tidak ditemukan.' }; }
  sheet.appendRow(row); _clearSheetCache();
  return { success:true, message:'Harga ditambahkan.' };
}
function apiDeleteHargaTingkat(token, id) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('HargaTingkat');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(id)) { sheet.deleteRow(i+1); _clearSheetCache(); return { success:true, message:'Harga dihapus.' }; }
  return { success:false, message:'Harga tidak ditemukan.' };
}

// ============================================================
//  TUTUP BUKU
// ============================================================
function apiGetTutupBukuList(token) {
  requireRole(token, ['admin']);
  return getSheetData('TutupBuku').map(t => ({ id: t.id, periode: t.periode || '', tanggalMulai: formatDate(t.tanggalMulai), tanggalAkhir: formatDate(t.tanggalAkhir), status: t.status || 'Open', ditutupBy: t.ditutupBy || '', ditutupAt: formatDateTime(t.ditutupAt), catatan: t.catatan || '' })).reverse();
}
function apiLockPeriode(token, payload) {
  const sess = requireRole(token, ['admin']);
  const dari = payload.dari, sampai = payload.sampai;
  if (!dari || !sampai) return { success: false, message: 'Periode wajib diisi.' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('TutupBuku');
    const id = 'TB' + Utilities.getUuid().slice(0,6).toUpperCase();
    sheet.appendRow([id, dari + ' s/d ' + sampai, new Date(dari), new Date(sampai), 'Locked', sess.username, new Date(), String(payload.catatan || '')]);
    const setoranSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Setoran');
    const sdata = setoranSheet.getDataRange().getValues();
    const sh = sdata[0];
    const iTgl = sh.indexOf('tanggal'), iLocked = sh.indexOf('locked');
    let count = 0;
    for (let i = 1; i < sdata.length; i++) {
      const t = formatDate(sdata[i][iTgl]);
      if (t >= dari && t <= sampai) { if (iLocked >= 0) setoranSheet.getRange(i + 1, iLocked + 1).setValue(true); count++; }
    }
    _clearSheetCache();
    return { success: true, message: 'Periode dikunci. ' + count + ' setoran terkunci.' };
  } finally { lock.releaseLock(); }
}
function apiUnlockPeriode(token, id) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('TutupBuku');
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const iId = h.indexOf('id'), iStatus = h.indexOf('status');
  const iMulai = h.indexOf('tanggalMulai'), iAkhir = h.indexOf('tanggalAkhir');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][iId]) === String(id)) {
      const dari = formatDate(data[i][iMulai]), sampai = formatDate(data[i][iAkhir]);
      sheet.getRange(i + 1, iStatus + 1).setValue('Open');
      const setoranSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Setoran');
      const sdata = setoranSheet.getDataRange().getValues();
      const sh = sdata[0];
      const iTgl = sh.indexOf('tanggal'), iLocked = sh.indexOf('locked');
      for (let k = 1; k < sdata.length; k++) {
        const t = formatDate(sdata[k][iTgl]);
        if (t >= dari && t <= sampai && iLocked >= 0) setoranSheet.getRange(k + 1, iLocked + 1).setValue(false);
      }
      _clearSheetCache();
      return { success: true, message: 'Periode dibuka.' };
    }
  }
  return { success: false, message: 'Periode tidak ditemukan.' };
}
function isPeriodeLocked(tgl) {
  const list = getSheetData('TutupBuku').filter(t => t.status === 'Locked');
  const t = formatDate(tgl);
  return list.some(p => t >= formatDate(p.tanggalMulai) && t <= formatDate(p.tanggalAkhir));
}

// ============================================================
//  NOTIFIKASI
// ============================================================
function apiGetNotifikasi(token, filter) {
  const sess = requireRole(token, ['admin', 'karyawan']);
  filter = filter || {};
  let list = getSheetData('Notifikasi').map(n => ({ id: n.id, tanggal: formatDateTime(n.tanggal), tipe: n.tipe || '', penerima: n.penerima || '', subjek: n.subjek || '', pesan: n.pesan || '', status: n.status || 'unread', refId: n.refId || '', channel: n.channel || 'in-app' }));
  if (sess.role === 'karyawan') list = list.filter(n => String(n.penerima) === String(sess.username) || String(n.penerima) === String(sess.id) || n.penerima === 'all');
  if (filter.status) list = list.filter(n => n.status === filter.status);
  return list.reverse().slice(0, 100);
}
function apiMarkNotifRead(token, id) {
  requireRole(token, ['admin', 'karyawan']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Notifikasi');
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const iId = h.indexOf('id'), iStatus = h.indexOf('status');
  for (let i = 1; i < data.length; i++) if (String(data[i][iId]) === String(id)) { sheet.getRange(i + 1, iStatus + 1).setValue('read'); _clearSheetCache(); return { success: true }; }
  return { success: false, message: 'Notifikasi tidak ditemukan.' };
}

// ============================================================
//  DISTRIBUSI
// ============================================================
function apiGetDistribusiHariIni(token, lapakId, tanggal) {
  const sess = requireRole(token, ['admin','karyawan']);
  const tgl = tanggal || todayStr();
  const target = lapakId || sess.lapakId || '';
  const katMap = {}; getSheetData('Katalog').forEach(k => katMap[k.id] = k);
  const supMap = {}; getSheetData('Suppliers').forEach(s => supMap[s.id] = s);
  const isAdmin = sess.role === 'admin';
  return getSheetData('Distribusi').filter(d => formatDate(d.tanggal) === tgl && String(d.lapakId) === String(target)).map(d => {
    const k = katMap[d.katalogId] || {};
    const sup = supMap[k.supplierId] || {};
    const base = { id:d.id, katalogId:d.katalogId, nama: k.nama || d.katalogId, supplierId: k.supplierId || '', supplierNama: sup.nama || '', tipeTransaksi: sup.tipeTransaksi || 'BeliPutus', hargaJual: Number(k.hargaJual) || 0, qtyDrop: Number(d.qtyDrop) || 0, droppedAt: formatDateTime(d.droppedAt) };
    if (isAdmin) base.hargaBeli = Number(k.hargaBeli) || 0;
    return base;
  });
}
function apiSaveDistribusi(token, lapakId, tanggal, items) {
  const sess = requireRole(token, ['admin']);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success:false, message:'Sistem sibuk. Coba lagi.' };
  try {
    const tgl = tanggal || todayStr();
    if (isPeriodeLocked(tgl)) return { success:false, message:'Periode ini terkunci.' };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Distribusi');
    const data = sheet.getDataRange().getValues();
    const h = data[0];
    const iLapak = h.indexOf('lapakId'), iKat = h.indexOf('katalogId'), iTgl = h.indexOf('tanggal'), iQty = h.indexOf('qtyDrop');
    for (let i = data.length - 1; i >= 1; i--) {
      if (formatDate(data[i][iTgl]) === tgl && String(data[i][iLapak]) === String(lapakId)) {
        catatKartuStok(data[i][iKat], lapakId, 'Drop-Reversal', 0, Number(data[i][iQty]) || 0, '', 'Revisi');
        sheet.deleteRow(i + 1);
      }
    }
    const rows = [];
    (items || []).forEach(it => {
      const qty = toPosNum(it.qtyDrop);
      if (qty > 0) {
        rows.push(['D' + Utilities.getUuid().slice(0, 8).toUpperCase(), tgl, lapakId, it.katalogId, qty, sess.username, new Date()]);
        catatKartuStok(it.katalogId, lapakId, 'Drop', qty, 0, '', 'Drop ke ' + lapakId);
      }
    });
    if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    _clearSheetCache();
    return { success: true, message: 'Drop tersimpan (' + rows.length + ' item).' };
  } finally { lock.releaseLock(); }
}

// ============================================================
//  ABSENSI LAPAK
// ============================================================
function apiBukaLapak(token) {
  const sess = requireRole(token, ['karyawan']);
  const tgl = todayStr();
  if (isPeriodeLocked(tgl)) return { success: false, message: 'Periode ini terkunci.' };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Absensi');
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const iLapak = h.indexOf('lapakId'), iTgl = h.indexOf('tanggal'), iTutup = h.indexOf('jamTutup');
  for (let i = 1; i < data.length; i++) {
    if (formatDate(data[i][iTgl]) === tgl && String(data[i][iLapak]) === String(sess.lapakId)) {
      if (!data[i][iTutup]) return { success: false, message: 'Lapak sudah dibuka.' };
    }
  }
  sheet.appendRow(['A' + Utilities.getUuid().slice(0, 8).toUpperCase(), tgl, sess.lapakId, sess.id, new Date(), '', '']);
  _clearSheetCache();
  return { success: true, message: 'Lapak dibuka.' };
}
function apiTutupLapak(token) {
  const sess = requireRole(token, ['karyawan']);
  const tgl = todayStr();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Absensi');
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const iLapak = h.indexOf('lapakId'), iTgl = h.indexOf('tanggal'), iTutup = h.indexOf('jamTutup');
  for (let i = data.length - 1; i >= 1; i--) {
    if (formatDate(data[i][iTgl]) === tgl && String(data[i][iLapak]) === String(sess.lapakId)) {
      if (data[i][iTutup]) return { success: false, message: 'Lapak sudah ditutup.' };
      sheet.getRange(i + 1, iTutup + 1).setValue(new Date());
      _clearSheetCache();
      return { success: true, message: 'Lapak ditutup.' };
    }
  }
  return { success: false, message: 'Lapak belum dibuka.' };
}
function apiGetAbsensiHariIni(token, lapakId, tanggal) {
  const sess = requireRole(token, ['admin','karyawan']);
  const tgl = tanggal || todayStr();
  const target = lapakId || sess.lapakId || '';
  const absen = getSheetData('Absensi').filter(a => formatDate(a.tanggal) === tgl && String(a.lapakId) === String(target));
  if (!absen.length) return { jamBuka: null, jamTutup: null, isOpen: false };
  const last = absen[absen.length - 1];
  return { jamBuka: last.jamBuka instanceof Date ? formatDateTime(last.jamBuka) : String(last.jamBuka || ''), jamTutup: last.jamTutup instanceof Date ? formatDateTime(last.jamTutup) : String(last.jamTutup || ''), isOpen: !!last.jamBuka && !last.jamTutup };
}

function apiGetKaryawanDashboard(token) {
  const sess = requireRole(token, ['karyawan']);
  const tgl = todayStr();
  const absen = apiGetAbsensiHariIni(token, sess.lapakId, tgl);
  const distribusi = apiGetDistribusiHariIni(token, sess.lapakId, tgl);
  const locked = nowHour() >= CONFIG.TIME_LOCK_HOUR || isPeriodeLocked(tgl);
  const sudahSubmit = getSheetData('Setoran').some(s => formatDate(s.tanggal) === tgl && String(s.lapakId) === String(sess.lapakId));
  const lapak = getSheetData('Lapak').find(l => l.id === sess.lapakId) || {};
  const absensiKaryawan = apiAbsensiHariIni(token);
  // v5.10 — Feature A: Titipan SELALU ditampilkan (bisa bayar kapan saja)
  const titipanData = apiGetTitipanKaryawan(token);
  return {
    tanggal: tgl, absen, distribusi, locked, sudahSubmit,
    cutoffHour: CONFIG.TIME_LOCK_HOUR,
    lapakNama: lapak.nama || sess.lapakId,
    katalogFull: apiGetKatalog(token),
    absensiKaryawan,
    titipanPending: titipanData.pending,
    bayarTitipanHariIni: titipanData.sudahBayar
  };
}
function apiKaryawanInputDrop(token, items) {
  const sess = requireRole(token, ['karyawan']);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success:false, message:'Sistem sibuk. Coba lagi.' };
  try {
    const tgl = todayStr();
    if (isPeriodeLocked(tgl)) return { success: false, message: 'Periode ini terkunci.' };
    const lapakId = sess.lapakId;
    if (!lapakId) return { success: false, message: 'Akun Anda tidak terkait dengan lapak mana pun.' };
    const sudahSubmit = getSheetData('Setoran').some(s => formatDate(s.tanggal) === tgl && String(s.lapakId) === String(lapakId));
    if (sudahSubmit) return { success: false, message: 'Laporan hari ini sudah dikirim.' };
    if (hasKonsinyasiRekapDraft(tgl, lapakId)) return { success: false, message: 'Stok drop tidak bisa diubah setelah tagihan titip jual disiapkan. Koreksi jumlah sisa pada form rekap.' };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Distribusi');
    const data = sheet.getDataRange().getValues();
    const h = data[0];
    const iLapak = h.indexOf('lapakId'), iKat = h.indexOf('katalogId'), iTgl = h.indexOf('tanggal'), iQty = h.indexOf('qtyDrop');
    const katalogMap = {};
    getSheetData('Katalog').forEach(k => { katalogMap[String(k.id)] = k; });
    const newRows = [];
    (items || []).forEach(it => {
      const qty = toPosNum(it.qtyDrop);
      if (qty <= 0) return;
      let found = false;
      for (let i = 1; i < data.length; i++) {
        if (formatDate(data[i][iTgl]) === tgl && String(data[i][iLapak]) === String(lapakId) && String(data[i][iKat]) === String(it.katalogId)) {
          const oldQty = Number(data[i][iQty]) || 0;
          const diff = qty - oldQty;
          sheet.getRange(i + 1, iQty + 1).setValue(qty);
          if (diff > 0) catatKartuStok(it.katalogId, lapakId, 'Drop-Adjust', diff, 0, '', 'Penyesuaian');
          else if (diff < 0) catatKartuStok(it.katalogId, lapakId, 'Drop-Adjust', 0, -diff, '', 'Penyesuaian');
          if (diff !== 0 && katalogMap[String(it.katalogId)]) {
            catatAuditStok(it.katalogId, katalogMap[String(it.katalogId)].nama, lapakId, oldQty, qty, sess);
          }
          found = true; break;
        }
      }
      if (!found) {
        newRows.push(['D' + Utilities.getUuid().slice(0, 8).toUpperCase(), tgl, lapakId, it.katalogId, qty, sess.username, new Date()]);
        catatKartuStok(it.katalogId, lapakId, 'Drop', qty, 0, '', 'Drop karyawan');
      }
    });
    if (newRows.length) sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    _clearSheetCache();
    return { success: true, message: 'Stok tersimpan.' };
  } finally { lock.releaseLock(); }
}
function apiEditDropStok(token, items) {
  const sess = requireRole(token, ['karyawan']);
  const lapakId = String(sess.lapakId || '');
  if (!lapakId) return { success: false, message: 'Akun belum terhubung ke lapak.' };
  if (!Array.isArray(items) || !items.length) return { success: false, message: 'Item stok wajib diisi.' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    const tgl = todayStr();
    if (nowHour() >= CONFIG.TIME_LOCK_HOUR) return { success: false, message: 'Input terkunci setelah jam ' + CONFIG.TIME_LOCK_HOUR + ':00.' };
    if (isPeriodeLocked(tgl)) return { success: false, message: 'Periode ini terkunci.' };
    if (getSheetData('Setoran').some(s => formatDate(s.tanggal) === tgl && String(s.lapakId) === lapakId)) {
      return { success: false, message: 'Stok tidak bisa diedit setelah laporan dikirim.' };
    }
    if (hasKonsinyasiRekapDraft(tgl, lapakId)) {
      return { success: false, message: 'Stok drop tidak bisa diubah setelah tagihan titip jual disiapkan. Koreksi jumlah sisa pada form rekap.' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const distribusiSheet = ss.getSheetByName('Distribusi');
    const data = distribusiSheet.getDataRange().getValues();
    const h = data[0].map(x => String(x).trim());
    const iId = h.indexOf('id'), iTgl = h.indexOf('tanggal'), iLapak = h.indexOf('lapakId');
    const iKat = h.indexOf('katalogId'), iQty = h.indexOf('qtyDrop');
    const iBy = h.indexOf('droppedBy'), iAt = h.indexOf('droppedAt');
    const katalog = {};
    getSheetData('Katalog').forEach(k => { katalog[String(k.id)] = k; });
    const seen = {};
    const updates = items.map(item => {
      const katalogId = String(item.katalogId || '');
      const qtyBaru = Number(item.qtyDrop);
      if (!katalogId || !katalog[katalogId]) throw new Error('Item stok tidak valid.');
      if (seen[katalogId]) throw new Error('Item stok duplikat.');
      seen[katalogId] = true;
      if (!isFinite(qtyBaru) || qtyBaru < 0 || Math.floor(qtyBaru) !== qtyBaru) {
        throw new Error('Jumlah stok harus bilangan bulat minimal 0.');
      }
      return { katalogId, qtyBaru, namaItem: katalog[katalogId].nama };
    });
    let edited = 0;

    for (const update of updates) {
      const { katalogId, qtyBaru, namaItem } = update;
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (formatDate(data[i][iTgl]) === tgl && String(data[i][iLapak]) === lapakId && String(data[i][iKat]) === katalogId) {
          rowIndex = i + 1;
          break;
        }
      }
      const stokLama = rowIndex > 0 ? Number(distribusiSheet.getRange(rowIndex, iQty + 1).getValue()) || 0 : 0;
      if (stokLama === qtyBaru) continue;

      if (rowIndex > 0) {
        distribusiSheet.getRange(rowIndex, iQty + 1).setValue(qtyBaru);
        if (iBy >= 0) distribusiSheet.getRange(rowIndex, iBy + 1).setValue(sess.username);
        if (iAt >= 0) distribusiSheet.getRange(rowIndex, iAt + 1).setValue(new Date());
      } else if (qtyBaru > 0) {
        distribusiSheet.appendRow(['D' + Utilities.getUuid().slice(0, 8).toUpperCase(), tgl, lapakId, katalogId, qtyBaru, sess.username, new Date()]);
      }

      const delta = qtyBaru - stokLama;
      const refId = 'SA' + Utilities.getUuid().slice(0, 8).toUpperCase();
      if (delta > 0) catatKartuStok(katalogId, lapakId, 'Drop-Edit', delta, 0, refId, 'Edit stok ' + stokLama + ' -> ' + qtyBaru);
      else catatKartuStok(katalogId, lapakId, 'Drop-Edit', 0, Math.abs(delta), refId, 'Edit stok ' + stokLama + ' -> ' + qtyBaru);
      catatAuditStok(katalogId, namaItem, lapakId, stokLama, qtyBaru, sess);
      edited++;
    }
    _clearSheetCache();
    return { success: true, message: edited ? edited + ' perubahan stok tersimpan dan tercatat.' : 'Tidak ada perubahan stok.' };
  } finally { lock.releaseLock(); }
}

// ============================================================
//  DRAFT REKAP — HITUNG TAGIHAN TITIP JUAL SEBELUM LAPORAN
// ============================================================
function hasKonsinyasiRekapDraft(tgl, lapakId) {
  const marker = 'DRAFT_REKAP|' + tgl + '|' + lapakId + '|';
  return getSheetData('Konsinyasi').some(k =>
    String(k.lapakId) === String(lapakId) &&
    String(k.catatan || '').indexOf(marker) === 0
  );
}

function apiSaveRekapDraft(token, payload) {
  const sess = requireRole(token, ['karyawan']);
  const tgl = (payload && payload.tanggal) || todayStr();
  if (tgl !== todayStr()) return { success:false, message:'Draft hanya bisa disiapkan untuk hari ini.' };
  if (nowHour() >= CONFIG.TIME_LOCK_HOUR || isPeriodeLocked(tgl)) return { success:false, message:'Input sudah terkunci.' };
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return { success:false, message:'Tidak ada item rekap.' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success:false, message:'Sistem sibuk. Coba lagi.' };
  try {
    ensureSupplierFinanceSheets_();
    if (getSheetData('Setoran').some(x => formatDate(x.tanggal)===tgl && String(x.lapakId)===String(sess.lapakId))) return {success:false,message:'Laporan hari ini sudah dikirim.'};
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dist = getSheetData('Distribusi').filter(x => formatDate(x.tanggal) === tgl && String(x.lapakId) === String(sess.lapakId));
    const distMap = {}; dist.forEach(x => distMap[String(x.katalogId)] = Number(x.qtyDrop) || 0);
    const katMap = {}; getSheetData('Katalog').forEach(x => katMap[String(x.id)] = x);
    const supMap = {}; getSheetData('Suppliers').forEach(x => supMap[String(x.id)] = x);
    const ks = ss.getSheetByName('Konsinyasi');
    if (!ks || ks.getLastRow() < 1) return { success:false, message:'Sheet Konsinyasi belum tersedia.' };
    const data = ks.getDataRange().getValues();
    const h = data[0].map(x => String(x).trim());
    const settlementMaps = getSupplierInvoiceSettlementMaps_();
    const ix = name => h.indexOf(name);
    const required = ['id','tanggal','supplierId','lapakId','katalogId','qtyLaku','hargaTitip','utang','status','setoranId','catatan'];
    if (required.some(x => ix(x) < 0)) return { success:false, message:'Struktur kolom Konsinyasi tidak sesuai.' };
    const existing = {};
    for (let r=1;r<data.length;r++) {
      const note=String(data[r][ix('catatan')] || '');
      const m=note.match(/^DRAFT_REKAP\|([^|]+)\|([^|]+)\|([^|]+)/);
      if (m && m[1]===tgl && m[2]===String(sess.lapakId)) {
        if (existing[m[3]]) return {success:false,message:'Ditemukan draft ganda untuk item '+m[3]+'. Hentikan proses dan minta admin memeriksa data.'};
        existing[m[3]]={row:r+1,status:String(data[r][ix('status')]||''),qty:Number(data[r][ix('qtyLaku')])||0,id:String(data[r][ix('id')])};
      }
    }
    const updates=[], additions=[], seenItems={};
    for (const it of items) {
      const id=String(it && it.katalogId || '').trim();
      if (!id) return {success:false,message:'Ada item tanpa ID katalog. Draft tidak disimpan.'};
      if (seenItems[id]) return {success:false,message:'Item katalog duplikat ditemukan: '+id+'. Hapus duplikat sebelum menyiapkan draft.'};
      seenItems[id]=true;
      const drop=distMap[id];
      if (drop===undefined) return {success:false,message:'Item tidak ditemukan pada drop hari ini: '+id};
      const rawSisa=Number(it.qtySisa);
      if (!Number.isFinite(rawSisa) || rawSisa<0 || rawSisa>drop || Math.floor(rawSisa)!==rawSisa) return {success:false,message:'Jumlah sisa tidak valid untuk item '+id+'. Gunakan bilangan bulat dari 0 sampai '+drop+'.'};
      const sisa=rawSisa;
      const k=katMap[id];
      if(!k) return {success:false,message:'Item tidak ditemukan di Katalog: '+id+'. Periksa data katalog sebelum menyiapkan draft.'};
      const sup=supMap[String(k.supplierId)];
      if(!sup || String(sup.tipeTransaksi||'BeliPutus')!=='TitipJual') continue;
      const laku=drop-sisa, harga=Number(k.hargaBeli)||0, utang=laku*harga;
      const old=existing[id];
      if(old) {
        // Draft belum dikirim: karyawan tetap bebas memperbaiki sisa meskipun
        // sudah ada pembayaran tunai atau kredit yang dialokasikan ke invoice ini.
        const settled=(settlementMaps.cashPaidById[String(old.id)]||0)+(settlementMaps.creditAppliedByInvoice[String(old.id)]||0)+(settlementMaps.statusSettledById[String(old.id)]||0);
        const remaining=Math.max(0,utang-settled);
        const nextStatus=(laku<=0&&settled<=0)?'Cancelled':(remaining>0?'Pending':'Bayar');
        updates.push(
          {row:old.row,col:ix('qtyLaku')+1,value:laku},
          {row:old.row,col:ix('hargaTitip')+1,value:harga},
          {row:old.row,col:ix('utang')+1,value:remaining},
          {row:old.row,col:ix('status')+1,value:nextStatus}
        );
      } else if(laku>0) {
        const obj={}; h.forEach((name,j)=>obj[name]='');
        obj.id='KN'+Utilities.getUuid().slice(0,8).toUpperCase(); obj.tanggal=new Date(tgl); obj.supplierId=k.supplierId; obj.lapakId=sess.lapakId; obj.katalogId=id; obj.qtyLaku=laku; obj.hargaTitip=harga; obj.utang=utang; obj.status='Pending'; obj.catatan='DRAFT_REKAP|'+tgl+'|'+sess.lapakId+'|'+id;
        additions.push(h.map(name=>obj[name]));
      }
    }
    const journal = beginWriteJournal(['Konsinyasi']);
    try {
      updates.forEach(u => journalSetValue(journal, ks, u.row, u.col, u.value));
      if (additions.length) {
        const additionObjects = additions.map(row => { const obj = {}; h.forEach((name, index) => { if (name) obj[name] = row[index]; }); return obj; });
        appendObjectsByHeaders(ks, additionObjects);
      }
      // Jangan terapkan kredit pada draft yang belum dikirim; karyawan masih bebas mengoreksi stok sebelum submit.
    } catch (writeError) {
      try { rollbackWriteJournal(journal); }
      catch (rollbackError) { console.error('Gagal rollback draft rekap:', rollbackError.message); return { success:false, message:'Penyimpanan draft gagal dan pemulihan otomatis tidak sepenuhnya berhasil. Hentikan proses dan minta admin memeriksa data. Detail: ' + writeError.message + ' | ' + rollbackError.message }; }
      _clearSheetCache();
      return { success:false, message:'Penyimpanan draft gagal. Perubahan telah dibatalkan: ' + writeError.message };
    }
    _clearSheetCache();
    return {success:true,message:'Tagihan titip jual berhasil disiapkan. Periksa dan bayar setiap supplier sebelum mengirim laporan.',created:additions.length,updated:updates.length};
  } finally { lock.releaseLock(); }
}

// ============================================================
//  SUBMIT REKAP (dengan bayar titipan + carry-over)
// ============================================================
function apiSubmitRekap(token, payload) {
  const sess = requireRole(token, ['karyawan']);
  const tgl = (payload && payload.tanggal) || todayStr();
  if (tgl !== todayStr()) return { success: false, message: 'Hanya bisa submit untuk hari ini.' };
  if (nowHour() >= CONFIG.TIME_LOCK_HOUR) return { success: false, message: 'Input terkunci setelah jam ' + CONFIG.TIME_LOCK_HOUR + ':00.' };
  if (isPeriodeLocked(tgl)) return { success: false, message: 'Periode ini terkunci.' };
  ensureSupplierFinanceSheets_();
  const pendingCorrections = getSheetData('SupplierCorrectionRequests').filter(r=>String(r.lapakId)===String(sess.lapakId)&&String(r.status)==='Pending');
  if(pendingCorrections.length) return {success:false,message:'Masih ada '+pendingCorrections.length+' permintaan koreksi invoice yang menunggu keputusan admin. Selesaikan terlebih dahulu sebelum mengirim laporan berikutnya.'};
  const draftMarker = 'DRAFT_REKAP|' + tgl + '|' + sess.lapakId + '|';
  const konsinyasiDraft = getSheetData('Konsinyasi').filter(k => String(k.lapakId)===String(sess.lapakId) && String(k.catatan||'').indexOf(draftMarker)===0 && String(k.status)==='Pending');
  if (konsinyasiDraft.length) return {success:false,message:'Masih ada tagihan titip jual yang belum dibayar. Lunasi terlebih dahulu sebelum mengirim laporan.'};
  const items = Array.isArray(payload.items) ? payload.items : [];
  const pengeluaranList = Array.isArray(payload.pengeluaran) ? payload.pengeluaran.slice() : [];
  const totalTunai = toPosNum(payload.totalTunai);
  const totalQris = toPosNum(payload.totalQris);
  const totalTransfer = toPosNum(payload.totalTransfer);
  if (!items.length) return { success: false, message: 'Tidak ada item yang dilaporkan.' };
  const seenCatalogIds = {};
  for (const it of items) {
    const catalogId = String(it && it.katalogId || '').trim();
    if (!catalogId) return { success:false, message:'Ada item tanpa ID katalog. Laporan tidak dikirim.' };
    if (seenCatalogIds[catalogId]) return { success:false, message:'Item katalog duplikat ditemukan: ' + catalogId + '. Hapus duplikat sebelum mengirim.' };
    seenCatalogIds[catalogId] = true;
  }
  const distMap = {};
  getSheetData('Distribusi').filter(d => formatDate(d.tanggal) === tgl && String(d.lapakId) === String(sess.lapakId)).forEach(d => distMap[d.katalogId] = Number(d.qtyDrop) || 0);
  const katMap = {}; getSheetData('Katalog').forEach(k => katMap[k.id] = k);
  const supMap = {}; getSheetData('Suppliers').forEach(s => supMap[s.id] = s);
  const htMap = {};
  getSheetData('HargaTingkat').filter(h => String(h.aktif) !== 'false' && h.aktif !== false).forEach(h => {
    const key = h.katalogId + '_' + (h.tipePelanggan || 'Umum');
    if (!htMap[key]) htMap[key] = [];
    htMap[key].push(h);
  });
  let totalSistem = 0;
  const details = [];
  for (const it of items) {
    const qtyDrop = distMap[it.katalogId];
    if (qtyDrop === undefined) return { success: false, message: 'Item tidak ditemukan di distribusi hari ini: ' + it.katalogId };
    const k = katMap[it.katalogId];
    if (!k) return { success:false, message:'Item tidak ditemukan di Katalog: ' + it.katalogId + '. Periksa data katalog sebelum mengirim.' };
    const rawQtySisa = Number(it.qtySisa);
    if (!Number.isFinite(rawQtySisa) || rawQtySisa < 0 || rawQtySisa > qtyDrop || Math.floor(rawQtySisa) !== rawQtySisa) {
      return { success:false, message:'Jumlah sisa tidak valid untuk item ' + (k.nama || it.katalogId) + '. Nilai harus bilangan bulat dari 0 sampai ' + qtyDrop + '.' };
    }
    const qtySisa = rawQtySisa;
    const qtyLaku = qtyDrop - qtySisa;
    const tipe = it.tipePelanggan || 'Umum';
    const key = it.katalogId + '_' + tipe;
    let hargaJual = Number(k.hargaJual) || 0;
    if (htMap[key]) {
      const matches = htMap[key].filter(h => qtyLaku >= (Number(h.minimalQty) || 1)).sort((a, b) => (Number(b.minimalQty) || 1) - (Number(a.minimalQty) || 1));
      if (matches.length) hargaJual = Number(matches[0].hargaJual) || hargaJual;
    }
    const subtotal = qtyLaku * hargaJual;
    totalSistem += subtotal;
    details.push({ katalogId: it.katalogId, qtyDrop, qtySisa, qtyLaku, hargaJual, hargaBeli: Number(k.hargaBeli) || 0, subtotal, tipePelanggan: tipe });
  }

  // v5.10 — Feature A: Ambil SEMUA bayar titipan yang belum ter-link (carry-over bila bayar setelah submit)
  let bayarTitipanHariIni = getSheetData('BayarTitipanKaryawan').filter(b =>
    String(b.lapakId) === String(sess.lapakId) &&
    (!b.setoranId || b.setoranId === '') &&
    String(b.status || 'Active') === 'Active'
  );
  // Pembayaran supplier adalah metadata metode pembayaran, bukan potongan kedua dari penerimaan karyawan.

  for (const p of pengeluaranList) {
    const nominal = Number(p && p.nominal);
    if (!Number.isFinite(nominal) || nominal < 0) return { success:false, message:'Nominal pengeluaran tidak valid. Periksa kembali daftar pengeluaran.' };
  }
  const totalPengeluaran = pengeluaranList.reduce((s, p) => s + toPosNum(p.nominal), 0);
  const selisih = totalSistem - (totalTunai + totalQris + totalTransfer);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    // Ulangi pemeriksaan antrean koreksi di dalam lock agar pengajuan dan submit
    // yang terjadi hampir bersamaan tidak dapat saling melewati.
    _clearSheetCache('SupplierCorrectionRequests');
    const unresolvedCorrections=getSheetData('SupplierCorrectionRequests').filter(r=>String(r.lapakId)===String(sess.lapakId)&&String(r.status)==='Pending');
    if(unresolvedCorrections.length)return {success:false,message:'Masih ada permintaan koreksi invoice yang menunggu keputusan admin. Laporan belum dapat dikirim.'};
    // Refresh pembayaran setelah lock diperoleh agar pembayaran supplier yang terjadi
    // bersamaan dengan submit tidak tertinggal dari perhitungan maupun tautan setoran.
    // Cache lokal eksekusi harus dibuang agar pembacaan ini benar-benar membaca sheet terbaru.
    _clearSheetCache('BayarTitipanKaryawan');
    _clearSheetCache('Konsinyasi');
    bayarTitipanHariIni = getSheetData('BayarTitipanKaryawan').filter(b => String(b.lapakId) === String(sess.lapakId) && (!b.setoranId || b.setoranId === '') && String(b.status || 'Active') === 'Active');
    const totalTitipanTunai = bayarTitipanHariIni.filter(b => String(b.metode || 'Tunai') === 'Tunai').reduce((sum,b) => sum + toPosNum(b.totalBayar),0);
    const totalTitipanQris = bayarTitipanHariIni.filter(b => String(b.metode || '') === 'QRIS').reduce((sum,b) => sum + toPosNum(b.totalBayar),0);
    const totalTitipanTransfer = bayarTitipanHariIni.filter(b => String(b.metode || '') === 'Transfer').reduce((sum,b) => sum + toPosNum(b.totalBayar),0);
    // Metode pembayaran supplier hanya metadata. Pembayaran supplier tidak
    // dipotong lagi dari setoran karyawan; dampak laba bersih dicatat di Kas Utama.
    const uangDisetor = totalTunai - totalPengeluaran;
    const qrisBersih = totalQris;
    const transferBersih = totalTransfer;
    if (uangDisetor < 0) return { success:false, message:'Pengeluaran operasional melebihi penerimaan tunai.' };
    const expectedSetoran = uangDisetor + qrisBersih + transferBersih;
    const unpaidDraft = getSheetData('Konsinyasi').filter(k => String(k.lapakId)===String(sess.lapakId) && String(k.catatan||'').indexOf(draftMarker)===0 && String(k.status)==='Pending');
    if (unpaidDraft.length) return {success:false,message:'Masih ada tagihan titip jual yang belum dibayar. Lunasi terlebih dahulu sebelum mengirim laporan.'};
    if (getSheetData('Setoran').some(x => formatDate(x.tanggal)===tgl && String(x.lapakId)===String(sess.lapakId))) return {success:false,message:'Laporan hari ini sudah dikirim.'};

    // Pastikan draft yang pernah disiapkan/dibatalkan/dibayar sesuai dengan angka laporan final.
    const draftRows = getSheetData('Konsinyasi').filter(k =>
      String(k.lapakId) === String(sess.lapakId) &&
      String(k.catatan || '').indexOf(draftMarker) === 0
    );
    for (const d of details) {
      const k = katMap[d.katalogId];
      const supplier = k && supMap[k.supplierId];
      if (!supplier || (supplier.tipeTransaksi || 'BeliPutus') !== 'TitipJual') continue;
      const marker = draftMarker + d.katalogId;
      const draft = draftRows.find(x => String(x.catatan || '').indexOf(marker) === 0);
      if (!draft) continue; // kompatibilitas untuk item yang belum pernah disiapkan sebagai draft
      const statusValid = d.qtyLaku > 0 ? String(draft.status)==='Bayar' : ['Cancelled','Bayar'].includes(String(draft.status));
      if (!statusValid ||
          (Number(draft.qtyLaku) || 0) !== d.qtyLaku ||
          (Number(draft.utang) || 0) !== 0) {
        return {success:false,message:'Jumlah sisa atau tagihan '+(k.nama || d.katalogId)+' berubah setelah tagihan disiapkan. Hitung ulang sisa dan tagihan sebelum mengirim laporan.'};
      }
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const setoranSheet = ss.getSheetByName('Setoran');
    const detailSheet = ss.getSheetByName('SetoranDetail');
    const pengSheet = ss.getSheetByName('PengeluaranLapak');
    const requiredSetoran = ['id','tanggal','lapakId','userId','totalTunai','totalQris','totalTransfer','totalSistem','pengeluaran','expectedSetoran','uangDisetor','selisih','status'];
    if (!hasHeaders(setoranSheet, requiredSetoran)) {
      return { success:false, message:'Struktur Setoran masih menggunakan format lama. Submit ditahan agar data historis tidak tertimpa. Tambahkan kolom versi baru secara non-destruktif pada Spreadsheet testing sebelum uji submit.' };
    }
    const detailHeaders = detailSheet.getRange(1, 1, 1, detailSheet.getLastColumn()).getDisplayValues()[0].map(x => String(x).trim());
    const hasQtyLaku = detailHeaders.indexOf('qtyLaku') >= 0 || detailHeaders.indexOf('terjual') >= 0;
    const hasQtySisa = detailHeaders.indexOf('qtySisa') >= 0 || detailHeaders.indexOf('sisa') >= 0;
    if (!hasHeaders(detailSheet, ['id','setoranId','katalogId','hargaJual','hargaBeli','subtotal']) || !hasQtyLaku || !hasQtySisa) {
      return { success:false, message:'Struktur SetoranDetail tidak dikenali. Submit ditahan agar riwayat penjualan tetap aman.' };
    }
    const stokSheet = ss.getSheetByName('KartuStok');
    const konsinyasiSheet = ss.getSheetByName('Konsinyasi');
    const bayarSheet = ss.getSheetByName('BayarTitipanKaryawan');
    if (!hasHeaders(pengSheet, ['id','setoranId','keterangan','kategori','nominal']) ||
        !hasHeaders(konsinyasiSheet, ['id','tanggal','supplierId','lapakId','katalogId','qtyLaku','hargaTitip','utang','status','kasId','bayarAt','bayarBy','setoranId','catatan']) ||
        !hasHeaders(stokSheet, ['id','tanggal','katalogId','lapakId','tipe','masuk','keluar','saldo','refId','keterangan']) ||
        !hasHeaders(bayarSheet, ['id','setoranId','lapakId','supplierId','totalBayar','konsinyasiIds','status'])) {
      return { success:false, message:'Struktur sheet pendukung belum lengkap. Tidak ada transaksi yang ditulis.' };
    }
    const setoranId = 'S' + Utilities.getUuid().slice(0, 8).toUpperCase() + Date.now();
    ensureSupplierFinanceSheets_();
    const journal = beginWriteJournal(['Setoran','SetoranDetail','BayarTitipanKaryawan','KartuStok','PengeluaranLapak','Konsinyasi','SupplierCreditLedger']);
    try {
    appendObjectsByHeaders(setoranSheet, [{
      id:setoranId, tanggal:tgl, lapakId:sess.lapakId, userId:sess.id,
      totalTunai, totalQris, totalTransfer, totalSistem, pengeluaran:totalPengeluaran,
      expectedSetoran, uangDisetor, selisih, status:'pending',
      approvedAt:'', approvedBy:'', catatan:String(payload.catatan || ''),
      editHistory:'', locked:false, lapak:sess.lapakId, totalCash:totalTunai
    }]);
    const rows = details.map(d => ({
      id:'D' + Utilities.getUuid().slice(0, 8).toUpperCase(), setoranId, katalogId:d.katalogId,
      qtyDrop:d.qtyDrop, qtySisa:d.qtySisa, qtyLaku:d.qtyLaku,
      sisa:d.qtySisa, terjual:d.qtyLaku, hargaJual:d.hargaJual,
      hargaBeli:d.hargaBeli, subtotal:d.subtotal, tipePelanggan:d.tipePelanggan
    }));
    if (rows.length) appendObjectsByHeaders(detailSheet, rows);

    if (bayarTitipanHariIni.length) {
      const bayarSheet = ss.getSheetByName('BayarTitipanKaryawan');
      if (bayarSheet) {
        const bData = bayarSheet.getDataRange().getValues();
        const bH = bData[0].map(x => String(x).trim());
        const bId = bH.indexOf('id'), bSetoran = bH.indexOf('setoranId');
        bayarTitipanHariIni.forEach(b => {
          for (let i = 1; i < bData.length; i++) {
            if (String(bData[i][bId]) === String(b.id)) {
              if (bSetoran >= 0) journalSetValue(journal, bayarSheet, i + 1, bSetoran + 1, setoranId);
              break;
            }
          }
        });
      }
    }

    details.forEach(d => { if (d.qtyLaku > 0) catatKartuStok(d.katalogId, sess.lapakId, 'Terjual', 0, d.qtyLaku, setoranId, 'Laku'); });
    if (pengeluaranList.length) {
      const pRows = pengeluaranList.map(p => ({id:'P'+Utilities.getUuid().slice(0,8).toUpperCase(),setoranId,keterangan:String(p.keterangan||''),kategori:String(p.kategori||'Lain'),nominal:toPosNum(p.nominal)}));
      appendObjectsByHeaders(pengSheet,pRows);
    }
    const konsinyasiSheet = ss.getSheetByName('Konsinyasi');
    if (konsinyasiSheet) {
      const kRows = [];
      details.forEach(d => {
        const k = katMap[d.katalogId]; if (!k) return;
        const supplier = supMap[k.supplierId]; if (!supplier) return;
        if ((supplier.tipeTransaksi || 'BeliPutus') !== 'TitipJual') return;
        const marker = 'DRAFT_REKAP|' + tgl + '|' + sess.lapakId + '|' + d.katalogId;
        const existingDraft = getSheetData('Konsinyasi').find(x => String(x.catatan||'').indexOf(marker)===0);
        if (existingDraft) {
          const draftData = konsinyasiSheet.getDataRange().getValues();
          const draftHeaders = draftData[0].map(x=>String(x).trim());
          const iDraftId=draftHeaders.indexOf('id'), iDraftSetoran=draftHeaders.indexOf('setoranId');
          if(iDraftSetoran>=0) for(let ri=1;ri<draftData.length;ri++) if(String(draftData[ri][iDraftId])===String(existingDraft.id)){journalSetValue(journal, konsinyasiSheet, ri+1, iDraftSetoran+1, setoranId);break;}
          return;
        }
        // Hanya buat invoice baru bila ada qty terjual; invoice draft nol tetap
        // ditautkan di atas agar alokasi pembayaran dan kreditnya bisa diaudit.
        if (d.qtyLaku <= 0) return;
        const hargaTitip = Number(k.hargaBeli) || 0;
        const utang = d.qtyLaku * hargaTitip;
        kRows.push({id:'KN'+Utilities.getUuid().slice(0,8).toUpperCase(),tanggal:new Date(),supplierId:k.supplierId,lapakId:sess.lapakId,katalogId:d.katalogId,qtyLaku:d.qtyLaku,hargaTitip,utang,status:'Pending',kasId:'',bayarAt:'',bayarBy:'',setoranId,catatan:''});
      });
      if (kRows.length) appendObjectsByHeaders(konsinyasiSheet,kRows);
    }

    // Bila pembayaran tunai/kredit yang sudah dialokasikan melebihi kewajiban
    // final setelah koreksi draft, selisih menjadi saldo supplier setelah laporan dikirim.
    _clearSheetCache('Konsinyasi');_clearSheetCache('BayarTitipanKaryawan');_clearSheetCache('SupplierCreditLedger');
    const settlementMaps=getSupplierInvoiceSettlementMaps_();
    const existingCreditKeys=new Set((getSheetData('SupplierCreditLedger')||[]).map(x=>String(x.requestKey||'')));
    const surplusCredits=[];
    (getSheetData('Konsinyasi')||[]).filter(k=>String(k.setoranId)===String(setoranId)).forEach(k=>{
      const supplier=supMap[String(k.supplierId)];
      if(!supplier||(supplier.tipeTransaksi||'BeliPutus')!=='TitipJual')return;
      const invoiceId=String(k.id),gross=(Number(k.qtyLaku)||0)*(Number(k.hargaTitip)||0);
      const paid=(settlementMaps.cashPaidById[invoiceId]||0)+(settlementMaps.creditAppliedByInvoice[invoiceId]||0)+(settlementMaps.statusSettledById[invoiceId]||0);
      const surplus=Math.max(0,paid-gross);
      const requestKey='SETORAN-SURPLUS:'+setoranId+':'+invoiceId;
      if(surplus>0&&!existingCreditKeys.has(requestKey)){
        surplusCredits.push({id:'SCL'+Utilities.getUuid().slice(0,8).toUpperCase(),createdAt:new Date(),supplierId:String(k.supplierId),eventType:'CREDIT',amount:surplus,correctionId:'',sourceInvoiceId:invoiceId,referenceInvoiceId:'',createdBy:sess.username,notes:'Saldo lebih dari koreksi draft sebelum submit setoran '+setoranId,requestKey});
        existingCreditKeys.add(requestKey);
      }
    });
    if(surplusCredits.length)appendObjectsByHeaders(ss.getSheetByName('SupplierCreditLedger'),surplusCredits);
    _clearSheetCache('SupplierCreditLedger');
    applySupplierCreditsToPendingInvoices_('',sess.username,journal);
    } catch (writeError) {
      try {
        rollbackWriteJournal(journal);
      } catch (rollbackError) {
        console.error('Gagal rollback submit rekap:', rollbackError.message);
        return { success:false, message:'Penulisan transaksi gagal dan pemulihan otomatis tidak sepenuhnya berhasil. HENTIKAN transaksi lanjutan dan minta pemeriksaan admin. Detail: ' + writeError.message + ' | ' + rollbackError.message };
      }
      _clearSheetCache();
      return { success:false, message:'Penulisan transaksi gagal. Perubahan pada transaksi ini telah dibatalkan: ' + writeError.message };
    }
    _clearSheetCache();
    const lapak = getSheetData('Lapak').find(l => String(l.id) === String(sess.lapakId)) || {};
    try { notifySetoranMasuk({ id: setoranId, expectedSetoran, totalSistem, pengeluaran: totalPengeluaran }, lapak.nama || sess.lapakId); } catch (notifyError) { console.error('Notifikasi setoran gagal, transaksi tetap tersimpan:', notifyError.message); }
    return { success: true, id: setoranId, selisih };
  } finally { lock.releaseLock(); }
}

// ============================================================
//  TITIP JUAL — BAYAR LANGSUNG OLEH KARYAWAN (v5.10)
// ============================================================
function apiGetTitipanKaryawan(token) {
  const sess = requireRole(token, ['karyawan']);
  const lapakId = sess.lapakId;
  if (!lapakId) return { pending: [], sudahBayar: [] };
  const settlementMaps=getSupplierInvoiceSettlementMaps_();
  ensureSupplierFinanceSheets_();
  const correctionByInvoice={};
  getSheetData('SupplierCorrectionRequests').filter(r=>String(r.lapakId)===String(lapakId)).forEach(r=>{correctionByInvoice[String(r.konsinyasiId)]={id:r.id,status:r.status||'Pending'};});

  const supMap = {};
  getSheetData('Suppliers').forEach(s => { supMap[String(s.id)] = s.nama; });
  const katMap = {};
  getSheetData('Katalog').forEach(k => { katMap[String(k.id)] = k.nama; });

  const konsinyasiRows = (getSheetData('Konsinyasi') || [])
    .filter(k => String(k.lapakId) === String(lapakId));
  const bayarSheet = getSheetData('BayarTitipanKaryawan') || [];
  const activePayments = bayarSheet.filter(b =>
    String(b.lapakId) === String(lapakId) &&
    String(b.status || 'Active') === 'Active'
  );

  // Rekonsiliasi pembayaran per ID invoice. Kolom Konsinyasi.utang normalnya
  // sudah berisi saldo setelah pembayaran; MIN mencegah saldo itu dikurangi
  // untuk kedua kalinya, tetapi tetap memperbaiki data lama yang belum ter-update.
  const paidAmountById = {};
  const paidIds = {};
  const konsinyasiById = {};
  konsinyasiRows.forEach(k => { konsinyasiById[String(k.id)] = k; });
  activePayments.forEach(b => {
    const raw = String(b.konsinyasiIds || '');
    if (raw.trim().startsWith('[')) {
      try {
        JSON.parse(raw).forEach(x => {
          if (!x || !x.id) return;
          const id = String(x.id);
          paidIds[id] = true;
          const amount = Number(x.amount);
          if (Number.isFinite(amount) && amount > 0) {
            paidAmountById[id] = (paidAmountById[id] || 0) + amount;
          }
        });
      } catch (e) {}
    } else {
      // Format lama hanya menyimpan daftar ID. Alokasikan totalBayar sesuai
      // urutan invoice yang tersimpan, sama seperti urutan pembayaran lama.
      const ids = raw.split(',').map(x => x.trim()).filter(Boolean);
      let remainingPayment = Math.max(0, Number(b.totalBayar) || 0);
      ids.forEach(id => {
        paidIds[id] = true;
        if (remainingPayment <= 0) return;
        const invoice = konsinyasiById[id];
        if (!invoice) return;
        const original = (Number(invoice.qtyLaku) || 0) * (Number(invoice.hargaTitip) || 0);
        const capacity = original > 0 ? Math.max(0, original - (paidAmountById[id] || 0)) : Math.max(0, Number(invoice.utang) || 0);
        const allocated = Math.min(capacity, remainingPayment);
        if (allocated > 0) {
          paidAmountById[id] = (paidAmountById[id] || 0) + allocated;
          remainingPayment -= allocated;
        }
      });
    }
  });

  const detailMap = {};
  (getSheetData('SetoranDetail') || []).forEach(d => {
    detailMap[String(d.setoranId) + '|' + String(d.katalogId)] = d;
  });

  const grouped = {};
  konsinyasiRows.forEach(k => {
    if (String(k.status) !== 'Pending') return;
    const id = String(k.id);
    const currentUtang = Math.max(0, Number(k.utang) || 0);
    const originalUtang = (Number(k.qtyLaku) || 0) * (Number(k.hargaTitip) || 0);
    const saldoTerhitung = originalUtang > 0
      ? Math.max(0, originalUtang - (paidAmountById[id] || 0))
      : currentUtang;
    const saldo = originalUtang > 0 ? Math.min(currentUtang, saldoTerhitung) : currentUtang;
    // Invoice yang sudah lunas berdasarkan alokasi pembayaran tidak boleh
    // tampil lagi sebagai tagihan, meskipun status Konsinyasi terlambat berubah.
    if (saldo <= 0) return;

    const sid = String(k.supplierId);
    if (!grouped[sid]) grouped[sid] = {
      supplierId: sid, supplierNama: supMap[sid] || sid, total: 0, count: 0, items: []
    };
    grouped[sid].total += saldo;
    grouped[sid].count++;
    const detail = detailMap[String(k.setoranId) + '|' + String(k.katalogId)] || {};
    grouped[sid].items.push({
      id: k.id,
      tanggal: formatDate(k.tanggal),
      nama: katMap[String(k.katalogId)] || k.katalogId,
      qtyLaku: Number(k.qtyLaku) || 0,
      qtyDrop: Number(detail.qtyDrop) || (Number(k.qtyLaku) || 0),
      qtySisa: Number(detail.qtySisa) || 0,
      hargaTitip: Number(k.hargaTitip) || 0,
      utang: saldo,
      setoranId: String(k.setoranId||''),
      currentQtyLaku: Number(k.qtyLaku)||0,
      canAdjust: !paidIds[id] && !(settlementMaps.creditAppliedByInvoice[id]>0) && !String(k.setoranId || ''),
      correctionRequestId: (correctionByInvoice[id]||{}).id||'',
      correctionRequestStatus: (correctionByInvoice[id]||{}).status||''
    });
  });
  const creditMap=getSupplierCreditBalanceMap_();
  const pending = Object.values(grouped).map(item=>Object.assign(item,{saldoLebihAvailable:(creditMap[String(item.supplierId)]||{balance:0}).balance})).sort((a, b) => b.total - a.total);

  // Riwayat pembayaran aktif yang belum ditautkan ke setoran.
  const tgl = todayStr();
  const sudahBayar = activePayments
    .filter(b => formatDate(b.tanggal) === tgl || !b.setoranId)
    .map(b => ({
      id: b.id,
      supplierId: b.supplierId,
      supplierNama: supMap[String(b.supplierId)] || b.supplierId,
      total: Number(b.totalBayar) || 0,
      tanggal: formatDate(b.tanggal),
      noNota: b.noNota || '',
      metode: b.metode || 'Tunai',
      catatan: b.catatan || '',
      setoranId: b.setoranId || '',
      canCancel: !b.setoranId,
      createdAt: formatDateTime(b.createdAt)
    }));

  const correctionCandidates = konsinyasiRows
    .filter(k=>['Bayar','Cancelled'].includes(String(k.status))&&String(k.setoranId||''))
    .sort((a,b)=>(new Date(b.tanggal).getTime()||0)-(new Date(a.tanggal).getTime()||0))
    .slice(0,100)
    .map(k=>{
      const id=String(k.id),detail=detailMap[String(k.setoranId)+'|'+String(k.katalogId)]||{},request=correctionByInvoice[id]||{};
      return {
        id,tanggal:formatDate(k.tanggal),supplierId:String(k.supplierId),supplierNama:supMap[String(k.supplierId)]||String(k.supplierId),
        katalogId:String(k.katalogId),nama:katMap[String(k.katalogId)]||String(k.katalogId),
        qtyLaku:Number(k.qtyLaku)||0,currentQtyLaku:Number(k.qtyLaku)||0,
        qtyDrop:Number(detail.qtyDrop)||Number(k.qtyLaku)||0,qtySisa:Number(detail.qtySisa)||0,
        hargaTitip:Number(k.hargaTitip)||0,utang:Number(k.utang)||0,status:String(k.status),
        setoranId:String(k.setoranId),correctionRequestId:request.id||'',correctionRequestStatus:request.status||''
      };
    });
  return { pending, sudahBayar, correctionCandidates };
}
function apiKaryawanBayarSupplier(token, payload) {
  const sess = requireRole(token, ['karyawan']);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success:false, message:'Sistem sibuk. Coba lagi.' };
  try {
    payload = payload || {};
    const supplierId = String(payload.supplierId || '').trim();
    if (!supplierId) return { success:false, message:'Supplier wajib dipilih.' };
    const lapakId = sess.lapakId, tgl = todayStr();
    if (isPeriodeLocked(tgl)) return { success:false, message:'Periode ini terkunci.' };
    const requestedPayment = Number(payload.nominalBayar);
    if (!Number.isSafeInteger(requestedPayment) || requestedPayment <= 0)
      return {success:false,message:'Nominal pembayaran harus bilangan bulat lebih dari 0.'};
    const metode = String(payload.metode || 'Tunai').trim();
    if (!['Tunai','QRIS','Transfer'].includes(metode)) return {success:false,message:'Metode pembayaran harus Tunai, QRIS, atau Transfer.'};

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ks = ss.getSheetByName('Konsinyasi'), bayarSheet = ss.getSheetByName('BayarTitipanKaryawan');
    if (!hasHeaders(ks, ['id','supplierId','lapakId','status','utang','bayarAt','bayarBy','catatan']) ||
        !hasHeaders(bayarSheet, ['id','tanggal','lapakId','supplierId','userName','totalBayar','konsinyasiIds','setoranId','createdAt','catatan','noNota','metode','status'])) {
      return {success:false,message:'Struktur sheet pembayaran titipan belum lengkap. Tidak ada perubahan yang dilakukan.'};
    }
    ensureSupplierFinanceSheets_();
    const data = ks.getDataRange().getValues(), h = data[0].map(x => String(x).trim());
    const iId=h.indexOf('id'), iSupplier=h.indexOf('supplierId'), iLapak=h.indexOf('lapakId');
    const iStatus=h.indexOf('status'), iUtang=h.indexOf('utang'), iBayarAt=h.indexOf('bayarAt');
    const iBayarBy=h.indexOf('bayarBy'), iCatatan=h.indexOf('catatan');
    const iQtyLaku=h.indexOf('qtyLaku'), iHargaTitip=h.indexOf('hargaTitip');
    const iSetoran=h.indexOf('setoranId'), iKatalog=h.indexOf('katalogId');

    // Rekonsiliasi pembayaran kas yang sudah pernah dialokasikan ke invoice ini.
    const paidAmountById = {};
    const activePayments = (getSheetData('BayarTitipanKaryawan') || []).filter(b =>
      String(b.lapakId)===String(lapakId) && String(b.supplierId)===supplierId &&
      String(b.status || 'Active')==='Active'
    );
    activePayments.forEach(b => {
      const raw=String(b.konsinyasiIds || '');
      if(raw.trim().startsWith('[')){
        try {
          JSON.parse(raw).forEach(x=>{
            if(!x || !x.id) return;
            const amount=Number(x.amount), id=String(x.id);
            if(Number.isFinite(amount) && amount>0) paidAmountById[id]=(paidAmountById[id]||0)+amount;
          });
        } catch(e) {}
      } else {
        let remainingPayment=Math.max(0,Number(b.totalBayar)||0);
        raw.split(',').map(x=>x.trim()).filter(Boolean).forEach(id=>{
          if(remainingPayment<=0) return;
          const invoiceRow=data.find((row,idx)=>idx>0&&String(row[iId])===id);
          if(!invoiceRow) return;
          const original=(Number(invoiceRow[iQtyLaku])||0)*(Number(invoiceRow[iHargaTitip])||0);
          const capacity=original>0?Math.max(0,original-(paidAmountById[id]||0)):Math.max(0,Number(invoiceRow[iUtang])||0);
          const allocated=Math.min(capacity,remainingPayment);
          if(allocated>0){paidAmountById[id]=(paidAmountById[id]||0)+allocated;remainingPayment-=allocated;}
        });
      }
    });

    const pendingRows=[];
    for (let i=1;i<data.length;i++) {
      if (String(data[i][iSupplier])!==supplierId || String(data[i][iLapak])!==String(lapakId) || String(data[i][iStatus])!=='Pending') continue;
      const currentUtang=Math.max(0,Number(data[i][iUtang])||0);
      const originalUtang=(Number(data[i][iQtyLaku])||0)*(Number(data[i][iHargaTitip])||0);
      const reconciled=originalUtang>0?Math.min(currentUtang,Math.max(0,originalUtang-(paidAmountById[String(data[i][iId])]||0))):currentUtang;
      if (reconciled<=0) continue;
      pendingRows.push({row:i+1,id:String(data[i][iId]),outstanding:reconciled,qtyLaku:Number(data[i][iQtyLaku])||0,hargaTitip:Number(data[i][iHargaTitip])||0,setoranId:String(data[i][iSetoran]||''),katalogId:String(data[i][iKatalog]||'')});
    }
    if (!pendingRows.length) return {success:false,message:'Tidak ada utang pending untuk supplier ini.'};

    // Penyesuaian qty hanya diizinkan pada draft sebelum laporan dikirim.
    const adjustments=Array.isArray(payload.adjustments)?payload.adjustments:[];
    const adjustmentMap={};
    adjustments.forEach(x=>{
      const id=String(x && x.id || '').trim(), qty=Number(x && x.qtyLaku);
      if(!id || !Number.isSafeInteger(qty) || qty<0) throw new Error('Penyesuaian qty tagihan tidak valid.');
      if(adjustmentMap[id]!==undefined) throw new Error('Item penyesuaian duplikat: '+id);
      adjustmentMap[id]=qty;
    });
    let detailSheet=null,detailData=null,detailHeaders=null,diSetoran=-1,diKatalog=-1,diDrop=-1,diSisa=-1,diLaku=-1;
    if(adjustments.length){
      detailSheet=ss.getSheetByName('SetoranDetail');
      if(!detailSheet) return {success:false,message:'Data rincian setoran tidak ditemukan. Penyesuaian sisa kue dibatalkan.'};
      detailData=detailSheet.getDataRange().getValues();
      detailHeaders=detailData[0].map(x=>String(x).trim());
      diSetoran=detailHeaders.indexOf('setoranId');diKatalog=detailHeaders.indexOf('katalogId');
      diDrop=detailHeaders.indexOf('qtyDrop');diSisa=detailHeaders.indexOf('qtySisa');diLaku=detailHeaders.indexOf('qtyLaku');
      if([diSetoran,diKatalog,diDrop,diSisa,diLaku].some(i=>i<0)) return {success:false,message:'Kolom rincian stok tidak lengkap. Penyesuaian sisa kue dibatalkan.'};
      const paidIds={};
      const appliedCreditsByInvoice=getSupplierInvoiceSettlementMaps_().creditAppliedByInvoice;
      activePayments.forEach(x=>{
        const raw=String(x.konsinyasiIds||'');
        if(raw.trim().startsWith('[')){try{JSON.parse(raw).forEach(v=>{if(v&&v.id)paidIds[String(v.id)]=true;});}catch(e){}}
        else raw.split(',').map(v=>v.trim()).filter(Boolean).forEach(id=>paidIds[id]=true);
      });
      for(const id of Object.keys(adjustmentMap)){
        const row=pendingRows.find(x=>x.id===id);
        if(!row) return {success:false,message:'Item tagihan tidak ditemukan pada supplier ini. Muat ulang data.'};
        if(row.setoranId) return {success:false,message:'Laporan lapak sudah dikirim. Karyawan tidak dapat mengubah jumlah atau sisa invoice ini secara langsung. Hubungi admin untuk koreksi dengan persetujuan admin.'};
        const targetRow = data[row.row - 1];
        const draftKey = iCatatan >= 0 ? String(targetRow[iCatatan] || '') : '';
        const paidSibling = draftKey && data.some((raw, idx) =>
          idx > 0 && idx + 1 !== row.row &&
          String(raw[iCatatan] || '') === draftKey &&
          paidIds[String(raw[iId])]
        );
        if(paidSibling) return {success:false,message:'Ditemukan invoice lain untuk transaksi supplier/produk yang sama yang sudah menerima pembayaran. Jangan ubah atau bayar tagihan ini. Ajukan koreksi kepada admin agar pembayaran lama tetap diperhitungkan.'};
        if(paidIds[id]) return {success:false,message:'Jumlah produk '+id+' tidak dapat diubah karena sudah pernah menerima pembayaran. Selesaikan atau batalkan pembayaran sebelumnya terlebih dahulu.'};
        const appliedCredit=appliedCreditsByInvoice[id]||0;
        if(appliedCredit>0)return {success:false,message:'Invoice ini sudah menggunakan saldo lebih supplier. Ubah jumlah melalui rekap draft sebelum laporan dikirim, bukan melalui formulir pembayaran.'};
        const detailIndex=detailData.findIndex((d,i)=>i>0&&String(d[diSetoran])===row.setoranId&&String(d[diKatalog])===row.katalogId);
        if(detailIndex<1) return {success:false,message:'Rincian stok untuk '+id+' tidak ditemukan. Muat ulang data.'};
        const qtyDrop=Number(detailData[detailIndex][diDrop])||0, qtySisa=qtyDrop-adjustmentMap[id];
        if(!Number.isSafeInteger(qtyDrop)||qtyDrop<0||adjustmentMap[id]>qtyDrop) return {success:false,message:'Jumlah kue terjual melebihi jumlah yang diterima untuk '+id+'.'};
        row.qtyLaku=adjustmentMap[id];
        row.outstanding=row.qtyLaku*row.hargaTitip;
        row.detailRow=detailIndex+1;
        row.qtySisa=qtySisa;
      }
    }

    const noNota=String(payload.noNota||'').trim(), catatanText=String(payload.catatan||'').trim();
    const sup=getSheetData('Suppliers').find(s=>String(s.id)===supplierId)||{};
    const bayarId='BT'+Utilities.getUuid().slice(0,8).toUpperCase();
    const journal=beginWriteJournal(['Konsinyasi','BayarTitipanKaryawan','SetoranDetail','SupplierCreditLedger']);
    try {
      // Simpan penyesuaian draft terlebih dahulu dalam journal yang sama.
      Object.keys(adjustmentMap).forEach(id=>{
        const item=pendingRows.find(x=>x.id===id);if(!item)return;
        journalSetValue(journal,ks,item.row,h.indexOf('qtyLaku')+1,item.qtyLaku);
        journalSetValue(journal,ks,item.row,iUtang+1,item.outstanding);
        if(item.detailRow){
          journalSetValue(journal,detailSheet,item.detailRow,diSisa+1,item.qtySisa);
          journalSetValue(journal,detailSheet,item.detailRow,diLaku+1,item.qtyLaku);
        }
        if(item.qtyLaku<=0)journalSetValue(journal,ks,item.row,iStatus+1,'Cancelled');
      });
      // Perbaiki saldo invoice legacy yang belum merefleksikan alokasi pembayaran tunai.
      pendingRows.forEach(item=>{
        if(!Object.prototype.hasOwnProperty.call(adjustmentMap,item.id)){
          const sheetDue=Math.max(0,Number(data[item.row-1][iUtang])||0);
          if(sheetDue!==item.outstanding)journalSetValue(journal,ks,item.row,iUtang+1,item.outstanding);
        }
      });
      // Kredit supplier diterapkan sesudah qty dan alokasi pembayaran final, lintas lapak, ke invoice tertua dahulu.
      const creditUse=applySupplierCreditsToPendingInvoices_(supplierId,sess.username,journal);
      const creditedById={};(creditUse.items||[]).forEach(x=>{creditedById[String(x.invoiceId)]=Number(x.amount)||0;});
      const payableRows=pendingRows.map(item=>({
        ...item,
        outstanding:Math.max(0,(Number(item.outstanding)||0)-(creditedById[String(item.id)]||0))
      })).filter(item=>item.outstanding>0);
      const totalUtang=payableRows.reduce((sum,x)=>sum+x.outstanding,0);
      if(totalUtang<=0){
        _clearSheetCache();
        return {success:true,message:'Tagihan supplier sudah tertutup oleh saldo lebih atau penyesuaian stok. Tidak ada pembayaran tunai yang perlu dilakukan.',total:0,creditApplied:creditUse.total||0,remaining:0,count:0};
      }
      // Jika form dibuka sebelum kredit diterapkan, pembayaran dibatasi pada sisa tagihan setelah kredit.
      const nominalBayar=Math.min(requestedPayment,totalUtang);
      let sisaBayar=nominalBayar;const allocations=[];
      payableRows.forEach(item=>{
        if(sisaBayar<=0)return;
        const amount=Math.min(item.outstanding,sisaBayar);
        if(amount<=0)return;
        allocations.push({id:item.id,amount,remaining:item.outstanding-amount,row:item.row});
        sisaBayar-=amount;
      });
      if(sisaBayar!==0)throw new Error('Nominal tidak dapat dialokasikan. Muat ulang data dan coba lagi.');
      const bh=bayarSheet.getRange(1,1,1,bayarSheet.getLastColumn()).getValues()[0];
      const newRow=bh.map(col=>{
        switch(String(col).trim()){
          case 'id':return bayarId;case 'tanggal':return new Date(tgl);case 'lapakId':return lapakId;
          case 'supplierId':return supplierId;case 'userName':return sess.username;case 'totalBayar':return nominalBayar;
          case 'konsinyasiIds':return JSON.stringify(allocations.map(x=>({id:x.id,amount:x.amount})));
          case 'setoranId':return '';case 'createdAt':return new Date();case 'catatan':return catatanText;
          case 'noNota':return noNota;case 'metode':return metode;case 'status':return 'Active';default:return '';
        }
      });
      allocations.forEach(item=>{
        journalSetValue(journal,ks,item.row,iUtang+1,item.remaining);
        if(item.remaining<=0){
          journalSetValue(journal,ks,item.row,iStatus+1,'Bayar');
          if(iBayarAt>=0)journalSetValue(journal,ks,item.row,iBayarAt+1,new Date());
          if(iBayarBy>=0)journalSetValue(journal,ks,item.row,iBayarBy+1,sess.username);
        }else journalSetValue(journal,ks,item.row,iStatus+1,'Pending');
        if(iCatatan>=0){
          const prev=String(ks.getRange(item.row,iCatatan+1).getValue()||'');
          const note='Pembayaran tunai '+fmtRpLocal(item.amount)+' oleh '+sess.name+(noNota?' (Nota: '+noNota+')':'')+(catatanText?' — '+catatanText:'');
          journalSetValue(journal,ks,item.row,iCatatan+1,(prev?prev+' | ':'')+note);
        }
      });
      bayarSheet.appendRow(newRow);
      _clearSheetCache();
      const sudahSubmit=getSheetData('Setoran').some(x=>formatDate(x.tanggal)===tgl&&String(x.lapakId)===String(lapakId));
      const sisaUtang=totalUtang-nominalBayar;
      const tail=sudahSubmit?' Akan masuk ke rekap setoran berikutnya.':' Setoran hari ini otomatis berkurang.';
      const creditMsg=creditUse.total>0?' Saldo lebih supplier yang diterapkan: '+fmtRpLocal(creditUse.total)+'.':'';
      return {success:true,message:'Pembayaran '+(sup.nama||supplierId)+' '+fmtRpLocal(nominalBayar)+' berhasil.'+creditMsg+' Sisa utang lapak: '+fmtRpLocal(sisaUtang)+'.'+tail,total:nominalBayar,creditApplied:creditUse.total||0,remaining:sisaUtang,count:allocations.length};
    }catch(writeError){
      try{rollbackWriteJournal(journal);}catch(rollbackError){return {success:false,message:'Pembayaran gagal dan rollback tidak lengkap. Hentikan transaksi dan minta pemeriksaan admin: '+writeError.message+' | '+rollbackError.message};}
      _clearSheetCache();
      return {success:false,message:'Pembayaran gagal. Seluruh penyesuaian, penggunaan kredit, dan pembayaran dibatalkan: '+writeError.message};
    }
  } finally { lock.releaseLock(); }
}
function apiBatalBayarTitipan(token, bayarId) {
  const sess = requireRole(token, ['karyawan']);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    if (!bayarId) return { success: false, message: 'ID pembayaran wajib.' };
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const bayarSheet = ss.getSheetByName('BayarTitipanKaryawan');
    if (!bayarSheet) return { success: false, message: 'Sheet tidak ditemukan.' };
    const bData = bayarSheet.getDataRange().getValues();
    const bH = bData[0].map(x => String(x).trim());
    const iId = bH.indexOf('id'), iSetoran = bH.indexOf('setoranId');
    const iIds = bH.indexOf('konsinyasiIds'), iStatus = bH.indexOf('status');
    const iLapak = bH.indexOf('lapakId');

    let rowIdx = -1, konsinyasiIdsStr = '', status = 'Active', lapakId = '', setoranId = '';
    for (let i = 1; i < bData.length; i++) {
      if (String(bData[i][iId]) === String(bayarId)) {
        konsinyasiIdsStr = String(bData[i][iIds] || '');
        status = String(bData[i][iStatus] || 'Active');
        lapakId = bData[i][iLapak];
        setoranId = String(bData[i][iSetoran] || '');
        rowIdx = i + 1;
        break;
      }
    }
    if (rowIdx === -1) return { success: false, message: 'Data pembayaran tidak ditemukan.' };
    if (status === 'Cancelled') return { success: false, message: 'Sudah dibatalkan sebelumnya.' };
    if (String(lapakId) !== String(sess.lapakId)) return { success: false, message: 'Anda tidak punya akses ke data ini.' };
    if (setoranId) return { success: false, message: 'Sudah masuk rekap setoran. Hubungi admin untuk koreksi.' };

    let allocations = [], legacyIds = [];
    if (konsinyasiIdsStr.trim().startsWith('[')) {
      try { allocations = JSON.parse(konsinyasiIdsStr).filter(x => x && x.id); }
      catch (e) { return {success:false,message:'Rincian alokasi pembayaran tidak valid. Minta admin memeriksa transaksi ini.'}; }
    } else legacyIds = konsinyasiIdsStr.split(',').map(s => s.trim()).filter(Boolean);
    const allocationMap = {};
    allocations.forEach(x => { allocationMap[String(x.id)] = (allocationMap[String(x.id)] || 0) + Math.max(0,Number(x.amount)||0); });
    legacyIds.forEach(x => { allocationMap[x] = null; });
    const ks = ss.getSheetByName('Konsinyasi');
    const kData = ks.getDataRange().getValues();
    const kH = kData[0];
    const kId=kH.indexOf('id'), kStatus=kH.indexOf('status'), kUtang=kH.indexOf('utang');
    const kBayarAt=kH.indexOf('bayarAt'), kBayarBy=kH.indexOf('bayarBy'), kKasId=kH.indexOf('kasId'), kCatatan=kH.indexOf('catatan');
    let reverted=0;
    const journal=beginWriteJournal(['Konsinyasi','BayarTitipanKaryawan']);
    try {
      for(let i=1;i<kData.length;i++){
        const itemId=String(kData[i][kId]);
        if(!Object.prototype.hasOwnProperty.call(allocationMap,itemId))continue;
        if(allocationMap[itemId]!==null&&kUtang>=0){
          const current=Number(kData[i][kUtang])||0;
          journalSetValue(journal,ks,i+1,kUtang+1,current+allocationMap[itemId]);
        }
        journalSetValue(journal,ks,i+1,kStatus+1,'Pending');
        if(kBayarAt>=0)journalSetValue(journal,ks,i+1,kBayarAt+1,'');
        if(kBayarBy>=0)journalSetValue(journal,ks,i+1,kBayarBy+1,'');
        if(kKasId>=0)journalSetValue(journal,ks,i+1,kKasId+1,'');
        if(kCatatan>=0){
          const prev=String(ks.getRange(i+1,kCatatan+1).getValue()||'');
          journalSetValue(journal,ks,i+1,kCatatan+1,(prev?prev+' | ':'')+'DIBATALKAN oleh '+sess.name);
        }
        reverted++;
      }
      journalSetValue(journal,bayarSheet,rowIdx,iStatus+1,'Cancelled');
    } catch(e) {
      try{rollbackWriteJournal(journal);}catch(rollbackError){return {success:false,message:'Pembatalan gagal dan rollback perlu pemeriksaan admin: '+e.message+' | '+rollbackError.message};}
      return {success:false,message:'Pembatalan gagal. Tidak ada perubahan yang dipertahankan: '+e.message};
    }
    _clearSheetCache();
    return { success: true, message: 'Pembayaran dibatalkan. ' + reverted + ' transaksi kembali pending.', reverted };
  } finally { lock.releaseLock(); }
}

// ============================================================
//  ADMIN DASHBOARD & SETORAN
// ============================================================
function buildTitipanTotalsBySetoran() {
  const totals = {};
  getSheetData('BayarTitipanKaryawan').forEach(b => {
    if (String(b.status || 'Active') !== 'Active' || !b.setoranId) return;
    const id = String(b.setoranId);
    if (!totals[id]) totals[id] = { Tunai:0, QRIS:0, Transfer:0 };
    const metode = String(b.metode || 'Tunai');
    if (Object.prototype.hasOwnProperty.call(totals[id], metode)) totals[id][metode] += Number(b.totalBayar) || 0;
  });
  return totals;
}
function mapSetoran(s, totalsBySetoran) {
  const totalTitipanPerMetode = (totalsBySetoran || {})[String(s.id)] || { Tunai:0, QRIS:0, Transfer:0 };
  const totalTitipan = totalTitipanPerMetode.Tunai + totalTitipanPerMetode.QRIS + totalTitipanPerMetode.Transfer;
  return { id:s.id, tanggal: formatDate(s.tanggal), lapakId:s.lapakId, totalTunai: Number(s.totalTunai) || 0, totalQris: Number(s.totalQris) || 0, totalTransfer: Number(s.totalTransfer) || 0, totalSistem: Number(s.totalSistem) || 0, pengeluaran: Number(s.pengeluaran) || 0, totalTitipan, totalTitipanTunai:totalTitipanPerMetode.Tunai, totalTitipanQris:totalTitipanPerMetode.QRIS, totalTitipanTransfer:totalTitipanPerMetode.Transfer, expectedSetoran: Number(s.expectedSetoran) || 0, uangDisetor: Number(s.uangDisetor) || 0, selisih: Number(s.selisih) || 0, status: s.status, catatan: s.catatan || '', locked: String(s.locked) === 'true' || s.locked === true, editHistory: s.editHistory || '' };
}
function apiGetAdminDashboard(token) {
  requireRole(token, ['admin']);
  const tgl = todayStr();
  const setoran = getSheetData('Setoran');
  const kas = getSheetData('Kas');
  const pending = setoran.filter(s => s.status === 'pending');
  const titipanTotals = buildTitipanTotalsBySetoran();
  const saldoKas = kas.length ? Number(kas[kas.length - 1].saldo) || 0 : 0;
  const todaySetoran = setoran.filter(s => formatDate(s.tanggal) === tgl);
  const todayPenjualan = todaySetoran.reduce((s, x) => s + (Number(x.totalSistem) || 0), 0);
  const todayTunai = todaySetoran.reduce((s, x) => s + (Number(x.totalTunai) || 0), 0);
  const todayQris = todaySetoran.reduce((s, x) => s + (Number(x.totalQris) || 0), 0);
  const recentKas = kas.slice(-10).reverse().map(k => ({ tanggal: formatDateTime(k.tanggal), keterangan: k.keterangan || '', tipe: k.tipe || '', kategori: k.kategori || '', metode: k.metode || ((String(k.keterangan || '').match(/\\[(Tunai|QRIS|Transfer)\\]\\s*$/i) || [])[1] || ''), nominal: Number(k.nominal) || 0, saldo: Number(k.saldo) || 0 }));
  const unreadNotif = getSheetData('Notifikasi').filter(n => n.status === 'unread').length;
  const utangKonsinyasi = getSheetData('Konsinyasi').filter(k => k.status === 'Pending').reduce((s, k) => s + (Number(k.utang) || 0), 0);
  const todayPesanan = getSheetData('PesananPelanggan').filter(p => formatDate(p.tanggalAmbil) === tgl || formatDate(p.tanggal) === tgl);
  const todayTransfer = todaySetoran.reduce((s, x) => s + (Number(x.totalTransfer) || 0), 0);
  return { kasBesar:saldoKas, pendingCount:pending.length, pendingSetoran:pending.map(s => mapSetoran(s, titipanTotals)), todayPenjualan, todayTunai, todayQris, todayTransfer, todaySetoranCount: todaySetoran.length, recentKas, unreadNotif, utangKonsinyasi, todayPesananCount: todayPesanan.length };
}
function apiGetSetoranList(token, filter) {
  requireRole(token, ['admin']);
  filter = filter || {};
  const titipanTotals = buildTitipanTotalsBySetoran();
  let list = getSheetData('Setoran').map(s => mapSetoran(s, titipanTotals));
  if (filter.status) list = list.filter(s => s.status === filter.status);
  if (filter.lapakId) list = list.filter(s => String(s.lapakId) === String(filter.lapakId));
  if (filter.dari) list = list.filter(s => s.tanggal >= filter.dari);
  if (filter.sampai) list = list.filter(s => s.tanggal <= filter.sampai);
  return list.reverse();
}
function apiGetSetoranDetail(token, setoranId) {
  requireRole(token, ['admin']);
  const detail = getSheetData('SetoranDetail').filter(d => String(d.setoranId) === String(setoranId)).map(d => ({ katalogId:d.katalogId, qtyDrop:Number(d.qtyDrop) || 0, qtySisa:Number(d.qtySisa) || 0, qtyLaku:Number(d.qtyLaku) || 0, hargaJual:Number(d.hargaJual) || 0, hargaBeli:Number(d.hargaBeli) || 0, subtotal:Number(d.subtotal) || 0, tipePelanggan:d.tipePelanggan || 'Umum' }));
  const pengeluaran = getSheetData('PengeluaranLapak').filter(p => String(p.setoranId) === String(setoranId)).map(p => ({ keterangan: p.keterangan, kategori: p.kategori, nominal: Number(p.nominal) || 0 }));
  const pembelianSusulan = getSheetData('Konsinyasi').filter(k => String(k.setoranId) === String(setoranId) && String(k.catatan || '').indexOf('PEMBELIAN_SUSULAN|') === 0).map(k => ({ id:k.id, katalogId:k.katalogId, supplierId:k.supplierId, qty:Number(k.qtyLaku)||0, hargaSatuan:Number(k.hargaTitip)||0, total:Number(k.utang)||0, status:k.status, tanggal:formatDate(k.tanggal), catatan:String(k.catatan||'').split('|').slice(2).join('|') }));
  const katMap = {}; getSheetData('Katalog').forEach(k => katMap[k.id] = k);
  detail.forEach(d => d.nama = (katMap[d.katalogId] || {}).nama || d.katalogId);
  pembelianSusulan.forEach(d => { const k=katMap[d.katalogId]||{}; d.nama=k.nama||d.katalogId; d.supplierNama=(getSheetData('Suppliers').find(s=>String(s.id)===String(d.supplierId))||{}).nama||d.supplierId; });
  return { items: detail, pengeluaran, pembelianSusulan };
}
function apiAddSetoranPembelianSusulan(token, payload) {
  const sess = requireRole(token, ['admin']);
  payload = payload || {};
  const setoranId = String(payload.setoranId || '').trim();
  const katalogId = String(payload.katalogId || '').trim();
  const qty = Number(payload.qty);
  const harga = toPosNum(payload.hargaSatuan);
  if (!setoranId || !katalogId) return {success:false,message:'Setoran dan item wajib dipilih.'};
  if (!Number.isInteger(qty) || qty <= 0) return {success:false,message:'Jumlah pembelian harus bilangan bulat lebih dari 0.'};
  if (harga <= 0) return {success:false,message:'Harga beli harus lebih dari 0.'};
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return {success:false,message:'Sistem sibuk. Coba lagi.'};
  try {
    const ss=SpreadsheetApp.getActiveSpreadsheet();
    const setoran=getSheetData('Setoran').find(s=>String(s.id)===setoranId);
    if(!setoran) return {success:false,message:'Setoran tidak ditemukan.'};
    if(String(setoran.status).toLowerCase()!=='approved') return {success:false,message:'Pembelian susulan hanya dapat ditambahkan pada setoran yang sudah disetujui.'};
    if(String(setoran.locked)==='true'||setoran.locked===true) return {success:false,message:'Periode/setoran terkunci. Pembelian susulan tidak dapat ditambahkan.'};
    if(isPeriodeLocked(formatDate(setoran.tanggal))) return {success:false,message:'Periode setoran sudah dikunci.'};
    const katalog=getSheetData('Katalog').find(k=>String(k.id)===katalogId);
    if(!katalog) return {success:false,message:'Item katalog tidak ditemukan.'};
    const supplierId=String(katalog.supplierId||'');
    const supplier=getSheetData('Suppliers').find(s=>String(s.id)===supplierId);
    if(!supplier) return {success:false,message:'Supplier item belum terdaftar di katalog.'};
    const kSheet=ss.getSheetByName('Konsinyasi'), stokSheet=ss.getSheetByName('KartuStok');
    if(!hasHeaders(kSheet,['id','tanggal','supplierId','lapakId','katalogId','qtyLaku','hargaTitip','utang','status','kasId','bayarAt','bayarBy','setoranId','catatan']) || !hasHeaders(stokSheet,['id','tanggal','katalogId','lapakId','tipe','masuk','keluar','saldo','refId','keterangan'])) return {success:false,message:'Struktur sheet supplier/stok belum lengkap. Tidak ada perubahan.'};
    ensureSupplierFinanceSheets_();
    const id='KN'+Utilities.getUuid().slice(0,8).toUpperCase();
    const utang=qty*harga;
    const marker='PEMBELIAN_SUSULAN|'+setoranId+'|'+String(payload.catatan||'').trim().slice(0,120);
    const journal=beginWriteJournal(['Konsinyasi','KartuStok','SupplierCreditLedger']);
    try {
      appendObjectsByHeaders(kSheet,[{id,tanggal:new Date(),supplierId,lapakId:setoran.lapakId,katalogId,qtyLaku:qty,hargaTitip:harga,utang,status:'Pending',kasId:'',bayarAt:'',bayarBy:'',setoranId,catatan:marker}]);
      catatKartuStok(katalogId,setoran.lapakId,'Pembelian Susulan',qty,0,id,'Pembelian susulan setoran '+setoranId+' · '+(supplier.nama||supplierId));
      applySupplierCreditsToPendingInvoices_(supplierId,sess.username,journal);
    } catch(e) {
      try { rollbackWriteJournal(journal); }
      catch(re) { return {success:false,message:'Pembelian gagal dan rollback perlu diperiksa: '+e.message+' | '+re.message}; }
      _clearSheetCache();
      return {success:false,message:'Pembelian tidak tersimpan; perubahan dibatalkan: '+e.message};
    }
    logAction(sess.username,'TAMBAH_PEMBELIAN_SUSULAN',{id,setoranId,katalogId,supplierId,qty,harga,utang});
    _clearSheetCache();
    return {success:true,message:'Pembelian susulan ditambahkan. Utang supplier bertambah '+utang.toLocaleString('id-ID')+' dan stok bertambah '+qty+' pcs.',id,total:utang};
  } finally { lock.releaseLock(); }
}
function apiApproveSetoran(token, idSetoran) {
  const sess = requireRole(token, ['admin']);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const setoranSheet = ss.getSheetByName('Setoran');
    const kasSheet = ss.getSheetByName('Kas');
    const data = setoranSheet.getDataRange().getValues();
    const h = data[0];
    if (!hasHeaders(setoranSheet, ['id','status','totalTunai','totalQris','pengeluaran','lapakId','userId','tanggal','approvedAt','approvedBy'])) {
      return { success:false, message:'Struktur Setoran lama belum mendukung persetujuan versi baru. Tidak ada perubahan yang dilakukan.' };
    }
    const iId = h.indexOf('id'), iStatus = h.indexOf('status');
    const iTunai = h.indexOf('totalTunai'), iQris = h.indexOf('totalQris'), iTransfer = h.indexOf('totalTransfer'), iPengeluaran = h.indexOf('pengeluaran');
    const iLapak = h.indexOf('lapakId'), iAt = h.indexOf('approvedAt'), iBy = h.indexOf('approvedBy');
    if (!hasHeaders(kasSheet, ['id','tanggal','keterangan','tipe','nominal','saldo'])) {
      return { success:false, message:'Struktur Kas belum lengkap. Setoran tidak disetujui dan tidak ada perubahan.' };
    }
    if (iTunai < 0 || iPengeluaran < 0) {
      return { success:false, message:'Kolom totalTunai/pengeluaran belum tersedia. Setoran tidak disetujui dan tidak ada perubahan.' };
    }
    let rowIdx = -1, totalTunai = 0, qris = 0, transfer = 0, pengeluaranOperasional = 0, lapakId = '', userId = '', tanggal = '';
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][iId]) === String(idSetoran)) {
        if (data[i][iStatus] === 'approved') return { success: false, message: 'Setoran sudah disetujui.' };
        if (data[i][iStatus] === 'rejected') return { success: false, message: 'Setoran sudah ditolak.' };
        totalTunai = Number(data[i][iTunai]) || 0;
        qris = Number(data[i][iQris]) || 0;
        transfer = iTransfer >= 0 ? Number(data[i][iTransfer]) || 0 : 0;
        pengeluaranOperasional = Number(data[i][iPengeluaran]) || 0;
        lapakId = data[i][iLapak];
        userId = data[i][h.indexOf('userId')];
        tanggal = formatDate(data[i][h.indexOf('tanggal')]);
        rowIdx = i + 1; break;
      }
    }
    if (rowIdx === -1) return { success: false, message: 'Setoran tidak ditemukan.' };
    ensureSupplierFinanceSheets_();
    const pendingCorrections = getSheetData('SupplierCorrectionRequests').filter(r=>String(r.setoranId)===String(idSetoran)&&String(r.status)==='Pending');
    if (pendingCorrections.length) return {success:false,message:'Setoran belum dapat disetujui karena ada '+pendingCorrections.length+' permintaan koreksi invoice yang menunggu keputusan admin.'};
    const kasData = kasSheet.getDataRange().getValues();
    const iSaldo = kasData[0].indexOf('saldo');
    let saldo = kasData.length > 1 ? Number(kasData[kasData.length - 1][iSaldo]) || 0 : 0;
    const pembayaranSupplier = getSheetData('BayarTitipanKaryawan')
      .filter(b => String(b.setoranId) === String(idSetoran) && String(b.status || 'Active') === 'Active');
    const totalPembayaranSupplier = pembayaranSupplier.reduce((sum, b) => sum + (Number(b.totalBayar) || 0), 0);
    // Kas Utama hanya menerima keuntungan bersih. Metode pembayaran supplier
    // adalah metadata riwayat, bukan akun/sumber kas yang didebit.
    const totalPenjualan = totalTunai + qris + transfer;
    const keuntunganBersih = totalPenjualan - totalPembayaranSupplier - pengeluaranOperasional;
    if (keuntunganBersih < 0)
      return { success:false, message:'Pembayaran supplier dan pengeluaran operasional melebihi total penjualan. Setoran ditahan untuk pemeriksaan.' };
    const newRows = [];
    if (keuntunganBersih > 0) {
      saldo += keuntunganBersih;
      newRows.push({
        id:'KS'+Utilities.getUuid().slice(0,8).toUpperCase(),
        tanggal:new Date(),
        keterangan:'Keuntungan bersih penjualan '+lapakId,
        tipe:'Masuk',
        kategori:'Keuntungan Bersih',
        metode:'Internal',
        nominal:keuntunganBersih,
        saldo
      });
    }
    const journal = beginWriteJournal(['Setoran','Kas']);
    try {
      journalSetValue(journal, setoranSheet, rowIdx, iStatus + 1, 'approved');
      if (iAt >= 0) journalSetValue(journal, setoranSheet, rowIdx, iAt + 1, new Date());
      if (iBy >= 0) journalSetValue(journal, setoranSheet, rowIdx, iBy + 1, sess.username);
      if (newRows.length) appendObjectsByHeaders(kasSheet,newRows);
    } catch (writeError) {
      try { rollbackWriteJournal(journal); }
      catch (rollbackError) {
        console.error('Gagal rollback persetujuan setoran:', rollbackError.message);
        return { success:false, message:'Persetujuan gagal dan pemulihan otomatis tidak sepenuhnya berhasil. Hentikan proses lanjutan dan minta pemeriksaan admin. Detail: ' + writeError.message + ' | ' + rollbackError.message };
      }
      _clearSheetCache();
      return { success:false, message:'Persetujuan gagal. Perubahan telah dibatalkan: ' + writeError.message };
    }
    _clearSheetCache();
    const user = getSheetData('Users').find(u => String(u.id) === String(userId));
    if (user && (user.email || user.username)) {
      const lapak = getSheetData('Lapak').find(l => String(l.id) === String(lapakId)) || {};
      try { notifySetoranApproved({ id: idSetoran, tanggal, expectedSetoran: keuntunganBersih }, lapak.nama || lapakId, user.email || '', user.username || ''); } catch (notifyError) { console.error('Notifikasi persetujuan gagal, transaksi tetap disetujui:', notifyError.message); }
    }
    return { success: true, message: 'Setoran disetujui.' };
  } finally { lock.releaseLock(); }
}
function apiRejectSetoran(token, idSetoran, reason) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Setoran');
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  if (!hasHeaders(sheet, ['id','status','catatan'])) return { success:false, message:'Struktur Setoran lama belum mendukung penolakan dengan catatan. Tidak ada perubahan yang dilakukan.' };
  const iId = h.indexOf('id'), iStatus = h.indexOf('status'), iCatatan = h.indexOf('catatan');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][iId]) === String(idSetoran)) {
      if (data[i][iStatus] !== 'pending') return { success: false, message: 'Setoran sudah diproses.' };
      sheet.getRange(i + 1, iStatus + 1).setValue('rejected');
      if (iCatatan >= 0) sheet.getRange(i + 1, iCatatan + 1).setValue('REJECTED: ' + (reason || ''));
      _clearSheetCache();
      return { success: true, message: 'Setoran ditolak.' };
    }
  }
  return { success: false, message: 'Setoran tidak ditemukan.' };
}
function apiEditSetoran(token, idSetoran, updates) {
  const sess = requireRole(token, ['admin']);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Setoran');
    const data = sheet.getDataRange().getValues(), h = data[0];
    if (!hasHeaders(sheet, ['id','status','totalTunai','totalQris','totalSistem','pengeluaran','expectedSetoran','selisih'])) return { success:false, message:'Struktur Setoran lama belum mendukung edit versi baru. Tidak ada perubahan yang dilakukan.' };
    const iId=h.indexOf('id'), iStatus=h.indexOf('status'), iEdit=h.indexOf('editHistory'), iLocked=h.indexOf('locked');
    for(let i=1;i<data.length;i++) if(String(data[i][iId])===String(idSetoran)) {
      if(data[i][iStatus]==='approved') return {success:false,message:'Setoran yang sudah disetujui tidak bisa diedit.'};
      if(iLocked>=0&&(String(data[i][iLocked])==='true'||data[i][iLocked]===true)) return {success:false,message:'Setoran ini terkunci.'};
      const row=i+1, changes={}, journal=beginWriteJournal(['Setoran']);
      try {
        ['totalTunai','totalQris','totalTransfer','pengeluaran','catatan'].forEach(field=>{
          if(updates[field]!==undefined){const idx=h.indexOf(field);if(idx>=0){const before=data[i][idx];journalSetValue(journal,sheet,row,idx+1,field==='catatan'?String(updates[field]):toPosNum(updates[field]));changes[field]={from:before,to:updates[field]};}}
        });
        const it=h.indexOf('totalTunai'), iq=h.indexOf('totalQris'), itr=h.indexOf('totalTransfer'), is=h.indexOf('totalSistem'), ip=h.indexOf('pengeluaran'), ie=h.indexOf('expectedSetoran'), iu=h.indexOf('uangDisetor'), il=h.indexOf('selisih');
        const nt=Number(sheet.getRange(row,it+1).getValue())||0, nq=Number(sheet.getRange(row,iq+1).getValue())||0, ntr=itr>=0?Number(sheet.getRange(row,itr+1).getValue())||0:0, ns=Number(sheet.getRange(row,is+1).getValue())||0, np=Number(sheet.getRange(row,ip+1).getValue())||0;
        // Pembayaran supplier hanya metadata; setoran tidak dipotong ulang.
        const tunaiDiserahkan=nt-np;
        if(tunaiDiserahkan<0) throw new Error('Pengeluaran operasional melebihi penerimaan tunai.');
        if(ie>=0) journalSetValue(journal,sheet,row,ie+1,tunaiDiserahkan+nq+ntr);
        if(iu>=0) journalSetValue(journal,sheet,row,iu+1,tunaiDiserahkan);
        journalSetValue(journal,sheet,row,il+1,ns-(nt+nq+ntr));
        if(iEdit>=0){const prev=sheet.getRange(row,iEdit+1).getValue(), entry=formatDateTime(new Date())+' by '+sess.username+': '+JSON.stringify(changes);journalSetValue(journal,sheet,row,iEdit+1,(prev?prev+' || ':'')+entry);}
      } catch(writeError) {
        try{rollbackWriteJournal(journal);}catch(rollbackError){console.error('Gagal rollback edit setoran:',rollbackError.message);return{success:false,message:'Edit setoran gagal dan pemulihan otomatis tidak sepenuhnya berhasil. Hentikan proses dan minta admin memeriksa data. Detail: '+writeError.message+' | '+rollbackError.message};}
        _clearSheetCache();return{success:false,message:'Edit setoran gagal. Perubahan telah dibatalkan: '+writeError.message};
      }
      _clearSheetCache();return{success:true,message:'Setoran diperbarui.'};
    }
    return {success:false,message:'Setoran tidak ditemukan.'};
  } finally { lock.releaseLock(); }
}

// ============================================================
//  KAS / BELANJA / JADWAL / KASBON
// ============================================================
function apiGetKas(token, limit) {
  requireRole(token, ['admin']);
  const kas = getSheetData('Kas').map(k => ({ id:k.id, tanggal:formatDateTime(k.tanggal), keterangan:k.keterangan || '', tipe:k.tipe || '', kategori:k.kategori || '', metode:k.metode || ((String(k.keterangan || '').match(/\[(Tunai|QRIS|Transfer)\]\s*$/i) || [])[1] || ''), nominal:Number(k.nominal) || 0, saldo:Number(k.saldo) || 0 }));
  if (limit) return kas.slice(-limit).reverse();
  return kas.reverse();
}
function apiAddKas(token, item) {
  requireRole(token, ['admin']);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success:false, message:'Sistem sibuk. Coba lagi.' };
  try {
    const nominal = toPosNum(item.nominal);
    if (nominal <= 0) return { success: false, message: 'Nominal harus lebih dari 0.' };
    const tipe = item.tipe === 'Keluar' ? 'Keluar' : 'Masuk';
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Kas');
    const data = sheet.getDataRange().getValues();
    const iSaldo = data[0].indexOf('saldo');
    const saldoLama = data.length > 1 ? Number(data[data.length - 1][iSaldo]) || 0 : 0;
    const saldoBaru = tipe === 'Masuk' ? saldoLama + nominal : saldoLama - nominal;
    appendObjectsByHeaders(sheet, [{id:'KS' + Utilities.getUuid().slice(0,8).toUpperCase(),tanggal:new Date(),keterangan:String(item.keterangan || ''),tipe,kategori:String(item.kategori || 'Lain'),nominal,saldo:saldoBaru}]);
    _clearSheetCache();
    return { success: true, message: 'Transaksi kas dicatat.' };
  } finally { lock.releaseLock(); }
}
function apiGetBelanja(token, filter) {
  requireRole(token, ['admin']);
  filter = filter || {};
  let list = getSheetData('Belanja').map(b => ({ id:b.id, tanggal:formatDate(b.tanggal), item:b.item, supplierId:b.supplierId, qty:Number(b.qty) || 0, estimasiHarga:Number(b.estimasiHarga) || 0, hargaAktual:Number(b.hargaAktual) || 0, checked: String(b.checked) === 'true' || b.checked === true, checkedAt: formatDateTime(b.checkedAt), kasId: b.kasId || '', keterangan: b.keterangan || '' }));
  if (filter.onlyPending) list = list.filter(b => !b.checked);
  return list.reverse();
}
function apiSaveBelanja(token, item) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Belanja');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  const headers = data[0].map(h => String(h).trim());
  const nama = String(item.item || '').trim();
  if (!nama) return { success: false, message: 'Nama item wajib.' };
  const rowId = String(item.id || '').trim();
  const matchingRows = [];
  if (rowId) {
    for (let i = 1; i < data.length; i++) if (String(data[i][iId]).trim() === rowId) matchingRows.push(i + 1);
    if (matchingRows.length > 1) return { success:false, message:'ID item belanja duplikat. Jalankan fixDuplicateBelanjaIds() terlebih dahulu.' };
    if (!matchingRows.length) return { success:false, message:'Item tidak ditemukan.' };
  }

  const values = {
    id: rowId,
    tanggal: item.tanggal ? new Date(item.tanggal) : new Date(),
    item: nama,
    supplierId: item.supplierId || '',
    qty: toPosNum(item.qty) || 1,
    estimasiHarga: toPosNum(item.estimasiHarga),
    hargaAktual: toPosNum(item.hargaAktual),
    checked: item.checked === true,
    checkedAt: item.checked ? new Date() : '',
    kasId: item.kasId || '',
    keterangan: String(item.keterangan || '')
  };
  if (rowId) {
    const row = matchingRows[0];
    ['item', 'supplierId', 'qty', 'estimasiHarga'].forEach(key => {
      const column = headers.indexOf(key);
      if (column >= 0) sheet.getRange(row, column + 1).setValue(values[key]);
    });
    _clearSheetCache();
    return { success:true, message:'Belanja diperbarui.' };
  }

  do { values.id = 'B' + Utilities.getUuid().replace(/-/g, '').toUpperCase(); }
  while (data.slice(1).some(row => String(row[iId]).trim() === values.id));
  sheet.appendRow(headers.map(header => values[header] === undefined ? '' : values[header]));
  _clearSheetCache();
  return { success:true, message:'Belanja ditambahkan.' };
}
function fixDuplicateBelanjaIds() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Belanja');
  if (!sheet) return 'Sheet Belanja tidak ditemukan.';
  const data = sheet.getDataRange().getValues();
  if (!data.length) return 'Sheet Belanja kosong.';
  const iId = data[0].map(h => String(h).trim()).indexOf('id');
  if (iId < 0) return 'Kolom id tidak ditemukan.';
  const used = {};
  let fixed = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][iId] || '').trim();
    if (id && !used[id]) { used[id] = true; continue; }
    let newId;
    do { newId = 'B' + Utilities.getUuid().replace(/-/g, '').toUpperCase(); }
    while (used[newId]);
    sheet.getRange(i + 1, iId + 1).setValue(newId);
    used[newId] = true;
    fixed++;
  }
  _clearSheetCache();
  return fixed + ' ID item belanja diperbaiki.';
}
function apiCheckBelanja(token, id, checked, hargaAktual) {
  requireRole(token, ['admin']);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success:false, message:'Sistem sibuk. Coba lagi.' };
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Belanja');
    const kasSheet = ss.getSheetByName('Kas');
    const data = sheet.getDataRange().getValues();
    const h = data[0];
    const iId = h.indexOf('id'), iChecked = h.indexOf('checked'), iCheckedAt = h.indexOf('checkedAt');
    const iKasId = h.indexOf('kasId'), iItem = h.indexOf('item');
    const iHA = h.indexOf('hargaAktual'), iEst = h.indexOf('estimasiHarga'), iQty = h.indexOf('qty');
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][iId]) === String(id)) {
        const itemName = data[i][iItem];
        if (checked) {
          const qty = Number(data[i][iQty]) || 1;
          const ha = toPosNum(hargaAktual) || Number(data[i][iHA]) || Number(data[i][iEst]) || 0;
          const total = qty * ha;
          const kasData = kasSheet.getDataRange().getValues();
          const iSaldo = kasData[0].indexOf('saldo');
          const saldoLama = kasData.length > 1 ? Number(kasData[kasData.length - 1][iSaldo]) || 0 : 0;
          const kasId = 'KS' + Utilities.getUuid().slice(0, 8).toUpperCase();
          appendObjectsByHeaders(kasSheet,[{id:kasId,tanggal:new Date(),keterangan:'Belanja: '+itemName,tipe:'Keluar',kategori:'Belanja',nominal:total,saldo:saldoLama-total}]);
          sheet.getRange(i + 1, iChecked + 1).setValue(true);
          sheet.getRange(i + 1, iCheckedAt + 1).setValue(new Date());
          sheet.getRange(i + 1, iHA + 1).setValue(ha);
          sheet.getRange(i + 1, iKasId + 1).setValue(kasId);
        } else {
          const kasId = data[i][iKasId];
          if (kasId) {
            const kasData = kasSheet.getDataRange().getValues();
            for (let k = kasData.length - 1; k >= 1; k--) if (String(kasData[k][0]) === String(kasId)) { kasSheet.deleteRow(k + 1); break; }
          }
          sheet.getRange(i + 1, iChecked + 1).setValue(false);
          sheet.getRange(i + 1, iCheckedAt + 1).setValue('');
          sheet.getRange(i + 1, iKasId + 1).setValue('');
        }
        _clearSheetCache();
        return { success: true, message: checked ? 'Kas berkurang.' : 'Pembelian dibatalkan.' };
      }
    }
    return { success: false, message: 'Item tidak ditemukan.' };
  } finally { lock.releaseLock(); }
}
function apiDeleteBelanja(token, id) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Belanja');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(id)) { sheet.deleteRow(i+1); _clearSheetCache(); return { success:true, message:'Item dihapus.' }; }
  return { success:false, message:'Item tidak ditemukan.' };
}
function apiGetJadwal(token, days) {
  requireRole(token, ['admin']);
  const daysAhead = days || 30;
  const limit = new Date(Date.now() + daysAhead * 86400000);
  const supMap = {}; getSheetData('Suppliers').forEach(s => supMap[s.id] = s.nama);
  return getSheetData('Jadwal').filter(j => {
    const t = j.tanggal instanceof Date ? j.tanggal.getTime() : new Date(j.tanggal).getTime();
    return t <= limit.getTime() || (String(j.done) !== 'true' && j.done !== true);
  }).map(j => ({ id:j.id, tanggal:formatDate(j.tanggal), supplierId:j.supplierId, supplierNama: supMap[j.supplierId] || j.supplierId, tipe: j.tipe || '', keterangan: j.keterangan || '', done: String(j.done) === 'true' || j.done === true })).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
}
function apiSaveJadwal(token, item) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Jadwal');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  const row = [item.id || ('J' + Utilities.getUuid().slice(0,6).toUpperCase()), item.tanggal ? new Date(item.tanggal) : new Date(), item.supplierId || '', String(item.tipe || 'Pesanan'), String(item.keterangan || ''), item.done === true];
  if (item.id) { for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(item.id)) { sheet.getRange(i+1,1,1,6).setValues([row]); _clearSheetCache(); return { success:true, message:'Jadwal diperbarui.' }; } return { success:false, message:'Jadwal tidak ditemukan.' }; }
  sheet.appendRow(row); _clearSheetCache(); return { success:true, message:'Jadwal ditambahkan.' };
}
function apiToggleJadwal(token, id, done) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Jadwal');
  const data = sheet.getDataRange().getValues();
  const iId = data[0].indexOf('id'), iDone = data[0].indexOf('done');
  for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(id)) { sheet.getRange(i+1,iDone+1).setValue(!!done); _clearSheetCache(); return { success:true }; }
  return { success:false, message:'Jadwal tidak ditemukan.' };
}
function apiDeleteJadwal(token, id) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Jadwal');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(id)) { sheet.deleteRow(i+1); _clearSheetCache(); return { success:true, message:'Jadwal dihapus.' }; }
  return { success:false, message:'Jadwal tidak ditemukan.' };
}
function mapKasbon(k, userMap) {
  return { id:k.id, tanggal:formatDate(k.tanggal), userId:k.userId, userName: userMap && userMap[k.userId] || k.userId, nominal:Number(k.nominal) || 0, keterangan:k.keterangan || '', tipe:k.tipe || 'Kasbon', status:k.status || 'Outstanding', approvedBy:k.approvedBy || '', approvedAt: formatDateTime(k.approvedAt), gajiId:k.gajiId || '' };
}
function getKasbonOutstandingMap_(rows) {
  const events = (rows || []).map((k, index) => ({
    row:k, index, time:(new Date(k.tanggal).getTime() || 0), userId:String(k.userId || '')
  })).filter(e=>e.userId).sort((a,b)=>a.time-b.time || a.index-b.index);
  const byUser = {};
  events.forEach(e => {
    const k=e.row, uid=e.userId;
    if (!byUser[uid]) byUser[uid] = { debts: [], outstanding: 0 };
    const item=byUser[uid];
    if ((k.tipe || 'Kasbon') === 'Kasbon' && k.status === 'Outstanding') {
      item.debts.push({ id:k.id, nominal:Number(k.nominal)||0, keterangan:k.keterangan||'', tanggal:formatDate(k.tanggal), remaining:Number(k.nominal)||0 });
    } else if (k.tipe === 'Bayar' && k.status === 'Lunas') {
      // Pembayaran hanya mengurangi utang yang sudah ada pada saat uang diterima.
      // Sisa pembayaran tidak dibawa ke kasbon baru di masa depan.
      let paid=Math.max(0,Number(k.nominal)||0);
      item.debts.forEach(d=>{
        if(paid<=0)return;
        const applied=Math.min(d.remaining,paid);
        d.remaining-=applied; paid-=applied;
      });
    }
  });
  Object.keys(byUser).forEach(uid=>{
    const item=byUser[uid];
    item.debts=item.debts.filter(d=>d.remaining>0).map(d=>({id:d.id,nominal:d.remaining,keterangan:d.keterangan,tanggal:d.tanggal}));
    item.outstanding=item.debts.reduce((sum,d)=>sum+d.nominal,0);
  });
  return byUser;
}
function apiGetKasbon(token, filter) {
  const sess = getSession(token);
  filter = filter || {};
  const userMap = {}; getSheetData('Users').forEach(u => userMap[u.id] = u.name);
  let list = getSheetData('Kasbon');
  if (sess.role === 'karyawan') list = list.filter(k => String(k.userId) === String(sess.id));
  else if (filter.userId) list = list.filter(k => String(k.userId) === String(filter.userId));
  if (filter.status) list = list.filter(k => k.status === filter.status);
  const mapped = list.map(k => mapKasbon(k, userMap)).reverse();
  const balances = getKasbonOutstandingMap_(getSheetData('Kasbon'));
  mapped.forEach(k => {
    const bal = balances[String(k.userId)] || {debts:[]};
    const debt = bal.debts.find(d => String(d.id) === String(k.id));
    if (k.tipe === 'Kasbon' && k.status === 'Outstanding') k.sisa = debt ? debt.nominal : 0;
  });
  let summary = null;
  if (sess.role === 'admin') {
    const allUsers = getSheetData('Users');
    summary = allUsers.filter(u=>u.role==='karyawan').map(u=>({
      userId:String(u.id), userName:u.name||u.id,
      outstanding:(balances[String(u.id)]||{outstanding:0}).outstanding
    }));
  }
  return { list: mapped, summary };
}
function apiAddKasbon(token, payload) {
  const sess = getSession(token);
  payload = payload || {};
  if (!['admin','karyawan'].includes(sess.role)) return {success:false,message:'Akses kasbon tidak diizinkan.'};
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success:false, message:'Sistem sibuk. Coba lagi.' };
  try {
    const nominal = toPosNum(payload.nominal);
    if (nominal <= 0) return { success:false, message:'Nominal harus lebih dari 0.' };
    let userId, tipe, status;
    if (sess.role === 'karyawan') {
      userId = sess.id; tipe = 'Kasbon'; status = 'Outstanding';
    } else {
      userId = String(payload.userId || '');
      tipe = payload.tipe === 'Bayar' ? 'Bayar' : 'Kasbon';
      status = tipe === 'Bayar' ? 'Lunas' : 'Outstanding';
      if (!userId) return { success:false, message:'Pilih karyawan terlebih dahulu.' };
    }
    const ss=SpreadsheetApp.getActiveSpreadsheet();
    const sheet=ss.getSheetByName('Kasbon');
    if(!hasHeaders(sheet,['id','tanggal','userId','nominal','keterangan','tipe','status'])) return {success:false,message:'Struktur Kasbon belum lengkap. Tidak ada perubahan.'};

    // A request key makes a repeated submit safe if the browser retries after a network timeout.
    const requestKey=String(payload.requestKey||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,32);
    const id=requestKey?'KB'+requestKey:'KB'+Utilities.getUuid().slice(0,8).toUpperCase();
    const existing=getSheetData('Kasbon').find(k=>String(k.id)===id);
    if(existing) {
      if(String(existing.userId)!==userId||Number(existing.nominal)!==nominal||String(existing.tipe||'Kasbon')!==tipe)
        return {success:false,message:'Kunci transaksi sudah digunakan untuk data kasbon yang berbeda.'};
      return {success:true,message:tipe==='Bayar'?'Pembayaran kasbon sudah tercatat.':'Kasbon sudah tercatat.',id,duplicate:true};
    }

    const now=new Date();
    const keterangan=String(payload.keterangan||'').trim();
    const kasbonRow={id,tanggal:now,userId,nominal,keterangan,tipe,status,approvedBy:sess.username,approvedAt:now,gajiId:''};
    if(tipe==='Bayar') {
      if(sess.role!=='admin') return {success:false,message:'Hanya admin yang dapat menerima pembayaran kasbon.'};
      const balance=getKasbonOutstandingMap_(getSheetData('Kasbon'))[userId];
      const outstanding=balance?balance.outstanding:0;
      if(outstanding<=0) return {success:false,message:'Karyawan ini tidak memiliki kasbon yang belum dibayar.'};
      if(nominal>outstanding) return {success:false,message:'Pembayaran melebihi sisa kasbon '+fmtRpLocal(outstanding)+'.'};
      const metode=String(payload.metode||'Tunai').trim();
      if(!['Tunai','QRIS','Transfer'].includes(metode)) return {success:false,message:'Metode pembayaran harus Tunai, QRIS, atau Transfer.'};
      const kasSheet=ss.getSheetByName('Kas');
      if(!hasHeaders(kasSheet,['id','tanggal','keterangan','tipe','nominal','saldo'])) return {success:false,message:'Struktur Kas belum lengkap. Pembayaran kasbon tidak disimpan.'};
      const kasData=kasSheet.getDataRange().getValues();
      const saldoIndex=kasData[0].map(x=>String(x).trim()).indexOf('saldo');
      const saldoLama=kasData.length>1?Number(kasData[kasData.length-1][saldoIndex])||0:0;
      const kasId='KS'+Utilities.getUuid().slice(0,8).toUpperCase();
      const userName=(getSheetData('Users').find(u=>String(u.id)===userId)||{}).name||userId;
      const keteranganKas='Penerimaan kasbon '+userName+(keterangan?' · '+keterangan:'')+' [Kasbon '+id+']';
      const kasRow={id:kasId,tanggal:now,keterangan:keteranganKas,tipe:'Masuk',kategori:'Penerimaan Kasbon Karyawan',metode,nominal,saldo:saldoLama+nominal};
      const journal=beginWriteJournal(['Kasbon','Kas']);
      try {
        appendObjectsByHeaders(sheet,[kasbonRow]);
        appendObjectsByHeaders(kasSheet,[kasRow]);
      } catch(writeError) {
        try { rollbackWriteJournal(journal); }
        catch(rollbackError) { console.error('Gagal rollback penerimaan kasbon:',rollbackError.message); return {success:false,message:'Penerimaan gagal dan pemulihan otomatis perlu diperiksa. '+writeError.message+' | '+rollbackError.message}; }
        _clearSheetCache();
        return {success:false,message:'Penerimaan kasbon gagal. Tidak ada perubahan yang disimpan: '+writeError.message};
      }
      _clearSheetCache();
      return {success:true,message:'Pembayaran kasbon '+fmtRpLocal(nominal)+' diterima via '+metode+' dan dicatat ke Kas.',id,kasId,metode,nominal};
    }

    const journal=beginWriteJournal(['Kasbon']);
    try { appendObjectsByHeaders(sheet,[kasbonRow]); }
    catch(writeError) {
      try { rollbackWriteJournal(journal); }
      catch(rollbackError) { console.error('Gagal rollback kasbon:',rollbackError.message); return {success:false,message:'Penyimpanan kasbon gagal dan pemulihan otomatis perlu diperiksa. '+writeError.message+' | '+rollbackError.message}; }
      _clearSheetCache();
      return {success:false,message:'Kasbon gagal disimpan: '+writeError.message};
    }
    _clearSheetCache();
    return { success:true, message:'Kasbon dicatat.', id };
  } finally { lock.releaseLock(); }
}
function apiRejectKasbon(token, id) {
  const sess = requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Kasbon');
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const iId = h.indexOf('id'), iStatus = h.indexOf('status');
  const iBy = h.indexOf('approvedBy'), iAt = h.indexOf('approvedAt');
  for (let i = 1; i < data.length; i++) if (String(data[i][iId]) === String(id)) {
    sheet.getRange(i + 1, iStatus + 1).setValue('Rejected');
    if (iBy >= 0) sheet.getRange(i + 1, iBy + 1).setValue(sess.username);
    if (iAt >= 0) sheet.getRange(i + 1, iAt + 1).setValue(new Date());
    _clearSheetCache();
    return { success: true, message: 'Kasbon ditolak.' };
  }
  return { success: false, message: 'Kasbon tidak ditemukan.' };
}
function apiDeleteKasbon(token, id) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Kasbon');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(id)) { sheet.deleteRow(i+1); _clearSheetCache(); return { success:true, message:'Kasbon dihapus.' }; }
  return { success:false, message:'Kasbon tidak ditemukan.' };
}
function apiGetOutstandingKasbon(token, userId) {
  requireRole(token, ['admin']);
  const balance = getKasbonOutstandingMap_(getSheetData('Kasbon'))[String(userId)] || {outstanding:0,debts:[]};
  return { total:balance.outstanding, items:balance.debts };
}

// ============================================================
//  GAJI LAMA + PESANAN SUPPLIER
// ============================================================
function apiGetSettingGaji(token) {
  const sess = requireRole(token, ['admin','karyawan']);
  const userMap = {}; getSheetData('Users').forEach(u => userMap[u.id] = u.name);
  let list = getSheetData('SettingGaji');
  if (sess.role === 'karyawan') list = list.filter(g => String(g.userId) === String(sess.id));
  return list.map(g => ({ id:g.id, userId:g.userId, userName: userMap[g.userId] || g.userId, tipe: g.tipe || 'Bulanan', nominal: Number(g.nominal) || 0, aktif: String(g.aktif) !== 'false' && g.aktif !== false, berlakuDari: formatDate(g.berlakuDari) }));
}
function apiSaveSettingGaji(token, item) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SettingGaji');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  const userId = String(item.userId || '').trim();
  const tipe = ['Harian','Mingguan','Bulanan'].indexOf(item.tipe) !== -1 ? item.tipe : 'Bulanan';
  const nominal = toPosNum(item.nominal);
  if (!userId) return { success: false, message: 'Pilih karyawan.' };
  if (nominal <= 0) return { success: false, message: 'Nominal harus lebih dari 0.' };
  const row = [item.id || ('SG' + Utilities.getUuid().slice(0,6).toUpperCase()), userId, tipe, nominal, item.aktif !== false, item.berlakuDari ? new Date(item.berlakuDari) : new Date()];
  if (item.id) { for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(item.id)) { sheet.getRange(i+1,1,1,6).setValues([row]); _clearSheetCache(); return { success:true, message:'Setting diperbarui.' }; } return { success:false, message:'Setting tidak ditemukan.' }; }
  sheet.appendRow(row); _clearSheetCache(); return { success:true, message:'Setting ditambahkan.' };
}
function apiRekapGaji(token, filter) {
  requireRole(token, ['admin']);
  filter = filter || {};
  const tipe = ['Harian','Mingguan','Bulanan'].indexOf(filter.tipe) !== -1 ? filter.tipe : 'Bulanan';
  const dari = filter.dari ? new Date(filter.dari) : new Date(Date.now() - 30 * 86400000);
  const sampai = filter.sampai ? new Date(filter.sampai) : new Date();
  const fromMs = dari.getTime(), toMs = sampai.getTime();
  const users = getSheetData('Users').filter(u => u.role === 'karyawan' && String(u.aktif) !== 'false' && u.aktif !== false);
  const settings = getSheetData('SettingGaji').filter(s => String(s.aktif) !== 'false' && s.aktif !== false && s.tipe === tipe);
  const settingMap = {}; settings.forEach(s => settingMap[s.userId] = Number(s.nominal) || 0);
  const hadirMap = {};
  getSheetData('Absensi').forEach(a => {
    const t = a.tanggal instanceof Date ? a.tanggal.getTime() : new Date(a.tanggal).getTime();
    if (t < fromMs || t > toMs) return;
    if (!a.jamBuka) return;
    if (!hadirMap[a.userId]) hadirMap[a.userId] = {};
    hadirMap[a.userId][formatDate(a.tanggal)] = true;
  });
  const kasbonMap = getKasbonOutstandingMap_(getSheetData('Kasbon'));
  const list = users.map(u => {
    const hadir = hadirMap[u.id] ? Object.keys(hadirMap[u.id]).length : 0;
    const nominalSetting = settingMap[u.id] || 0;
    let gajiPokok = nominalSetting;
    if (tipe === 'Harian') gajiPokok = nominalSetting * hadir;
    else if (tipe === 'Mingguan') { const hariCount = Math.ceil((toMs - fromMs) / 86400000); const minggu = Math.max(1, Math.round(hariCount / 7)); gajiPokok = nominalSetting * minggu; }
    const kasbonInfo = kasbonMap[String(u.id)] || { outstanding: 0, debts: [] };
    return { userId:u.id, userName:u.name, lapakId:u.lapakId || '', hadir, tipe, nominalSetting, gajiPokok, tunjangan:0, bonus:0, potonganKasbon: kasbonInfo.outstanding, kasbonItems: kasbonInfo.debts, totalBersih: Math.max(0, gajiPokok - kasbonInfo.outstanding) };
  });
  const totals = list.reduce((s, x) => { s.gajiPokok += x.gajiPokok; s.potonganKasbon += x.potonganKasbon; s.totalBersih += x.totalBersih; return s; }, { gajiPokok: 0, potonganKasbon: 0, totalBersih: 0 });
  return { periode: { dari: formatDate(dari), sampai: formatDate(new Date(toMs - 1)), tipe }, list, totals };
}
function apiGetGaji(token, filter) {
  const sess = getSession(token);
  filter = filter || {};
  const userMap = {}; getSheetData('Users').forEach(u => userMap[u.id] = u.name);
  let list = getSheetData('Gaji');
  if (sess.role === 'karyawan') list = list.filter(g => String(g.userId) === String(sess.id));
  else if (filter.userId) list = list.filter(g => String(g.userId) === String(filter.userId));
  return list.map(g => ({ id:g.id, tanggal:formatDate(g.tanggal), userId:g.userId, userName: userMap[g.userId] || g.userId, periode: g.periode || '', gajiPokok: Number(g.gajiPokok) || 0, potonganKasbon: Number(g.potonganKasbon) || 0, tunjangan: Number(g.tunjangan) || 0, gajiBersih: Number(g.gajiBersih) || 0, catatan: g.catatan || '', dibayarBy: g.dibayarBy || '' })).reverse();
}
function apiBayarGaji(token, payload) {
  const sess = requireRole(token, ['admin']);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    const userId = payload.userId;
    const periode = String(payload.periode || todayStr());
    const gajiPokok = toPosNum(payload.gajiPokok);
    const tunjangan = toPosNum(payload.tunjangan);
    if (!userId) return { success: false, message: 'Pilih karyawan.' };
    if (gajiPokok <= 0) return { success: false, message: 'Gaji harus lebih dari 0.' };
    const kasbonSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Kasbon');
    const kasbonData = kasbonSheet.getDataRange().getValues();
    const kh = kasbonData[0];
    const kUser = kh.indexOf('userId'), kStatus = kh.indexOf('status'), kTipe = kh.indexOf('tipe');
    const kNominal = kh.indexOf('nominal'), kGajiId = kh.indexOf('gajiId');
    const outstandingMap = getKasbonOutstandingMap_(getSheetData('Kasbon'));
    const potonganKasbon = (outstandingMap[String(userId)] || {outstanding:0}).outstanding;
    const rowsToLunas = [];
    for (let i = 1; i < kasbonData.length; i++) {
      if (String(kasbonData[i][kUser]) === String(userId) && kasbonData[i][kStatus] === 'Outstanding' && kasbonData[i][kTipe] === 'Kasbon') rowsToLunas.push(i + 1);
    }
    const gajiBersih = Math.max(0, gajiPokok + tunjangan - potonganKasbon);
    const kasSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Kas');
    const kasData = kasSheet.getDataRange().getValues();
    const iSaldo = kasData[0].indexOf('saldo');
    const saldoLama = kasData.length > 1 ? Number(kasData[kasData.length - 1][iSaldo]) || 0 : 0;
    const kasId = 'KS' + Utilities.getUuid().slice(0, 8).toUpperCase();
    const uName = (getSheetData('Users').find(u => String(u.id) === String(userId)) || {}).name || userId;
    if (gajiBersih > 0) appendObjectsByHeaders(kasSheet,[{id:kasId,tanggal:new Date(),keterangan:'Gaji '+uName+' ('+periode+')',tipe:'Keluar',kategori:'Gaji',nominal:gajiBersih,saldo:saldoLama-gajiBersih}]);
    const gajiSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Gaji');
    const gajiId = 'G' + Utilities.getUuid().slice(0, 8).toUpperCase();
    gajiSheet.appendRow([gajiId, new Date(), userId, periode, gajiPokok, potonganKasbon, tunjangan, gajiBersih, gajiBersih > 0 ? kasId : '', String(payload.catatan || ''), sess.username]);
    rowsToLunas.forEach(r => { kasbonSheet.getRange(r, kStatus + 1).setValue('Lunas'); if (kGajiId >= 0) kasbonSheet.getRange(r, kGajiId + 1).setValue(gajiId); });
    _clearSheetCache();
    return { success: true, message: 'Gaji dibayar. Potongan: ' + potonganKasbon, gajiBersih, potonganKasbon };
  } finally { lock.releaseLock(); }
}
function apiBayarGajiBulk(token, payload) {
  const sess = requireRole(token, ['admin']);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    const items = Array.isArray(payload.items) ? payload.items : [];
    const periode = String(payload.periode || todayStr());
    if (!items.length) return { success: false, message: 'Tidak ada yang dipilih.' };
    const kasbonSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Kasbon');
    const kasbonData = kasbonSheet.getDataRange().getValues();
    const kh = kasbonData[0];
    const kUser = kh.indexOf('userId'), kStatus = kh.indexOf('status'), kTipe = kh.indexOf('tipe');
    const kNominal = kh.indexOf('nominal'), kGajiId = kh.indexOf('gajiId');
    const kasSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Kas');
    const gajiSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Gaji');
    const userMap = {}; getSheetData('Users').forEach(u => userMap[u.id] = u.name);
    const results = []; let grandTotal = 0, grandPotongan = 0;
    for (const it of items) {
      const userId = it.userId, gajiPokok = toPosNum(it.gajiPokok), tunjangan = toPosNum(it.tunjangan), bonus = toPosNum(it.bonus);
      if (!userId || gajiPokok <= 0) continue;
      let potonganKasbon = 0;
      const rowsToLunas = [];
      for (let i = 1; i < kasbonData.length; i++) {
        if (String(kasbonData[i][kUser]) === String(userId) && kasbonData[i][kStatus] === 'Outstanding' && kasbonData[i][kTipe] === 'Kasbon') {
          potonganKasbon += Number(kasbonData[i][kNominal]) || 0; rowsToLunas.push(i + 1);
        }
      }
      const gajiBersih = Math.max(0, gajiPokok + tunjangan + bonus - potonganKasbon);
      let kasId = '';
      if (gajiBersih > 0) {
        const kasData = kasSheet.getDataRange().getValues();
        const iSaldo = kasData[0].indexOf('saldo');
        const saldoLama = kasData.length > 1 ? Number(kasData[kasData.length - 1][iSaldo]) || 0 : 0;
        kasId = 'KS' + Utilities.getUuid().slice(0, 8).toUpperCase();
        appendObjectsByHeaders(kasSheet,[{id:kasId,tanggal:new Date(),keterangan:'Gaji '+(userMap[userId]||userId)+' ('+periode+')',tipe:'Keluar',kategori:'Gaji',nominal:gajiBersih,saldo:saldoLama-gajiBersih}]);
      }
      const gajiId = 'G' + Utilities.getUuid().slice(0, 8).toUpperCase();
      gajiSheet.appendRow([gajiId, new Date(), userId, periode, gajiPokok, potonganKasbon, tunjangan + bonus, gajiBersih, kasId, String(it.catatan || ''), sess.username]);
      rowsToLunas.forEach(r => { kasbonSheet.getRange(r, kStatus + 1).setValue('Lunas'); if (kGajiId >= 0) kasbonSheet.getRange(r, kGajiId + 1).setValue(gajiId); });
      results.push({ userId, gajiBersih, potonganKasbon });
      grandTotal += gajiBersih; grandPotongan += potonganKasbon;
    }
    _clearSheetCache();
    return { success: true, message: results.length + ' gaji dibayar. Total: ' + grandTotal, count: results.length, total: grandTotal, potongan: grandPotongan, details: results };
  } finally { lock.releaseLock(); }
}
function mapPesanan(p, supMap) {
  return { id:p.id, tanggal:formatDate(p.tanggal), supplierId: p.supplierId || '', supplierNama: supMap && supMap[p.supplierId] || p.supplierId || '', item: p.item || '', qty: Number(p.qty) || 0, hargaSatuan: Number(p.hargaSatuan) || 0, subtotal: Number(p.subtotal) || 0, status: p.status || 'Draft', keterangan: p.keterangan || '', dibuatOleh: p.dibuatOleh || '', updatedAt: formatDateTime(p.updatedAt) };
}
function apiGetPesanan(token, filter) {
  requireRole(token, ['admin']);
  filter = filter || {};
  const supMap = {}; getSheetData('Suppliers').forEach(s => supMap[s.id] = s.nama);
  let list = getSheetData('Pesanan').map(p => mapPesanan(p, supMap));
  if (filter.supplierId) list = list.filter(p => String(p.supplierId) === String(filter.supplierId));
  if (filter.status) list = list.filter(p => p.status === filter.status);
  if (filter.dari) list = list.filter(p => p.tanggal >= filter.dari);
  if (filter.sampai) list = list.filter(p => p.tanggal <= filter.sampai);
  return list.reverse();
}
function apiSavePesanan(token, item) {
  const sess = requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Pesanan');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  const itemName = String(item.item || '').trim();
  if (!itemName) return { success: false, message: 'Nama item wajib.' };
  const qty = toPosNum(item.qty) || 1, harga = toPosNum(item.hargaSatuan);
  const status = ['Draft','Ordered','Received','Cancelled'].indexOf(item.status) !== -1 ? item.status : 'Draft';
  const row = [item.id || ('PO' + Utilities.getUuid().slice(0,8).toUpperCase()), item.tanggal ? new Date(item.tanggal) : new Date(), item.supplierId || '', itemName, qty, harga, qty * harga, status, String(item.keterangan || ''), sess.username, new Date()];
  if (item.id) { for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(item.id)) { sheet.getRange(i+1,1,1,11).setValues([row]); _clearSheetCache(); return { success:true, message:'Pesanan diperbarui.' }; } return { success:false, message:'Pesanan tidak ditemukan.' }; }
  sheet.appendRow(row); _clearSheetCache(); return { success:true, message:'Pesanan ditambahkan.' };
}
function apiUpdatePesananStatus(token, id, status) {
  requireRole(token, ['admin']);
  if (['Draft','Ordered','Received','Cancelled'].indexOf(status) === -1) return { success: false, message: 'Status tidak valid.' };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Pesanan');
  const data = sheet.getDataRange().getValues();
  const iId = data[0].indexOf('id'), iStatus = data[0].indexOf('status'), iUpd = data[0].indexOf('updatedAt');
  for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(id)) {
    sheet.getRange(i+1, iStatus+1).setValue(status);
    if (iUpd >= 0) sheet.getRange(i+1, iUpd+1).setValue(new Date());
    _clearSheetCache(); return { success:true, message:'Status diperbarui.' };
  }
  return { success:false, message:'Pesanan tidak ditemukan.' };
}
function apiDeletePesanan(token, id) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Pesanan');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(id)) { sheet.deleteRow(i+1); _clearSheetCache(); return { success:true, message:'Pesanan dihapus.' }; }
  return { success:false, message:'Pesanan tidak ditemukan.' };
}
function apiRekapPesanan(token, filter) {
  requireRole(token, ['admin']);
  filter = filter || {};
  const dari = filter.dari ? new Date(filter.dari) : new Date(Date.now() - 30 * 86400000);
  const sampai = filter.sampai ? new Date(filter.sampai) : new Date();
  const fromMs = dari.getTime(), toMs = sampai.getTime();
  const supMap = {}; getSheetData('Suppliers').forEach(s => supMap[s.id] = s.nama);
  const all = getSheetData('Pesanan').filter(p => {
    const t = p.tanggal instanceof Date ? p.tanggal.getTime() : new Date(p.tanggal).getTime();
    return t >= fromMs && t <= toMs;
  });
  const perSupplier = {};
  const perStatus = { Draft:0, Ordered:0, Received:0, Cancelled:0 };
  all.forEach(p => {
    const supId = p.supplierId || 'unknown';
    if (!perSupplier[supId]) perSupplier[supId] = { supplierId:supId, nama: supMap[supId] || supId, count: 0, qty: 0, total: 0 };
    perSupplier[supId].count++;
    perSupplier[supId].qty += Number(p.qty) || 0;
    perSupplier[supId].total += Number(p.subtotal) || 0;
    perStatus[p.status] = (perStatus[p.status] || 0) + 1;
  });
  return { periode: { dari: formatDate(dari), sampai: formatDate(new Date(toMs - 1)) }, perSupplier: Object.values(perSupplier).sort((a, b) => b.total - a.total), perStatus, totals: { count: all.length, qty: all.reduce((s, p) => s + (Number(p.qty) || 0), 0), total: all.reduce((s, p) => s + (Number(p.subtotal) || 0), 0) } };
}

// ============================================================
//  LAPORAN & EXPORT
// ============================================================
function apiGetLaporan(token, filter) {
  requireRole(token, ['admin']);
  filter = filter || {};
  const dari = filter.dari ? new Date(filter.dari) : new Date(Date.now() - 30 * 86400000);
  const sampai = filter.sampai ? new Date(new Date(filter.sampai).getTime() + 86400000) : new Date();
  return buildLaporanForRange(dari, sampai, filter.lapakId || null);
}
function apiSendSupplierReport(token, payload) {
  requireRole(token, ['admin']);
  payload = payload || {};
  const supplierId = String(payload.supplierId || '');
  const supplier = getSheetData('Suppliers').find(s => String(s.id) === supplierId);
  if (!supplier) return { success: false, message: 'Supplier tidak ditemukan.' };
  const email = String(supplier.email || '').trim();
  if (!email) return { success: false, message: 'Email supplier belum diisi.' };

  const konsinyasi = getSheetData('Konsinyasi');
  if (!konsinyasi.some(k => String(k.supplierId) === supplierId && k.status === 'Bayar')) {
    return { success: false, message: 'Bayar supplier dulu.' };
  }

  const dari = String(payload.dari || '');
  const sampai = String(payload.sampai || '');
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(dari) || !datePattern.test(sampai) || dari > sampai) {
    return { success: false, message: 'Rentang tanggal laporan tidak valid.' };
  }
  const report = apiGetLaporan(token, { dari, sampai });
  const katalog = {};
  getSheetData('Katalog').forEach(k => { katalog[String(k.id)] = k; });
  const items = report.perItem.filter(i => String((katalog[String(i.katalogId)] || {}).supplierId) === supplierId);
  const paidItems = konsinyasi.filter(k => {
    if (String(k.supplierId) !== supplierId || k.status !== 'Bayar') return false;
    const paidDate = k.bayarAt instanceof Date ? formatDate(k.bayarAt) : String(k.bayarAt || '').slice(0, 10);
    return paidDate >= dari && paidDate <= sampai;
  });
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const rupiah = value => 'Rp ' + (Number(value) || 0).toLocaleString('id-ID');
  const itemRows = items.length ? items.map(i => `<tr><td>${escapeHtml(i.nama)}</td><td style="text-align:right">${Number(i.qtyLaku) || 0} pcs</td><td style="text-align:right">${rupiah(i.omzet)}</td></tr>`).join('') : '<tr><td colspan="3">Tidak ada penjualan pada periode ini.</td></tr>';
  const paymentRows = paidItems.length ? paidItems.map(k => {
    const item = katalog[String(k.katalogId)] || {};
    return `<tr><td>${escapeHtml(formatDate(k.tanggal))}</td><td>${escapeHtml(item.nama || k.katalogId)}</td><td style="text-align:right">${Number(k.qtyLaku) || 0} pcs</td><td style="text-align:right">${rupiah(k.utang)}</td></tr>`;
  }).join('') : '<tr><td colspan="4">Tidak ada pembayaran pada periode ini.</td></tr>';
  const totalQty = items.reduce((sum, i) => sum + (Number(i.qtyLaku) || 0), 0);
  const totalOmzet = items.reduce((sum, i) => sum + (Number(i.omzet) || 0), 0);
  const content = `<p>Halo ${escapeHtml(supplier.nama)}, berikut laporan periode ${escapeHtml(dari)} sampai ${escapeHtml(sampai)}.</p><h3>Rekap Penjualan</h3><table style="width:100%;border-collapse:collapse"><tr><th>Item</th><th>Qty</th><th>Omzet</th></tr>${itemRows}<tr><th>Total</th><th style="text-align:right">${totalQty} pcs</th><th style="text-align:right">${rupiah(totalOmzet)}</th></tr></table><h3>Rincian Pembayaran</h3><table style="width:100%;border-collapse:collapse"><tr><th>Tanggal</th><th>Item</th><th>Qty</th><th>Nominal</th></tr>${paymentRows}</table>`;
  const subject = `Laporan Supplier ${supplier.nama} (${dari} - ${sampai})`;
  const sent = kirimEmail(email, subject, emailWrapper('Laporan Supplier', content));
  return { success: sent, message: sent ? 'Laporan berhasil dikirim ke ' + email : 'Gagal mengirim laporan.' };
}
function apiExportSetoranCSV(token, dari, sampai) {
  requireRole(token, ['admin']);
  const filter = {};
  if (dari) filter.dari = dari;
  if (sampai) filter.sampai = sampai;
  const list = apiGetSetoranList(token, filter);
  const rows = [['ID','Tanggal','Lapak','Penjualan Tunai','QRIS Langsung Owner','Transfer Langsung Owner','Total Sistem','Pengeluaran Operasional','Pembayaran Titipan Supplier','Total Penerimaan Owner','Tunai Diserahkan Karyawan','Selisih','Status']];
  list.forEach(s => rows.push([s.id, s.tanggal, s.lapakId, s.totalTunai, s.totalQris, s.totalTransfer, s.totalSistem, s.pengeluaran, s.totalTitipan, s.expectedSetoran, s.uangDisetor, s.selisih, s.status]));
  const csv = rows.map(r => r.map(c => { const str = String(c); return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str; }).join(',')).join('\n');
  return { success: true, filename: 'Laporan_Setoran_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm') + '.csv', content: csv };
}

// ============================================================
//  FASE 1 — ABSENSI KARYAWAN / BONUS / PAYROLL
// ============================================================
function apiAbsenMasuk(token, lapakId) {
  const sess = requireRole(token, ['karyawan']);
  const tgl = todayStr();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AbsensiKaryawan');
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const iUser = h.indexOf('userId'), iTgl = h.indexOf('tanggal'), iKeluar = h.indexOf('jamKeluar');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][iUser]) === String(sess.id) && formatDate(data[i][iTgl]) === tgl) {
      if (!data[i][iKeluar]) return { success: false, message: 'Anda sudah absen masuk hari ini.' };
      return { success: false, message: 'Anda sudah menyelesaikan absensi hari ini.' };
    }
  }
  const id = 'AK' + Utilities.getUuid().slice(0, 8).toUpperCase();
  sheet.appendRow([id, new Date(), sess.id, lapakId || sess.lapakId || '', new Date(), '', 'Hadir', sess.username, '']);
  _clearSheetCache();
  const jamStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  return { success: true, message: 'Absen masuk jam ' + jamStr, id };
}
function apiAbsenKeluar(token) {
  const sess = requireRole(token, ['karyawan']);
  const tgl = todayStr();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AbsensiKaryawan');
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const iUser = h.indexOf('userId'), iTgl = h.indexOf('tanggal');
  const iMasuk = h.indexOf('jamMasuk'), iKeluar = h.indexOf('jamKeluar');
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][iUser]) === String(sess.id) && formatDate(data[i][iTgl]) === tgl) {
      if (data[i][iKeluar]) return { success: false, message: 'Anda sudah absen keluar hari ini.' };
      if (!data[i][iMasuk]) return { success: false, message: 'Anda belum absen masuk.' };
      sheet.getRange(i + 1, iKeluar + 1).setValue(new Date());
      _clearSheetCache();
      const jamStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
      return { success: true, message: 'Absen keluar jam ' + jamStr };
    }
  }
  return { success: false, message: 'Anda belum absen masuk hari ini.' };
}
function apiAbsensiHariIni(token) {
  const sess = getSession(token);
  const tgl = todayStr();
  const list = getSheetData('AbsensiKaryawan').filter(a => String(a.userId) === String(sess.id) && formatDate(a.tanggal) === tgl);
  if (!list.length) return { status: 'belum', jamMasuk: null, jamKeluar: null, lapakId: null };
  const a = list[list.length - 1];
  const jm = a.jamMasuk instanceof Date ? a.jamMasuk : null;
  const jk = a.jamKeluar instanceof Date ? a.jamKeluar : null;
  return { status: jk ? 'selesai' : (jm ? 'bekerja' : 'belum'), jamMasuk: jm ? Utilities.formatDate(jm, Session.getScriptTimeZone(), 'HH:mm') : null, jamKeluar: jk ? Utilities.formatDate(jk, Session.getScriptTimeZone(), 'HH:mm') : null, lapakId: a.lapakId || '' };
}
function apiGetAbsensiKaryawan(token, filter) {
  const sess = requireRole(token, ['admin', 'karyawan']);
  filter = filter || {};
  const userMap = {}; getSheetData('Users').forEach(u => userMap[u.id] = u.name);
  const lapakMap = {}; getSheetData('Lapak').forEach(l => lapakMap[l.id] = l.nama);
  let list = getSheetData('AbsensiKaryawan').map(a => {
    const jm = a.jamMasuk instanceof Date ? a.jamMasuk : null;
    const jk = a.jamKeluar instanceof Date ? a.jamKeluar : null;
    let jamKerja = 0;
    if (jm && jk) jamKerja = Math.round(((jk.getTime() - jm.getTime()) / 3600000) * 100) / 100;
    return { id: a.id, tanggal: formatDate(a.tanggal), userId: a.userId, userName: userMap[a.userId] || a.userId, lapakId: a.lapakId, lapakNama: lapakMap[a.lapakId] || a.lapakId, jamMasuk: jm ? Utilities.formatDate(jm, Session.getScriptTimeZone(), 'HH:mm') : '', jamKeluar: jk ? Utilities.formatDate(jk, Session.getScriptTimeZone(), 'HH:mm') : '', jamKerja, status: a.status || 'Hadir', filledBy: a.filledBy || '', catatan: a.catatan || '' };
  });
  if (sess.role === 'karyawan') list = list.filter(a => String(a.userId) === String(sess.id));
  if (filter.bulan) list = list.filter(a => a.tanggal.indexOf(filter.bulan) === 0);
  if (filter.userId) list = list.filter(a => String(a.userId) === String(filter.userId));
  if (filter.lapakId) list = list.filter(a => String(a.lapakId) === String(filter.lapakId));
  return list.reverse();
}
function apiEditAbsensi(token, id, updates) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AbsensiKaryawan');
  const data = sheet.getDataRange().getValues();
  const h = data[0]; const iId = h.indexOf('id');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][iId]) === String(id)) {
      ['lapakId', 'status', 'catatan'].forEach(f => { if (updates[f] !== undefined) { const idx = h.indexOf(f); if (idx >= 0) sheet.getRange(i + 1, idx + 1).setValue(updates[f]); } });
      ['jamMasuk', 'jamKeluar'].forEach(f => {
        if (updates[f] !== undefined) {
          const idx = h.indexOf(f);
          const tgl = formatDate(data[i][h.indexOf('tanggal')]);
          if (idx >= 0) {
            if (!updates[f]) sheet.getRange(i + 1, idx + 1).setValue('');
            else { const [hh, mm] = String(updates[f]).split(':'); sheet.getRange(i + 1, idx + 1).setValue(new Date(tgl + 'T' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ':00')); }
          }
        }
      });
      _clearSheetCache();
      return { success: true, message: 'Absensi diperbarui.' };
    }
  }
  return { success: false, message: 'Absensi tidak ditemukan.' };
}
function apiDeleteAbsensi(token, id) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AbsensiKaryawan');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  for (let i = 1; i < data.length; i++) if (String(data[i][iId]) === String(id)) { sheet.deleteRow(i + 1); _clearSheetCache(); return { success: true, message: 'Absensi dihapus.' }; }
  return { success: false, message: 'Absensi tidak ditemukan.' };
}
function apiIsiAbsensiOrangLain(token, payload) {
  const sess = requireRole(token, ['admin', 'karyawan']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AbsensiKaryawan');
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const iUser = h.indexOf('userId'), iTgl = h.indexOf('tanggal');
  const iMasuk = h.indexOf('jamMasuk'), iKeluar = h.indexOf('jamKeluar');
  const tgl = payload.tanggal || todayStr();
  const toDate = (jamStr) => { if (!jamStr) return ''; const [hh, mm] = String(jamStr).split(':'); return new Date(tgl + 'T' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ':00'); };
  const jm = toDate(payload.jamMasuk);
  const jk = toDate(payload.jamKeluar);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][iUser]) === String(payload.userId) && formatDate(data[i][iTgl]) === tgl) {
      if (jm) sheet.getRange(i + 1, iMasuk + 1).setValue(jm);
      if (jk) sheet.getRange(i + 1, iKeluar + 1).setValue(jk);
      sheet.getRange(i + 1, h.indexOf('status') + 1).setValue(payload.status || 'Hadir');
      sheet.getRange(i + 1, h.indexOf('lapakId') + 1).setValue(payload.lapakId || '');
      sheet.getRange(i + 1, h.indexOf('catatan') + 1).setValue(payload.catatan || '');
      sheet.getRange(i + 1, h.indexOf('filledBy') + 1).setValue(sess.username);
      _clearSheetCache();
      return { success: true, message: 'Absensi diperbarui.' };
    }
  }
  sheet.appendRow(['AK' + Utilities.getUuid().slice(0, 8).toUpperCase(), new Date(tgl), payload.userId, payload.lapakId || '', jm, jk, payload.status || 'Hadir', sess.username, payload.catatan || '']);
  _clearSheetCache();
  return { success: true, message: 'Absensi dicatat.' };
}
function apiGetBonusAntar(token, filter) {
  const sess = requireRole(token, ['admin', 'karyawan']);
  filter = filter || {};
  const userMap = {}; getSheetData('Users').forEach(u => userMap[u.id] = u.name);
  let list = getSheetData('BonusAntar').map(b => ({ id: b.id, tanggal: formatDate(b.tanggal), userId: b.userId, userName: userMap[b.userId] || b.userId, tujuan: b.tujuan || '', jarakKm: Number(b.jarakKm) || 0, qty: Number(b.qty) || 0, nominal: Number(b.nominal) || 0, keterangan: b.keterangan || '', createdBy: b.createdBy || '', pesananId: b.pesananId || '' }));
  if (sess.role === 'karyawan') list = list.filter(b => String(b.userId) === String(sess.id));
  if (filter.bulan) list = list.filter(b => b.tanggal.indexOf(filter.bulan) === 0);
  if (filter.userId) list = list.filter(b => String(b.userId) === String(filter.userId));
  return list.reverse();
}
function apiSaveBonusAntar(token, item) {
  const sess = requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('BonusAntar');
  const data = sheet.getDataRange().getValues();
  const h = data[0]; const iId = h.indexOf('id');
  if (!item.userId) return { success: false, message: 'Pilih karyawan.' };
  if (toPosNum(item.nominal) <= 0) return { success: false, message: 'Nominal harus lebih dari 0.' };
  const row = [item.id || ('BA' + Utilities.getUuid().slice(0, 8).toUpperCase()), item.tanggal ? new Date(item.tanggal) : new Date(), item.userId, String(item.tujuan || ''), toPosNumF(item.jarakKm), toPosNum(item.qty), toPosNum(item.nominal), String(item.keterangan || ''), sess.username, item.pesananId || ''];
  if (item.id) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][iId]) === String(item.id)) { sheet.getRange(i + 1, 1, 1, row.length).setValues([row]); _clearSheetCache(); return { success: true, message: 'Bonus diperbarui.' }; }
    }
    return { success: false, message: 'Bonus tidak ditemukan.' };
  }
  sheet.appendRow(row);
  _clearSheetCache();
  return { success: true, message: 'Bonus antar dicatat.' };
}
function apiDeleteBonusAntar(token, id) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('BonusAntar');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  for (let i = 1; i < data.length; i++) if (String(data[i][iId]) === String(id)) { sheet.deleteRow(i + 1); _clearSheetCache(); return { success: true, message: 'Bonus dihapus.' }; }
  return { success: false, message: 'Bonus tidak ditemukan.' };
}
function apiGetSettingPayroll(token) {
  requireRole(token, ['admin']);
  const lapakMap = {}; getSheetData('Lapak').forEach(l => lapakMap[l.id] = l.nama);
  return getSheetData('SettingPayroll').map(s => ({ id: s.id, lapakId: s.lapakId, lapakNama: lapakMap[s.lapakId] || s.lapakId, bonusMerekap: Number(s.bonusMerekap) || 0, tunjanganLapak: Number(s.tunjanganLapak) || 0, berlakuDari: formatDate(s.berlakuDari), aktif: String(s.aktif) !== 'false' && s.aktif !== false }));
}
function apiSaveSettingPayroll(token, item) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SettingPayroll');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  if (!item.lapakId) return { success: false, message: 'Pilih lapak.' };
  const row = [item.id || ('SP' + Utilities.getUuid().slice(0, 8).toUpperCase()), item.lapakId, toPosNum(item.bonusMerekap), toPosNum(item.tunjanganLapak), item.berlakuDari ? new Date(item.berlakuDari) : new Date(), item.aktif !== false];
  if (item.id) { for (let i=1;i<data.length;i++) if (String(data[i][iId])===String(item.id)) { sheet.getRange(i+1,1,1,row.length).setValues([row]); _clearSheetCache(); return { success:true, message:'Setting diperbarui.' }; } return { success:false, message:'Setting tidak ditemukan.' }; }
  sheet.appendRow(row); _clearSheetCache();
  return { success: true, message: 'Setting ditambahkan.' };
}
function apiDeleteSettingPayroll(token, id) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SettingPayroll');
  const data = sheet.getDataRange().getValues(); const iId = data[0].indexOf('id');
  for (let i = 1; i < data.length; i++) if (String(data[i][iId]) === String(id)) { sheet.deleteRow(i + 1); _clearSheetCache(); return { success: true, message: 'Setting dihapus.' }; }
  return { success: false, message: 'Setting tidak ditemukan.' };
}
function apiGetHariEfektif(token, bulan) {
  requireRole(token, ['admin']);
  const lapakMap = {}; getSheetData('Lapak').forEach(l => lapakMap[l.id] = l.nama);
  let list = getSheetData('HariEfektif');
  if (bulan) list = list.filter(h => h.bulan === bulan);
  return list.map(h => ({ id: h.id, bulan: h.bulan, lapakId: h.lapakId, lapakNama: lapakMap[h.lapakId] || h.lapakId, jumlahHari: Number(h.jumlahHari) || 0, catatan: h.catatan || '' }));
}
function apiSaveHariEfektif(token, item) {
  requireRole(token, ['admin']);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('HariEfektif');
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const iBulan = h.indexOf('bulan'), iLapak = h.indexOf('lapakId');
  if (!item.bulan || !item.lapakId) return { success: false, message: 'Bulan dan lapak wajib.' };
  for (let i = 1; i < data.length; i++) {
    if (data[i][iBulan] === item.bulan && String(data[i][iLapak]) === String(item.lapakId)) {
      sheet.getRange(i + 1, h.indexOf('jumlahHari') + 1).setValue(toPosNum(item.jumlahHari));
      sheet.getRange(i + 1, h.indexOf('catatan') + 1).setValue(item.catatan || '');
      _clearSheetCache();
      return { success: true, message: 'Hari efektif diperbarui.' };
    }
  }
  sheet.appendRow(['HE' + Utilities.getUuid().slice(0, 8).toUpperCase(), item.bulan, item.lapakId, toPosNum(item.jumlahHari), item.catatan || '']);
  _clearSheetCache();
  return { success: true, message: 'Hari efektif dicatat.' };
}
function apiAutoHariEfektif(token, bulan) {
  requireRole(token, ['admin']);
  if (!bulan) return { success: false, message: 'Pilih bulan.' };
  const lapakList = getSheetData('Lapak').filter(l => String(l.aktif) !== 'false' && l.aktif !== false);
  const absensiKaryawan = getSheetData('AbsensiKaryawan');
  const result = [];
  lapakList.forEach(l => {
    const set = {};
    absensiKaryawan.forEach(a => { if (String(a.lapakId) === String(l.id) && formatDate(a.tanggal).indexOf(bulan) === 0) set[formatDate(a.tanggal)] = true; });
    result.push({ lapakId: l.id, lapakNama: l.nama, jumlahHari: Object.keys(set).length });
  });
  return { success: true, list: result, message: 'Auto-hitung selesai.' };
}
function apiRekapPayroll(token, bulan) {
  requireRole(token, ['admin']);
  if (!bulan) return { success: false, message: 'Pilih bulan.' };
  const users = getSheetData('Users').filter(u => u.role === 'karyawan' && String(u.aktif) !== 'false' && u.aktif !== false);
  const lapakMap = {}; getSheetData('Lapak').forEach(l => lapakMap[l.id] = l);
  const setoran = getSheetData('Setoran').filter(s => formatDate(s.tanggal).indexOf(bulan) === 0);
  const absensiK = getSheetData('AbsensiKaryawan').filter(a => formatDate(a.tanggal).indexOf(bulan) === 0);
  const bonusAntar = getSheetData('BonusAntar').filter(b => formatDate(b.tanggal).indexOf(bulan) === 0);
  const kasbon = getSheetData('Kasbon').filter(k => k.status === 'Outstanding' && k.tipe === 'Kasbon');
  const settingPayroll = getSheetData('SettingPayroll').filter(s => String(s.aktif) !== 'false' && s.aktif !== false);
  const hariEfektif = getSheetData('HariEfektif').filter(h => h.bulan === bulan);
  const settingMap = {};
  settingPayroll.forEach(s => { const key = String(s.lapakId); const bd = formatDate(s.berlakuDari); if (!settingMap[key] || formatDate(settingMap[key].berlakuDari) < bd) settingMap[key] = s; });
  const heMap = {};
  hariEfektif.forEach(h => heMap[String(h.lapakId)] = Number(h.jumlahHari) || 0);
  const list = users.map(u => {
    const rekapPerLapak = {};
    setoran.forEach(s => {
      if (String(s.userId) === String(u.id)) {
        const lapakKey = String(s.lapakId);
        if (!rekapPerLapak[lapakKey]) rekapPerLapak[lapakKey] = {};
        rekapPerLapak[lapakKey][formatDate(s.tanggal)] = true;
      }
    });
    let totalBonusMerekap = 0;
    const rincianMerekap = [];
    Object.keys(rekapPerLapak).forEach(lapakId => {
      const hariMerekap = Object.keys(rekapPerLapak[lapakId]).length;
      const he = heMap[lapakId] || 26;
      const setting = settingMap[lapakId];
      const rate = setting ? (Number(setting.bonusMerekap) || 0) : 0;
      const bonus = he > 0 ? (hariMerekap / he) * rate : 0;
      totalBonusMerekap += bonus;
      rincianMerekap.push({ lapakId, lapakNama: (lapakMap[lapakId] || {}).nama || lapakId, hariMerekap, hariEfektif: he, rate, bonus: Math.round(bonus) });
    });
    let totalTunjangan = 0;
    const rincianTunjangan = [];
    if (u.lapakId) {
      const setting = settingMap[String(u.lapakId)];
      if (setting && Number(setting.tunjanganLapak) > 0) {
        totalTunjangan = Number(setting.tunjanganLapak);
        rincianTunjangan.push({ lapakId: u.lapakId, lapakNama: (lapakMap[u.lapakId] || {}).nama || u.lapakId, nominal: totalTunjangan });
      }
    }
    const antarList = bonusAntar.filter(b => String(b.userId) === String(u.id));
    const totalBonusAntar = antarList.reduce((s, b) => s + (Number(b.nominal) || 0), 0);
    const kasbonUser = kasbon.filter(k => String(k.userId) === String(u.id));
    const totalKasbon = kasbonUser.reduce((s, k) => s + (Number(k.nominal) || 0), 0);
    const absensiUser = absensiK.filter(a => String(a.userId) === String(u.id));
    let telat = 0, setengahHari = 0;
    const standarMasuk = 5 * 60 + 15;
    absensiUser.forEach(a => {
      const jm = a.jamMasuk instanceof Date ? a.jamMasuk : null;
      if (jm) { const menit = jm.getHours() * 60 + jm.getMinutes(); if (menit > standarMasuk) telat++; }
      if (a.status === 'SetengahHari') setengahHari++;
    });
    let skor = 100 - (telat * 2) - (setengahHari * 1);
    skor = Math.max(0, Math.min(100, skor));
    const totalBersih = Math.max(0, Math.round(totalBonusMerekap + totalTunjangan + totalBonusAntar - totalKasbon));
    return { userId: u.id, userName: u.name, lapakId: u.lapakId, lapakNama: (lapakMap[u.lapakId] || {}).nama || '', rincianMerekap, totalBonusMerekap: Math.round(totalBonusMerekap), rincianTunjangan, totalTunjangan, bonusAntarList: antarList.map(b => ({ id: b.id, tanggal: formatDate(b.tanggal), tujuan: b.tujuan, nominal: Number(b.nominal) || 0 })), totalBonusAntar, kasbonList: kasbonUser.map(k => ({ id: k.id, nominal: Number(k.nominal) || 0, keterangan: k.keterangan || '', tanggal: formatDate(k.tanggal) })), totalKasbon, kehadiran: { hadir: absensiUser.length, telat, setengahHari, skor }, totalBersih };
  });
  const totals = list.reduce((s, x) => { s.totalBonusMerekap += x.totalBonusMerekap; s.totalTunjangan += x.totalTunjangan; s.totalBonusAntar += x.totalBonusAntar; s.totalKasbon += x.totalKasbon; s.totalBersih += x.totalBersih; return s; }, { totalBonusMerekap: 0, totalTunjangan: 0, totalBonusAntar: 0, totalKasbon: 0, totalBersih: 0 });
  return { bulan, list, totals };
}
function apiBayarPayroll(token, userId, bulan) {
  const sess = requireRole(token, ['admin']);
  if (!userId || !bulan) return { success: false, message: 'User dan bulan wajib.' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    const sudah = getSheetData('RekapPayroll').some(r => r.bulan === bulan && String(r.userId) === String(userId));
    if (sudah) return { success: false, message: 'Karyawan ini sudah dibayar bulan ' + bulan + '.' };
    const rekap = apiRekapPayroll(token, bulan);
    const user = rekap.list.find(x => String(x.userId) === String(userId));
    if (!user) return { success: false, message: 'Data payroll tidak ditemukan.' };
    const kasbonSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Kasbon');
    const kasbonData = kasbonSheet.getDataRange().getValues();
    const kh = kasbonData[0];
    const kUser = kh.indexOf('userId'), kStatus = kh.indexOf('status'), kTipe = kh.indexOf('tipe');
    const kNominal = kh.indexOf('nominal'), kGajiId = kh.indexOf('gajiId');
    const totalPenghasilan = Math.round((user.totalBonusMerekap || 0) + (user.totalTunjangan || 0) + (user.totalBonusAntar || 0));
    const maxPotong = Math.min(user.totalKasbon || 0, totalPenghasilan);
    const totalBersih = totalPenghasilan - maxPotong;
    let danaTersedia = maxPotong;
    const kasbonUpdates = [];
    for (let i = 1; i < kasbonData.length && danaTersedia > 0; i++) {
      if (String(kasbonData[i][kUser]) === String(userId) && kasbonData[i][kStatus] === 'Outstanding' && kasbonData[i][kTipe] === 'Kasbon') {
        const nominal = Number(kasbonData[i][kNominal]) || 0;
        if (nominal <= danaTersedia) { kasbonUpdates.push({ row: i + 1, action: 'lunas' }); danaTersedia -= nominal; }
        else { kasbonUpdates.push({ row: i + 1, action: 'partial', sisa: nominal - danaTersedia }); danaTersedia = 0; }
      }
    }
    const kasSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Kas');
    const kasData = kasSheet.getDataRange().getValues();
    const iSaldo = kasData[0].indexOf('saldo');
    const saldoLama = kasData.length > 1 ? Number(kasData[kasData.length - 1][iSaldo]) || 0 : 0;
    const kasId = 'KS' + Utilities.getUuid().slice(0, 8).toUpperCase();
    if (totalBersih > 0) appendObjectsByHeaders(kasSheet,[{id:kasId,tanggal:new Date(),keterangan:'Payroll '+user.userName+' ('+bulan+')',tipe:'Keluar',kategori:'Gaji',nominal:totalBersih,saldo:saldoLama-totalBersih}]);
    const rekapSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RekapPayroll');
    const rekapId = 'RP' + Utilities.getUuid().slice(0, 8).toUpperCase();
    rekapSheet.appendRow([rekapId, bulan, user.userId, user.userName, JSON.stringify(user), totalBersih, totalBersih > 0 ? kasId : '', new Date(), sess.username]);
    kasbonUpdates.forEach(u => {
      if (u.action === 'lunas') { kasbonSheet.getRange(u.row, kStatus + 1).setValue('Lunas'); if (kGajiId >= 0) kasbonSheet.getRange(u.row, kGajiId + 1).setValue(rekapId); }
      else { kasbonSheet.getRange(u.row, kNominal + 1).setValue(u.sisa); }
    });
    _clearSheetCache();
    const sisaKasbon = (user.totalKasbon || 0) - maxPotong;
    let msg = user.userName + ' dibayar: Rp ' + totalBersih.toLocaleString('id-ID');
    if (sisaKasbon > 0) msg += ' (kasbon belum lunas: Rp ' + sisaKasbon.toLocaleString('id-ID') + ')';
    return { success: true, message: msg };
  } finally { lock.releaseLock(); }
}
function apiBayarPayrollBulk(token, bulan, userIds) {
  requireRole(token, ['admin']);
  if (!bulan || !Array.isArray(userIds) || !userIds.length) return { success: false, message: 'Pilih minimal 1 karyawan.' };
  const results = [];
  for (const uid of userIds) {
    try { const r = apiBayarPayroll(token, uid, bulan); results.push({ userId: uid, success: r.success, message: r.message }); }
    catch (e) { results.push({ userId: uid, success: false, message: e.message }); }
  }
  const ok = results.filter(r => r.success).length;
  return { success: true, message: ok + '/' + userIds.length + ' payroll dibayar.', results };
}
function apiGetPayrollHistory(token, filter) {
  requireRole(token, ['admin']);
  filter = filter || {};
  let list = getSheetData('RekapPayroll').map(r => ({ id: r.id, bulan: r.bulan, userId: r.userId, userName: r.userName, totalBersih: Number(r.totalBersih) || 0, kasId: r.kasId || '', dibayarAt: r.dibayarAt instanceof Date ? Utilities.formatDate(r.dibayarAt, Session.getScriptTimeZone(), 'dd MMM yyyy HH:mm') : String(r.dibayarAt || ''), dibayarBy: r.dibayarBy || '' }));
  if (filter.bulan) list = list.filter(r => r.bulan === filter.bulan);
  return list.reverse();
}

// ============================================================
//  FASE 2 — KONSINYASI
// ============================================================
function apiGetKonsinyasi(token, filter) {
  requireRole(token, ['admin']);
  filter = filter || {};
  const supMap = {}; getSheetData('Suppliers').forEach(s => supMap[s.id] = s.nama);
  const katMap = {}; getSheetData('Katalog').forEach(k => katMap[k.id] = k.nama);
  const lapakMap = {}; getSheetData('Lapak').forEach(l => lapakMap[l.id] = l.nama);
  let list = getSheetData('Konsinyasi').map(k => ({ id: k.id, tanggal: formatDate(k.tanggal), supplierId: k.supplierId, supplierNama: supMap[k.supplierId] || k.supplierId, lapakId: k.lapakId, lapakNama: lapakMap[k.lapakId] || k.lapakId, katalogId: k.katalogId, nama: katMap[k.katalogId] || k.katalogId, qtyLaku: Number(k.qtyLaku) || 0, hargaTitip: Number(k.hargaTitip) || 0, utang: Number(k.utang) || 0, status: k.status || 'Pending', kasId: k.kasId || '', bayarAt: k.bayarAt instanceof Date ? Utilities.formatDate(k.bayarAt, Session.getScriptTimeZone(), 'dd MMM yyyy HH:mm') : String(k.bayarAt || ''), bayarBy: k.bayarBy || '', setoranId: k.setoranId || '', catatan: k.catatan || '' }));
  if (filter.supplierId) list = list.filter(x => String(x.supplierId) === String(filter.supplierId));
  if (filter.status) list = list.filter(x => x.status === filter.status);
  if (filter.dari) list = list.filter(x => x.tanggal >= filter.dari);
  if (filter.sampai) list = list.filter(x => x.tanggal <= filter.sampai);
  return list.reverse();
}
function apiEditKonsinyasi(token, id, updates) {
  const sess = requireRole(token, ['admin']);
  updates = updates || {};
  const supplierId = String(updates.supplierId || '');
  const qtyLaku = Number(updates.qtyLaku);
  const hargaTitip = Number(updates.hargaTitip);
  if (!id || !supplierId) return { success: false, message: 'Titipan dan nama penitip wajib diisi.' };
  if (!Number.isInteger(qtyLaku) || qtyLaku <= 0) return { success: false, message: 'Qty terjual harus bilangan bulat lebih dari 0.' };
  if (!isFinite(hargaTitip) || hargaTitip < 0) return { success: false, message: 'Harga titip tidak valid.' };

  const supplier = getSheetData('Suppliers').find(s => String(s.id) === supplierId);
  if (!supplier) return { success: false, message: 'Nama penitip tidak ditemukan.' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const konsinyasiSheet = ss.getSheetByName('Konsinyasi');
    const konsinyasiData = konsinyasiSheet.getDataRange().getValues();
    const kh = konsinyasiData[0].map(x => String(x).trim());
    const kId = kh.indexOf('id'), kStatus = kh.indexOf('status');
    const kSupplier = kh.indexOf('supplierId'), kQty = kh.indexOf('qtyLaku');
    const kHarga = kh.indexOf('hargaTitip'), kUtang = kh.indexOf('utang');
    const kSetoran = kh.indexOf('setoranId'), kLapak = kh.indexOf('lapakId');
    const kKatalog = kh.indexOf('katalogId');
    let konsinyasiRow = -1;
    for (let i = 1; i < konsinyasiData.length; i++) {
      if (String(konsinyasiData[i][kId]) === String(id)) { konsinyasiRow = i + 1; break; }
    }
    if (konsinyasiRow < 0) return { success: false, message: 'Data titipan tidak ditemukan.' };
    const oldRow = konsinyasiData[konsinyasiRow - 1];
    if (oldRow[kStatus] !== 'Pending') return { success: false, message: 'Titipan yang sudah dibayar terkunci.' };
    const currentQty=Number(oldRow[kQty])||0, currentPrice=Number(oldRow[kHarga])||0, currentDue=Number(oldRow[kUtang])||0;
    if (currentQty*currentPrice-currentDue>0) return {success:false,message:'Invoice sudah menerima pembayaran sebagian. Gunakan permintaan koreksi invoice agar selisih pembayaran dan saldo lebih supplier tetap tercatat.'};

    const setoranId = String(oldRow[kSetoran] || '');
    const katalogId = String(oldRow[kKatalog] || '');
    const lapakId = String(oldRow[kLapak] || '');
    if (!setoranId || !katalogId) return { success: false, message: 'Titipan tidak memiliki referensi setoran yang valid.' };

    const detailSheet = ss.getSheetByName('SetoranDetail');
    const detailData = detailSheet.getDataRange().getValues();
    const dh = detailData[0].map(x => String(x).trim());
    const dSetoran = dh.indexOf('setoranId'), dKatalog = dh.indexOf('katalogId');
    const dQtyLaku = dh.indexOf('qtyLaku'), dQtySisa = dh.indexOf('qtySisa');
    const dHargaBeli = dh.indexOf('hargaBeli'), dHargaJual = dh.indexOf('hargaJual');
    const dSubtotal = dh.indexOf('subtotal');
    let detailRow = -1;
    for (let i = 1; i < detailData.length; i++) {
      if (String(detailData[i][dSetoran]) === setoranId && String(detailData[i][dKatalog]) === katalogId) {
        if (detailRow >= 0) return { success: false, message: 'Detail setoran duplikat; edit dibatalkan.' };
        detailRow = i + 1;
      }
    }
    if (detailRow < 0) return { success: false, message: 'Detail setoran terkait tidak ditemukan.' };
    const oldDetail = detailData[detailRow - 1];
    const qtyDrop = Number(oldDetail[dh.indexOf('qtyDrop')]) || 0;
    if (qtyLaku > qtyDrop) return { success: false, message: 'Qty terjual tidak boleh melebihi qty drop (' + qtyDrop + ').' };
    const hargaJual = Number(oldDetail[dHargaJual]) || 0;
    const subtotalBaru = qtyLaku * hargaJual;

    const setoranSheet = ss.getSheetByName('Setoran');
    const setoranData = setoranSheet.getDataRange().getValues();
    const sh = setoranData[0].map(x => String(x).trim());
    const sId = sh.indexOf('id'), sStatus = sh.indexOf('status');
    const sTotal = sh.indexOf('totalSistem'), sPengeluaran = sh.indexOf('pengeluaran');
    const sExpected = sh.indexOf('expectedSetoran'), sTunai = sh.indexOf('totalTunai');
    const sQris = sh.indexOf('totalQris'), sSelisih = sh.indexOf('selisih');
    let setoranRow = -1;
    for (let i = 1; i < setoranData.length; i++) {
      if (String(setoranData[i][sId]) === setoranId) { setoranRow = i + 1; break; }
    }
    if (setoranRow < 0) return { success: false, message: 'Setoran terkait tidak ditemukan.' };

    const stokSheet = ss.getSheetByName('KartuStok');
    const stokData = stokSheet.getDataRange().getValues();
    const khStok = stokData[0].map(x => String(x).trim());
    const stKatalog = khStok.indexOf('katalogId'), stLapak = khStok.indexOf('lapakId');
    const stTipe = khStok.indexOf('tipe'), stKeluar = khStok.indexOf('keluar');
    const stMasuk = khStok.indexOf('masuk'), stRef = khStok.indexOf('refId');
    const stSaldo = khStok.indexOf('saldo');
    let stokRow = -1;
    for (let i = 1; i < stokData.length; i++) {
      if (String(stokData[i][stRef]) === setoranId && String(stokData[i][stKatalog]) === katalogId && String(stokData[i][stLapak]) === lapakId && stokData[i][stTipe] === 'Terjual') {
        if (stokRow >= 0) return { success: false, message: 'Ledger stok duplikat; edit dibatalkan.' };
        stokRow = i + 1;
      }
    }
    if (stokRow < 0) return { success: false, message: 'Ledger stok terkait tidak ditemukan.' };

    const oldQty = Number(oldRow[kQty]) || 0;
    const oldHarga = Number(oldRow[kHarga]) || 0;
    const utangBaru = qtyLaku * hargaTitip;
    const totalSistemBaru = detailData.slice(1).reduce((sum, row, index) => sum + (index + 1 === detailRow ? subtotalBaru : (Number(row[dSubtotal]) || 0)), 0);
    const setoranValues = setoranData[setoranRow - 1];
    const expectedBaru = totalSistemBaru - (Number(setoranValues[sPengeluaran]) || 0);
    const selisihBaru = totalSistemBaru - (Number(setoranValues[sTunai]) || 0) - (Number(setoranValues[sQris]) || 0);

    konsinyasiSheet.getRange(konsinyasiRow, kSupplier + 1).setValue(supplierId);
    konsinyasiSheet.getRange(konsinyasiRow, kQty + 1).setValue(qtyLaku);
    konsinyasiSheet.getRange(konsinyasiRow, kHarga + 1).setValue(hargaTitip);
    konsinyasiSheet.getRange(konsinyasiRow, kUtang + 1).setValue(utangBaru);
    detailSheet.getRange(detailRow, dQtyLaku + 1).setValue(qtyLaku);
    detailSheet.getRange(detailRow, dQtySisa + 1).setValue(qtyDrop - qtyLaku);
    detailSheet.getRange(detailRow, dHargaBeli + 1).setValue(hargaTitip);
    detailSheet.getRange(detailRow, dSubtotal + 1).setValue(subtotalBaru);
    setoranSheet.getRange(setoranRow, sTotal + 1).setValue(totalSistemBaru);
    setoranSheet.getRange(setoranRow, sExpected + 1).setValue(expectedBaru);
    setoranSheet.getRange(setoranRow, sSelisih + 1).setValue(selisihBaru);
    stokSheet.getRange(stokRow, stKeluar + 1).setValue(qtyLaku);
    stokData[stokRow - 1][stKeluar] = qtyLaku;

    let saldo = 0;
    for (let i = 1; i < stokData.length; i++) {
      if (String(stokData[i][stKatalog]) !== katalogId) continue;
      saldo += (Number(stokData[i][stMasuk]) || 0) - (Number(stokData[i][stKeluar]) || 0);
      stokSheet.getRange(i + 1, stSaldo + 1).setValue(saldo);
    }

    logAction(sess.username, 'EDIT_KONSINYASI', { id, setoranId, supplierId: { from: oldRow[kSupplier], to: supplierId }, qtyLaku: { from: oldQty, to: qtyLaku }, hargaTitip: { from: oldHarga, to: hargaTitip }, utang: { from: Number(oldRow[kUtang]) || 0, to: utangBaru } });
    _clearSheetCache();
    return { success: true, message: 'Titipan diperbarui; detail setoran dan saldo stok ikut disinkronkan.' };
  } finally { lock.releaseLock(); }
}
function apiGetSaldoSupplier(token) {
  requireRole(token, ['admin']);
  const supMap = {}; getSheetData('Suppliers').forEach(s => supMap[s.id] = s);
  const balanceMap = {};
  getSheetData('Konsinyasi').forEach(k => {
    const sid = String(k.supplierId);
    if (!balanceMap[sid]) balanceMap[sid] = { supplierId: sid, nama: (supMap[sid] || {}).nama || sid, tipeTransaksi: (supMap[sid] || {}).tipeTransaksi || 'BeliPutus', pending: 0, pendingCount: 0, totalDibayar: 0, countDibayar: 0 };
    if (k.status === 'Pending') { balanceMap[sid].pending += Number(k.utang) || 0; balanceMap[sid].pendingCount++; }
    else if (k.status === 'Bayar') { balanceMap[sid].totalDibayar += Number(k.utang) || 0; balanceMap[sid].countDibayar++; }
  });
  const creditMap=getSupplierCreditBalanceMap_();
  Object.keys(balanceMap).forEach(sid=>{
    const credit=(creditMap[sid]||{balance:0}).balance;
    balanceMap[sid].saldoLebih=credit;
    balanceMap[sid].pendingSetelahKredit=Math.max(0,balanceMap[sid].pending-credit);
  });
  Object.keys(creditMap).forEach(sid=>{
    if(!balanceMap[sid]&&creditMap[sid].balance>0)balanceMap[sid]={supplierId:sid,nama:(supMap[sid]||{}).nama||sid,tipeTransaksi:(supMap[sid]||{}).tipeTransaksi||'TitipJual',pending:0,pendingCount:0,totalDibayar:0,countDibayar:0,saldoLebih:creditMap[sid].balance,pendingSetelahKredit:0};
  });
  return Object.values(balanceMap).sort((a, b) => b.pendingSetelahKredit - a.pendingSetelahKredit);
}
function apiBayarSupplier(token, payload) {
  const sess = requireRole(token, ['admin']);
  payload = payload || {};
  const supplierId = String(payload.supplierId || '').trim();
  if (!supplierId) return { success: false, message: 'Supplier wajib.' };
  const metode = String(payload.metode || 'Tunai').trim();
  if (!['Tunai','QRIS','Transfer'].includes(metode)) return { success:false, message:'Metode pembayaran harus Tunai, QRIS, atau Transfer.' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSupplierFinanceSheets_();
    const creditUse = applySupplierCreditsToPendingInvoices_(supplierId,sess.username);
    const sheet = ss.getSheetByName('Konsinyasi');
    const data = sheet.getDataRange().getValues();
    const h = data[0];
    const iSupplier = h.indexOf('supplierId'), iStatus = h.indexOf('status');
    const iUtang = h.indexOf('utang'), iKasId = h.indexOf('kasId');
    const iBayarAt = h.indexOf('bayarAt'), iBayarBy = h.indexOf('bayarBy');
    if (iSupplier < 0 || iStatus < 0 || iUtang < 0 || iKasId < 0) return {success:false,message:'Struktur Konsinyasi belum lengkap. Tidak ada perubahan.'};
    let totalBayar = 0;
    const rowsToUpdate = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][iSupplier]) === supplierId && data[i][iStatus] === 'Pending') {
        totalBayar += Number(data[i][iUtang]) || 0; rowsToUpdate.push(i + 1);
      }
    }
    if (totalBayar <= 0) return { success: true, message: creditUse.total>0 ? 'Tagihan lunas menggunakan saldo lebih supplier. Tidak perlu pembayaran tunai.' : 'Tidak ada utang pending.', total:0, creditApplied:creditUse.total, count:0 };
    const kasSheet = ss.getSheetByName('Kas');
    if (!hasHeaders(kasSheet, ['id','tanggal','keterangan','tipe','nominal','saldo'])) return {success:false,message:'Struktur Kas belum lengkap. Tidak ada perubahan.'};
    const kasData = kasSheet.getDataRange().getValues();
    const iSaldo = kasData[0].indexOf('saldo');
    const saldoLama = kasData.length > 1 ? Number(kasData[kasData.length - 1][iSaldo]) || 0 : 0;
    const kasId = 'KS' + Utilities.getUuid().slice(0, 8).toUpperCase();
    const sup = getSheetData('Suppliers').find(s => String(s.id) === supplierId) || {};
    const kasRow = {id:kasId,tanggal:new Date(),keterangan:'Bayar Supplier: '+(sup.nama||supplierId)+' ('+rowsToUpdate.length+' transaksi) ['+metode+']',tipe:'Keluar',kategori:'Konsinyasi',metode,nominal:totalBayar,saldo:saldoLama-totalBayar};
    const journal = beginWriteJournal(['Konsinyasi','Kas']);
    try {
      appendObjectsByHeaders(kasSheet,[kasRow]);
      rowsToUpdate.forEach(r => {
        journalSetValue(journal, sheet, r, iStatus + 1, 'Bayar');
        journalSetValue(journal, sheet, r, iKasId + 1, kasId);
        if (iBayarAt >= 0) journalSetValue(journal, sheet, r, iBayarAt + 1, new Date());
        if (iBayarBy >= 0) journalSetValue(journal, sheet, r, iBayarBy + 1, sess.username);
      });
    } catch (writeError) {
      try { rollbackWriteJournal(journal); }
      catch (rollbackError) { console.error('Gagal rollback pembayaran supplier:',rollbackError.message); return {success:false,message:'Pembayaran gagal dan pemulihan otomatis perlu diperiksa. '+writeError.message+' | '+rollbackError.message}; }
      _clearSheetCache();
      return {success:false,message:'Pembayaran gagal. Perubahan dibatalkan: '+writeError.message};
    }
    _clearSheetCache();
    return { success: true, message: 'Bayar ' + (sup.nama || supplierId) + ': Rp ' + totalBayar.toLocaleString('id-ID') + ' via ' + metode + (creditUse.total>0 ? '. Saldo lebih yang dipakai: Rp '+creditUse.total.toLocaleString('id-ID') : ''), total: totalBayar, creditApplied:creditUse.total, count: rowsToUpdate.length, kasId, metode };
  } finally { lock.releaseLock(); }
}
function apiGetRiwayatBayarSupplier(token, filter) {
  requireRole(token, ['admin']);
  filter = filter || {};
  const supMap = {}; getSheetData('Suppliers').forEach(s => supMap[s.id] = s.nama);
  const kasMap = {}; getSheetData('Kas').forEach(k => kasMap[String(k.id)] = k);
  const grouped = {};
  getSheetData('Konsinyasi').forEach(k => {
    if (k.status !== 'Bayar') return;
    const key = String(k.kasId) + '_' + String(k.supplierId);
    if (!grouped[key]) grouped[key] = { kasId: k.kasId, supplierId: k.supplierId, supplierNama: supMap[k.supplierId] || k.supplierId, bayarAt: k.bayarAt instanceof Date ? Utilities.formatDate(k.bayarAt, Session.getScriptTimeZone(), 'dd MMM yyyy HH:mm') : String(k.bayarAt || ''), bayarBy: k.bayarBy || '', metode: (kasMap[String(k.kasId)] || {}).metode || ((String((kasMap[String(k.kasId)] || {}).keterangan || '').match(/\[(Tunai|QRIS|Transfer)\]\s*$/i) || [])[1] || ''), total: 0, count: 0 };
    grouped[key].total += Number(k.utang) || 0;
    grouped[key].count++;
  });
  let list = Object.values(grouped).sort((a, b) => {
    const ta = new Date((kasMap[String(a.kasId)] || {}).tanggal || a.bayarAt || 0).getTime() || 0;
    const tb = new Date((kasMap[String(b.kasId)] || {}).tanggal || b.bayarAt || 0).getTime() || 0;
    return tb - ta;
  });
  if (filter.supplierId) list = list.filter(x => String(x.supplierId) === String(filter.supplierId));
  return list;
}
function ensureSupplierFinanceSheets_() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const schemas=[
    {name:'SupplierCorrectionRequests',headers:['id','requestKey','createdAt','requestedBy','requestedByName','lapakId','supplierId','katalogId','konsinyasiId','setoranId','oldQtyLaku','requestedQtyLaku','hargaTitip','oldObligation','newObligation','reason','status','reviewedBy','reviewedAt','reviewNote','appliedAt','paidAmount','creditCreated']},
    {name:'SupplierCreditLedger',headers:['id','createdAt','supplierId','eventType','amount','correctionId','sourceInvoiceId','referenceInvoiceId','createdBy','notes','requestKey']}
  ];
  schemas.forEach(def=>{
    let sh=ss.getSheetByName(def.name);
    if(!sh){sh=ss.insertSheet(def.name);sh.getRange(1,1,1,def.headers.length).setValues([def.headers]);sh.setFrozenRows(1);sh.getRange(1,1,1,def.headers.length).setFontWeight('bold').setBackground('#fef3c7');return;}
    if(sh.getLastColumn()<1){sh.getRange(1,1,1,def.headers.length).setValues([def.headers]);sh.setFrozenRows(1);return;}
    const h=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0].map(x=>String(x).trim());
    def.headers.forEach(name=>{if(h.indexOf(name)>=0)return;const col=sh.getLastColumn()+1;sh.getRange(1,col).setValue(name).setFontWeight('bold').setBackground('#fef3c7');h.push(name);});
  });
  return {requests:ss.getSheetByName('SupplierCorrectionRequests'),credits:ss.getSheetByName('SupplierCreditLedger')};
}
function getSupplierCreditBalanceMap_() {
  const map={};
  const ledgerSheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SupplierCreditLedger');
  if(!ledgerSheet || ledgerSheet.getLastRow()<2)return map;
  getSheetData('SupplierCreditLedger').forEach(r=>{
    const sid=String(r.supplierId||'');if(!sid)return;
    if(!map[sid])map[sid]={supplierId:sid,credited:0,used:0,balance:0,events:0};
    const n=Math.max(0,Number(r.amount)||0);
    if(r.eventType==='CREDIT')map[sid].credited+=n;
    else if(r.eventType==='APPLY')map[sid].used+=n;
    map[sid].events++;
  });
  Object.keys(map).forEach(sid=>map[sid].balance=Math.max(0,map[sid].credited-map[sid].used));
  return map;
}
function getSupplierInvoiceSettlementMaps_() {
  const invoices=getSheetData('Konsinyasi')||[];
  const invoiceById={};
  invoices.forEach(x=>invoiceById[String(x.id)]=x);
  const cashPaidById={};
  (getSheetData('BayarTitipanKaryawan')||[]).filter(x=>String(x.status||'Active')==='Active').forEach(payment=>{
    const raw=String(payment.konsinyasiIds||'');
    if(raw.trim().startsWith('[')){
      try{
        JSON.parse(raw).forEach(item=>{
          if(!item||!item.id)return;
          const amount=Number(item.amount),id=String(item.id);
          if(Number.isFinite(amount)&&amount>0)cashPaidById[id]=(cashPaidById[id]||0)+amount;
        });
      }catch(e){}
    }else{
      let remaining=Math.max(0,Number(payment.totalBayar)||0);
      raw.split(',').map(x=>x.trim()).filter(Boolean).forEach(id=>{
        if(remaining<=0)return;
        const invoice=invoiceById[id];if(!invoice)return;
        const gross=(Number(invoice.qtyLaku)||0)*(Number(invoice.hargaTitip)||0);
        const capacity=gross>0?Math.max(0,gross-(cashPaidById[id]||0)):Math.max(0,Number(invoice.utang)||0);
        const allocated=Math.min(capacity,remaining);
        if(allocated>0){cashPaidById[id]=(cashPaidById[id]||0)+allocated;remaining-=allocated;}
      });
    }
  });
  const creditAppliedByInvoice={};
  (getSheetData('SupplierCreditLedger')||[]).filter(x=>String(x.eventType)==='APPLY').forEach(x=>{
    const id=String(x.referenceInvoiceId||''),amount=Math.max(0,Number(x.amount)||0);
    if(id&&amount)creditAppliedByInvoice[id]=(creditAppliedByInvoice[id]||0)+amount;
  });
  const statusSettledById={};
  invoices.forEach(invoice=>{
    if(String(invoice.status)!=='Bayar')return;
    const id=String(invoice.id),gross=(Number(invoice.qtyLaku)||0)*(Number(invoice.hargaTitip)||0);
    const recorded=(cashPaidById[id]||0)+(creditAppliedByInvoice[id]||0);
    // Status Bayar adalah sumber lama yang sah untuk pembayaran admin di Kas
    // atau data legacy yang belum memiliki alokasi per invoice.
    statusSettledById[id]=Math.max(0,gross-recorded);
  });
  return {cashPaidById,creditAppliedByInvoice,statusSettledById};
}

function applySupplierCreditsToPendingInvoices_(supplierId,actor,parentJournal) {
  const sheets=ensureSupplierFinanceSheets_(),own=!parentJournal;
  const journal=parentJournal||beginWriteJournal(['Konsinyasi','SupplierCreditLedger']);
  const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Konsinyasi'),ledger=sheets.credits;
  const h=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0].map(x=>String(x).trim()),ix=n=>h.indexOf(n);
  if(['id','supplierId','tanggal','utang','status'].some(n=>ix(n)<0))throw new Error('Struktur Konsinyasi tidak lengkap untuk penggunaan saldo lebih.');
  const rows=sh.getDataRange().getValues(),balances=getSupplierCreditBalanceMap_();
  const supplierIds=supplierId?[String(supplierId)]:Object.keys(balances),events=[],used=[];
  try{
    supplierIds.forEach(sid=>{
      let credit=(balances[sid]||{balance:0}).balance;if(credit<=0)return;
      const pending=[];
      for(let i=1;i<rows.length;i++)if(String(rows[i][ix('supplierId')])===sid&&String(rows[i][ix('status')])==='Pending'){
        const due=Math.max(0,Number(rows[i][ix('utang')])||0);if(due>0)pending.push({row:i+1,id:String(rows[i][ix('id')]),due,date:new Date(rows[i][ix('tanggal')]).getTime()||0});
      }
      pending.sort((a,b)=>a.date-b.date||a.row-b.row);
      pending.forEach(item=>{
        if(credit<=0)return;
        const amount=Math.min(item.due,credit),remaining=item.due-amount;if(amount<=0)return;
        journalSetValue(journal,sh,item.row,ix('utang')+1,remaining);
        if(remaining===0){
          journalSetValue(journal,sh,item.row,ix('status')+1,'Bayar');
          if(ix('bayarAt')>=0)journalSetValue(journal,sh,item.row,ix('bayarAt')+1,new Date());
          if(ix('bayarBy')>=0)journalSetValue(journal,sh,item.row,ix('bayarBy')+1,'Saldo Lebih Supplier');
        }
        if(ix('catatan')>=0){const old=String(rows[item.row-1][ix('catatan')]||'');journalSetValue(journal,sh,item.row,ix('catatan')+1,(old?old+' | ':'')+'KREDIT_SUPPLIER '+fmtRpLocal(amount));}
        const id='SCA'+Utilities.getUuid().slice(0,8).toUpperCase();
        events.push({id,createdAt:new Date(),supplierId:sid,eventType:'APPLY',amount,correctionId:'',sourceInvoiceId:'',referenceInvoiceId:item.id,createdBy:actor||'system',notes:'Saldo lebih otomatis dipakai pada invoice '+item.id,requestKey:'APPLY:'+id});
        used.push({invoiceId:item.id,amount,remaining});credit-=amount;
      });
    });
    if(events.length)appendObjectsByHeaders(ledger,events);
    if(own)_clearSheetCache();
    return {total:used.reduce((sum,x)=>sum+x.amount,0),items:used};
  }catch(e){
    if(own){try{rollbackWriteJournal(journal);}catch(re){throw new Error('Kredit gagal diterapkan dan rollback perlu diperiksa: '+e.message+' | '+re.message);}_clearSheetCache();}
    throw e;
  }
}
function apiSubmitSupplierCorrection(token,payload) {
  const sess=requireRole(token,['karyawan']);payload=payload||{};
  const invoiceId=String(payload.invoiceId||'').trim(),qty=Number(payload.qtyLaku),reason=String(payload.reason||'').trim();
  if(!invoiceId)return {success:false,message:'Invoice wajib dipilih.'};
  if(!Number.isSafeInteger(qty)||qty<0)return {success:false,message:'Jumlah terjual harus bilangan bulat dan tidak boleh negatif.'};
  if(reason.length<5)return {success:false,message:'Alasan koreksi minimal 5 karakter.'};
  const lock=LockService.getScriptLock();if(!lock.tryLock(CONFIG.LOCK_TIMEOUT))return {success:false,message:'Sistem sibuk. Coba lagi.'};
  try{
    const sheets=ensureSupplierFinanceSheets_(),records=getSheetData('SupplierCorrectionRequests');
    const key=String(payload.requestKey||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,48);
    if(key){const dup=records.find(x=>String(x.requestKey||'')===key);if(dup)return {success:true,message:'Permintaan sudah tercatat.',id:dup.id,duplicate:true};}
    if(records.some(x=>String(x.konsinyasiId)===invoiceId&&String(x.status)==='Pending'))return {success:false,message:'Invoice ini sudah memiliki permintaan yang menunggu admin.'};
    const inv=getSheetData('Konsinyasi').find(x=>String(x.id)===invoiceId);
    if(!inv)return {success:false,message:'Invoice tidak ditemukan.'};
    if(String(inv.lapakId)!==String(sess.lapakId))return {success:false,message:'Invoice bukan milik lapak Anda.'};
    if(!inv.setoranId)return {success:false,message:'Invoice belum terhubung ke laporan yang dikirim.'};
    const detail=getSheetData('SetoranDetail').filter(x=>String(x.setoranId)===String(inv.setoranId)&&String(x.katalogId)===String(inv.katalogId));
    if(detail.length!==1)return {success:false,message:'Rincian laporan tidak ditemukan atau ganda. Hubungi admin.'};
    const drop=Number(detail[0].qtyDrop)||0;if(qty>drop)return {success:false,message:'Jumlah terjual maksimal '+drop+' pcs.'};
    const oldQty=Number(inv.qtyLaku)||0,price=Number(inv.hargaTitip)||0;
    if(qty===oldQty)return {success:false,message:'Jumlah baru sama dengan jumlah saat ini.'};
    const id='SCR'+Utilities.getUuid().slice(0,8).toUpperCase();
    appendObjectsByHeaders(sheets.requests,[{id,requestKey:key||id,createdAt:new Date(),requestedBy:sess.id,requestedByName:sess.name||sess.username,lapakId:sess.lapakId,supplierId:String(inv.supplierId),katalogId:String(inv.katalogId),konsinyasiId:invoiceId,setoranId:String(inv.setoranId),oldQtyLaku:oldQty,requestedQtyLaku:qty,hargaTitip:price,oldObligation:oldQty*price,newObligation:qty*price,reason,status:'Pending',reviewedBy:'',reviewedAt:'',reviewNote:'',appliedAt:'',paidAmount:'',creditCreated:0}]);
    _clearSheetCache();logAction(sess.username,'AJUKAN_KOREKSI_INVOICE_SUPPLIER',{id,invoiceId,oldQty,requestedQty:qty,reason});
    return {success:true,message:'Permintaan koreksi dikirim. Menunggu persetujuan admin.',id};
  }finally{lock.releaseLock();}
}
function apiGetSupplierFinanceOverview(token) {
  requireRole(token,['admin']);ensureSupplierFinanceSheets_();
  const suppliers={},catalog={},lapaks={},users={};
  getSheetData('Suppliers').forEach(x=>suppliers[String(x.id)]=x.nama);
  getSheetData('Katalog').forEach(x=>catalog[String(x.id)]=x.nama);
  getSheetData('Lapak').forEach(x=>lapaks[String(x.id)]=x.nama);
  getSheetData('Users').forEach(x=>users[String(x.id)]=x.name||x.username);
  const requests=getSheetData('SupplierCorrectionRequests').map(r=>({
    id:String(r.id),createdAt:formatDateTime(r.createdAt),requestedBy:r.requestedBy,requestedByName:r.requestedByName||users[String(r.requestedBy)]||r.requestedBy,
    lapakId:r.lapakId,lapakNama:lapaks[String(r.lapakId)]||r.lapakId,supplierId:r.supplierId,supplierNama:suppliers[String(r.supplierId)]||r.supplierId,
    katalogId:r.katalogId,nama:catalog[String(r.katalogId)]||r.katalogId,konsinyasiId:r.konsinyasiId,setoranId:r.setoranId,
    oldQtyLaku:Number(r.oldQtyLaku)||0,requestedQtyLaku:Number(r.requestedQtyLaku)||0,hargaTitip:Number(r.hargaTitip)||0,
    oldObligation:Number(r.oldObligation)||0,newObligation:Number(r.newObligation)||0,reason:r.reason||'',status:r.status||'Pending',
    reviewedBy:r.reviewedBy||'',reviewedAt:formatDateTime(r.reviewedAt),reviewNote:r.reviewNote||'',paidAmount:Number(r.paidAmount)||0,creditCreated:Number(r.creditCreated)||0
  })).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const creditMap=getSupplierCreditBalanceMap_();
  const credits=Object.keys(creditMap).map(sid=>({supplierId:sid,supplierNama:suppliers[sid]||sid,credited:creditMap[sid].credited,used:creditMap[sid].used,balance:creditMap[sid].balance,events:creditMap[sid].events})).filter(x=>x.balance>0).sort((a,b)=>b.balance-a.balance);
  const ledger=getSheetData('SupplierCreditLedger').slice(-50).reverse().map(x=>({id:x.id,createdAt:formatDateTime(x.createdAt),supplierId:x.supplierId,supplierNama:suppliers[String(x.supplierId)]||x.supplierId,eventType:x.eventType,amount:Number(x.amount)||0,referenceInvoiceId:x.referenceInvoiceId||'',correctionId:x.correctionId||'',createdBy:x.createdBy||'',notes:x.notes||''}));
  return {requests,credits,ledger,pendingCount:requests.filter(x=>x.status==='Pending').length};
}
function apiApproveSupplierCorrection(token,requestId,reviewNote) {
  const sess=requireRole(token,['admin']),lock=LockService.getScriptLock();
  if(!lock.tryLock(CONFIG.LOCK_TIMEOUT))return {success:false,message:'Sistem sibuk. Coba lagi.'};
  try{
    const sheets=ensureSupplierFinanceSheets_(),ss=SpreadsheetApp.getActiveSpreadsheet(),requestSheet=sheets.requests,creditSheet=sheets.credits;
    const rd=requestSheet.getDataRange().getValues(),rh=rd[0].map(x=>String(x).trim()),ri=n=>rh.indexOf(n);
    const rindex=rd.findIndex((row,i)=>i>0&&String(row[ri('id')])===String(requestId));
    if(rindex<1)return {success:false,message:'Permintaan tidak ditemukan.'};
    const req=rd[rindex],rrow=rindex+1;if(String(req[ri('status')])!=='Pending')return {success:false,message:'Permintaan sudah diproses.'};
    const ks=ss.getSheetByName('Konsinyasi'),ds=ss.getSheetByName('SetoranDetail'),ssheet=ss.getSheetByName('Setoran'),stocks=ss.getSheetByName('KartuStok');
    if(!hasHeaders(ks,['id','supplierId','lapakId','katalogId','qtyLaku','hargaTitip','utang','status','setoranId','catatan','bayarAt','bayarBy'])||!hasHeaders(ds,['id','setoranId','katalogId','qtyDrop','qtySisa','qtyLaku','hargaJual','subtotal'])||!hasHeaders(ssheet,['id','totalSistem','totalTunai','totalQris','selisih'])||!hasHeaders(stocks,['id','tanggal','katalogId','lapakId','tipe','masuk','keluar','saldo','refId','keterangan']))return {success:false,message:'Struktur sheet koreksi belum lengkap. Tidak ada perubahan.'};
    const kd=ks.getDataRange().getValues(),kh=kd[0].map(x=>String(x).trim()),ki=n=>kh.indexOf(n);
    const kindex=kd.findIndex((row,i)=>i>0&&String(row[ki('id')])===String(req[ri('konsinyasiId')]));
    if(kindex<1)return {success:false,message:'Invoice sumber tidak ditemukan.'};
    const krow=kd[kindex],krowNum=kindex+1,oldQty=Number(krow[ki('qtyLaku')])||0,price=Number(krow[ki('hargaTitip')])||0,oldGross=oldQty*price;
    if(oldQty!==(Number(req[ri('oldQtyLaku')])||0)||oldGross!==(Number(req[ri('oldObligation')])||0)){
      const journal=beginWriteJournal(['SupplierCorrectionRequests']);journalSetValue(journal,requestSheet,rrow,ri('status')+1,'Stale');journalSetValue(journal,requestSheet,rrow,ri('reviewedBy')+1,sess.username);journalSetValue(journal,requestSheet,rrow,ri('reviewedAt')+1,new Date());journalSetValue(journal,requestSheet,rrow,ri('reviewNote')+1,'Invoice berubah sejak permintaan dibuat. Ajukan ulang dengan data terbaru.');_clearSheetCache();
      return {success:false,message:'Invoice berubah sejak permintaan dibuat. Permintaan ditandai Stale dan harus diajukan ulang.'};
    }
    const setoranId=String(krow[ki('setoranId')]||''),supplierId=String(krow[ki('supplierId')]||''),katalogId=String(krow[ki('katalogId')]||''),lapakId=String(krow[ki('lapakId')]||'');
    if(!setoranId||setoranId!==String(req[ri('setoranId')]))return {success:false,message:'Referensi setoran tidak cocok.'};
    if(isPeriodeLocked(formatDate(krow[ki('tanggal')])))return {success:false,message:'Periode terkunci. Buka kunci periode terlebih dahulu.'};
    const dd=ds.getDataRange().getValues(),dh=dd[0].map(x=>String(x).trim()),di=n=>dh.indexOf(n),dindexes=[];
    for(let i=1;i<dd.length;i++)if(String(dd[i][di('setoranId')])===setoranId&&String(dd[i][di('katalogId')])===katalogId)dindexes.push(i);
    if(dindexes.length!==1)return {success:false,message:'Rincian setoran tidak unik. Koreksi dibatalkan.'};
    const didx=dindexes[0],drow=dd[didx],drop=Number(drow[di('qtyDrop')])||0,newQty=Number(req[ri('requestedQtyLaku')]);
    if(!Number.isSafeInteger(newQty)||newQty<0||newQty>drop)return {success:false,message:'Jumlah koreksi tidak valid terhadap jumlah drop.'};
    const sd=ssheet.getDataRange().getValues(),sh=sd[0].map(x=>String(x).trim()),si=n=>sh.indexOf(n),sindex=sd.findIndex((row,i)=>i>0&&String(row[si('id')])===setoranId);
    if(sindex<1)return {success:false,message:'Setoran sumber tidak ditemukan.'};
    const oldDue=Math.max(0,Number(krow[ki('utang')])||0);
    const settlementMaps=getSupplierInvoiceSettlementMaps_();
    const paidFromAllocations=(settlementMaps.cashPaidById[String(krow[ki('id')])]||0)+(settlementMaps.creditAppliedByInvoice[String(krow[ki('id')])]||0)+(settlementMaps.statusSettledById[String(krow[ki('id')])]||0);
    const paid=String(krow[ki('status')])==='Bayar'?Math.max(oldGross,paidFromAllocations):Math.max(0,oldGross-oldDue,paidFromAllocations);
    const newGross=newQty*price,newDue=Math.max(0,newGross-paid),credit=Math.max(0,paid-newGross),newStatus=newDue>0?'Pending':(newQty===0&&paid<=0?'Cancelled':'Bayar');
    const st=stocks.getDataRange().getValues(),sth=st[0].map(x=>String(x).trim()),sx=n=>sth.indexOf(n),stockIdxs=[];
    for(let i=1;i<st.length;i++)if(String(st[i][sx('refId')])===setoranId&&String(st[i][sx('katalogId')])===katalogId&&String(st[i][sx('lapakId')])===lapakId&&String(st[i][sx('tipe')])==='Terjual')stockIdxs.push(i);
    if(stockIdxs.length>1||(oldQty>0&&stockIdxs.length!==1))return {success:false,message:'Ledger stok penjualan tidak unik atau tidak ditemukan. Koreksi dibatalkan agar saldo stok tidak rusak.'};
    const stockIdx=stockIdxs.length?stockIdxs[0]:-1,newSubtotal=newQty*(Number(drow[di('hargaJual')])||0);
    const journal=beginWriteJournal(['SupplierCorrectionRequests','SupplierCreditLedger','Konsinyasi','SetoranDetail','Setoran','KartuStok']);
    try{
      journalSetValue(journal,ks,krowNum,ki('qtyLaku')+1,newQty);journalSetValue(journal,ks,krowNum,ki('utang')+1,newDue);journalSetValue(journal,ks,krowNum,ki('status')+1,newStatus);
      journalSetValue(journal,ks,krowNum,ki('bayarAt')+1,newStatus==='Bayar'?new Date():'');journalSetValue(journal,ks,krowNum,ki('bayarBy')+1,newStatus==='Bayar'?'Pembayaran terdahulu':'');
      const oldNote=String(krow[ki('catatan')]||''),audit='KOREKSI '+requestId+' oleh '+sess.username+': qty '+oldQty+'→'+newQty+'; kewajiban '+oldGross+'→'+newGross;
      journalSetValue(journal,ks,krowNum,ki('catatan')+1,(oldNote?oldNote+' | ':'')+audit);
      journalSetValue(journal,ds,didx+1,di('qtyLaku')+1,newQty);journalSetValue(journal,ds,didx+1,di('qtySisa')+1,drop-newQty);journalSetValue(journal,ds,didx+1,di('subtotal')+1,newSubtotal);
      const newSales=dd.slice(1).reduce((sum,row,index)=>sum+(index===didx?newSubtotal:(Number(row[di('subtotal')])||0)),0);
      journalSetValue(journal,ssheet,sindex+1,si('totalSistem')+1,newSales);
      const received=(Number(sd[sindex][si('totalTunai')])||0)+(Number(sd[sindex][si('totalQris')])||0)+(si('totalTransfer')>=0?(Number(sd[sindex][si('totalTransfer')])||0):0);
      journalSetValue(journal,ssheet,sindex+1,si('selisih')+1,newSales-received);
      if(stockIdx>=0)journalSetValue(journal,stocks,stockIdx+1,sx('keluar')+1,newQty);
      else appendObjectsByHeaders(stocks,[{id:'KS'+Utilities.getUuid().slice(0,8).toUpperCase(),tanggal:new Date(),katalogId,lapakId,tipe:'Terjual',masuk:0,keluar:newQty,saldo:0,refId:setoranId,keterangan:'Koreksi admin '+requestId+' untuk penjualan yang sebelumnya tercatat nol'}]);
      const updatedStockData=stocks.getDataRange().getValues();
      let running=0;for(let i=1;i<updatedStockData.length;i++)if(String(updatedStockData[i][sx('katalogId')])===katalogId){running+=(Number(updatedStockData[i][sx('masuk')])||0)-(Number(updatedStockData[i][sx('keluar')])||0);journalSetValue(journal,stocks,i+1,sx('saldo')+1,running);}
      if(credit>0)appendObjectsByHeaders(creditSheet,[{id:'SCL'+Utilities.getUuid().slice(0,8).toUpperCase(),createdAt:new Date(),supplierId,eventType:'CREDIT',amount:credit,correctionId:requestId,sourceInvoiceId:String(krow[ki('id')]),referenceInvoiceId:'',createdBy:sess.username,notes:'Saldo lebih dari koreksi invoice '+requestId,requestKey:'CORR:'+requestId}]);
      journalSetValue(journal,requestSheet,rrow,ri('status')+1,'Approved');journalSetValue(journal,requestSheet,rrow,ri('reviewedBy')+1,sess.username);journalSetValue(journal,requestSheet,rrow,ri('reviewedAt')+1,new Date());journalSetValue(journal,requestSheet,rrow,ri('reviewNote')+1,String(reviewNote||'Disetujui admin'));journalSetValue(journal,requestSheet,rrow,ri('appliedAt')+1,new Date());journalSetValue(journal,requestSheet,rrow,ri('paidAmount')+1,paid);journalSetValue(journal,requestSheet,rrow,ri('creditCreated')+1,credit);
      _clearSheetCache();
      const applied=applySupplierCreditsToPendingInvoices_(supplierId,sess.username,journal);
      journalSetValue(journal,requestSheet,rrow,ri('reviewNote')+1,String(reviewNote||'Disetujui admin')+(applied.total>0?' · Kredit otomatis dipakai '+fmtRpLocal(applied.total):''));
      logAction(sess.username,'APPROVE_KOREKSI_INVOICE_SUPPLIER',{requestId,invoiceId:String(krow[ki('id')]),oldQty,newQty,oldGross,newGross,paid,credit,creditUsed:applied.total});
      _clearSheetCache();
      return {success:true,message:'Koreksi disetujui. Tagihan baru '+fmtRpLocal(newGross)+', sisa '+fmtRpLocal(newDue)+', saldo lebih dibuat '+fmtRpLocal(credit)+', kredit langsung dipakai '+fmtRpLocal(applied.total)+'.',creditCreated:credit,creditUsed:applied.total};
    }catch(e){
      try{rollbackWriteJournal(journal);}catch(re){return {success:false,message:'Koreksi gagal dan rollback perlu diperiksa. Hentikan transaksi dan hubungi admin: '+e.message+' | '+re.message};}
      _clearSheetCache();return {success:false,message:'Koreksi gagal. Semua perubahan dibatalkan: '+e.message};
    }
  }finally{lock.releaseLock();}
}
function apiRejectSupplierCorrection(token,requestId,reviewNote) {
  const sess=requireRole(token,['admin']),lock=LockService.getScriptLock();
  if(!lock.tryLock(CONFIG.LOCK_TIMEOUT))return {success:false,message:'Sistem sibuk. Coba lagi.'};
  try{
    const sheet=ensureSupplierFinanceSheets_().requests,data=sheet.getDataRange().getValues(),h=data[0].map(x=>String(x).trim()),ix=n=>h.indexOf(n);
    const index=data.findIndex((row,i)=>i>0&&String(row[ix('id')])===String(requestId));
    if(index<1)return {success:false,message:'Permintaan koreksi tidak ditemukan.'};
    if(String(data[index][ix('status')])!=='Pending')return {success:false,message:'Permintaan sudah diproses.'};
    const journal=beginWriteJournal(['SupplierCorrectionRequests']);
    try{
      journalSetValue(journal,sheet,index+1,ix('status')+1,'Rejected');
      journalSetValue(journal,sheet,index+1,ix('reviewedBy')+1,sess.username);
      journalSetValue(journal,sheet,index+1,ix('reviewedAt')+1,new Date());
      journalSetValue(journal,sheet,index+1,ix('reviewNote')+1,String(reviewNote||'Ditolak admin'));
      _clearSheetCache();
      logAction(sess.username,'REJECT_KOREKSI_INVOICE_SUPPLIER',{requestId,reviewNote:String(reviewNote||'')});
      return {success:true,message:'Permintaan ditolak. Invoice dan saldo supplier tidak diubah.'};
    }catch(error){
      try{rollbackWriteJournal(journal);}catch(rollbackError){return {success:false,message:'Penolakan gagal dan pemulihan perlu diperiksa. '+error.message+' | '+rollbackError.message};}
      _clearSheetCache();
      return {success:false,message:'Penolakan gagal. Tidak ada perubahan yang dipertahankan: '+error.message};
    }
  }finally{lock.releaseLock();}
}
function apiGetKonsinyasiDetailSupplier(token, supplierId) {
  requireRole(token, ['admin']);
  if (!supplierId) return { success: false, message: 'Supplier wajib.' };
  const katMap = {}; getSheetData('Katalog').forEach(k => katMap[k.id] = k.nama);
  const lapakMap = {}; getSheetData('Lapak').forEach(l => lapakMap[l.id] = l.nama);
  const list = getSheetData('Konsinyasi').filter(k => String(k.supplierId) === String(supplierId) && k.status === 'Pending');
  const grouped = {};
  list.forEach(k => {
    const susulan=String(k.catatan||'').indexOf('PEMBELIAN_SUSULAN|')===0;
    const tanggal=formatDate(k.tanggal), harga=Number(k.hargaTitip)||0, katalogId=String(k.katalogId||'');
    // Supplier is fixed by this API call. Same catalogue item, unit price and
    // transaction type become one line even when drops happened on other dates/lapaks.
    const key=[katalogId,harga,susulan?'susulan':'titipan'].join('|');
    if (!grouped[key]) grouped[key]={id:'GRP_'+key,nama:katMap[katalogId]||katalogId,katalogId,qtyLaku:0,hargaTitip:harga,utang:0,jenis:susulan?'Pembelian susulan':'Titipan terjual',tanggalList:[],lapakBreakdown:[],sourceBreakdown:[],invoiceIds:[],setoranIds:[],catatan:''};
    const g=grouped[key];
    g.qtyLaku+=Number(k.qtyLaku)||0;
    g.utang+=Number(k.utang)||0;
    g.invoiceIds.push(String(k.id));
    if(g.tanggalList.indexOf(tanggal)<0)g.tanggalList.push(tanggal);
    const lapakNama=lapakMap[k.lapakId]||k.lapakId;
    const lapakExisting=g.lapakBreakdown.find(x=>x.lapakNama===lapakNama);
    if(lapakExisting){lapakExisting.qty+=(Number(k.qtyLaku)||0);lapakExisting.utang+=(Number(k.utang)||0);}
    else g.lapakBreakdown.push({lapakNama,qty:Number(k.qtyLaku)||0,utang:Number(k.utang)||0});
    const sourceExisting=g.sourceBreakdown.find(x=>x.tanggal===tanggal&&x.lapakNama===lapakNama);
    if(sourceExisting){sourceExisting.qty+=(Number(k.qtyLaku)||0);sourceExisting.utang+=(Number(k.utang)||0);}
    else g.sourceBreakdown.push({tanggal,lapakNama,qty:Number(k.qtyLaku)||0,utang:Number(k.utang)||0});
    if(susulan)g.setoranIds.push(String(k.catatan||'').split('|')[1]||'');
  });
  const items=Object.values(grouped).map(g=>({
    ...g,
    tanggalList:g.tanggalList.sort(),
    sourceBreakdown:g.sourceBreakdown.sort((a,b)=>a.tanggal.localeCompare(b.tanggal)||a.lapakNama.localeCompare(b.lapakNama))
  })).sort((a,b)=>a.nama.localeCompare(b.nama));
  const total=list.reduce((sum,k)=>sum+(Number(k.utang)||0),0);
  const credit=(getSupplierCreditBalanceMap_()[String(supplierId)]||{balance:0}).balance;
  const creditForThisBill=Math.min(total,credit);
  return { count:list.length, groupedCount:items.length, total, creditAvailable:credit, creditToApply:creditForThisBill, totalAfterCredit:Math.max(0,total-creditForThisBill), countPembelianSusulan:items.filter(x=>x.jenis==='Pembelian susulan').length, totalPembelianSusulan:items.filter(x=>x.jenis==='Pembelian susulan').reduce((sum,x)=>sum+x.utang,0), countTitipan:items.filter(x=>x.jenis==='Titipan terjual').length, totalTitipan:items.filter(x=>x.jenis==='Titipan terjual').reduce((sum,x)=>sum+x.utang,0), items };
}
function apiGetTemplateBox(token) {
  requireRole(token, ['admin', 'karyawan']);
  return getTemplateBoxFullData();
}
function apiSaveTemplateBox(token, payload) {
  const sess = requireRole(token, ['admin']);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const boxSheet = ss.getSheetByName('TemplateBox');
    const itemSheet = ss.getSheetByName('TemplateBoxItem');
    const nama = String(payload.nama || '').trim();
    if (!nama) return { success: false, message: 'Nama box wajib.' };
    const hargaPaket = toPosNum(payload.hargaPaket);
    if (hargaPaket <= 0) return { success: false, message: 'Harga paket harus > 0.' };
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) return { success: false, message: 'Isi box minimal 1 item.' };
    const boxId = payload.id || ('TB' + Utilities.getUuid().slice(0, 8).toUpperCase());
    const row = [boxId, nama, hargaPaket, String(payload.keterangan || ''), payload.aktif !== false];
    const boxData = boxSheet.getDataRange().getValues();
    const iId = boxData[0].indexOf('id');
    let found = false;
    if (payload.id) {
      for (let i = 1; i < boxData.length; i++) {
        if (String(boxData[i][iId]) === String(payload.id)) { boxSheet.getRange(i + 1, 1, 1, row.length).setValues([row]); found = true; break; }
      }
    }
    if (!found) boxSheet.appendRow(row);
    const itemData = itemSheet.getDataRange().getValues();
    const iBox = itemData[0].indexOf('templateBoxId');
    for (let i = itemData.length - 1; i >= 1; i--) {
      if (String(itemData[i][iBox]) === String(boxId)) itemSheet.deleteRow(i + 1);
    }
    const newRows = items.map(it => ['TBI' + Utilities.getUuid().slice(0, 8).toUpperCase(), boxId, it.katalogId, toPosNum(it.qty) || 1]);
    if (newRows.length) itemSheet.getRange(itemSheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    _clearSheetCache();
    return { success: true, message: payload.id ? 'Box diperbarui.' : 'Box ditambahkan.' };
  } finally { lock.releaseLock(); }
}
function apiDeleteTemplateBox(token, id) {
  const sess = requireRole(token, ['admin']);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const boxSheet = ss.getSheetByName('TemplateBox');
    const itemSheet = ss.getSheetByName('TemplateBoxItem');
    const boxData = boxSheet.getDataRange().getValues();
    const iId = boxData[0].indexOf('id');
    for (let i = 1; i < boxData.length; i++) {
      if (String(boxData[i][iId]) === String(id)) { boxSheet.deleteRow(i + 1); break; }
    }
    const itemData = itemSheet.getDataRange().getValues();
    const iBox = itemData[0].indexOf('templateBoxId');
    for (let i = itemData.length - 1; i >= 1; i--) {
      if (String(itemData[i][iBox]) === String(id)) itemSheet.deleteRow(i + 1);
    }
    _clearSheetCache();
    return { success: true, message: 'Box dihapus.' };
  } finally { lock.releaseLock(); }
}

// ============================================================
//  FASE 3 — PESANAN PELANGGAN
// ============================================================
function apiGetPesananPelanggan(token, filter) {
  requireRole(token, ['admin']);
  filter = filter || {};
  let list = getSheetData('PesananPelanggan').map(p => ({ id: p.id, tanggal: formatDate(p.tanggal), pelangganNama: p.pelangganNama || '', pelangganHp: p.pelangganHp || '', pelangganEmail: p.pelangganEmail || '', tanggalAmbil: formatDate(p.tanggalAmbil), jenisAmbil: p.jenisAmbil || 'Terjadwal', metodeAmbil: p.metodeAmbil || 'Ambil', alamat: p.alamat || '', catatan: p.catatan || '', totalSistem: Number(p.totalSistem) || 0, dp: Number(p.dp) || 0, sisaBayar: Number(p.sisaBayar) || 0, metodeBayar: p.metodeBayar || 'Tunai', status: p.status || 'Dipesan', bonusAntarId: p.bonusAntarId || '', kasIdDp: p.kasIdDp || '', kasIdLunas: p.kasIdLunas || '', createdAt: formatDateTime(p.createdAt), createdBy: p.createdBy || '', updatedAt: formatDateTime(p.updatedAt) }));
  if (filter.status) list = list.filter(p => p.status === filter.status);
  if (filter.dari) list = list.filter(p => p.tanggalAmbil >= filter.dari);
  if (filter.sampai) list = list.filter(p => p.tanggalAmbil <= filter.sampai);
  if (filter.jenisAmbil) list = list.filter(p => p.jenisAmbil === filter.jenisAmbil);
  return list.sort((a, b) => (a.tanggalAmbil || '').localeCompare(b.tanggalAmbil || '')).reverse();
}
function apiGetPesananPelangganDetail(token, id) {
  requireRole(token, ['admin']);
  if (!id) return { success: false, message: 'ID wajib.' };
  const p = getSheetData('PesananPelanggan').find(x => String(x.id) === String(id));
  if (!p) return { success: false, message: 'Pesanan tidak ditemukan.' };
  const items = getSheetData('PesananPelangganItem').filter(it => String(it.pesananId) === String(id)).map(it => ({ id: it.id, katalogId: it.katalogId, nama: it.namaItem || it.katalogId, qty: Number(it.qty) || 0, hargaJual: Number(it.hargaJual) || 0, subtotal: Number(it.subtotal) || 0, dariBoxId: it.dariBoxId || '', dariBoxNama: it.dariBoxNama || '' }));
  return { id: p.id, tanggal: formatDate(p.tanggal), pelangganNama: p.pelangganNama || '', pelangganHp: p.pelangganHp || '', pelangganEmail: p.pelangganEmail || '', tanggalAmbil: formatDate(p.tanggalAmbil), jenisAmbil: p.jenisAmbil || 'Terjadwal', metodeAmbil: p.metodeAmbil || 'Ambil', alamat: p.alamat || '', catatan: p.catatan || '', totalSistem: Number(p.totalSistem) || 0, dp: Number(p.dp) || 0, sisaBayar: Number(p.sisaBayar) || 0, metodeBayar: p.metodeBayar || 'Tunai', status: p.status || 'Dipesan', bonusAntarId: p.bonusAntarId || '', createdAt: formatDateTime(p.createdAt), createdBy: p.createdBy || '', items };
}
function apiSavePesananPelanggan(token, payload) {
  const sess = requireRole(token, ['admin']);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pesananSheet = ss.getSheetByName('PesananPelanggan');
    const itemSheet = ss.getSheetByName('PesananPelangganItem');
    const pelangganNama = String(payload.pelangganNama || '').trim();
    if (!pelangganNama) return { success: false, message: 'Nama pelanggan wajib.' };
    const tanggalAmbil = payload.tanggalAmbil || todayStr();
    const jenisAmbil = payload.jenisAmbil === 'WalkIn' ? 'WalkIn' : 'Terjadwal';
    const metodeAmbil = payload.metodeAmbil === 'Diantar' ? 'Diantar' : 'Ambil';
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) return { success: false, message: 'Minimal 1 item.' };
    const katMap = {}; getSheetData('Katalog').forEach(k => katMap[k.id] = k);
    let totalSistem = 0;
    const detailRows = [];
    items.forEach(it => {
      const k = katMap[it.katalogId]; if (!k) return;
      const qty = toPosNum(it.qty);
      if (qty <= 0) return;
      const hargaJual = toPosNum(it.hargaJual) || Number(k.hargaJual) || 0;
      const subtotal = qty * hargaJual;
      totalSistem += subtotal;
      detailRows.push({ katalogId: it.katalogId, namaItem: it.namaItem || k.nama, qty, hargaJual, subtotal, dariBoxId: it.dariBoxId || '', dariBoxNama: it.dariBoxNama || '' });
    });
    if (!detailRows.length) return { success: false, message: 'Semua item qty bernilai 0.' };
    const dp = toPosNum(payload.dp);
    const sisaBayar = Math.max(0, totalSistem - dp);
    const metodeBayar = ['Tunai','QRIS'].indexOf(payload.metodeBayar) !== -1 ? payload.metodeBayar : 'Tunai';
    const pesananId = payload.id || ('PP' + Utilities.getUuid().slice(0, 8).toUpperCase());
    let kasIdDp = '';
    if (dp > 0 && !payload.id) {
      const kasSheet = ss.getSheetByName('Kas');
      const kasData = kasSheet.getDataRange().getValues();
      const iSaldo = kasData[0].indexOf('saldo');
      const saldoLama = kasData.length > 1 ? Number(kasData[kasData.length - 1][iSaldo]) || 0 : 0;
      kasIdDp = 'KS' + Utilities.getUuid().slice(0, 8).toUpperCase();
      appendObjectsByHeaders(kasSheet,[{id:kasIdDp,tanggal:new Date(),keterangan:'DP Pesanan: '+pelangganNama,tipe:'Masuk',kategori:'Pesanan-DP',nominal:dp,saldo:saldoLama+dp}]);
    }
    const row = [pesananId, payload.tanggal ? new Date(payload.tanggal) : new Date(), pelangganNama, String(payload.pelangganHp || ''), new Date(tanggalAmbil), jenisAmbil, metodeAmbil, String(payload.alamat || ''), String(payload.catatan || ''), totalSistem, dp, sisaBayar, metodeBayar, 'Dipesan', '', kasIdDp, '', payload.id ? payload.createdAt : new Date(), payload.id ? payload.createdBy : sess.username, new Date(), String(payload.pelangganEmail || '')];
    const data = pesananSheet.getDataRange().getValues();
    const iId = data[0].indexOf('id');
    let found = false;
    if (payload.id) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][iId]) === String(payload.id)) {
          row[15] = data[i][data[0].indexOf('kasIdDp')] || kasIdDp;
          row[17] = data[i][data[0].indexOf('createdAt')] || new Date();
          row[18] = data[i][data[0].indexOf('createdBy')] || sess.username;
          pesananSheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
          found = true;
          break;
        }
      }
    }
    if (!found) pesananSheet.appendRow(row);
    const itemData = itemSheet.getDataRange().getValues();
    const iPesanan = itemData[0].indexOf('pesananId');
    for (let i = itemData.length - 1; i >= 1; i--) {
      if (String(itemData[i][iPesanan]) === String(pesananId)) itemSheet.deleteRow(i + 1);
    }
    const newItems = detailRows.map(d => ['PPI' + Utilities.getUuid().slice(0, 8).toUpperCase(), pesananId, d.katalogId, d.namaItem, d.qty, d.hargaJual, d.subtotal, d.dariBoxId, d.dariBoxNama]);
    if (newItems.length) itemSheet.getRange(itemSheet.getLastRow() + 1, 1, newItems.length, newItems[0].length).setValues(newItems);
    _clearSheetCache();
    if (!payload.id) {
      notifyPesananBaru({ id: pesananId, pelangganNama, pelangganHp: String(payload.pelangganHp || ''), tanggalAmbil, jenisAmbil, metodeAmbil, totalSistem, dp, sisaBayar });
    }
    return { success: true, message: payload.id ? 'Pesanan diperbarui.' : 'Pesanan dibuat.', id: pesananId };
  } finally { lock.releaseLock(); }
}
function apiUpdateStatusPesanan(token, id, status) {
  const sess = requireRole(token, ['admin']);
  if (['Dipesan','Siap','Diambil','Selesai','Batal'].indexOf(status) === -1) return { success: false, message: 'Status tidak valid.' };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PesananPelanggan');
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const iId = h.indexOf('id'), iStatus = h.indexOf('status'), iUpd = h.indexOf('updatedAt');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][iId]) === String(id)) {
      sheet.getRange(i + 1, iStatus + 1).setValue(status);
      if (iUpd >= 0) sheet.getRange(i + 1, iUpd + 1).setValue(new Date());
      _clearSheetCache();
      return { success: true, message: 'Status: ' + status };
    }
  }
  return { success: false, message: 'Pesanan tidak ditemukan.' };
}
function apiSelesaikanPesanan(token, id, payload) {
  const sess = requireRole(token, ['admin']);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pesananSheet = ss.getSheetByName('PesananPelanggan');
    const data = pesananSheet.getDataRange().getValues();
    const h = data[0];
    const iId = h.indexOf('id'), iStatus = h.indexOf('status');
    const iNama = h.indexOf('pelangganNama'), iMetode = h.indexOf('metodeAmbil');
    const iSisa = h.indexOf('sisaBayar'), iMetodeBayar = h.indexOf('metodeBayar');
    const iKasLunas = h.indexOf('kasIdLunas'), iBonus = h.indexOf('bonusAntarId');
    const iUpd = h.indexOf('updatedAt');
    let rowIdx = -1, pelangganNama = '', metodeAmbil = 'Ambil', sisaBayar = 0, metodeBayar = 'Tunai', existingBonus = '';
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][iId]) === String(id)) {
        if (data[i][iStatus] === 'Selesai') return { success: false, message: 'Pesanan sudah diselesaikan.' };
        if (data[i][iStatus] === 'Batal') return { success: false, message: 'Pesanan sudah dibatalkan.' };
        pelangganNama = data[i][iNama]; metodeAmbil = data[i][iMetode];
        sisaBayar = Number(data[i][iSisa]) || 0; metodeBayar = data[i][iMetodeBayar] || 'Tunai';
        existingBonus = data[i][iBonus] || '';
        rowIdx = i + 1;
        break;
      }
    }
    if (rowIdx === -1) return { success: false, message: 'Pesanan tidak ditemukan.' };
    const items = getSheetData('PesananPelangganItem').filter(it => String(it.pesananId) === String(id));
    const saldoMap = {};
    apiGetStokSaldo(null, true).forEach(s => { saldoMap[String(s.katalogId)] = Number(s.saldo) || 0; });
    const stokKurang = [];
    items.forEach(it => {
      const qty = Number(it.qty) || 0;
      if (qty <= 0) return;
      const tersedia = saldoMap[String(it.katalogId)] || 0;
      if (qty > tersedia) stokKurang.push({ nama: it.namaItem || it.katalogId, butuh: qty, tersedia });
    });
    if (stokKurang.length > 0) {
      const detail = stokKurang.map(x => x.nama + ' (butuh ' + x.butuh + ', tersedia ' + x.tersedia + ')').join(', ');
      return { success: false, message: 'Stok tidak cukup: ' + detail + '. Restock dulu atau sesuaikan pesanan.' };
    }
    items.forEach(it => { const qty = Number(it.qty) || 0; if (qty > 0) catatKartuStok(it.katalogId, '', 'Pesanan-Keluar', 0, qty, id, 'Pesanan ' + pelangganNama); });
    let kasIdLunas = '';
    if (sisaBayar > 0) {
      const kasSheet = ss.getSheetByName('Kas');
      const kasData = kasSheet.getDataRange().getValues();
      const iSaldo = kasData[0].indexOf('saldo');
      const saldoLama = kasData.length > 1 ? Number(kasData[kasData.length - 1][iSaldo]) || 0 : 0;
      kasIdLunas = 'KS' + Utilities.getUuid().slice(0, 8).toUpperCase();
      appendObjectsByHeaders(kasSheet,[{id:kasIdLunas,tanggal:new Date(),keterangan:'Pelunasan Pesanan: '+pelangganNama,tipe:'Masuk',kategori:'Pesanan-Lunas',nominal:sisaBayar,saldo:saldoLama+sisaBayar}]);
    }
    let bonusId = existingBonus;
    if (metodeAmbil === 'Diantar' && payload.bonusAntar && payload.bonusAntar.userId && Number(payload.bonusAntar.nominal) > 0) {
      const bonusSheet = ss.getSheetByName('BonusAntar');
      bonusId = 'BA' + Utilities.getUuid().slice(0, 8).toUpperCase();
      bonusSheet.appendRow([bonusId, new Date(), payload.bonusAntar.userId, 'Pesanan ' + pelangganNama, toPosNumF(payload.bonusAntar.jarakKm), items.length, toPosNum(payload.bonusAntar.nominal), 'Bonus antar pesanan #' + id, sess.username, id]);
    }
    pesananSheet.getRange(rowIdx, iStatus + 1).setValue('Selesai');
    if (iKasLunas >= 0) pesananSheet.getRange(rowIdx, iKasLunas + 1).setValue(kasIdLunas);
    if (iBonus >= 0) pesananSheet.getRange(rowIdx, iBonus + 1).setValue(bonusId);
    if (iUpd >= 0) pesananSheet.getRange(rowIdx, iUpd + 1).setValue(new Date());
    _clearSheetCache();
    return { success: true, message: 'Pesanan selesai. Stok dikurangi, kas diperbarui.' };
  } finally { lock.releaseLock(); }
}
function apiDeletePesananPelanggan(token, id) {
  const sess = requireRole(token, ['admin']);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT)) return { success: false, message: 'Sistem sibuk. Coba lagi.' };
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pesananSheet = ss.getSheetByName('PesananPelanggan');
    const itemSheet = ss.getSheetByName('PesananPelangganItem');
    const data = pesananSheet.getDataRange().getValues();
    const h = data[0];
    const iId = h.indexOf('id'), iStatus = h.indexOf('status');
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][iId]) === String(id)) {
        if (data[i][iStatus] === 'Selesai') return { success: false, message: 'Pesanan sudah selesai. Tidak bisa dihapus.' };
        pesananSheet.deleteRow(i + 1);
        break;
      }
    }
    const itemData = itemSheet.getDataRange().getValues();
    const iPesanan = itemData[0].indexOf('pesananId');
    for (let i = itemData.length - 1; i >= 1; i--) {
      if (String(itemData[i][iPesanan]) === String(id)) itemSheet.deleteRow(i + 1);
    }
    _clearSheetCache();
    return { success: true, message: 'Pesanan dihapus.' };
  } finally { lock.releaseLock(); }
}
function apiGetPesananKalender(token, bulan) {
  requireRole(token, ['admin']);
  if (!bulan) bulan = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
  const list = getSheetData('PesananPelanggan').filter(p => formatDate(p.tanggalAmbil).indexOf(bulan) === 0);
  const byDate = {};
  list.forEach(p => {
    const d = formatDate(p.tanggalAmbil);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push({ id: p.id, pelangganNama: p.pelangganNama || '', totalSistem: Number(p.totalSistem) || 0, status: p.status || 'Dipesan', metodeAmbil: p.metodeAmbil || 'Ambil' });
  });
  return Object.keys(byDate).sort().map(d => ({ tanggal: d, pesanan: byDate[d] }));
}

// ============================================================
//  FASE 4 — ANALYTICS
// ============================================================
function apiGetAnalytics(token, filter) {
  requireRole(token, ['admin']);
  filter = filter || {};
  const range = [7, 14, 30, 90].indexOf(Number(filter.range)) !== -1 ? Number(filter.range) : 30;
  const endDate = new Date();
  const startDate = new Date(Date.now() - (range - 1) * 86400000);
  const fromMs = startDate.getTime();
  const toMs = endDate.getTime() + 86400000;
  const setoran = getSheetData('Setoran').filter(s => {
    if (s.status !== 'approved' && s.status !== 'pending') return false;
    const t = s.tanggal instanceof Date ? s.tanggal.getTime() : new Date(s.tanggal).getTime();
    return t >= fromMs && t <= toMs;
  });
  const setoranIds = {}; setoran.forEach(s => setoranIds[s.id] = s);
  const katMap = {}; getSheetData('Katalog').forEach(k => katMap[k.id] = k);
  const lapakMap = {}; getSheetData('Lapak').forEach(l => lapakMap[l.id] = l.nama);
  const userMap = {}; getSheetData('Users').forEach(u => userMap[u.id] = u.name);
  const dailyMap = {};
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const ds = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    dailyMap[ds] = { tanggal: ds, omzet: 0, profit: 0, qty: 0, setoran: 0 };
  }
  const perLapak = {};
  const perKaryawan = {};
  const perJam = Array(24).fill(0);
  const perKategori = {};
  getSheetData('SetoranDetail').forEach(d => {
    const s = setoranIds[d.setoranId]; if (!s) return;
    const k = katMap[d.katalogId]; if (!k) return;
    const qtyLaku = Number(d.qtyLaku) || 0;
    const subtotal = Number(d.subtotal) || 0;
    const hpp = qtyLaku * (Number(d.hargaBeli) || Number(k.hargaBeli) || 0);
    const profit = subtotal - hpp;
    const tgl = formatDate(s.tanggal);
    if (dailyMap[tgl]) { dailyMap[tgl].omzet += subtotal; dailyMap[tgl].profit += profit; dailyMap[tgl].qty += qtyLaku; }
    const lapakId = String(s.lapakId);
    if (!perLapak[lapakId]) perLapak[lapakId] = { lapakId, nama: lapakMap[lapakId] || lapakId, omzet: 0, profit: 0, qty: 0, setoranCount: 0 };
    perLapak[lapakId].omzet += subtotal; perLapak[lapakId].profit += profit; perLapak[lapakId].qty += qtyLaku;
    const userId = String(s.userId);
    if (!perKaryawan[userId]) perKaryawan[userId] = { userId, nama: userMap[userId] || userId, omzet: 0, profit: 0, qty: 0, setoranCount: 0, totalSkor: 0, skorCount: 0 };
    perKaryawan[userId].omzet += subtotal; perKaryawan[userId].profit += profit; perKaryawan[userId].qty += qtyLaku;
    const kategori = k.kategori || 'Lain';
    if (!perKategori[kategori]) perKategori[kategori] = { kategori, omzet: 0, profit: 0, qty: 0 };
    perKategori[kategori].omzet += subtotal; perKategori[kategori].profit += profit; perKategori[kategori].qty += qtyLaku;
  });
  setoran.forEach(s => {
    const tgl = formatDate(s.tanggal);
    if (dailyMap[tgl]) dailyMap[tgl].setoran++;
    const lapakId = String(s.lapakId);
    if (perLapak[lapakId]) perLapak[lapakId].setoranCount++;
    const userId = String(s.userId);
    if (perKaryawan[userId]) perKaryawan[userId].setoranCount++;
    const approvedAt = s.approvedAt;
    if (approvedAt instanceof Date) perJam[approvedAt.getHours()] += (Number(s.totalSistem) || 0);
  });
  const dailyArr = Object.values(dailyMap);
  const last7 = dailyArr.slice(-7);
  const avgOmzet = last7.length ? last7.reduce((a, b) => a + b.omzet, 0) / last7.length : 0;
  const avgProfit = last7.length ? last7.reduce((a, b) => a + b.profit, 0) / last7.length : 0;
  const forecast = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(Date.now() + i * 86400000);
    const ds = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    forecast.push({ tanggal: ds, omzet: Math.round(avgOmzet), profit: Math.round(avgProfit) });
  }
  const peakHourIdx = perJam.indexOf(Math.max(...perJam));
  const peakHour = peakHourIdx >= 0 && Math.max(...perJam) > 0 ? peakHourIdx : null;
  const insights = [];
  if (avgOmzet > 0) {
    const last3 = dailyArr.slice(-3).reduce((a, b) => a + b.omzet, 0) / 3;
    const prev3 = dailyArr.slice(-6, -3).reduce((a, b) => a + b.omzet, 0) / 3;
    if (prev3 > 0) {
      const diff = ((last3 - prev3) / prev3) * 100;
      if (diff > 5) insights.push({ type: 'success', text: 'Omzet 3 hari terakhir naik ' + diff.toFixed(1) + '% vs 3 hari sebelumnya' });
      else if (diff < -5) insights.push({ type: 'warn', text: 'Omzet 3 hari terakhir turun ' + Math.abs(diff).toFixed(1) + '%' });
    }
  }
  return { range, periode: { dari: formatDate(startDate), sampai: formatDate(endDate) }, daily: dailyArr, forecast, perLapak: Object.values(perLapak).sort((a, b) => b.omzet - a.omzet), perKaryawan: Object.values(perKaryawan).sort((a, b) => b.omzet - a.omzet).map(k => ({ ...k, avgOmzet: k.setoranCount > 0 ? Math.round(k.omzet / k.setoranCount) : 0 })), perKategori: Object.values(perKategori).sort((a, b) => b.omzet - a.omzet), perJam: perJam.map((v, i) => ({ jam: i, omzet: v })), peakHour, ringkasan: { totalOmzet: dailyArr.reduce((a, b) => a + b.omzet, 0), totalProfit: dailyArr.reduce((a, b) => a + b.profit, 0), totalQty: dailyArr.reduce((a, b) => a + b.qty, 0), avgOmzet: Math.round(avgOmzet), avgProfit: Math.round(avgProfit) }, insights };
}

function apiGetAnalisisPerforma(token, payload) {
  requireRole(token, ['admin']);
  payload = payload || {};
  const range = [7, 30, 90].indexOf(Number(payload.range)) !== -1 ? Number(payload.range) : 30;
  const groupBy = payload.groupBy === 'supplier' ? 'supplier' : 'item';
  const ids = Array.isArray(payload.ids) ? payload.ids.map(String) : [];
  const endDate = new Date();
  const startDate = new Date(Date.now() - (range - 1) * 86400000);
  const startISO = formatDate(startDate);
  const endISO = formatDate(endDate);
  const setoranMap = {};
  getSheetData('Setoran').forEach(s => {
    const status = s.status;
    if (status !== 'approved' && status !== 'pending') return;
    const tgl = formatDate(s.tanggal);
    if (tgl < startISO || tgl > endISO) return;
    setoranMap[s.id] = { tanggal: tgl };
  });
  const katMap = {};
  getSheetData('Katalog').forEach(k => katMap[k.id] = { id: k.id, nama: k.nama, supplierId: k.supplierId || k.supplier });
  const supMap = {};
  getSheetData('Suppliers').forEach(s => supMap[s.id] = s.nama);
  const dailyMap = {};
  const entityAgg = {};
  getSheetData('SetoranDetail').forEach(d => {
    const s = setoranMap[d.setoranId]; if (!s) return;
    const qtyLaku = Number(d.qtyLaku) || 0;
    const subtotal = Number(d.subtotal) || 0;
    if (qtyLaku <= 0) return;
    let entityId, entityNama;
    const k = katMap[d.katalogId];
    if (groupBy === 'item') { entityId = String(d.katalogId); entityNama = k ? k.nama : entityId; }
    else { entityId = k ? String(k.supplierId) : 'UNKNOWN'; entityNama = supMap[entityId] || entityId; }
    if (ids.length > 0 && ids.indexOf(entityId) === -1) return;
    const tgl = s.tanggal;
    if (!dailyMap[tgl]) dailyMap[tgl] = {};
    if (!dailyMap[tgl][entityId]) dailyMap[tgl][entityId] = { qty: 0, omzet: 0 };
    dailyMap[tgl][entityId].qty += qtyLaku;
    dailyMap[tgl][entityId].omzet += subtotal;
    if (!entityAgg[entityId]) entityAgg[entityId] = { id: entityId, nama: entityNama, qty: 0, omzet: 0 };
    entityAgg[entityId].qty += qtyLaku;
    entityAgg[entityId].omzet += subtotal;
  });
  const tanggalList = [];
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    tanggalList.push(Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  }
  const entities = Object.values(entityAgg).sort((a, b) => b.omzet - a.omzet);
  const selectedIds = ids.length > 0 ? ids : entities.slice(0, 5).map(e => e.id);
  const daily = tanggalList.map(tgl => {
    const dayData = dailyMap[tgl] || {};
    const values = {};
    selectedIds.forEach(id => { values[id] = dayData[id] || { qty: 0, omzet: 0 }; });
    return { tanggal: tgl, values };
  });
  const totalOmzet = entities.reduce((s, e) => s + e.omzet, 0);
  const totalQty = entities.reduce((s, e) => s + e.qty, 0);
  return { periode: { dari: startISO, sampai: endISO }, groupBy, entities: entities.slice(0, 100), selectedIds, daily, summary: { totalOmzet, totalQty, avgOmzetPerHari: Math.round(totalOmzet / range) } };
}

// ============================================================
//  DIAGNOSTIC
// ============================================================
function diagnoseFull() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const r = [];
  r.push('=== DIAGNOSTIC KUE AS-SYIFA v5.10 ===');
  r.push('Timezone: ' + Session.getScriptTimeZone());
  r.push('Sekarang: ' + new Date().toString());
  r.push('');
  r.push('--- Sheets ---');
  const required = ['Users','Lapak','Suppliers','Katalog','Distribusi','Absensi','Setoran','SetoranDetail','PengeluaranLapak','Belanja','Kas','Jadwal','Kasbon','Gaji','SettingGaji','Pesanan','Sessions','KartuStok','Retur','HargaTingkat','TutupBuku','Notifikasi','AbsensiKaryawan','BonusAntar','SettingPayroll','HariEfektif','RekapPayroll','Konsinyasi','BayarTitipanKaryawan','TemplateBox','TemplateBoxItem','PesananPelanggan','PesananPelangganItem','Log','EmailLog'];
  required.forEach(name => {
    const s = ss.getSheetByName(name);
    r.push((s ? '✅' : '❌') + ' ' + name + (s ? ' (' + (s.getLastRow() - 1) + ' rows)' : ' MISSING'));
  });
  r.push('');
  r.push('--- Users ---');
  const users = getSheetData('Users');
  users.forEach(u => {
    const status = u.passwordHash && u.salt ? 'CREDENTIALS_SET' : 'CREDENTIALS_MISSING';
    r.push('  ' + u.username + ' / ' + u.name + ' / ' + u.role + ' / lapakIds=' + (u.lapakIds || '-') + ' / ' + status);
  });
  r.push('');
  r.push('--- Config ---');
  r.push('NOTIF_EMAIL: ' + (CONFIG.NOTIF_EMAIL || '(kosong)'));
  r.push('NOTIF_EMAIL_PESANAN: ' + (CONFIG.NOTIF_EMAIL_PESANAN || '(kosong)'));
  r.push('STOK_KRITIS_THRESHOLD: ' + CONFIG.STK_KRITIS_THRESHOLD);
  r.push('HASH_ITERATIONS: ' + CONFIG.HASH_ITERATIONS);
  const out = r.join('\n');
  console.log(out);
  return out;
}

// ============================================
//  TESTING FUNCTIONS
// ============================================
function testEmailLangsung() {
  try {
    const emailTujuan = String(CONFIG.NOTIF_EMAIL || '').trim();
    console.log('=== TEST EMAIL ===');
    console.log('Email tujuan: ' + emailTujuan);
    if (!emailTujuan || emailTujuan === 'email.anda@gmail.com') {
      console.log('❌ GAGAL: NOTIF_EMAIL belum diset di CONFIG');
      return { success: false, message: 'NOTIF_EMAIL belum diset' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTujuan)) {
      console.log('❌ GAGAL: Format email tidak valid: ' + emailTujuan);
      return { success: false, message: 'Format email tidak valid' };
    }
    console.log('📧 Mengirim email...');
    MailApp.sendEmail({
      to: emailTujuan,
      subject: '[Kue As-Syifa] Test Notifikasi Berhasil ✅',
      htmlBody: '<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px"><h2 style="color:#f59e0b">✅ Test Berhasil</h2><p>Halo,</p><p>Email ini dikirim dari sistem <strong>Kue As-Syifa POS</strong> untuk memverifikasi konfigurasi notifikasi email.</p><p>Jika Anda menerima email ini, artinya:</p><ul><li>✅ <code>CONFIG.NOTIF_EMAIL</code> sudah benar</li><li>✅ Scope <code>MailApp</code> sudah di-authorize</li><li>✅ Backend Apps Script berfungsi normal</li></ul><hr style="border:none;border-top:1px solid #eee"><p style="color:#888;font-size:12px">Dikirim: ' + new Date().toLocaleString('id-ID') + '<br>Sisa kuota email hari ini: ' + MailApp.getRemainingDailyQuota() + ' email</p></div>'
    });
    const quota = MailApp.getRemainingDailyQuota();
    console.log('✅ SUKSES! Email terkirim ke ' + emailTujuan);
    console.log('📊 Sisa kuota email hari ini: ' + quota);
    return { success: true, message: 'Email terkirim ke ' + emailTujuan + ' (sisa kuota: ' + quota + ')' };
  } catch (err) {
    console.error('❌ GAGAL kirim email:', err.message);
    console.error('Stack:', err.stack);
    return { success: false, message: 'Gagal: ' + err.message };
  }
}

function fixKatalogSheetStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Katalog');
  if (!sheet) return 'Sheet Katalog tidak ada.';
  const data = sheet.getDataRange().getValues();
  const h = data[0].map(x => String(x).trim());
  const log = [];
  if (h.indexOf('supplierId') === -1 && h.indexOf('supplier') !== -1) {
    const i = h.indexOf('supplier');
    sheet.getRange(1, i + 1).setValue('supplierId');
    h[i] = 'supplierId';
    log.push('✅ Rename kolom "supplier" → "supplierId"');
  }
  if (h.indexOf('aktif') === -1 && h.indexOf('stokDefault') !== -1) {
    const i = h.indexOf('stokDefault');
    sheet.getRange(1, i + 1).setValue('aktif');
    h[i] = 'aktif';
    log.push('✅ Rename kolom "stokDefault" → "aktif"');
  }
  if (h.indexOf('kategori') === -1) {
    const lastCol = h.length;
    sheet.getRange(1, lastCol + 1).setValue('kategori');
    h.push('kategori');
    log.push('✅ Tambah kolom "kategori"');
  }
  const supSheet = ss.getSheetByName('Suppliers');
  const supData = supSheet.getDataRange().getValues();
  const validIds = [];
  for (let i = 1; i < supData.length; i++) if (supData[i][0]) validIds.push(String(supData[i][0]));
  const defaultSupId = validIds[0] || '';
  log.push('');
  log.push('📋 Supplier valid: ' + validIds.join(', '));
  log.push('');
  const iSupId = h.indexOf('supplierId');
  const iNama = h.indexOf('nama');
  let fixedCount = 0;
  for (let i = 1; i < data.length; i++) {
    const val = String(data[i][iSupId] || '').trim();
    if (!val || validIds.indexOf(val) === -1) {
      if (defaultSupId) {
        sheet.getRange(i + 1, iSupId + 1).setValue(defaultSupId);
        log.push('  ⚠️ "' + (data[i][iNama] || '') + '": "' + val + '" → "' + defaultSupId + '"');
        fixedCount++;
      }
    }
  }
  if (fixedCount > 0) {
    log.push('');
    log.push('✅ Fix ' + fixedCount + ' supplier ID invalid → "' + defaultSupId + '"');
  } else {
    log.push('✅ Semua supplier ID valid.');
  }
  _clearSheetCache();
  const msg = '═══ PERBAIKAN SHEET KATALOG ═══\n\n' + log.join('\n') + '\n\n➡️  Deploy ulang & refresh browser.';
  Logger.log(msg);
  return msg;
}