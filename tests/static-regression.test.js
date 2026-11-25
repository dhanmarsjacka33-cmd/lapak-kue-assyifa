const fs = require('node:fs');
const assert = require('node:assert/strict');

const backend = fs.readFileSync('code.gs', 'utf8');
const frontend = fs.readFileSync('app.js', 'utf8');
const config = fs.readFileSync('config.js', 'utf8');

function has(text, pattern, message) {
  assert.match(text, pattern, message);
}

has(backend, /function apiSaveRekapDraft\s*\(/, 'Draft preparation API must exist');
has(backend, /function apiSubmitRekap\s*\(/, 'Final rekap API must exist');
has(backend, /function apiKaryawanBayarSupplier\s*\(/, 'Supplier payment API must exist');
has(backend, /function apiGetTitipanKaryawan\s*\(/, 'Employee consignment summary API must exist');
has(backend, /const recentKas = kas\.slice\(-10\)\.reverse\(\)/, 'Dashboard must map recent cash transactions');
has(backend, /metode:k\.metode \|\|/, 'Dashboard recent cash transactions must expose payment method with legacy fallback');
has(backend, /DRAFT_REKAP\|/, 'Draft marker must be present in backend');
has(frontend, /prepare-rekap-draft/, 'Frontend must expose prepare-draft action');
has(frontend, /data-drop-search/, 'Frontend must include product search');
has(config, /API_URL\s*:/, 'Frontend API URL must be configurable');

// Transaction-safety regression guards for the fixes in this PR.
has(backend, /function beginWriteJournal\s*\(/, 'Write journal helper must exist');
has(backend, /function rollbackWriteJournal\s*\(/, 'Rollback helper must exist');
has(backend, /const journal = beginWriteJournal\(\['Konsinyasi'\]\)/, 'Draft writes must use rollback journal');
has(backend, /appendObjectsByHeaders\(pengSheet,\s*pRows\)/, 'Expense rows must be written by header name');
has(backend, /appendObjectsByHeaders\(konsinyasiSheet,\s*kRows\)/, 'Consignment rows must be written by header name');
has(backend, /Notifikasi setoran gagal, transaksi tetap tersimpan/, 'Submit notification failure must not mask a saved transaction');

has(backend, /seenItems\s*=\s*\{\}/, 'Draft must reject duplicate catalog IDs');
has(backend, /Number\.isFinite\(rawSisa\).*Math\.floor\(rawSisa\)!==rawSisa/, 'Draft must validate integer remaining quantities');
has(backend, /Ditemukan draft ganda untuk item/, 'Duplicate existing draft records must be detected');
has(backend, /const row=i\+1, changes=\{\}, journal=beginWriteJournal\(\['Setoran'\]\)/, 'Setoran edits must use rollback journal');
has(backend, /appendObjectsByHeaders\(sheet, \[\{id:'KS'/, 'Stock card entries must be written by header name');
has(backend, /Notifikasi persetujuan gagal, transaksi tetap disetujui/, 'Approval notification failure must not mask an approved transaction');


const requiredSheets = [
  'Konsinyasi',
  'BayarTitipanKaryawan',
  'Setoran',
  'SetoranDetail',
  'Distribusi',
  'Katalog',
  'Suppliers'
];
for (const sheet of requiredSheets) {
  assert.ok(backend.includes("name: '" + sheet + "'"), 'Missing database schema for sheet: ' + sheet);
}

has(backend, /const sampai = filter\.sampai \? new Date\(filter\.sampai\) : new Date\(\)/, 'Report end date must be passed once; buildLaporanForRange owns the inclusive end boundary');

console.log('PASS: syntax and static regression checks');

// Accounting regression guards: QRIS is received directly by Owner; supplier payments
// reduce the employee's cash handover and are posted separately from operating expenses.
has(backend, /const totalTitipan = bayarTitipanHariIni\.filter\(b => String\(b\.metode \|\| 'Tunai'\) === 'Tunai'\)\.reduce/, 'Submit must total cash supplier payments linked to the settlement');
has(backend, /if \(uangDisetor < 0\)/, 'Submit must reject cash outflows greater than cash sales');
has(backend, /metode !== 'Tunai'/, 'Supplier payments must use cash from the employee-held sales proceeds');
has(backend, /if\(tunaiDiserahkan<0\)/, 'Admin edits must reject negative cash handovers');
has(backend, /const uangDisetor = totalTunai - totalTitipan - totalPengeluaran/, 'Employee cash handover must deduct supplier payments and operating expenses');
has(backend, /kategori:'Pembayaran Titipan Supplier',nominal:totalTitipan/, 'Supplier payments must post as a distinct cash outflow');
has(backend, /kategori:'Operasional Lapak',nominal:pengeluaranOperasional/, 'Operating expenses must post as a separate cash outflow');
has(frontend, /Tunai — dari uang penjualan lapak/, 'Supplier payment form must clearly state cash-only settlement');
has(frontend, /QRIS/, 'Frontend must display QRIS as a payment method');
has(frontend, /Tunai yang diserahkan karyawan/, 'Frontend must show net cash handed over by employee');

has(backend, /\['id','status','totalTunai','totalQris','pengeluaran','lapakId'/, 'Approval preflight must require gross cash and operating expense fields');
if (/data-f="uangDisetor"/.test(frontend)) throw new Error('Admin edit form must not expose legacy net-deposit field when ledger uses gross cash and separate expenses');

// Carry-over visibility must match the backend's all-unlinked-payment calculation.
has(backend, /formatDate\(b\.tanggal\) === tgl \|\| !b\.setoranId/, 'Employee summary must include older unlinked supplier payments');
has(backend, /tanggal: formatDate\(b\.tanggal\)/, 'Supplier payment history must expose payment date');
has(frontend, /filter\(x => !x\.setoranId\)/, 'Cash handover preview must deduct only unlinked supplier payments');
has(frontend, /Belum masuk setoran — dipotong pada rekap berikutnya/, 'Carry-over payments must be identified in the employee UI');
