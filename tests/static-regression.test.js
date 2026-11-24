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

console.log('PASS: syntax and static regression checks');

// Accounting regression guards: supplier consignment payments are not operating expenses;
// approval posts gross cash/QRIS inflows and a separate operating-expense outflow.
has(backend, /Pembayaran titipan tetap tercatat di BayarTitipanKaryawan[\s\S]*bukan pengeluaran modal\/operasional lapak/, 'Supplier consignment payment must remain outside operating expenses');
has(backend, /totalTunai = Number\(data\[i\]\[iTunai\]\) \|\| 0/, 'Approval must post gross cash receipts, not net deposit');
has(backend, /tipe:'Keluar',kategori:'Operasional Lapak',nominal:pengeluaranOperasional/, 'Approval must post operating expenses as a separate cash outflow');
has(frontend, /Pembayaran titipan \(tidak mengurangi setoran\)/, 'Frontend must distinguish consignment payments from operating expenses');
