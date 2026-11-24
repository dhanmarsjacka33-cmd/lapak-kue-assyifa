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
has(backend, /appendObjectsByHeaders\(pengSheet, pRows\)/, 'Expense rows must be written by header name');
has(backend, /appendObjectsByHeaders\(konsinyasiSheet, kRows\)/, 'Consignment rows must be written by header name');
has(backend, /Notifikasi setoran gagal, transaksi tetap tersimpan/, 'Submit notification failure must not mask a saved transaction');

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
