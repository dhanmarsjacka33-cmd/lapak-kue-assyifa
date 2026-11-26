const fs = require('node:fs');
const assert = require('node:assert/strict');

const backend = fs.readFileSync('code.gs', 'utf8');
const frontend = fs.readFileSync('app.js', 'utf8');
const config = fs.readFileSync('config.js', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');

function has(text, pattern, message) {
  assert.match(text, pattern, message);
}

has(backend, /function apiSaveRekapDraft\s*\(/, 'Draft preparation API must exist');
has(backend, /function apiSubmitRekap\s*\(/, 'Final rekap API must exist');
has(backend, /function apiKaryawanBayarSupplier\s*\(/, 'Supplier payment API must exist');
has(backend, /function apiGetTitipanKaryawan\s*\(/, 'Employee consignment summary API must exist');
has(backend, /const recentKas = kas\.slice\(-10\)\.reverse\(\)/, 'Dashboard must map recent cash transactions');
has(backend, /metode:k\.metode \|\|/, 'Dashboard recent cash transactions must expose payment method with legacy fallback');
has(backend, /match\(\/\\\\\[\(Tunai\|QRIS\|Transfer\)\\\\\]\\\\s\*\$\/i\)/, 'Dashboard legacy payment method parser must match bracketed methods');
has(backend, /DRAFT_REKAP\|/, 'Draft marker must be present in backend');
has(frontend, /prepare-rekap-draft/, 'Frontend must expose prepare-draft action');
has(frontend, /data-drop-search/, 'Frontend must include product search');
assert.ok(styles.includes('.list-item[hidden]{display:none!important}'), 'Filtered catalog rows must be hidden even when list-item uses display:flex');
// Catalog live-search regression guards.
has(frontend, /data-katalog-search/, 'Catalog must expose a product search input');
has(frontend, /data-katalog-row/, 'Catalog products must expose searchable rows');
has(frontend, /data-supplier-id=/, 'Catalog rows must expose supplier IDs for filtering');
has(frontend, /katalog-supplier-toggle/, 'Catalog must support selecting multiple suppliers');
const supplierChipSelector = "Array.from(document.querySelectorAll('[data-act=\"katalog-supplier-toggle\"]')).forEach";
assert.ok(frontend.indexOf(supplierChipSelector) >= 0 && frontend.lastIndexOf(supplierChipSelector) > frontend.indexOf(supplierChipSelector), 'Both supplier chip handlers must update all selected chips');
assert.ok(frontend.includes('function applyKatalogFilter()'), 'Catalog search and supplier filters must share one filter function');
assert.ok(frontend.includes("row.style.setProperty('display', 'none', 'important')"), 'Non-matching catalog rows must be hidden inline even when stale CSS is cached');
assert.ok(frontend.includes("Array.from(document.querySelectorAll('[data-katalog-row]'))"), 'Catalog search must query all product rows');
has(frontend, /data-katalog-count/, 'Catalog search must update visible result count');
has(frontend, /data-katalog-empty/, 'Catalog search must show an empty state when no products match');

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


const mapperStart = backend.indexOf('function mapSetoran(');
const mapperEnd = backend.indexOf('\n}', mapperStart);
assert.ok(mapperStart >= 0 && mapperEnd > mapperStart, 'Setoran mapper must exist');
assert.ok(!backend.slice(mapperStart, mapperEnd).includes("getSheetData('BayarTitipanKaryawan')"), 'Setoran mapper must not reread supplier payments for every row');
has(backend, /function buildTitipanTotalsBySetoran\s*\(/, 'Supplier payment totals must be aggregated once per setoran response');
has(backend, /function _clearSheetCache\(name\)[\s\S]*?delete __sheetCache\[name\]/, 'Sheet cache must support targeted invalidation');
const submitLockPos = backend.indexOf('function apiSubmitRekap(');
const submitRefreshPos = backend.indexOf("_clearSheetCache('BayarTitipanKaryawan')", submitLockPos);
const submitPaymentReadPos = backend.indexOf("bayarTitipanHariIni = getSheetData('BayarTitipanKaryawan')", submitRefreshPos);
assert.ok(submitLockPos >= 0 && submitRefreshPos > submitLockPos && submitPaymentReadPos > submitRefreshPos, 'Supplier payment cache must be invalidated after lock and before refreshed read');
has(backend, /pending\.map\(s => mapSetoran\(s, titipanTotals\)\)/, 'Admin dashboard must reuse the aggregated supplier payment totals');
has(backend, /getSheetData\('Setoran'\)\.map\(s => mapSetoran\(s, titipanTotals\)\)/, 'Setoran list must reuse the aggregated supplier payment totals');

console.log('PASS: syntax and static regression checks');

// Accounting regression guards: QRIS is received directly by Owner; supplier payments
// reduce the employee's cash handover and are posted separately from operating expenses.
has(backend, /const totalTitipanTunai = bayarTitipanHariIni\.filter\(b => String\(b\.metode \|\| 'Tunai'\) === 'Tunai'\)\.reduce/, 'Submit must total cash supplier payments linked to the settlement');
has(backend, /if \(uangDisetor < 0\)/, 'Submit must reject cash outflows greater than cash sales');
has(backend, /!\['Tunai','QRIS','Transfer'\]\.includes\(metode\)/, 'Supplier payments must support Tunai, QRIS and Transfer');
has(backend, /if\(tunaiDiserahkan<0\)/, 'Admin edits must reject negative cash handovers');
has(backend, /totalTunai - totalTitipanTunai - totalPengeluaran/, 'Employee cash handover must deduct only cash supplier payments and operating expenses');
has(backend, /const keuntunganBersih = totalPenjualan - totalPembayaranSupplier - pengeluaranOperasional/, 'Main cash must receive net profit after supplier payments and operating expenses');
has(backend, /kategori:'Keuntungan Bersih'/, 'Approval must post net profit as a single cash inflow');
if (/kategori:'Pembayaran Titipan Supplier'/.test(backend)) throw new Error('Supplier payments must not create main-cash outflow entries');
has(backend, /totalPenjualan - totalPembayaranSupplier - pengeluaranOperasional/, 'Operating expenses must be deducted in net-profit calculation, not posted as a separate cash movement');
has(frontend, /data-f="metode"/, 'Supplier payment form must allow choosing the actual payment method');
has(frontend, /QRIS/, 'Frontend must display QRIS as a payment method');
has(frontend, /Tunai yang diserahkan karyawan/, 'Frontend must show net cash handed over by employee');

has(backend, /\['id','status','totalTunai','totalQris','pengeluaran','lapakId'/, 'Approval preflight must require gross cash and operating expense fields');
if (/data-f="uangDisetor"/.test(frontend)) throw new Error('Admin edit form must not expose legacy net-deposit field when ledger uses gross cash and separate expenses');

// Carry-over visibility must match the backend's all-unlinked-payment calculation.
has(backend, /formatDate\(b\.tanggal\) === tgl \|\| !b\.setoranId/, 'Employee summary must include older unlinked supplier payments');
has(backend, /tanggal: formatDate\(b\.tanggal\)/, 'Supplier payment history must expose payment date');
has(frontend, /filter\(x => !x\.setoranId\)/, 'Cash handover preview must deduct only unlinked supplier payments');
has(frontend, /const tunaiDiserahkan = tunai - pengeluaran - totalTitipanTunai/, 'Cash handover preview must deduct only supplier payments made in cash');
has(frontend, /Belum masuk setoran — dipotong pada rekap berikutnya/, 'Carry-over payments must be identified in the employee UI');

has(backend, /const nominalBayar=Number\(payload\.nominalBayar\)/, 'Employee supplier payment must accept an editable partial payment amount');
has(backend, /JSON\.stringify\(allocations\.map\(x=>\(\{id:x\.id,amount:x\.amount\}\)\)\)/, 'Partial supplier payment must persist exact per-invoice allocations');
has(backend, /journalSetValue\(journal,ks,item\.row,iUtang\+1,item\.remaining\)/, 'Partial supplier payment must preserve remaining supplier debt');
has(backend, /current\+allocationMap\[itemId\]/, 'Cancelling a partial payment must restore the allocated debt amount');
has(frontend, /data-f="nominalBayar"/, 'Employee supplier payment form must allow editing payment amount');
has(frontend, /__PARTIAL_PAYMENT_REQUIRES_UPDATED_BACKEND__/, 'Legacy backend must safely reject partial payments rather than charge the full supplier debt');

has(frontend, /data-titipan-qty/, 'Supplier payment form must allow editing remaining cake quantity for each product');
has(frontend, /Sisa kue/, 'Supplier payment form must label editable quantity as remaining cakes');
has(frontend, /qtyDrop.*qtySisa|qtySisa.*qtyDrop/, 'Supplier payment form must calculate payable quantity from received minus remaining cakes');
has(frontend, /data-titipan-total/, 'Supplier payment form must show recalculated payable total from product quantities');
has(frontend, /adjustments/, 'Supplier payment request must submit per-product quantity adjustments');
has(backend, /payload\.adjustments/, 'Backend must validate supplier invoice quantity adjustments');
has(backend, /qtyDrop.*adjustmentMap\[id\]|adjustmentMap\[id\].*qtyDrop/, 'Backend must reject remaining quantities that exceed received quantity');
has(backend, /diSisa/, 'Backend must persist remaining cake quantities to SetoranDetail');
has(backend, /row\.qtyLaku\*row\.hargaTitip/, 'Backend must recalculate payable debt from adjusted sold quantity and supplier price');
has(backend, /paidIds\[id\]/, 'Backend must prevent changing quantities on invoices with previous payments');

has(frontend, /totalTitipanQris/, 'Employee settlement preview must separate supplier QRIS payments');
has(frontend, /totalTitipanTransfer/, 'Employee settlement preview must separate supplier transfer payments');
has(backend, /const qrisBersih = totalQris - totalTitipanQris/, 'Employee QRIS reconciliation remains separate from main-cash accounting');
has(backend, /const transferBersih = totalTransfer - totalTitipanTransfer/, 'Employee transfer reconciliation remains separate from main-cash accounting');
has(frontend, /const data = await api\('getKaryawanDashboard'/, 'Employee reload should use the combined dashboard response');
if (/api\('getTitipanKaryawan'/.test(frontend.slice(frontend.indexOf('async function reloadKaryawan'), frontend.indexOf('async function karyawanSaveDrop')))) throw new Error('Employee reload must not fetch titipan a second time');

has(frontend, /data-locked-total/, 'Live supplier invoice total must include locked rows after previous partial payments');
has(frontend, /let total = Number\(wrap\.dataset\.lockedTotal\) \|\| 0/, 'Editing supplier quantities must preserve locked outstanding balances in the live total');


// Supplier invoice reconciliation regressions: active payment allocations must
// reduce the displayed balance exactly once and fully paid invoices must disappear.
has(backend, /const paidAmountById = \{\}/, 'Employee supplier summary must aggregate active payments by invoice ID');
has(backend, /originalUtang - \(paidAmountById\[id\] \|\| 0\)/, 'Supplier invoice balance must reconcile against exact payment allocations');
has(backend, /Math\.min\(currentUtang, saldoTerhitung\)/, 'Reconciliation must avoid subtracting payments twice when Konsinyasi.utang is already a remaining balance');
has(backend, /if \(saldo <= 0\) return/, 'Fully paid invoices must not reappear in the pending supplier list');
has(backend, /remainingPayment = Math\.max\(0, Number\(b\.totalBayar\) \|\| 0\)/, 'Legacy payment records without per-invoice amounts must be reconciled conservatively');
