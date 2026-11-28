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
has(backend, /getMyPayrollSummary: p => apiGetMyPayrollSummary\(p\.token, p\.bulan\)/, 'Employee income route must be registered');
has(backend, /function apiGetMyPayrollSummary\(token, bulan\)[\s\S]*?requireRole\(token, \['karyawan'\]\)[\s\S]*?String\(b\.userId\) === String\(sess\.id\)/, 'Employee income API must be scoped to the authenticated employee');
has(backend, /addColumnIfMissing\('Kas', 'userId', ''\)/, 'Cash ledger must support employee-linked expense entries');
has(backend, /Bonus antar harus berupa pengeluaran dan memiliki penerima karyawan/, 'Delivery bonus must require an employee and be an expense');
has(backend, /bonusAntarKas = getSheetData\('Kas'\)/, 'Payroll must include employee-linked delivery bonus expenses');
has(frontend, /Penerima bonus antar \(pilih jika kategori Bonus Antar\)/, 'Additional cash expense form must support a bonus recipient');
if (/id:'bonus-antar', label:'Bonus Antar'/.test(frontend)) throw new Error('Standalone delivery bonus menu must be removed');

has(frontend, /Pendapatan Saya/, 'Employee home must show monthly income summary');
has(frontend, /api\('getMyPayrollSummary'/, 'Employee home must load its own payroll summary');

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

// Accounting regression guards: supplier payment methods are metadata only.
 // Supplier payments must not be deducted again from employee handover or QRIS/transfer receipts.
has(backend, /const totalTitipanTunai = bayarTitipanHariIni\.filter\(b => String\(b\.metode \|\| 'Tunai'\) === 'Tunai'\)\.reduce/, 'Submit must total cash supplier payments linked to the settlement');
has(backend, /const uangDisetor = totalTunai;/, 'Setoran must preserve the actual cash amount entered by the employee');
has(backend, /!\['Tunai','QRIS','Transfer'\]\.includes\(metode\)/, 'Supplier payments must support Tunai, QRIS and Transfer');
has(backend, /if\(tunaiDiserahkan<0\)/, 'Admin edits must reject negative cash handovers');
has(backend, /const tunaiDiserahkan=nt-np/, 'Admin edits must not subtract supplier payment metadata from cash handover');
has(backend, /const uangDisetor = totalTunai;/, 'Employee cash handover must not deduct operating expenses a second time');
has(backend, /const keuntunganBersih = totalPenjualan - totalPembayaranSupplier - pengeluaranOperasional/, 'Main cash must receive net profit after supplier payments and operating expenses');
has(backend, /kategori:'Keuntungan Bersih'/, 'Approval must post net profit as a single cash inflow');
if (/kategori:'Pembayaran Titipan Supplier'/.test(backend)) throw new Error('Supplier payments must not create main-cash outflow entries');
has(backend, /totalPenjualan - totalPembayaranSupplier - pengeluaranOperasional/, 'Operating expenses must be deducted in net-profit calculation, not posted as a separate cash movement');
has(frontend, /data-f="metode"/, 'Supplier payment form must allow choosing the actual payment method');
has(frontend, /QRIS/, 'Frontend must display QRIS as a payment method');
has(frontend, /Tunai yang diserahkan karyawan/, 'Frontend must show net cash handed over by employee');
has(frontend, /Titipan dibayar Tunai \(informasi\)/, 'Supplier payment must be shown as informational, not a deduction');

has(backend, /\['id','status','totalTunai','totalQris','pengeluaran','lapakId'/, 'Approval preflight must require gross cash and operating expense fields');
if (/data-f="uangDisetor"/.test(frontend)) throw new Error('Admin edit form must not expose legacy net-deposit field when ledger uses gross cash and separate expenses');

// Carry-over visibility must match the backend's all-unlinked-payment calculation.
has(backend, /formatDate\(b\.tanggal\) === tgl \|\| !b\.setoranId/, 'Employee summary must include older unlinked supplier payments');
has(backend, /tanggal: formatDate\(b\.tanggal\)/, 'Supplier payment history must expose payment date');
has(frontend, /filter\(x => !x\.setoranId\)/, 'Employee summary must identify supplier payments not yet linked to a settlement');
has(frontend, /const tunaiDiserahkan = tunai;/, 'Cash handover preview must preserve the actual cash amount entered by the employee');
has(frontend, /Belum tertaut ke laporan setoran/, 'Unlinked supplier payments must be labeled as informational history, not a future deduction');

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
has(backend, /const paidSibling = draftKey && data\.some/, 'Employee adjustment must stop when a duplicate sibling invoice already has a payment');
has(backend, /Ajukan koreksi kepada admin agar pembayaran lama tetap diperhitungkan/, 'Duplicate paid invoice correction must be routed to admin');

has(frontend, /totalTitipanQris/, 'Employee settlement preview must separate supplier QRIS payments');
has(frontend, /totalTitipanTransfer/, 'Employee settlement preview must separate supplier transfer payments');
has(backend, /const qrisBersih = totalQris/, 'QRIS receipts are not reduced by supplier payment metadata');
has(backend, /const transferBersih = totalTransfer/, 'Transfer receipts are not reduced by supplier payment metadata');
has(frontend, /api\('getKaryawanDashboard'/, 'Employee reload should use the combined dashboard response');
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

has(backend, /const reconciled=originalUtang>0\?Math\.min\(currentUtang,Math\.max\(0,originalUtang-\(paidAmountById\[String\(data\[i\]\[iId\]\)\]\|\|0\)\)\):currentUtang/, 'Payment endpoint must reconcile allocated amounts before accepting another supplier payment');

// Legacy TESTING Kas sheets may not yet contain optional category/method columns.
// Supplier payment and setoran approval must require only columns needed to write a safe ledger row.
has(backend, /hasHeaders\(kasSheet, \['id','tanggal','keterangan','tipe','nominal','saldo'\]\)/, 'Supplier payment must support legacy Kas sheets without optional category column');
const supplierPayStart = backend.indexOf('function apiBayarSupplier(');
const supplierPayEnd = backend.indexOf('\nfunction ', supplierPayStart + 10);
const supplierPayCode = backend.slice(supplierPayStart, supplierPayEnd);
const approveStart = backend.indexOf('function apiApproveSetoran(');
const approveEnd = backend.indexOf('\nfunction ', approveStart + 10);
const approveCode = backend.slice(approveStart, approveEnd);
if (/hasHeaders\(kasSheet, \['id','tanggal','keterangan','tipe','kategori','nominal','saldo'\]\)/.test(supplierPayCode + approveCode)) throw new Error('Optional Kas category must not block supplier payment or setoran approval');
has(frontend, /Penerimaan belum diisi/, 'Employee rekap must clearly warn when sales exist but all payment channels are zero');
has(frontend, /Pengeluaran operasional \(sudah digunakan\)/, 'Employee rekap must display operating expenses separately');
has(frontend, /Kekurangan tunai/, 'Negative cash handover must be labeled as a shortfall, not an amount to hand over');

// Search coverage for both roles and supplier bill aggregation across lapaks.
has(frontend, /data-drop-search/, 'Employee drop form must search cake and supplier names');
has(frontend, /data-dist-search/, 'Admin stock drop must search cakes and suppliers');
has(frontend, /data-supplier-search/, 'Admin supplier list must support supplier search');
has(frontend, /data-bill-supplier-search/, 'Consolidated supplier bill list must be searchable');
has(backend, /lapakBreakdown/, 'Supplier invoice detail must consolidate same product across lapaks while retaining lapak breakdown');
has(backend, /function getKasbonOutstandingMap_/, 'Kasbon payments must be allocated against outstanding balances');
has(backend, /Pembayaran melebihi sisa kasbon/, 'Kasbon receipt must not exceed outstanding balance');
has(backend, /const kasbonMap = getKasbonOutstandingMap_/, 'Payroll deduction must use remaining kasbon after received payments');
has(frontend, /Terima Pembayaran Kasbon \(uang masuk\)/, 'Admin kasbon form must offer receiving employee repayments');


// Search/cache and money-ledger regressions.
has(frontend, /function setSearchRowVisible_\(row, visible\)/, 'Search rows must use one visibility helper');
has(frontend, /row\.style\.setProperty\('display', 'none', 'important'\)/, 'Search must hide flex/card rows even when component CSS overrides the hidden attribute');
has(frontend, /data-rekap-search/, 'Employee end-of-day recap must also search product and supplier names');
has(frontend, /data-rekap-row data-search=/, 'Employee recap rows must expose searchable product and supplier text');
has(frontend, /data-titipan-supplier-search/, 'Employee supplier bills must be searchable');
has(frontend, /sourceBreakdown/, 'Grouped supplier bills must retain per-date and per-lapak source detail');
has(backend, /const key=\[katalogId,harga,susulan\?'susulan':'titipan'\]\.join\('\|'\)/, 'Same supplier item and price must group across dates and lapaks');
has(backend, /const kasRow=\{id:kasId,tanggal:now,keterangan:keteranganKas,tipe:'Masuk'/, 'Receiving employee kasbon must create a cash ledger inflow');
has(backend, /beginWriteJournal\(\['Kasbon','Kas'\]\)/, 'Kasbon receipt and cash ledger entry must be saved atomically');
has(backend, /rollbackWriteJournal\(journal\)/, 'Failed kasbon receipt must roll back both sheets');
has(backend, /payload\.requestKey/, 'Kasbon submit must use an idempotency key to prevent duplicate receipts');
has(frontend, /data\.requestKey = 'KASBON-'/, 'Admin kasbon submission must send an idempotency key');
has(frontend, /api\('getKas', \{ token:S\.token, limit:50 \}\)/, 'Admin cash balance must refresh after a kasbon receipt');

// Asset version checks ensure existing browser/service-worker caches get the corrected UI.
const indexHtml = fs.readFileSync('index.html', 'utf8');
const testingHtml = fs.readFileSync('index.testing.html', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
has(indexHtml, /app\.js\?v=7\.7/, 'Main app must request the new frontend asset version');
has(testingHtml, /app\.js\?v=7\.6/, 'Testing page must request the new frontend asset version');
has(testingHtml, /<script src="app\.js\?v=7\.6" defer><\/script>/, 'Testing page executable script must use the same frontend asset version as its preload');
has(serviceWorker, /kueassyifa-v16/, 'Service worker cache must be invalidated for the new release');
has(serviceWorker, /app\.js\?v=7\.7/, 'Service worker static asset list must preload the new frontend version');

// Once an invoice is linked to a submitted setoran, employee adjustment must be locked in UI and API.
has(backend, /canAdjust: !paidIds\[id\] && !String\(k\.setoranId \|\| ''\)/, 'Submitted supplier invoices must render as locked for employees');
has(backend, /if\(row\.setoranId\) return \{success:false,message:'Laporan lapak sudah dikirim/, 'Backend must refuse post-submit employee quantity edits even if the client bypasses UI');
