'use strict';
/* Kue As-Syifa POS v5.1 — Frontend */

const CFG = window.APP_CONFIG || {};
const API = CFG.API_URL;

// ============================================
//  STATE
// ============================================
const S = {
  user: null,
  token: localStorage.getItem('tk') || null,
  lapakAktif: JSON.parse(localStorage.getItem('lapakAktif') || 'null'),
  view: 'login',
  tab: 'home',
  submitting: false,
  lapak: [], suppliers: [], katalog: [], users: [], belanja: [], jadwal: [],
  dash: null, karyawan: null, kasbon: null, gaji: null, laporan: null,
  setoran: null, pesanan: null, settingGaji: null, rekapGaji: null, rekapPesanan: null,
  kartuStok: null, stokSaldo: null, retur: null, hargaTingkat: null,
  tutupBuku: null, notifikasi: null,
  // Fase 1
  absensiList: null, absensiFilter: {},
  bonusAntar: null, bonusFilter: {},
  settingPayroll: null, hariEfektif: null,
  payrollBulan: null, payrollData: null, payrollHistory: null,
  dashboardProfit: null, profitRange: 30,
  absensiHariIni: null,
  rekap: {},
  _setoranFilter: {},
  _distTanggal: null, _distLapakId: null, _distItems: {},
  _rekapGajiTipe: 'Bulanan', _rekapGajiDari: null, _rekapGajiSampai: null,
  _pesananDari: null, _pesananSampai: null
};

// ============================================
//  UTILS
// ============================================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const fmtRp = (n) => {
  const v = Number(n);
  if (!isFinite(v)) return 'Rp 0';
  return 'Rp ' + v.toLocaleString('id-ID');
};

const fmtDateID = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return '';
  return dt.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const esc = (s) => {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
};

const ico = (name, cls = 'ico') => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthISO = () => new Date().toISOString().slice(0, 7);
const monthStartISO = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10); };
const bulanLabel = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const names = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return (names[parseInt(m, 10) - 1] || '') + ' ' + y;
};

const CACHE = {
  get(k) {
    try {
      const raw = sessionStorage.getItem('c_' + k);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (Date.now() > o.t) { sessionStorage.removeItem('c_' + k); return null; }
      return o.v;
    } catch { return null; }
  },
  set(k, v, ttl = 60000) {
    try { sessionStorage.setItem('c_' + k, JSON.stringify({ t: Date.now() + ttl, v })); } catch {}
  },
  clearAll() {
    Object.keys(sessionStorage).filter(k => k.startsWith('c_')).forEach(k => sessionStorage.removeItem(k));
  }
};

// ============================================
//  API CLIENT
// ============================================
async function api(action, payload = {}) {
  if (!API || API.indexOf('PASTE_') !== -1) {
    throw new Error('API_URL belum diset di config.js');
  }
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload }),
    redirect: 'follow'
  });
  if (!res.ok) throw new Error('Network ' + res.status);
  const body = await res.json();
  if (!body.ok) {
    if (String(body.error).indexOf('UNAUTHORIZED') !== -1 || String(body.error).indexOf('FORBIDDEN') !== -1) sessionExpired();
    throw new Error(body.error || 'Unknown');
  }
  return body.data;
}

// ============================================
//  UI HELPERS
// ============================================
let loaderCount = 0;
function showLoader() { loaderCount++; const el = $('#loader'); if (el) el.classList.remove('hide'); }
function hideLoader() { loaderCount = Math.max(0, loaderCount - 1); if (loaderCount === 0) { const el = $('#loader'); if (el) el.classList.add('hide'); } }

function toast(msg, type = 'success') {
  const box = $('#toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.innerHTML = ico(type === 'success' ? 'check' : type === 'error' ? 'x' : 'inbox') + '<span></span>';
  el.querySelector('span').textContent = String(msg || '');
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 3200);
}

function modal({ title, body, actions = [], onMount }) {
  const root = $('#modals');
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <h3>${esc(title)}</h3>
        <button class="modal-close" data-close>${ico('x', 'ico-sm')}</button>
      </div>
      <div data-body>${body || ''}</div>
      <div class="modal-actions" data-actions></div>
    </div>`;
  const actionsBox = bg.querySelector('[data-actions]');
  actions.forEach(a => {
    const b = document.createElement('button');
    b.className = 'btn ' + (a.className || 'btn-ghost');
    b.textContent = a.label;
    b.onclick = () => a.onClick ? a.onClick(close, bg) : close();
    actionsBox.appendChild(b);
  });
  function close() { bg.remove(); }
  bg.querySelector('[data-close]').onclick = close;
  bg.addEventListener('click', e => { if (e.target === bg) close(); });
  root.appendChild(bg);
  if (onMount) onMount(bg, close);
  return { close, root: bg };
}

function confirmDlg(title, msg, okText = 'Ya') {
  return new Promise(resolve => modal({
    title, body: `<p class="text-sm text-gray">${esc(msg)}</p>`,
    actions: [
      { label: 'Batal', onClick: c => { c(); resolve(false); } },
      { label: okText, className: 'btn-danger', onClick: c => { c(); resolve(true); } }
    ]
  }));
}

function formModal({ title, fields, onSubmit, submitLabel = 'Simpan', submitClass = 'btn-primary' }) {
  const body = fields.map(f => {
    if (f.type === 'select') {
      return `<div class="field"><label>${esc(f.label)}</label>
        <select data-f="${f.key}" class="select" ${f.attrs || ''}>
          ${(f.options || []).map(o => `<option value="${esc(o.v)}" ${o.selected ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}
        </select></div>`;
    }
    if (f.type === 'textarea') {
      return `<div class="field"><label>${esc(f.label)}</label>
        <textarea data-f="${f.key}" class="textarea" ${f.attrs || ''}>${esc(f.value || '')}</textarea></div>`;
    }
    if (f.type === 'checkbox') {
      return `<label class="row text-sm mb-3"><input type="checkbox" data-f="${f.key}" ${f.checked ? 'checked' : ''}> ${esc(f.label)}</label>`;
    }
    return `<div class="field"><label>${esc(f.label)}</label>
      <input type="${f.type || 'text'}" data-f="${f.key}" class="input" value="${esc(f.value || '')}" ${f.attrs || ''} placeholder="${esc(f.placeholder || '')}"></div>`;
  }).join('');

  modal({
    title,
    body,
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: submitLabel, className: submitClass, onClick: async (c, w) => {
        const data = {};
        fields.forEach(f => {
          const el = w.querySelector(`[data-f="${f.key}"]`);
          if (!el) return;
          if (f.type === 'checkbox') data[f.key] = el.checked;
          else if (f.type === 'number') data[f.key] = parseInt(el.value, 10) || 0;
          else data[f.key] = el.value;
        });
        await onSubmit(data, c, w);
      } }
    ]
  });
}

// ============================================
//  RENDER ROUTER
// ============================================
function render() {
  const app = $('#app');
  if (!app) return;
  let html = '';
  if (S.view === 'login') html = vLogin();
  else if (S.view === 'karyawan') html = vKaryawan();
  else if (S.view === 'admin') html = vAdmin();
  app.innerHTML = html;
  if (S.view === 'karyawan' && S.karyawan && S.karyawan.absen && S.karyawan.absen.isOpen && S.karyawan.distribusi && S.karyawan.distribusi.length && !S.karyawan.sudahSubmit) {
    const list = $('[data-peng-list]');
    if (list && !list.children.length) addPengRow();
  }
  if (S.view === 'karyawan') startClock();
}

document.addEventListener('click', handleClick);
document.addEventListener('input', handleInput);
document.addEventListener('change', handleChange);

// Live clock untuk karyawan
let __clockTimer = null;
function startClock() {
  if (__clockTimer) clearInterval(__clockTimer);
  const el = $('[data-live-clock]');
  if (!el) return;
  const update = () => {
    const e = $('[data-live-clock]');
    if (!e) { clearInterval(__clockTimer); __clockTimer = null; return; }
    const d = new Date();
    e.textContent = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0');
  };
  update();
  __clockTimer = setInterval(update, 1000);
}

// ============================================
//  LOGIN VIEW
// ============================================
function vLogin() {
  return `
    <div class="login">
      <div class="login-logo">${ico('cookie', 'ico-lg')}</div>
      <h1>Kue As-Syifa</h1>
      <p class="sub">Sistem Manajemen POS &amp; ERP</p>
      <form class="login-form" data-form="login">
        <div class="field"><label>Username / Nama</label>
          <input class="input" name="username" autocomplete="username" autofocus>
        </div>
        <div class="field"><label>Password</label>
          <input class="input" type="password" name="password" autocomplete="current-password">
        </div>
        <button class="btn btn-primary btn-block" type="submit">Masuk</button>
      </form>
      <p class="text-center text-xs text-gray mt-3">v5.1 · Kue As-Syifa</p>
    </div>`;
}

// ============================================
//  KARYAWAN VIEW
// ============================================
function vKaryawan() {
  const d = S.karyawan;
  if (!d) return '<div class="page"><div class="empty">Memuat...</div></div>';
  const isOpen = d.absen && d.absen.isOpen;
  const ak = d.absensiKaryawan || S.absensiHariIni || { status: 'belum' };

  let body = '';

  // ===== Clock Card (Fase 1) =====
  const statusMap = { belum: 'Belum Absen', bekerja: 'Bekerja', selesai: 'Selesai' };
  const statusCls = { belum: 'status-belum', bekerja: 'status-bekerja', selesai: 'status-selesai' };
  body += `
    <div class="clock-card">
      <div class="clock-time" data-live-clock>--:--:--</div>
      <div class="clock-label">
        ${esc(fmtDateID(new Date()))} · 
        <span class="status-pill ${statusCls[ak.status] || 'status-belum'}">${statusMap[ak.status] || 'Belum Absen'}</span>
      </div>
      ${ak.jamMasuk ? `<div class="text-xs" style="opacity:.9;margin-bottom:8px">Masuk: ${esc(ak.jamMasuk)}${ak.jamKeluar ? ' · Keluar: ' + esc(ak.jamKeluar) : ''}</div>` : ''}
      <div class="clock-actions">
        <button class="btn" data-act="absen-masuk" ${ak.status !== 'belum' ? 'disabled' : ''}>
          ${ico('login','ico-sm')} Absen Masuk
        </button>
        <button class="btn" data-act="absen-keluar" ${ak.status !== 'bekerja' ? 'disabled' : ''}>
          ${ico('logout','ico-sm')} Absen Keluar
        </button>
      </div>
    </div>`;

  // Absensi Lapak
  body += `
    <div class="card">
      <div class="row-between mb-3">
        <span class="text-sm text-gray">Status Lapak</span>
        <strong class="${isOpen ? 'text-green' : 'text-red'}">${isOpen ? 'BUKA' : 'TUTUP'}</strong>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn btn-block ${isOpen ? 'btn-ghost' : 'btn-success'}" data-act="buka" ${isOpen ? 'disabled' : ''}>Buka Lapak</button>
        <button class="btn btn-block ${!isOpen ? 'btn-ghost' : 'btn-danger'}" data-act="tutup" ${!isOpen ? 'disabled' : ''}>Tutup Lapak</button>
      </div>
    </div>`;

  if (d.sudahSubmit) {
    body += `<div class="alert alert-success">${ico('check','ico')}<div><strong>Laporan sudah dikirim</strong><br><span class="text-xs">Menunggu persetujuan admin.</span></div></div>`;
    body += `<button class="btn btn-ghost btn-block mb-3" data-act="retur-karyawan">${ico('return','ico-sm')} Ajukan Retur</button>`;
  } else if (!d.distribusi || !d.distribusi.length) {
    body += renderDropForm(d);
  } else if (!isOpen) {
    body += `<div class="alert alert-warn">${ico('inbox','ico-sm')}<span>Buka lapak dulu untuk mulai rekap.</span></div>`;
    body += `<div class="card"><div class="row-between mb-3"><strong class="text-sm">Drop Stok Hari Ini</strong><button class="btn btn-ghost btn-sm" data-act="edit-drop">Edit</button></div>`;
    body += d.distribusi.map(it => `<div class="row-between" style="padding:4px 0;border-bottom:1px solid var(--gray-100)"><span class="text-sm">${esc(it.nama)}</span><strong>${it.qtyDrop} pcs</strong></div>`).join('');
    body += `</div>`;
  } else {
    body += renderRekapForm(d);
  }

  // Kasbon Saya
  const kb = (S.kasbon && S.kasbon.list) || [];
  body += `<div class="card">
    <div class="row-between mb-3">
      <strong class="text-sm">${ico('money','ico-sm')} Kasbon Saya</strong>
      <button class="btn btn-primary btn-sm" data-act="ajukan-kasbon">+ Ajukan</button>
    </div>
    ${kb.length === 0 ? '<p class="text-xs text-gray text-center" style="padding:8px 0">Belum ada kasbon.</p>' :
      kb.slice(0, 5).map(k => `
        <div class="row-between" style="padding:6px 0;border-bottom:1px solid var(--gray-100)">
          <div style="min-width:0;flex:1">
            <p class="text-sm">${esc(k.keterangan || k.tipe)}</p>
            <p class="text-xs text-gray">${esc(k.tanggal)}</p>
          </div>
          <div class="text-right" style="flex-shrink:0;margin-left:8px">
            <p class="text-sm font-semibold ${k.tipe === 'Kasbon' ? 'text-red' : 'text-green'}">${k.tipe === 'Kasbon' ? '-' : '+'}${fmtRp(k.nominal)}</p>
            <p class="text-xs ${k.status === 'Outstanding' ? 'text-amber' : k.status === 'Lunas' ? 'text-green' : 'text-gray'}">${esc(k.status)}</p>
          </div>
        </div>`).join('')}
  </div>`;

  return `
    <div class="page">
      <div class="topbar topbar-amber">
        <div class="topbar-title">
          <h2>${esc(S.user.name)}</h2>
          <p>${esc(d.lapakNama || '')} · ${esc(fmtDateID(new Date()))}</p>
        </div>
        <div class="row" style="gap:4px">
          <button class="icon-btn" data-act="ganti-lapak">${ico('store')}</button>
          <button class="icon-btn" data-act="logout">${ico('out')}</button>
        </div>
      </div>
      <div class="page-body">${body}</div>
    </div>`;
}

function renderDropForm(d) {
  const katalog = d.katalogFull || [];
  if (!katalog.length) return `<div class="card empty">${ico('box','ico')}<p>Katalog kosong.</p></div>`;
  return `
    <div class="card" style="border:1px solid var(--amber);">
      <div class="card-title">${ico('boxes')} Input Stok Diterima</div>
      <p class="text-xs text-gray mb-4">Masukkan jumlah kue yang Anda terima pagi ini.</p>
      ${katalog.map(k => `
        <div class="row-between" style="padding:8px 0;border-bottom:1px solid var(--gray-100)">
          <div style="min-width:0;flex:1;padding-right:8px">
            <p class="text-sm font-semibold">${esc(k.nama)}</p>
            <p class="text-xs text-gray">${esc(k.supplierNama)} · ${fmtRp(k.hargaJual)}</p>
          </div>
          <input type="number" min="0" inputmode="numeric" value="0" data-drop-item="${esc(k.id)}" class="input field-sm" style="width:70px;text-align:center">
        </div>`).join('')}
      <button class="btn btn-primary btn-block mt-3" data-act="save-drop">Simpan Stok Diterima</button>
    </div>`;
}

function renderRekapForm(d) {
  return `
    <div class="card">
      <div class="card-title">${ico('bar')} Rekap Akhir Hari</div>
      ${d.locked ? `<div class="alert alert-danger">${ico('lock','ico-sm')}<span>Input terkunci setelah jam ${d.cutoffHour}:00</span></div>` : ''}
      ${d.distribusi.map(it => `
        <div class="card" style="padding:12px;background:var(--gray-50);border:none;margin-bottom:8px">
          <div class="row-between mb-3">
            <div style="min-width:0;flex:1;padding-right:8px">
              <p class="text-sm font-semibold">${esc(it.nama)}</p>
              <p class="text-xs text-gray">${fmtRp(it.hargaJual)}/pcs · Drop: <strong>${it.qtyDrop}</strong></p>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <label class="text-xs text-gray">Sisa</label>
              <input type="number" min="0" max="${it.qtyDrop}" inputmode="numeric" value="${S.rekap[it.katalogId] || 0}" data-rekap-item="${esc(it.katalogId)}" data-max="${it.qtyDrop}" class="input field-sm" style="width:64px;text-align:center">
            </div>
          </div>
          <div class="row-between text-xs" style="border-top:1px solid var(--gray-200);padding-top:6px">
            <span class="text-gray">Laku: <strong data-laku="${esc(it.katalogId)}">${it.qtyDrop - (S.rekap[it.katalogId] || 0)}</strong></span>
            <span class="text-green font-bold" data-sub="${esc(it.katalogId)}">${fmtRp((it.qtyDrop - (S.rekap[it.katalogId] || 0)) * it.hargaJual)}</span>
          </div>
        </div>`).join('')}
      <div style="border-top:1px solid var(--gray-100);padding-top:12px;margin-top:8px">
        <p class="text-xs font-semibold mb-2">Pengeluaran Lapak (opsional)</p>
        <div data-peng-list></div>
        <button class="btn btn-ghost btn-sm mt-2" data-act="add-peng">+ Tambah pengeluaran</button>
      </div>
      <div style="border-top:1px solid var(--gray-100);padding-top:12px;margin-top:12px">
        <p class="text-xs font-semibold mb-2">Total Penerimaan</p>
        <div class="form-grid">
          <div class="field"><label>Tunai (Rp)</label><input type="number" name="tunai" min="0" inputmode="numeric" class="input field-sm"></div>
          <div class="field"><label>QRIS (Rp)</label><input type="number" name="qris" min="0" inputmode="numeric" class="input field-sm"></div>
        </div>
      </div>
      <div class="alert alert-info" data-summary>${summaryHTML()}</div>
      <button class="btn btn-primary btn-block ${d.locked ? 'hide' : ''}" data-act="submit-rekap">Kirim Laporan</button>
    </div>`;
}

function summaryHTML() {
  const d = S.karyawan || {};
  let total = 0;
  (d.distribusi || []).forEach(it => {
    total += (it.qtyDrop - (S.rekap[it.katalogId] || 0)) * it.hargaJual;
  });
  let pengeluaran = 0;
  $$('[data-peng-row]').forEach(r => {
    const el = r.querySelector('[data-peng-nom]');
    if (el) pengeluaran += parseInt(el.value, 10) || 0;
  });
  const tunaiEl = $('input[name="tunai"]'), qrisEl = $('input[name="qris"]');
  const tunai = tunaiEl ? (parseInt(tunaiEl.value, 10) || 0) : 0;
  const qris = qrisEl ? (parseInt(qrisEl.value, 10) || 0) : 0;
  const expected = total - pengeluaran;
  const selisih = total - (tunai + qris);
  return `
    <div style="flex:1">
      <div class="row-between text-xs"><span>Penjualan Sistem</span><strong>${fmtRp(total)}</strong></div>
      <div class="row-between text-xs text-red"><span>Pengeluaran</span><span>- ${fmtRp(pengeluaran)}</span></div>
      <div class="row-between text-xs text-green font-bold mt-2"><span>Harus Disetor</span><span>${fmtRp(Math.max(0, expected))}</span></div>
      <div class="divider"></div>
      <div class="row-between text-xs"><span>Tunai + QRIS</span><span>${fmtRp(tunai + qris)}</span></div>
      <div class="row-between text-xs font-bold ${Math.abs(selisih) < 1 ? 'text-green' : 'text-red'}"><span>Selisih</span><span>${fmtRp(selisih)}</span></div>
    </div>`;
}

function updateSummary() {
  const sum = $('[data-summary]');
  if (sum) sum.innerHTML = summaryHTML();
}

function addPengRow() {
  const list = $('[data-peng-list]');
  if (!list) return;
  const row = document.createElement('div');
  row.dataset.pengRow = '1';
  row.className = 'row mb-2';
  row.innerHTML = '<input type="text" data-peng-ket placeholder="Keterangan" class="input field-sm" style="flex:1">' +
    '<input type="number" inputmode="numeric" data-peng-nom placeholder="Rp" class="input field-sm" style="width:100px">' +
    '<button class="action-btn action-del" data-act="del-peng">' + ico('x','ico-sm') + '</button>';
  list.appendChild(row);
}

// ============================================
//  ADMIN VIEW
// ============================================
function vAdmin() {
  const tabs = [
    { id:'home',    label:'Home',    icon:'chart' },
    { id:'kas',     label:'Kas',     icon:'wallet' },
    { id:'setoran', label:'Setoran', icon:'file', badge: S.dash ? S.dash.pendingCount : 0 },
    { id:'laporan', label:'Laporan', icon:'bar' },
    { id:'more',    label:'Lainnya', icon:'menu' }
  ];

  let body = '';
  if (S.tab === 'home') body = tabHome();
  else if (S.tab === 'kas') body = tabKas();
  else if (S.tab === 'setoran') body = tabSetoran();
  else if (S.tab === 'laporan') body = tabLaporan();
  else if (S.tab === 'katalog') body = tabKatalog();
  else if (S.tab === 'suppliers') body = tabSuppliers();
  else if (S.tab === 'lapak') body = tabLapak();
  else if (S.tab === 'distribusi') body = tabDistribusi();
  else if (S.tab === 'belanja') body = tabBelanja();
  else if (S.tab === 'jadwal') body = tabJadwal();
  else if (S.tab === 'kasbon') body = tabKasbon();
  else if (S.tab === 'gaji') body = tabGajiRiwayat();
  else if (S.tab === 'setting-gaji') body = tabSettingGaji();
  else if (S.tab === 'rekap-gaji') body = tabRekapGaji();
  else if (S.tab === 'pesanan') body = tabPesanan();
  else if (S.tab === 'users') body = tabUsers();
  else if (S.tab === 'kartu-stok') body = tabKartuStok();
  else if (S.tab === 'retur') body = tabRetur();
  else if (S.tab === 'harga-tingkat') body = tabHargaTingkat();
  else if (S.tab === 'tutup-buku') body = tabTutupBuku();
  else if (S.tab === 'notifikasi') body = tabNotifikasi();
  else if (S.tab === 'profil') body = tabProfil();
  // Fase 1
  else if (S.tab === 'absensi') body = tabAbsensi();
  else if (S.tab === 'absensi-hari-ini') body = tabAbsensiHariIni();
  else if (S.tab === 'bonus-antar') body = tabBonusAntar();
  else if (S.tab === 'setting-payroll') body = tabSettingPayroll();
  else if (S.tab === 'payroll') body = tabPayroll();
  else if (S.tab === 'dashboard-profit') body = tabDashboardProfit();

  const unread = S.dash ? (S.dash.unreadNotif || 0) : 0;

  return `
    <div class="page">
      <div class="topbar topbar-dark">
        <div class="topbar-title">
          <h2>Admin Panel</h2>
          <p>${esc(S.user.name)}</p>
        </div>
        <div class="row" style="gap:4px">
          <button class="icon-btn icon-btn-relative" data-act="open-notif">
            ${ico('bell')}
            ${unread > 0 ? `<span class="badge-dot">${unread > 9 ? '9+' : unread}</span>` : ''}
          </button>
          <button class="icon-btn" data-act="logout">${ico('out')}</button>
        </div>
      </div>
      <div class="page-body">${body}</div>
      <div class="tabbar">
        ${tabs.map(t => `
          <button class="tab ${S.tab === t.id ? 'active' : ''}" data-act="tab" data-tab="${t.id}">
            ${ico(t.icon)}<span>${t.label}</span>
            ${t.badge > 0 ? `<span class="badge-dot">${t.badge > 9 ? '9+' : t.badge}</span>` : ''}
          </button>`).join('')}
      </div>
    </div>`;
}

// ============================================
//  TAB: HOME (Dashboard)
// ============================================
function tabHome() {
  const d = S.dash || { kasBesar: 0, pendingCount: 0, todayPenjualan: 0, todayTunai: 0, todayQris: 0, todaySetoranCount: 0, recentKas: [] };
  return `
    <div class="kpi-hero">
      <div class="kpi-hero-label">Saldo Kas Besar</div>
      <div class="kpi-hero-value">${fmtRp(d.kasBesar)}</div>
      <button class="btn btn-ghost btn-sm" data-act="refresh">${ico('sync','ico-sm')} Refresh</button>
    </div>

    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">Penjualan Hari Ini</div>
        <div class="kpi-value text-green">${fmtRp(d.todayPenjualan)}</div>
        <div class="kpi-sub">${d.todaySetoranCount} setoran</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Tunai / QRIS</div>
        <div class="kpi-value" style="font-size:13px">${fmtRp(d.todayTunai)}</div>
        <div class="kpi-value text-amber" style="font-size:13px">${fmtRp(d.todayQris)}</div>
      </div>
    </div>

    <button class="btn btn-ghost btn-block mb-3" data-act="tab" data-tab="dashboard-profit">
      ${ico('trending','ico-sm')} Lihat Grafik Profit
    </button>

    ${d.pendingCount > 0 ? `
      <div class="alert alert-warn">
        ${ico('inbox','ico')}
        <div style="flex:1">
          <strong>${d.pendingCount} setoran pending</strong>
          <br><button class="btn btn-primary btn-sm mt-2" data-act="tab" data-tab="setoran">Lihat</button>
        </div>
      </div>` : ''}

    <h3 class="card-title">${ico('wallet')} Kas Terbaru</h3>
    ${!d.recentKas || !d.recentKas.length ? '<div class="empty"><p>Belum ada transaksi</p></div>' :
      d.recentKas.map(k => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${esc(k.keterangan)}</div>
            <div class="list-item-sub">${esc(k.tanggal)}</div>
          </div>
          <div class="text-right">
            <div class="text-sm font-bold ${k.tipe === 'Masuk' ? 'text-green' : 'text-red'}">${k.tipe === 'Masuk' ? '+' : '-'} ${fmtRp(k.nominal)}</div>
            <div class="text-xs text-gray">${fmtRp(k.saldo)}</div>
          </div>
        </div>`).join('')}`;
}

// ============================================
//  TAB: KAS
// ============================================
function tabKas() {
  const d = S.dash || { kasBesar: 0, recentKas: [] };
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('wallet')} Buku Kas</h3>
      <button class="btn btn-primary btn-sm" data-act="add-kas">+ Transaksi</button>
    </div>
    <div class="kpi-hero"><div class="kpi-hero-label">Saldo Saat Ini</div><div class="kpi-hero-value">${fmtRp(d.kasBesar)}</div></div>
    ${!d.recentKas || !d.recentKas.length ? '<div class="empty"><p>Belum ada transaksi</p></div>' :
      d.recentKas.map(k => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${esc(k.keterangan)}</div>
            <div class="list-item-sub">${esc(k.tanggal)}</div>
          </div>
          <div class="text-right">
            <div class="text-sm font-bold ${k.tipe === 'Masuk' ? 'text-green' : 'text-red'}">${k.tipe === 'Masuk' ? '+' : '-'} ${fmtRp(k.nominal)}</div>
            <div class="text-xs text-gray">${fmtRp(k.saldo)}</div>
          </div>
        </div>`).join('')}`;
}

// ============================================
//  TAB: SETORAN
// ============================================
function tabSetoran() {
  const f = S._setoranFilter || {};
  const list = S.setoran || [];
  const pending = list.filter(s => s.status === 'pending');
  const done = list.filter(s => s.status !== 'pending').slice(0, 50);

  let html = `<h3 class="card-title">${ico('file')} Setoran</h3>
    <div class="card">
      <div class="form-grid">
        <div class="field"><label>Dari</label><input type="date" data-filter-dari value="${f.dari || ''}" class="input field-sm"></div>
        <div class="field"><label>Sampai</label><input type="date" data-filter-sampai value="${f.sampai || ''}" class="input field-sm"></div>
      </div>
      <div class="field"><label>Lapak</label>
        <select data-filter-lapak class="select field-sm">
          <option value="">Semua Lapak</option>
          ${S.lapak.map(l => `<option value="${esc(l.id)}" ${f.lapakId === l.id ? 'selected' : ''}>${esc(l.nama)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Status</label>
        <select data-filter-status class="select field-sm">
          <option value="">Semua Status</option>
          <option value="pending" ${f.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="approved" ${f.status === 'approved' ? 'selected' : ''}>Approved</option>
          <option value="rejected" ${f.status === 'rejected' ? 'selected' : ''}>Rejected</option>
        </select>
      </div>
      <button class="btn btn-primary btn-block btn-sm" data-act="apply-setoran-filter">Terapkan Filter</button>
    </div>`;

  html += `<h3 class="card-title">${ico('inbox')} Pending (${pending.length})</h3>`;
  if (!pending.length) html += '<div class="empty">' + ico('inbox') + '<p>Tidak ada setoran pending</p></div>';
  else html += pending.map(s => {
    const status = s.selisih === 0 ? 'Match' : s.selisih > 0 ? 'Shortage' : 'Overage';
    const cls = s.selisih === 0 ? 'badge-success' : s.selisih > 0 ? 'badge-danger' : 'badge-blue';
    return `
      <div class="card" style="border:1px solid var(--amber-bg)">
        <div class="row-between mb-3">
          <div><strong>${esc(s.lapakId)}</strong><div class="text-xs text-gray">${esc(s.tanggal)}</div></div>
          <span class="badge ${cls}">${status}</span>
        </div>
        <div style="background:var(--gray-50);padding:10px;border-radius:8px;font-size:12px">
          <div class="row-between"><span class="text-gray">Penjualan</span><strong>${fmtRp(s.totalSistem)}</strong></div>
          <div class="row-between text-gray"><span>Tunai</span><span>${fmtRp(s.totalTunai)}</span></div>
          <div class="row-between text-gray"><span>QRIS</span><span>${fmtRp(s.totalQris)}</span></div>
          <div class="row-between text-red"><span>Pengeluaran</span><span>- ${fmtRp(s.pengeluaran)}</span></div>
          <div class="row-between text-green font-bold" style="border-top:1px solid var(--gray-200);padding-top:6px;margin-top:6px"><span>Setoran</span><span>${fmtRp(s.expectedSetoran)}</span></div>
        </div>
        <div class="row mt-3" style="gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" data-act="detail-setoran" data-id="${esc(s.id)}">${ico('eye','ico-sm')}</button>
          <button class="btn btn-ghost btn-sm" data-act="edit-setoran" data-id="${esc(s.id)}">${ico('edit','ico-sm')}</button>
          <button class="btn btn-ghost btn-sm" data-act="cetak-struk" data-id="${esc(s.id)}">${ico('print','ico-sm')}</button>
          <button class="btn btn-danger btn-sm" style="flex:1" data-act="reject" data-id="${esc(s.id)}">Tolak</button>
          <button class="btn btn-success btn-sm" style="flex:1" data-act="approve" data-id="${esc(s.id)}">Terima</button>
        </div>
      </div>`;
  }).join('');

  html += `<h3 class="card-title mt-3">${ico('file')} Riwayat (${done.length})</h3>`;
  if (!done.length) html += '<div class="empty"><p>Belum ada riwayat</p></div>';
  else html += done.map(s => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">${esc(s.lapakId)} · ${esc(s.tanggal)}</div>
        <div class="list-item-sub">${fmtRp(s.totalSistem)}${s.locked ? ' · 🔒' : ''}</div>
      </div>
      <span class="badge ${s.status === 'approved' ? 'badge-success' : 'badge-danger'}">${esc(s.status)}</span>
    </div>`).join('');
  return html;
}

// ============================================
//  TAB: KATALOG
// ============================================
function tabKatalog() {
  const isAdmin = S.user.role === 'admin';
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('box')} Katalog (${S.katalog.length})</h3>
      <div class="row" style="gap:4px">
        <button class="btn btn-ghost btn-sm" data-act="tab" data-tab="harga-tingkat">${ico('tag','ico-sm')} Harga</button>
        <button class="btn btn-primary btn-sm" data-act="add-katalog">+ Tambah</button>
      </div>
    </div>
    ${!S.katalog.length ? '<div class="empty"><p>Belum ada item</p></div>' :
      S.katalog.map(k => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${esc(k.nama)}</div>
            <div class="list-item-sub">${esc(k.supplierNama)} · ${esc(k.kategori || '-')}</div>
            <div class="text-sm mt-2">
              <strong class="text-green">${fmtRp(k.hargaJual)}</strong>
              ${isAdmin ? ` <span class="text-xs text-gray">· Beli ${fmtRp(k.hargaBeli)} · Margin ${fmtRp(k.margin)}</span>` : ''}
            </div>
          </div>
          <div class="list-item-actions">
            <button class="action-btn action-edit" data-act="edit-katalog" data-id="${esc(k.id)}">${ico('edit','ico-sm')}</button>
            <button class="action-btn action-del" data-act="del-katalog" data-id="${esc(k.id)}">${ico('trash','ico-sm')}</button>
          </div>
        </div>`).join('')}`;
}

// ============================================
//  TAB: SUPPLIERS
// ============================================
function tabSuppliers() {
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('truck')} Suppliers</h3>
      <button class="btn btn-primary btn-sm" data-act="add-supplier">+ Tambah</button>
    </div>
    ${!S.suppliers.length ? '<div class="empty"><p>Belum ada supplier</p></div>' :
      S.suppliers.map(s => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${esc(s.nama)}</div>
            <div class="list-item-sub">${esc(s.kontak || '-')}</div>
            ${s.jadwalPesan ? `<div class="text-xs text-amber mt-2">${esc(s.jadwalPesan)}</div>` : ''}
          </div>
          <div class="list-item-actions">
            <button class="action-btn action-edit" data-act="edit-supplier" data-id="${esc(s.id)}">${ico('edit','ico-sm')}</button>
            <button class="action-btn action-del" data-act="del-supplier" data-id="${esc(s.id)}">${ico('trash','ico-sm')}</button>
          </div>
        </div>`).join('')}`;
}

// ============================================
//  TAB: LAPAK
// ============================================
function tabLapak() {
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('store')} Lapak</h3>
      <button class="btn btn-primary btn-sm" data-act="add-lapak">+ Tambah</button>
    </div>
    ${!S.lapak.length ? '<div class="empty"><p>Belum ada lapak</p></div>' :
      S.lapak.map(l => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${esc(l.nama)}</div>
            <div class="list-item-sub">${esc(l.alamat || '-')}${l.aktif ? '' : ' · NONAKTIF'}</div>
          </div>
          <div class="list-item-actions">
            <button class="action-btn action-edit" data-act="edit-lapak" data-id="${esc(l.id)}">${ico('edit','ico-sm')}</button>
            <button class="action-btn action-del" data-act="del-lapak" data-id="${esc(l.id)}">${ico('trash','ico-sm')}</button>
          </div>
        </div>`).join('')}`;
}

// ============================================
//  TAB: DISTRIBUSI
// ============================================
function tabDistribusi() {
  const today = todayISO();
  const tanggal = S._distTanggal || today;
  const lapakId = S._distLapakId || (S.lapak[0] ? S.lapak[0].id : '');
  const items = S._distItems || {};
  return `
    <h3 class="card-title">${ico('boxes')} Drop Stok ke Lapak</h3>
    <div class="card">
      <div class="field"><label>Tanggal</label><input type="date" data-dist-tgl value="${tanggal}" class="input field-sm"></div>
      <div class="field"><label>Lapak</label>
        <select data-dist-lapak class="select field-sm">
          ${S.lapak.map(l => `<option value="${esc(l.id)}" ${l.id === lapakId ? 'selected' : ''}>${esc(l.nama)}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-ghost btn-block mt-2" data-act="load-distribusi">Muat Distribusi</button>
    </div>
    <div class="card">
      ${!S.katalog.length ? '<p class="text-xs text-gray">Katalog kosong.</p>' :
        S.katalog.map(k => `
          <div class="row-between" style="padding:8px 0;border-bottom:1px solid var(--gray-100)">
            <div style="min-width:0;flex:1;padding-right:8px">
              <p class="text-sm font-semibold">${esc(k.nama)}</p>
              <p class="text-xs text-gray">${esc(k.supplierNama)} · ${fmtRp(k.hargaJual)}</p>
            </div>
            <input type="number" min="0" inputmode="numeric" value="${items[k.id] || 0}" data-dist-item="${esc(k.id)}" class="input field-sm" style="width:70px;text-align:center">
          </div>`).join('')}
    </div>
    <button class="btn btn-primary btn-block mt-3" data-act="save-distribusi">Simpan Drop</button>`;
}

// ============================================
//  TAB: BELANJA
// ============================================
function tabBelanja() {
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('cart')} Daftar Belanja</h3>
      <button class="btn btn-primary btn-sm" data-act="add-belanja">+ Tambah</button>
    </div>
    ${!S.belanja.length ? '<div class="empty"><p>Belum ada item</p></div>' :
      S.belanja.map(b => `
        <div class="list-item">
          <input type="checkbox" data-act="check-belanja" data-id="${esc(b.id)}" ${b.checked ? 'checked' : ''}>
          <div class="list-item-main">
            <div class="list-item-title ${b.checked ? 'strike' : ''}">${esc(b.item)}</div>
            <div class="list-item-sub">${b.qty}x · ${fmtRp(b.hargaAktual || b.estimasiHarga)}${b.checked && b.kasId ? ' · ✓ Kas' : ''}</div>
          </div>
          <div class="list-item-actions">
            <button class="action-btn action-edit" data-act="edit-belanja" data-id="${esc(b.id)}">${ico('edit','ico-sm')}</button>
            <button class="action-btn action-del" data-act="del-belanja" data-id="${esc(b.id)}">${ico('trash','ico-sm')}</button>
          </div>
        </div>`).join('')}`;
}

// ============================================
//  TAB: JADWAL
// ============================================
function tabJadwal() {
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('cal')} Jadwal</h3>
      <button class="btn btn-primary btn-sm" data-act="add-jadwal">+ Tambah</button>
    </div>
    ${!S.jadwal.length ? '<div class="empty"><p>Belum ada jadwal</p></div>' :
      S.jadwal.map(j => `
        <div class="list-item">
          <input type="checkbox" data-act="toggle-jadwal" data-id="${esc(j.id)}" ${j.done ? 'checked' : ''}>
          <div class="list-item-main">
            <div class="list-item-title ${j.done ? 'strike' : ''}">${esc(j.supplierNama)}</div>
            <div class="list-item-sub">${esc(j.tanggal)} · ${esc(j.tipe)}</div>
            ${j.keterangan ? `<div class="text-xs text-gray mt-2">${esc(j.keterangan)}</div>` : ''}
          </div>
          <div class="list-item-actions">
            <button class="action-btn action-edit" data-act="edit-jadwal" data-id="${esc(j.id)}">${ico('edit','ico-sm')}</button>
            <button class="action-btn action-del" data-act="del-jadwal" data-id="${esc(j.id)}">${ico('trash','ico-sm')}</button>
          </div>
        </div>`).join('')}`;
}

// ============================================
//  TAB: KASBON
// ============================================
function tabKasbon() {
  const data = S.kasbon || { list: [], summary: [] };
  const outstanding = (data.summary || []).filter(s => s.outstanding > 0);
  let html = `<div class="row-between mb-3"><h3 class="card-title" style="margin:0">${ico('money')} Kasbon</h3><button class="btn btn-primary btn-sm" data-act="add-kasbon">+ Tambah</button></div>`;
  if (outstanding.length) {
    html += `<div class="card"><div class="card-title">Outstanding</div>` +
      outstanding.map(s => `<div class="row-between text-sm" style="padding:4px 0;border-bottom:1px solid var(--gray-100)"><span>${esc(s.userName)}</span><strong class="text-red">${fmtRp(s.outstanding)}</strong></div>`).join('') + `</div>`;
  }
  html += !data.list.length ? '<div class="empty"><p>Belum ada kasbon</p></div>' :
    data.list.map(k => `
      <div class="list-item">
        <div class="list-item-main">
          <div class="list-item-title">${esc(k.userName)}</div>
          <div class="list-item-sub">${esc(k.tanggal)} · ${esc(k.tipe)}</div>
          ${k.keterangan ? `<div class="text-xs text-gray mt-2">${esc(k.keterangan)}</div>` : ''}
          <span class="badge ${k.status === 'Outstanding' ? 'badge-warn' : k.status === 'Lunas' ? 'badge-success' : 'badge-gray'} mt-2">${esc(k.status)}</span>
        </div>
        <div class="text-right">
          <div class="text-sm font-bold ${k.tipe === 'Kasbon' ? 'text-red' : 'text-green'}">${k.tipe === 'Kasbon' ? '-' : '+'}${fmtRp(k.nominal)}</div>
          <div class="list-item-actions mt-2">
            ${k.status === 'Outstanding' && k.tipe === 'Kasbon' ? `<button class="action-btn action-del" data-act="reject-kasbon" data-id="${esc(k.id)}">${ico('x','ico-sm')}</button>` : ''}
            <button class="action-btn action-del" data-act="del-kasbon" data-id="${esc(k.id)}">${ico('trash','ico-sm')}</button>
          </div>
        </div>
      </div>`).join('');
  return html;
}

// ============================================
//  TAB: GAJI LAMA (Riwayat Gaji)
// ============================================
function tabGajiRiwayat() {
  const data = S.gaji || [];
  let html = `<h3 class="card-title">${ico('money')} Riwayat Gaji (Single Bayar)</h3>
    <p class="text-xs text-gray mb-3">Untuk payroll bulanan, gunakan menu <strong>Rekap Payroll</strong>.</p>`;
  if (!data.length) html += '<div class="empty"><p>Belum ada riwayat</p></div>';
  else html += data.map(g => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">${esc(g.userName)}</div>
        <div class="list-item-sub">Periode: ${esc(g.periode)}</div>
        <div class="text-xs text-gray mt-2">Pokok: ${fmtRp(g.gajiPokok)} · Tunjangan: ${fmtRp(g.tunjangan)} · Potongan: <span class="text-red">${fmtRp(g.potonganKasbon)}</span></div>
      </div>
      <div class="text-right"><div class="text-sm font-bold text-green">${fmtRp(g.gajiBersih)}</div></div>
    </div>`).join('');
  return html;
}

function tabSettingGaji() {
  const list = S.settingGaji || [];
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('money')} Setting Gaji Lama</h3>
      <button class="btn btn-primary btn-sm" data-act="add-setting-gaji">+ Tambah</button>
    </div>
    <p class="text-xs text-gray mb-3">Modul lama. Untuk sistem payroll baru, pakai <strong>Setting Payroll</strong>.</p>
    ${!list.length ? '<div class="empty"><p>Belum ada setting</p></div>' :
      list.map(g => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${esc(g.userName)}</div>
            <div class="list-item-sub">${esc(g.tipe)} · ${fmtRp(g.nominal)}</div>
          </div>
          <div class="list-item-actions">
            <button class="action-btn action-edit" data-act="edit-setting-gaji" data-id="${esc(g.id)}">${ico('edit','ico-sm')}</button>
          </div>
        </div>`).join('')}`;
}

function tabRekapGaji() {
  const L = S.rekapGaji;
  if (!L) return '<div class="empty">Memuat...</div>';
  return `
    <h3 class="card-title">${ico('money')} Rekap Gaji Lama</h3>
    <div class="grid-3 mb-3">
      <div class="kpi"><div class="kpi-label">Karyawan</div><div class="kpi-value">${L.list.length}</div></div>
      <div class="kpi"><div class="kpi-label">Gaji Pokok</div><div class="kpi-value" style="font-size:12px">${fmtRp(L.totals.gajiPokok)}</div></div>
      <div class="kpi"><div class="kpi-label">Kasbon</div><div class="kpi-value text-red" style="font-size:12px">${fmtRp(L.totals.potonganKasbon)}</div></div>
    </div>`;
}

// ============================================
//  TAB: PESANAN
// ============================================
function tabPesanan() {
  const list = S.pesanan || [];
  const statusCls = { Draft:'badge-gray', Ordered:'badge-blue', Received:'badge-success', Cancelled:'badge-danger' };
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('cart')} Pesanan</h3>
      <button class="btn btn-primary btn-sm" data-act="add-pesanan">+ Tambah</button>
    </div>
    ${list.slice(0, 30).map(p => `
      <div class="list-item">
        <div class="list-item-main">
          <div class="list-item-title">${esc(p.item)} <span class="badge ${statusCls[p.status] || 'badge-gray'}">${esc(p.status)}</span></div>
          <div class="list-item-sub">${esc(p.supplierNama)} · ${esc(p.tanggal)}</div>
          <div class="text-sm mt-2">${p.qty} × ${fmtRp(p.hargaSatuan)} = <strong>${fmtRp(p.subtotal)}</strong></div>
        </div>
        <div class="list-item-actions">
          <button class="action-btn action-edit" data-act="edit-pesanan" data-id="${esc(p.id)}">${ico('edit','ico-sm')}</button>
          <button class="action-btn action-del" data-act="del-pesanan" data-id="${esc(p.id)}">${ico('trash','ico-sm')}</button>
        </div>
      </div>`).join('')}
    ${!list.length ? '<div class="empty"><p>Belum ada pesanan</p></div>' : ''}`;
}

// ============================================
//  TAB: LAPORAN
// ============================================
function tabLaporan() {
  const L = S.laporan;
  if (!L) return '<div class="empty">Memuat laporan...</div>';
  const maxQty = L.topItems.length ? Math.max(...L.topItems.map(i => i.qtyLaku)) : 1;
  return `
    <h3 class="card-title">${ico('bar')} Laporan & Analitik</h3>
    <div class="card">
      <div class="form-grid">
        <div class="field"><label>Dari</label><input type="date" data-lap-dari value="${L.periode.dari}" class="input field-sm"></div>
        <div class="field"><label>Sampai</label><input type="date" data-lap-sampai value="${L.periode.sampai}" class="input field-sm"></div>
      </div>
      <button class="btn btn-primary btn-block btn-sm" data-act="load-laporan">Terapkan Filter</button>
    </div>
    <div class="grid-3 mb-3">
      <div class="kpi"><div class="kpi-label">Omzet</div><div class="kpi-value text-green" style="font-size:13px">${fmtRp(L.ringkasan.totalOmzet)}</div></div>
      <div class="kpi"><div class="kpi-label">Profit</div><div class="kpi-value text-blue" style="font-size:13px">${fmtRp(L.ringkasan.totalProfit)}</div></div>
      <div class="kpi"><div class="kpi-label">Qty</div><div class="kpi-value text-amber">${L.ringkasan.totalQty}</div></div>
    </div>
    <div class="card">
      <div class="card-title">Top 10 Item Terlaris</div>
      ${!L.topItems.length ? '<p class="text-xs text-gray">Belum ada data.</p>' :
        `<div class="bar-list">${L.topItems.map((it, i) => `
          <div class="bar-row">
            <div class="bar-meta"><span>${i + 1}. ${esc(it.nama)}</span><strong>${it.qtyLaku} pcs</strong></div>
            <div class="bar-track"><div class="bar-fill" style="width:${(it.qtyLaku / maxQty * 100).toFixed(1)}%"></div></div>
          </div>`).join('')}</div>`}
    </div>
    <div class="card">
      <div class="card-title">Performa Supplier</div>
      ${!L.perSupplier.length ? '<p class="text-xs text-gray">Belum ada data.</p>' :
        L.perSupplier.map(s => `
          <div style="padding:8px 0;border-bottom:1px solid var(--gray-100)">
            <div class="row-between text-sm mb-2"><strong>${esc(s.nama)}</strong><span class="text-gray">${s.margin.toFixed(1)}% margin</span></div>
            <div class="row-between text-xs text-gray"><span>${s.qtyLaku} pcs · ${s.itemCount} item</span><span class="text-green font-semibold">${fmtRp(s.omzet)}</span></div>
          </div>`).join('')}
    </div>
    <div class="card">
      <div class="card-title">Performa Lapak</div>
      ${!L.perLapak.length ? '<p class="text-xs text-gray">Belum ada data.</p>' :
        L.perLapak.map(l => `
          <div style="padding:8px 0;border-bottom:1px solid var(--gray-100)">
            <div class="row-between text-sm mb-2"><strong>${esc(l.nama)}</strong><span class="text-gray">${l.margin.toFixed(1)}%</span></div>
            <div class="row-between text-xs text-gray"><span>${l.qtyLaku} pcs · ${l.setoranCount} setoran</span><span class="text-green font-semibold">${fmtRp(l.omzet)}</span></div>
          </div>`).join('')}
    </div>
    <button class="btn btn-success btn-block" data-act="export-csv">${ico('csv','ico-sm')} Export CSV</button>`;
}

// ============================================
//  TAB: USERS
// ============================================
function tabUsers() {
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('users')} Users</h3>
      <button class="btn btn-primary btn-sm" data-act="add-user">+ Tambah</button>
    </div>
    ${!S.users.length ? '<div class="empty"><p>Belum ada user</p></div>' :
      S.users.map(u => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${esc(u.name)}</div>
            <div class="list-item-sub">@${esc(u.username)} · ${esc(u.role)}${u.lapakNama ? ' · ' + esc(u.lapakNama) : ''}</div>
            ${u.lapakIds && u.lapakIds !== u.lapakId ? `<div class="text-xs text-gray mt-1">Akses: ${esc(u.lapakIds)}</div>` : ''}
            ${u.mustChangePassword ? '<span class="badge badge-warn mt-1">Perlu ganti pwd</span>' : ''}
          </div>
          <div class="list-item-actions">
            <button class="action-btn action-info" data-act="reset-user-pwd" data-id="${esc(u.id)}" title="Reset Password">${ico('key','ico-sm')}</button>
            <button class="action-btn action-edit" data-act="edit-user" data-id="${esc(u.id)}">${ico('edit','ico-sm')}</button>
            <button class="action-btn action-del" data-act="del-user" data-id="${esc(u.id)}">${ico('trash','ico-sm')}</button>
          </div>
        </div>`).join('')}`;
}

// ============================================
//  TAB: KARTU STOK
// ============================================
function tabKartuStok() {
  const saldo = S.stokSaldo || [];
  const list = S.kartuStok || [];
  let html = `<div class="row-between mb-3"><h3 class="card-title" style="margin:0">${ico('boxes')} Stok Real-Time</h3>
    <button class="btn btn-ghost btn-sm" data-act="refresh-stok">${ico('refresh','ico-sm')}</button></div>`;

  html += `<div class="card"><div class="card-title">Saldo per Item</div>`;
  if (!saldo.length) html += '<p class="text-xs text-gray">Belum ada pergerakan stok.</p>';
  else html += saldo.map(s => `
    <div class="row-between text-sm" style="padding:6px 0;border-bottom:1px solid var(--gray-100)">
      <div style="min-width:0;flex:1"><strong>${esc(s.nama)}</strong><div class="text-xs text-gray">In ${s.masuk} · Out ${s.keluar}</div></div>
      <strong class="${s.saldo < 10 ? 'text-red' : 'text-green'}">${s.saldo}</strong>
    </div>`).join('');
  html += `</div>`;

  html += `<div class="card"><div class="card-title">Riwayat (50 terakhir)</div>`;
  if (!list.length) html += '<p class="text-xs text-gray">Belum ada.</p>';
  else html += list.slice(0, 50).map(k => `
    <div class="row-between text-xs" style="padding:6px 0;border-bottom:1px solid var(--gray-100)">
      <div style="min-width:0;flex:1">
        <strong>${esc(k.nama)}</strong>
        <div class="text-gray">${esc(k.tanggal)} · ${esc(k.tipe)} · ${esc(k.lapakNama || '-')}</div>
      </div>
      <div class="text-right">
        ${k.masuk > 0 ? `<div class="text-green font-bold">+${k.masuk}</div>` : ''}
        ${k.keluar > 0 ? `<div class="text-red font-bold">-${k.keluar}</div>` : ''}
        <div class="text-gray">Saldo: ${k.saldo}</div>
      </div>
    </div>`).join('');
  html += `</div>`;
  return html;
}

// ============================================
//  TAB: RETUR
// ============================================
function tabRetur() {
  const list = S.retur || [];
  const pending = list.filter(r => r.status === 'pending');
  const done = list.filter(r => r.status !== 'pending').slice(0, 20);
  let html = `<h3 class="card-title">${ico('return')} Retur Kue (${pending.length} pending)</h3>`;
  if (!pending.length) html += '<div class="empty"><p>Tidak ada retur pending.</p></div>';
  else html += pending.map(r => `
    <div class="card">
      <div class="row-between mb-2">
        <div><strong>${esc(r.nama)}</strong><div class="text-xs text-gray">${esc(r.dariLapakNama)} · ${esc(r.tanggal)}</div></div>
        <span class="badge ${r.kondisi === 'Layak' ? 'badge-success' : 'badge-danger'}">${esc(r.kondisi)}</span>
      </div>
      <div class="text-sm mb-2">Qty: <strong>${r.qty}</strong></div>
      <div class="row" style="gap:6px">
        <button class="btn btn-danger btn-sm" style="flex:1" data-act="reject-retur" data-id="${esc(r.id)}">Tolak</button>
        <button class="btn btn-success btn-sm" style="flex:1" data-act="approve-retur" data-id="${esc(r.id)}">Setujui</button>
      </div>
    </div>`).join('');
  html += `<h3 class="card-title mt-3">${ico('file')} Riwayat Retur</h3>`;
  if (!done.length) html += '<div class="empty"><p>Belum ada riwayat.</p></div>';
  else html += done.map(r => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">${esc(r.nama)} · ${r.qty}</div>
        <div class="list-item-sub">${esc(r.dariLapakNama)} · ${esc(r.tanggal)}</div>
      </div>
      <span class="badge ${r.status === 'approved' ? 'badge-success' : 'badge-danger'}">${esc(r.status)}</span>
    </div>`).join('');
  return html;
}

// ============================================
//  TAB: HARGA TINGKAT
// ============================================
function tabHargaTingkat() {
  const list = S.hargaTingkat || [];
  const katMap = {}; S.katalog.forEach(k => katMap[k.id] = k);
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('tag')} Harga Bertingkat</h3>
      <button class="btn btn-primary btn-sm" data-act="add-harga-tingkat">+ Tambah</button>
    </div>
    <p class="text-xs text-gray mb-3">Harga khusus untuk Reseller/Grosir. Sistem auto pakai harga tertinggi yang cocok dengan qty.</p>
    ${!list.length ? '<div class="empty"><p>Belum ada harga khusus.</p></div>' :
      list.map(h => {
        const k = katMap[h.katalogId] || {};
        return `<div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${esc(k.nama || h.katalogId)}</div>
            <div class="list-item-sub">${esc(h.tipePelanggan)} · min ${h.minimalQty} pcs</div>
            <div class="text-sm mt-2 font-bold text-green">${fmtRp(h.hargaJual)}</div>
          </div>
          <div class="list-item-actions">
            <button class="action-btn action-edit" data-act="edit-harga-tingkat" data-id="${esc(h.id)}">${ico('edit','ico-sm')}</button>
            <button class="action-btn action-del" data-act="del-harga-tingkat" data-id="${esc(h.id)}">${ico('trash','ico-sm')}</button>
          </div>
        </div>`;
      }).join('')}`;
}

// ============================================
//  TAB: TUTUP BUKU
// ============================================
function tabTutupBuku() {
  const list = S.tutupBuku || [];
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('lock')} Tutup Buku</h3>
      <button class="btn btn-primary btn-sm" data-act="add-tutup-buku">+ Kunci Periode</button>
    </div>
    <p class="text-xs text-gray mb-3">Setoran di periode terkunci tidak bisa diedit/diapprove ulang.</p>
    ${!list.length ? '<div class="empty"><p>Belum ada periode terkunci.</p></div>' :
      list.map(t => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${esc(t.periode)}</div>
            <div class="list-item-sub">${esc(t.ditutupAt)} · oleh ${esc(t.ditutupBy)}</div>
          </div>
          <div class="row" style="gap:4px">
            <span class="badge ${t.status === 'Locked' ? 'badge-warn' : 'badge-success'}">${esc(t.status)}</span>
            ${t.status === 'Locked' ? `<button class="action-btn action-del" data-act="unlock-periode" data-id="${esc(t.id)}">${ico('key','ico-sm')}</button>` : ''}
          </div>
        </div>`).join('')}`;
}

// ============================================
//  TAB: NOTIFIKASI
// ============================================
function tabNotifikasi() {
  const list = S.notifikasi || [];
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('bell')} Notifikasi</h3>
      <button class="btn btn-ghost btn-sm" data-act="test-notif">${ico('check','ico-sm')} Test</button>
    </div>
    ${!list.length ? '<div class="empty"><p>Tidak ada notifikasi.</p></div>' :
      list.map(n => `
        <div class="card" style="${n.status === 'unread' ? 'border:1px solid var(--amber)' : ''}">
          <div class="row-between mb-2">
            <strong class="text-sm">${esc(n.subjek)}</strong>
            <span class="badge ${n.status === 'unread' ? 'badge-warn' : 'badge-gray'}">${esc(n.status)}</span>
          </div>
          <p class="text-sm mb-2">${esc(n.pesan)}</p>
          <div class="row-between text-xs text-gray">
            <span>${esc(n.tanggal)}</span>
            ${n.status === 'unread' ? `<button class="text-amber font-semibold" data-act="mark-notif-read" data-id="${esc(n.id)}">Tandai dibaca</button>` : ''}
          </div>
        </div>`).join('')}`;
}

// ============================================
//  TAB: PROFIL
// ============================================
function tabProfil() {
  return `
    <h3 class="card-title">${ico('user')} Profil & Pengaturan</h3>
    <div class="card">
      <div class="field"><label class="text-gray">Username</label><strong>${esc(S.user.username)}</strong></div>
      <div class="field"><label class="text-gray">Nama</label><strong>${esc(S.user.name)}</strong></div>
      <div class="field"><label class="text-gray">Role</label><strong>${esc(S.user.role)}</strong></div>
    </div>
    <button class="btn btn-primary btn-block mb-2" data-act="change-password">${ico('key','ico-sm')} Ganti Password</button>
    <button class="btn btn-ghost btn-block mb-2" data-act="backup-all">${ico('download','ico-sm')} Download Backup (JSON)</button>
    <button class="btn btn-ghost btn-block mb-2" data-act="restore-modal">${ico('upload','ico-sm')} Restore dari Backup</button>
    <button class="btn btn-danger btn-block" data-act="logout">${ico('out','ico-sm')} Logout</button>`;
}

// ============================================
//  TAB: ABSENSI KARYAWAN (Fase 1)
// ============================================
function tabAbsensi() {
  const f = S.absensiFilter || {};
  const list = S.absensiList || [];
  const bulan = f.bulan || monthISO();

  // Group by user
  const perUser = {};
  list.forEach(a => {
    if (!perUser[a.userId]) perUser[a.userId] = { userId: a.userId, userName: a.userName, hadir: 0, telat: 0, setengah: 0, list: [] };
    perUser[a.userId].hadir++;
    if (a.jamMasuk) {
      const [hh, mm] = a.jamMasuk.split(':').map(Number);
      const menit = hh * 60 + mm;
      if (menit > 5 * 60 + 15) perUser[a.userId].telat++;
    }
    if (a.status === 'SetengahHari') perUser[a.userId].setengah++;
    perUser[a.userId].list.push(a);
  });

  let html = `<h3 class="card-title">${ico('clock')} Absensi Karyawan</h3>`;
  html += `<div class="card">
    <div class="form-grid">
      <div class="field"><label>Bulan</label><input type="month" data-abs-bulan value="${bulan}" class="input field-sm"></div>
      <div class="field"><label>Lapak</label>
        <select data-abs-lapak class="select field-sm">
          <option value="">Semua Lapak</option>
          ${S.lapak.map(l => `<option value="${esc(l.id)}" ${f.lapakId === l.id ? 'selected' : ''}>${esc(l.nama)}</option>`).join('')}
        </select>
      </div>
    </div>
    <button class="btn btn-primary btn-block btn-sm" data-act="load-absensi">Terapkan</button>
  </div>`;

  html += `<div class="row-between mb-3">
    <strong class="text-sm">Rekap Kehadiran (${bulanLabel(bulan)})</strong>
    <button class="btn btn-ghost btn-sm" data-act="isi-absensi-form">${ico('plus','ico-sm')} Isi Manual</button>
  </div>`;

  const users = Object.values(perUser);
  if (!users.length) html += '<div class="empty"><p>Belum ada data absensi bulan ini.</p></div>';
  else html += users.map(u => {
    const skor = Math.max(0, Math.min(100, 100 - (u.telat * 2) - (u.setengah * 1)));
    const skorCls = skor >= 90 ? 'skor-high' : skor >= 70 ? 'skor-mid' : 'skor-low';
    return `
      <div class="card">
        <div class="row-between mb-2">
          <strong>${esc(u.userName)}</strong>
          <span class="skor-label">${skor}</span>
        </div>
        <div class="skor-bar"><div class="skor-track"><div class="skor-fill ${skorCls}" style="width:${skor}%"></div></div></div>
        <div class="kehadiran-cell mt-2">
          <span class="kehadiran-tag hadir">Hadir ${u.hadir}</span>
          ${u.telat > 0 ? `<span class="kehadiran-tag telat">Telat ${u.telat}</span>` : ''}
          ${u.setengah > 0 ? `<span class="kehadiran-tag setengah">Setengah ${u.setengah}</span>` : ''}
        </div>
        <button class="btn btn-ghost btn-sm btn-block mt-2" data-act="lihat-absensi-user" data-id="${esc(u.userId)}">Lihat Detail</button>
      </div>`;
  }).join('');

  return html;
}

// ============================================
//  TAB: ABSENSI HARI INI
// ============================================
function tabAbsensiHariIni() {
  const list = S.absensiList || [];
  const hariIni = todayISO();
  const today = list.filter(a => a.tanggal === hariIni);

  let html = `<h3 class="card-title">${ico('clock')} Absensi Hari Ini</h3>
    <p class="text-xs text-gray mb-3">${fmtDateID(new Date())}</p>`;

  const karyawans = S.users.filter(u => u.role === 'karyawan' && u.aktif);
  if (!karyawans.length) return html + '<div class="empty"><p>Tidak ada karyawan aktif.</p></div>';

  html += karyawans.map(u => {
    const a = today.find(x => String(x.userId) === String(u.id));
    if (!a) {
      return `<div class="absensi-row">
        <div class="info">
          <div class="name">${esc(u.name)}</div>
          <div class="meta"><span class="status-pill status-belum">Belum Absen</span></div>
        </div>
        <button class="btn btn-primary btn-sm" data-act="isi-absensi-user" data-userid="${esc(u.id)}">Isi</button>
      </div>`;
    }
    return `<div class="absensi-row">
      <div class="info">
        <div class="name">${esc(u.name)}</div>
        <div class="meta">${esc(a.lapakNama)} · ${esc(a.status)}${a.filledBy && a.filledBy !== u.username ? ` · diisi oleh ${esc(a.filledBy)}` : ''}</div>
      </div>
      <div class="time">
        <div><strong>${esc(a.jamMasuk)}</strong> → <strong>${esc(a.jamKeluar || '...')}</strong></div>
        <div class="text-xs text-gray">${a.jamKerja ? a.jamKerja + ' jam' : ''}</div>
      </div>
      <div style="display:flex;gap:4px;margin-left:8px">
        <button class="action-btn action-edit" data-act="edit-absensi" data-id="${esc(a.id)}">${ico('edit','ico-sm')}</button>
        <button class="action-btn action-del" data-act="del-absensi" data-id="${esc(a.id)}">${ico('trash','ico-sm')}</button>
      </div>
    </div>`;
  }).join('');

  return html;
}

// ============================================
//  TAB: BONUS ANTAR (Fase 1)
// ============================================
function tabBonusAntar() {
  const f = S.bonusFilter || {};
  const list = S.bonusAntar || [];
  const bulan = f.bulan || monthISO();
  const total = list.reduce((s, b) => s + (b.nominal || 0), 0);

  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('truck')} Bonus Mengantar</h3>
      <button class="btn btn-primary btn-sm" data-act="add-bonus-antar">+ Tambah</button>
    </div>

    <div class="card">
      <div class="form-grid">
        <div class="field"><label>Bulan</label><input type="month" data-bonus-bulan value="${bulan}" class="input field-sm"></div>
        <div class="field"><label>Karyawan</label>
          <select data-bonus-user class="select field-sm">
            <option value="">Semua</option>
            ${S.users.filter(u => u.role === 'karyawan').map(u => `<option value="${esc(u.id)}" ${f.userId === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn btn-primary btn-block btn-sm" data-act="load-bonus">Terapkan</button>
    </div>

    <div class="kpi-hero">
      <div class="kpi-hero-label">Total Bonus (${bulanLabel(bulan)})</div>
      <div class="kpi-hero-value">${fmtRp(total)}</div>
      <div class="text-xs opacity-90">${list.length} pengantaran</div>
    </div>

    ${!list.length ? '<div class="empty"><p>Belum ada bonus antar.</p></div>' :
      list.map(b => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${esc(b.userName)}</div>
            <div class="list-item-sub">${esc(b.tanggal)} · ${esc(b.tujuan || '-')} ${b.jarakKm > 0 ? '· ' + b.jarakKm + ' km' : ''}</div>
            ${b.keterangan ? `<div class="text-xs text-gray mt-2">${esc(b.keterangan)}</div>` : ''}
          </div>
          <div class="text-right">
            <div class="text-sm font-bold text-green">${fmtRp(b.nominal)}</div>
            <div class="list-item-actions mt-2">
              <button class="action-btn action-edit" data-act="edit-bonus-antar" data-id="${esc(b.id)}">${ico('edit','ico-sm')}</button>
              <button class="action-btn action-del" data-act="del-bonus-antar" data-id="${esc(b.id)}">${ico('trash','ico-sm')}</button>
            </div>
          </div>
        </div>`).join('')}`;
}

// ============================================
//  TAB: SETTING PAYROLL (Fase 1)
// ============================================
function tabSettingPayroll() {
  const list = S.settingPayroll || [];
  const heList = S.hariEfektif || [];
  const bulan = monthISO();

  let html = `<h3 class="card-title">${ico('settings')} Setting Payroll</h3>`;
  html += `<p class="text-xs text-gray mb-3">Atur bonus merekap & tunjangan lapak per lapak.</p>`;

  // Setting Payroll
  html += `<div class="row-between mb-3">
    <strong class="text-sm">Rate per Lapak</strong>
    <button class="btn btn-primary btn-sm" data-act="add-setting-payroll">+ Tambah</button>
  </div>`;
  if (!list.length) html += '<div class="empty"><p>Belum ada setting.</p></div>';
  else html += list.map(s => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">${esc(s.lapakNama)}</div>
        <div class="list-item-sub">Bonus Merekap: <strong>${fmtRp(s.bonusMerekap)}</strong> · Tunjangan: <strong>${fmtRp(s.tunjanganLapak)}</strong></div>
        <div class="text-xs text-gray mt-1">Berlaku dari: ${esc(s.berlakuDari)}</div>
      </div>
      <div class="list-item-actions">
        <button class="action-btn action-edit" data-act="edit-setting-payroll" data-id="${esc(s.id)}">${ico('edit','ico-sm')}</button>
        <button class="action-btn action-del" data-act="del-setting-payroll" data-id="${esc(s.id)}">${ico('trash','ico-sm')}</button>
      </div>
    </div>`).join('');

  html += `<div class="divider"></div>`;

  // Hari Efektif
  html += `<div class="row-between mb-3">
    <strong class="text-sm">Hari Efektif per Bulan</strong>
    <button class="btn btn-ghost btn-sm" data-act="auto-hari-efektif" data-bulan="${bulan}">${ico('refresh','ico-sm')} Auto</button>
  </div>`;
  html += `<div class="card">
    <div class="field"><label>Bulan</label><input type="month" data-he-bulan value="${bulan}" class="input field-sm"></div>
    <button class="btn btn-ghost btn-block btn-sm" data-act="load-hari-efektif">Muat Hari Efektif</button>
  </div>`;

  if (!heList.length) html += '<div class="empty"><p>Belum ada data hari efektif.</p></div>';
  else html += heList.map(h => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">${esc(h.lapakNama)}</div>
        <div class="list-item-sub">${esc(bulanLabel(h.bulan))}</div>
      </div>
      <div class="text-right">
        <strong class="text-amber">${h.jumlahHari} hari</strong>
        <div class="mt-2">
          <button class="action-btn action-edit" data-act="edit-hari-efektif" data-id="${esc(h.id)}" data-bulan="${esc(h.bulan)}" data-lapak="${esc(h.lapakId)}" data-hari="${h.jumlahHari}">${ico('edit','ico-sm')}</button>
        </div>
      </div>
    </div>`).join('');

  return html;
}

// ============================================
//  TAB: PAYROLL (Fase 1)
// ============================================
function tabPayroll() {
  const bulan = S.payrollBulan || monthISO();
  const data = S.payrollData;
  const hist = S.payrollHistory || [];

  let html = `<h3 class="card-title">${ico('money')} Rekap Payroll</h3>`;
  html += `<div class="card">
    <div class="field"><label>Bulan</label><input type="month" data-payroll-bulan value="${bulan}" class="input field-sm"></div>
    <button class="btn btn-primary btn-block btn-sm" data-act="load-payroll">Tampilkan Rekap</button>
  </div>`;

  if (!data) {
    html += `<div class="alert alert-info">${ico('inbox','ico-sm')}<span>Pilih bulan lalu klik "Tampilkan Rekap".</span></div>`;
    // Riwayat
    if (hist.length) {
      html += `<h3 class="card-title mt-3">${ico('file')} Riwayat Bayar</h3>`;
      html += hist.slice(0, 20).map(h => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${esc(h.userName)}</div>
            <div class="list-item-sub">${esc(bulanLabel(h.bulan))} · ${esc(h.dibayarAt)}</div>
          </div>
          <div class="text-right"><div class="text-sm font-bold text-green">${fmtRp(h.totalBersih)}</div></div>
        </div>`).join('');
    }
    return html;
  }

  // Total KPI
  html += `<div class="grid-3 mb-3">
    <div class="kpi"><div class="kpi-label">Karyawan</div><div class="kpi-value">${data.list.length}</div></div>
    <div class="kpi"><div class="kpi-label">Total Bayar</div><div class="kpi-value text-green" style="font-size:12px">${fmtRp(data.totals.totalBersih)}</div></div>
    <div class="kpi"><div class="kpi-label">Kasbon</div><div class="kpi-value text-red" style="font-size:12px">${fmtRp(data.totals.totalKasbon)}</div></div>
  </div>`;

  html += `<div class="row-between mb-3">
    <strong class="text-sm">Detail per Karyawan</strong>
    <button class="btn btn-success btn-sm" data-act="bayar-payroll-bulk">${ico('check','ico-sm')} Bayar Terpilih</button>
  </div>`;

  html += data.list.map(x => {
    const skor = x.kehadiran.skor;
    const skorCls = skor >= 90 ? 'skor-high' : skor >= 70 ? 'skor-mid' : 'skor-low';
    return `
      <div class="card">
        <div class="row mb-3">
          <input type="checkbox" data-payroll-pick data-userid="${esc(x.userId)}" data-total="${x.totalBersih}">
          <div style="flex:1;min-width:0">
            <div class="row-between">
              <strong>${esc(x.userName)}</strong>
              <span class="skor-label">${skor}</span>
            </div>
            <div class="kehadiran-cell mt-2">
              <span class="kehadiran-tag hadir">Hadir ${x.kehadiran.hadir}</span>
              ${x.kehadiran.telat > 0 ? `<span class="kehadiran-tag telat">Telat ${x.kehadiran.telat}</span>` : ''}
              ${x.kehadiran.setengahHari > 0 ? `<span class="kehadiran-tag setengah">Setengah ${x.kehadiran.setengahHari}</span>` : ''}
            </div>
          </div>
        </div>

        <div style="background:var(--gray-50);padding:12px;border-radius:8px">
          <div class="text-xs font-semibold text-gray mb-2">Bonus Merekap</div>
          ${x.rincianMerekap.length ? x.rincianMerekap.map(r => `
            <div class="payroll-line">
              <span class="label">${esc(r.lapakNama)} (${r.hariMerekap}/${r.hariEfektif} × ${fmtRp(r.rate)})</span>
              <span class="value">${fmtRp(r.bonus)}</span>
            </div>`).join('') : '<p class="text-xs text-gray">Belum ada rekap</p>'}

          ${x.totalTunjangan > 0 ? `
            <div class="text-xs font-semibold text-gray mb-2 mt-3">Tunjangan Lapak</div>
            ${x.rincianTunjangan.map(r => `
              <div class="payroll-line">
                <span class="label">${esc(r.lapakNama)}</span>
                <span class="value">${fmtRp(r.nominal)}</span>
              </div>`).join('')}
          ` : ''}

          ${x.totalBonusAntar > 0 ? `
            <div class="payroll-line mt-3">
              <span class="label">Bonus Antar (${x.bonusAntarList.length}×)</span>
              <span class="value">${fmtRp(x.totalBonusAntar)}</span>
            </div>` : ''}

          ${x.totalKasbon > 0 ? `
            <div class="payroll-line deduction">
              <span class="label">Potongan Kasbon</span>
              <span class="value">- ${fmtRp(x.totalKasbon)}</span>
            </div>` : ''}

          <div class="payroll-line subtotal">
            <span class="label">Total Bersih</span>
            <span class="value">${fmtRp(x.totalBersih)}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  return html;
}

// ============================================
//  TAB: DASHBOARD PROFIT (Fase 1)
// ============================================
function tabDashboardProfit() {
  const range = S.profitRange || 30;
  const data = S.dashboardProfit;

  let html = `<h3 class="card-title">${ico('trending')} Dashboard Profit</h3>`;
  html += `<div class="card">
    <div class="row" style="gap:6px">
      ${[7, 14, 30, 90].map(r => `
        <button class="btn btn-sm ${range === r ? 'btn-primary' : 'btn-ghost'}" data-act="profit-range" data-range="${r}" style="flex:1">${r}h</button>
      `).join('')}
    </div>
  </div>`;

  if (!data) {
    html += `<div class="alert alert-info">${ico('inbox','ico-sm')}<span>Memuat data profit...</span></div>`;
    return html;
  }

  html += `<div class="grid-3 mb-3">
    <div class="kpi"><div class="kpi-label">Total Omzet</div><div class="kpi-value text-green" style="font-size:13px">${fmtRp(data.totalOmzet)}</div></div>
    <div class="kpi"><div class="kpi-label">Total Profit</div><div class="kpi-value text-blue" style="font-size:13px">${fmtRp(data.totalProfit)}</div></div>
    <div class="kpi"><div class="kpi-label">Rata-rata/Hari</div><div class="kpi-value text-amber" style="font-size:13px">${fmtRp(data.avgProfit)}</div></div>
  </div>`;

  // Grafik
  const maxP = Math.max(1, ...data.daily.map(d => d.profit));
  html += `<div class="card">
    <div class="card-title">Profit Harian (${range} hari)</div>
    <div class="grafik-simple">
      ${data.daily.map(d => `
        <div class="grafik-bar" style="height:${(d.profit / maxP * 100).toFixed(1)}%" title="${d.tanggal}: ${fmtRp(d.profit)}"></div>
      `).join('')}
    </div>
    <div class="row-between text-xs text-gray mt-2">
      <span>${data.daily[0] ? data.daily[0].tanggal : ''}</span>
      <span>${data.daily[data.daily.length - 1] ? data.daily[data.daily.length - 1].tanggal : ''}</span>
    </div>
  </div>`;

  // Top hari terbaik
  const sorted = [...data.daily].sort((a, b) => b.profit - a.profit);
  const best = sorted.slice(0, 3);
  const worst = sorted.slice(-3).reverse();

  html += `<div class="card">
    <div class="card-title">Hari Terbaik</div>
    ${best.map(d => `<div class="row-between text-sm" style="padding:4px 0"><span>${esc(d.tanggal)}</span><strong class="text-green">${fmtRp(d.profit)}</strong></div>`).join('')}
  </div>`;

  html += `<div class="card">
    <div class="card-title">Hari Terendah</div>
    ${worst.map(d => `<div class="row-between text-sm" style="padding:4px 0"><span>${esc(d.tanggal)}</span><strong class="text-red">${fmtRp(d.profit)}</strong></div>`).join('')}
  </div>`;

  return html;
}

// ============================================
//  EVENT HANDLERS
// ============================================
function handleClick(e) {
  const form = e.target.closest('[data-form="login"]');
  if (form && e.target.type === 'submit') { e.preventDefault(); doLogin(form); return; }

  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const a = btn.dataset.act;
  const id = btn.dataset.id;
  const tab = btn.dataset.tab;

  if (a === 'logout') return doLogout();
  if (a === 'tab') return switchTab(tab);
  if (a === 'refresh') return doRefresh();
  if (a === 'refresh-stok') return loadKartuStok();

  // Karyawan
  if (a === 'buka') return karyawanAction('bukaLapak');
  if (a === 'tutup') return karyawanAction('tutupLapak');
  if (a === 'save-drop') return karyawanSaveDrop();
  if (a === 'edit-drop') { S.karyawan.distribusi = []; return render(); }
  if (a === 'submit-rekap') return doSubmitRekap();
  if (a === 'add-peng') return addPengRow();
  if (a === 'del-peng') { const r = e.target.closest('[data-peng-row]'); if (r) r.remove(); return updateSummary(); }
  if (a === 'ajukan-kasbon') return formKasbon(false);
  if (a === 'ganti-lapak') return showGantiLapakModal();
  if (a === 'retur-karyawan') return formReturKaryawan();
  // Fase 1 - absensi karyawan
  if (a === 'absen-masuk') return doAbsenMasuk();
  if (a === 'absen-keluar') return doAbsenKeluar();

  // Admin setoran
  if (a === 'apply-setoran-filter') return applySetoranFilter();
  if (a === 'approve') return doApprove(id);
  if (a === 'reject') return doReject(id);
  if (a === 'detail-setoran') return showSetoranDetail(id);
  if (a === 'edit-setoran') return formEditSetoran(id);
  if (a === 'cetak-struk') return showStruk(id);

  if (a === 'add-kas') return formKas();
  if (a === 'add-katalog') return formKatalog();
  if (a === 'edit-katalog') return formKatalog(id);
  if (a === 'del-katalog') return delKatalog(id);
  if (a === 'add-supplier') return formSupplier();
  if (a === 'edit-supplier') return formSupplier(id);
  if (a === 'del-supplier') return delSupplier(id);
  if (a === 'add-lapak') return formLapak();
  if (a === 'edit-lapak') return formLapak(id);
  if (a === 'del-lapak') return delLapak(id);
  if (a === 'load-distribusi') return loadDistribusi();
  if (a === 'save-distribusi') return saveDistribusi();
  if (a === 'add-belanja') return formBelanja();
  if (a === 'edit-belanja') return formBelanja(id);
  if (a === 'del-belanja') return delBelanja(id);
  if (a === 'add-jadwal') return formJadwal();
  if (a === 'edit-jadwal') return formJadwal(id);
  if (a === 'del-jadwal') return delJadwal(id);
  if (a === 'add-kasbon') return formKasbon(true);
  if (a === 'reject-kasbon') return adminRejectKasbon(id);
  if (a === 'del-kasbon') return delKasbon(id);
  if (a === 'add-setting-gaji') return formSettingGaji();
  if (a === 'edit-setting-gaji') return formSettingGaji(id);
  if (a === 'rekap-gaji-load') return loadRekapGaji();
  if (a === 'bayar-gaji-bulk') return doBayarGajiBulk();
  if (a === 'add-pesanan') return formPesanan();
  if (a === 'edit-pesanan') return formPesanan(id);
  if (a === 'del-pesanan') return delPesanan(id);
  if (a === 'load-rekap-pesanan') return loadRekapPesanan();
  if (a === 'add-user') return formUser();
  if (a === 'edit-user') return formUser(id);
  if (a === 'del-user') return delUser(id);
  if (a === 'reset-user-pwd') return resetUserPwd(id);
  if (a === 'load-laporan') return loadLaporan();
  if (a === 'export-csv') return doExportCSV();
  if (a === 'approve-retur') return approveRetur(id);
  if (a === 'reject-retur') return rejectRetur(id);
  if (a === 'add-harga-tingkat') return formHargaTingkat();
  if (a === 'edit-harga-tingkat') return formHargaTingkat(id);
  if (a === 'del-harga-tingkat') return delHargaTingkat(id);
  if (a === 'add-tutup-buku') return formTutupBuku();
  if (a === 'unlock-periode') return unlockPeriode(id);
  if (a === 'open-notif') return switchTab('notifikasi');
  if (a === 'mark-notif-read') return markNotifRead(id);
  if (a === 'test-notif') return testNotif();
  if (a === 'change-password') return formChangePwd();
  if (a === 'backup-all') return doBackupAll();
  if (a === 'restore-modal') return formRestore();

  // Fase 1 - Absensi
  if (a === 'load-absensi') return loadAbsensi();
  if (a === 'isi-absensi-form') return formIsiAbsensi();
  if (a === 'isi-absensi-user') return formIsiAbsensi(btn.dataset.userid);
  if (a === 'edit-absensi') return formEditAbsensi(id);
  if (a === 'del-absensi') return delAbsensi(id);
  if (a === 'lihat-absensi-user') return lihatDetailAbsensiUser(id);

  // Fase 1 - Bonus Antar
  if (a === 'add-bonus-antar') return formBonusAntar();
  if (a === 'edit-bonus-antar') return formBonusAntar(id);
  if (a === 'del-bonus-antar') return delBonusAntar(id);
  if (a === 'load-bonus') return loadBonusAntar();

  // Fase 1 - Setting Payroll
  if (a === 'add-setting-payroll') return formSettingPayroll();
  if (a === 'edit-setting-payroll') return formSettingPayroll(id);
  if (a === 'del-setting-payroll') return delSettingPayroll(id);
  if (a === 'load-hari-efektif') return loadHariEfektif();
  if (a === 'auto-hari-efektif') return autoHariEfektif(btn.dataset.bulan);
  if (a === 'edit-hari-efektif') return formEditHariEfektif(btn.dataset);

  // Fase 1 - Payroll
  if (a === 'load-payroll') return loadPayroll();
  if (a === 'bayar-payroll-bulk') return bayarPayrollBulk();

  // Fase 1 - Dashboard Profit
  if (a === 'profit-range') { S.profitRange = parseInt(btn.dataset.range, 10); return loadDashboardProfit(); }
}

function handleInput(e) {
  const t = e.target;
  if (t.dataset.rekapItem) {
    const kat = t.dataset.rekapItem;
    const max = Number(t.dataset.max);
    let v = parseInt(t.value, 10) || 0;
    v = Math.max(0, Math.min(v, max));
    S.rekap[kat] = v;
    if (String(v) !== t.value) t.value = v;
    const lakuEl = $('[data-laku="' + kat + '"]');
    const subEl = $('[data-sub="' + kat + '"]');
    const item = S.karyawan.distribusi.find(x => x.katalogId === kat);
    if (lakuEl) lakuEl.textContent = max - v;
    if (subEl && item) subEl.textContent = fmtRp((max - v) * item.hargaJual);
    updateSummary();
    return;
  }
  if (t.name === 'tunai' || t.name === 'qris' || t.dataset.pengNom !== undefined) updateSummary();
}

function handleChange(e) {
  const t = e.target;
  if (t.dataset.act === 'check-belanja') {
    if (t.checked) {
      modal({
        title: 'Harga Aktual',
        body: '<div class="field"><label>Harga Aktual (Rp)</label><input type="number" data-harga min="0" class="input" placeholder="0 = pakai estimasi"></div>',
        actions: [
          { label: 'Batal', onClick: c => { c(); render(); } },
          { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
            const h = parseInt(w.querySelector('[data-harga]').value, 10) || 0;
            c(); await doCheckBelanja(t.dataset.id, true, h);
          } }
        ]
      });
    } else doCheckBelanja(t.dataset.id, false);
  }
  if (t.dataset.act === 'toggle-jadwal') {
    api('toggleJadwal', { token: S.token, id: t.dataset.id, done: t.checked }).then(() => {
      const j = S.jadwal.find(x => x.id === t.dataset.id);
      if (j) j.done = t.checked;
      render();
    }).catch(err => toast(err.message, 'error'));
  }
}

// ============================================
//  AUTH
// ============================================
async function doLogin(form) {
  const u = form.username.value.trim();
  const p = form.password.value;
  if (!u || !p) return toast('Isi form', 'error');
  const btn = form.querySelector('button');
  btn.disabled = true; btn.textContent = 'Memuat...';
  showLoader();
  try {
    const res = await api('login', { username: u, password: p });
    if (!res.success) { toast(res.message, 'error'); return; }
    S.token = res.token; S.user = res.user;
    localStorage.setItem('tk', res.token);
    CACHE.clearAll();
    if (res.user.mustChangePassword) toast('Anda harus ganti password', 'info');
    await bootstrap();
  } catch (err) { toast(err.message, 'error'); }
  finally { hideLoader(); btn.disabled = false; btn.textContent = 'Masuk'; }
}

async function doLogout() {
  try { if (S.token) await api('logout', { token: S.token }); } catch (e) {}
  localStorage.removeItem('tk');
  localStorage.removeItem('lapakAktif');
  CACHE.clearAll();
  Object.assign(S, {
    user: null, token: null, lapakAktif: null, view: 'login', tab: 'home',
    lapak: [], suppliers: [], katalog: [], users: [], belanja: [], jadwal: [],
    dash: null, karyawan: null, kasbon: null, gaji: null, laporan: null, setoran: null,
    pesanan: null, settingGaji: null, rekapGaji: null, rekapPesanan: null,
    kartuStok: null, stokSaldo: null, retur: null, hargaTingkat: null,
    tutupBuku: null, notifikasi: null, rekap: {},
    absensiList: null, absensiFilter: {}, bonusAntar: null, bonusFilter: {},
    settingPayroll: null, hariEfektif: null,
    payrollBulan: null, payrollData: null, payrollHistory: null,
    dashboardProfit: null, absensiHariIni: null
  });
  render();
}

function sessionExpired() {
  localStorage.removeItem('tk');
  localStorage.removeItem('lapakAktif');
  S.token = null; S.user = null; S.lapakAktif = null; S.view = 'login';
  render();
  toast('Sesi berakhir. Login ulang.', 'error');
}

async function tryAutoLogin() {
  if (!S.token) return render();
  try {
    const me = await api('getMe', { token: S.token });
    S.user = me;
    await bootstrap();
  } catch (e) {
    localStorage.removeItem('tk'); S.token = null; render();
  }
}

async function bootstrap() {
  showLoader();
  try {
    if (S.user.role === 'admin') {
      const [dash, lapak, sup, kat, users] = await Promise.all([
        api('getAdminDashboard', { token: S.token }),
        api('getLapak', { token: S.token }),
        api('getSuppliers', { token: S.token }),
        api('getKatalog', { token: S.token }),
        api('getUsers', { token: S.token })
      ]);
      Object.assign(S, { dash, lapak, suppliers: sup, katalog: kat, users });
      S.view = 'admin'; S.tab = 'home';
    } else {
      const myLapak = await api('getMyLapak', { token: S.token });
      if (myLapak.length > 1 && !S.lapakAktif) {
        hideLoader();
        return showPilihLapak(myLapak);
      }
      if (myLapak.length === 1) {
        S.lapakAktif = myLapak[0];
        localStorage.setItem('lapakAktif', JSON.stringify(S.lapakAktif));
        await api('setLapakAktif', { token: S.token, lapakId: S.lapakAktif.id });
      } else if (S.lapakAktif) {
        await api('setLapakAktif', { token: S.token, lapakId: S.lapakAktif.id });
      }
      const [d, kb, ak] = await Promise.all([
        api('getKaryawanDashboard', { token: S.token }),
        api('getKasbon', { token: S.token, filter: {} }),
        api('absensiHariIni', { token: S.token }).catch(() => ({ status: 'belum' }))
      ]);
      S.karyawan = d; S.kasbon = kb; S.absensiHariIni = ak;
      if (S.karyawan.distribusi) {
        S.karyawan.distribusi.forEach(x => { if (S.rekap[x.katalogId] === undefined) S.rekap[x.katalogId] = 0; });
      }
      S.view = 'karyawan';
    }
  } catch (e) {
    toast(e.message, 'error');
    if (String(e.message).indexOf('UNAUTHORIZED') !== -1) sessionExpired();
  } finally { hideLoader(); render(); }
}

function showPilihLapak(list) {
  modal({
    title: 'Pilih Lapak',
    body: '<p class="text-sm text-gray mb-3">Anda punya akses ke beberapa lapak. Pilih lapak aktif:</p>' +
      list.map(l => '<button data-lapak="' + esc(l.id) + '" class="btn btn-ghost btn-block mb-2" style="justify-content:flex-start">' + ico('store','ico-sm') + ' ' + esc(l.nama) + '</button>').join(''),
    actions: [],
    onMount: (wrap, close) => {
      wrap.addEventListener('click', async e => {
        const b = e.target.closest('[data-lapak]');
        if (!b) return;
        const lapakId = b.dataset.lapak;
        const lapakObj = list.find(l => l.id === lapakId);
        S.lapakAktif = lapakObj;
        localStorage.setItem('lapakAktif', JSON.stringify(lapakObj));
        try { await api('setLapakAktif', { token: S.token, lapakId }); } catch (err) {}
        close();
        await bootstrap();
      });
    }
  });
}

async function showGantiLapakModal() {
  showLoader();
  try {
    const list = await api('getMyLapak', { token: S.token });
    hideLoader();
    if (list.length <= 1) return toast('Anda hanya punya akses 1 lapak.', 'info');
    modal({
      title: 'Ganti Lapak',
      body: '<p class="text-sm text-gray mb-3">Pilih lapak baru:</p>' +
        list.map(l => {
          const isActive = S.lapakAktif && S.lapakAktif.id === l.id;
          return '<button data-lapak="' + esc(l.id) + '" class="btn ' + (isActive ? 'btn-primary' : 'btn-ghost') + ' btn-block mb-2" style="justify-content:flex-start">' + ico('store','ico-sm') + ' ' + esc(l.nama) + (isActive ? ' (aktif)' : '') + '</button>';
        }).join(''),
      actions: [{ label: 'Tutup', onClick: c => c() }],
      onMount: (wrap, close) => {
        wrap.addEventListener('click', async e => {
          const b = e.target.closest('[data-lapak]');
          if (!b) return;
          const lapakId = b.dataset.lapak;
          const obj = list.find(l => l.id === lapakId);
          if (S.lapakAktif && S.lapakAktif.id === lapakId) { close(); return; }
          try {
            const r = await api('setLapakAktif', { token: S.token, lapakId });
            if (!r.success) return toast(r.message, 'error');
            S.lapakAktif = obj;
            localStorage.setItem('lapakAktif', JSON.stringify(obj));
            close();
            await reloadKaryawan();
            toast('Lapak: ' + obj.nama, 'success');
            render();
          } catch (err) { toast(err.message, 'error'); }
        });
      }
    });
  } catch (e) { hideLoader(); toast(e.message, 'error'); }
}

// ============================================
//  KARYAWAN ACTIONS
// ============================================
async function karyawanAction(action) {
  showLoader();
  try {
    const r = await api(action, { token: S.token });
    toast(r.message, r.success ? 'success' : 'error');
    if (r.success) await reloadKaryawan();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

async function reloadKaryawan() {
  const [d, ak] = await Promise.all([
    api('getKaryawanDashboard', { token: S.token }),
    api('absensiHariIni', { token: S.token }).catch(() => ({ status: 'belum' }))
  ]);
  S.karyawan = d; S.absensiHariIni = ak;
  if (S.karyawan.distribusi) {
    S.karyawan.distribusi.forEach(x => { if (S.rekap[x.katalogId] === undefined) S.rekap[x.katalogId] = 0; });
  }
}

async function karyawanSaveDrop() {
  const items = [];
  $$('[data-drop-item]').forEach(inp => {
    const qty = parseInt(inp.value, 10) || 0;
    if (qty > 0) items.push({ katalogId: inp.dataset.dropItem, qtyDrop: qty });
  });
  if (!items.length) return toast('Isi minimal 1 qty.', 'error');
  showLoader();
  try {
    const r = await api('karyawanInputDrop', { token: S.token, items });
    toast(r.message, r.success ? 'success' : 'error');
    if (r.success) await reloadKaryawan();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

async function doSubmitRekap() {
  if (S.submitting) return;
  const d = S.karyawan;
  const items = d.distribusi.map(x => ({ katalogId: x.katalogId, qtySisa: S.rekap[x.katalogId] || 0 }));
  const pengeluaran = [];
  $$('[data-peng-row]').forEach(r => {
    const ketEl = r.querySelector('[data-peng-ket]');
    const nomEl = r.querySelector('[data-peng-nom]');
    if (!ketEl || !nomEl) return;
    const ket = ketEl.value.trim();
    const nom = parseInt(nomEl.value, 10) || 0;
    if (ket && nom > 0) pengeluaran.push({ keterangan: ket, kategori: 'Operasional', nominal: nom });
  });
  const tunaiEl = $('input[name=tunai]');
  const qrisEl = $('input[name=qris]');
  const tunai = tunaiEl ? (parseInt(tunaiEl.value, 10) || 0) : 0;
  const qris = qrisEl ? (parseInt(qrisEl.value, 10) || 0) : 0;

  const ok = await confirmDlg('Kirim Laporan?', 'Data tidak bisa diubah setelah dikirim.', 'Kirim');
  if (!ok) return;
  S.submitting = true;
  showLoader();
  try {
    const r = await api('submitRekap', { token: S.token, payload: { tanggal: d.tanggal, items, pengeluaran, totalTunai: tunai, totalQris: qris } });
    toast(r.message || 'Laporan terkirim', r.success ? 'success' : 'error');
    if (r.success) await reloadKaryawan();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); S.submitting = false; render(); }
}

// ============================================
//  FASE 1 — ABSENSI KARYAWAN
// ============================================
async function doAbsenMasuk() {
  const lapakList = await api('getMyLapak', { token: S.token });
  const defaultLapak = (S.lapakAktif && S.lapakAktif.id) || (lapakList[0] && lapakList[0].id) || '';
  modal({
    title: 'Absen Masuk',
    body: `
      <p class="text-sm text-gray mb-3">Pilih lapak tempat Anda bekerja hari ini:</p>
      <div class="field"><label>Lapak</label>
        <select data-f="lapakId" class="select">
          ${lapakList.map(l => `<option value="${esc(l.id)}" ${l.id === defaultLapak ? 'selected' : ''}>${esc(l.nama)}</option>`).join('')}
        </select>
      </div>
    `,
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Absen Masuk', className: 'btn-success', onClick: async (c, w) => {
        const lapakId = w.querySelector('[data-f="lapakId"]').value;
        c(); showLoader();
        try {
          const r = await api('absenMasuk', { token: S.token, lapakId });
          toast(r.message, r.success ? 'success' : 'error');
          if (r.success) await reloadKaryawan();
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); render(); }
      } }
    ]
  });
}

async function doAbsenKeluar() {
  const ok = await confirmDlg('Absen Keluar?', 'Anda yakin ingin absen keluar sekarang?', 'Ya, Keluar');
  if (!ok) return;
  showLoader();
  try {
    const r = await api('absenKeluar', { token: S.token });
    toast(r.message, r.success ? 'success' : 'error');
    if (r.success) await reloadKaryawan();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

// ============================================
//  TAB NAVIGATION
// ============================================
async function switchTab(tab) {
  if (tab === 'more') return showMoreMenu();
  S.tab = tab;
  await loadTabData(tab);
  render();
}

async function loadTabData(tab) {
  if (!S.token) return;
  try {
    if (tab === 'setoran') S.setoran = await api('getSetoranList', { token: S.token, filter: S._setoranFilter || {} });
    if (tab === 'belanja' && !S.belanja.length) S.belanja = await api('getBelanja', { token: S.token, filter: {} });
    if (tab === 'jadwal' && !S.jadwal.length) S.jadwal = await api('getJadwal', { token: S.token, days: 30 });
    if (tab === 'kasbon') S.kasbon = await api('getKasbon', { token: S.token, filter: {} });
    if (tab === 'gaji' && !S.gaji) S.gaji = await api('getGaji', { token: S.token, filter: {} });
    if (tab === 'setting-gaji' && !S.settingGaji) S.settingGaji = await api('getSettingGaji', { token: S.token });
    if (tab === 'pesanan' && !S.pesanan) S.pesanan = await api('getPesanan', { token: S.token, filter: {} });
    if (tab === 'laporan' && !S.laporan) S.laporan = await api('getLaporan', { token: S.token, filter: {} });
    if (tab === 'kartu-stok') await loadKartuStokData();
    if (tab === 'retur') S.retur = await api('getReturList', { token: S.token, filter: {} });
    if (tab === 'harga-tingkat') S.hargaTingkat = await api('getHargaTingkat', { token: S.token });
    if (tab === 'tutup-buku') S.tutupBuku = await api('getTutupBukuList', { token: S.token });
    if (tab === 'notifikasi') S.notifikasi = await api('getNotifikasi', { token: S.token, filter: {} });
    // Fase 1
    if (tab === 'absensi') await loadAbsensi();
    if (tab === 'absensi-hari-ini') { S.absensiList = await api('getAbsensiKaryawan', { token: S.token, filter: { bulan: monthISO() } }); }
    if (tab === 'bonus-antar') await loadBonusAntar();
    if (tab === 'setting-payroll') {
      S.settingPayroll = await api('getSettingPayroll', { token: S.token });
      S.hariEfektif = await api('getHariEfektif', { token: S.token, bulan: monthISO() });
    }
    if (tab === 'payroll') {
      S.payrollHistory = await api('getPayrollHistory', { token: S.token, filter: {} });
    }
    if (tab === 'dashboard-profit') await loadDashboardProfit();
  } catch (e) { toast(e.message, 'error'); }
}

async function loadKartuStokData() {
  try {
    const [stok, saldo] = await Promise.all([
      api('getKartuStok', { token: S.token, filter: {} }),
      api('getStokSaldo', { token: S.token })
    ]);
    S.kartuStok = stok; S.stokSaldo = saldo;
  } catch (e) { toast(e.message, 'error'); }
}
async function loadKartuStok() { await loadKartuStokData(); render(); }

async function loadAbsensi() {
  const f = S.absensiFilter || {};
  const bulan = f.bulan || monthISO();
  const lapakId = f.lapakId || '';
  try {
    S.absensiList = await api('getAbsensiKaryawan', { token: S.token, filter: { bulan, lapakId } });
    S.absensiFilter = { bulan, lapakId };
  } catch (e) { toast(e.message, 'error'); }
}

async function loadBonusAntar() {
  const f = S.bonusFilter || {};
  const bulan = f.bulan || monthISO();
  const userId = f.userId || '';
  try {
    S.bonusAntar = await api('getBonusAntar', { token: S.token, filter: { bulan, userId } });
    S.bonusFilter = { bulan, userId };
  } catch (e) { toast(e.message, 'error'); }
}

async function loadHariEfektif() {
  const el = $('[data-he-bulan]');
  const bulan = el ? el.value : monthISO();
  try {
    S.hariEfektif = await api('getHariEfektif', { token: S.token, bulan });
    render();
  } catch (e) { toast(e.message, 'error'); }
}

async function loadPayroll() {
  const el = $('[data-payroll-bulan]');
  const bulan = el ? el.value : monthISO();
  showLoader();
  try {
    S.payrollBulan = bulan;
    S.payrollData = await api('rekapPayroll', { token: S.token, bulan });
    S.payrollHistory = await api('getPayrollHistory', { token: S.token, filter: {} });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

async function loadDashboardProfit() {
  const range = S.profitRange || 30;
  showLoader();
  try {
    const end = todayISO();
    const start = new Date(Date.now() - (range - 1) * 86400000).toISOString().slice(0, 10);
    const laporan = await api('getLaporan', { token: S.token, filter: { dari: start, sampai: end } });

    // Ambil setoran untuk breakdown per hari
    const setoran = await api('getSetoranList', { token: S.token, filter: { dari: start, sampai: end } });

    // Hitung profit per hari (omzet - HPP - pengeluaran lapak)
    const daily = [];
    const dateMap = {};
    setoran.forEach(s => {
      if (s.status !== 'approved' && s.status !== 'pending') return;
      if (!dateMap[s.tanggal]) dateMap[s.tanggal] = { tanggal: s.tanggal, omzet: 0, pengeluaran: 0 };
      dateMap[s.tanggal].omzet += s.totalSistem || 0;
      dateMap[s.tanggal].pengeluaran += s.pengeluaran || 0;
    });

    // HPP: pakai rata-rata margin dari laporan
    const totalOmzet = laporan.ringkasan.totalOmzet;
    const totalProfit = laporan.ringkasan.totalProfit;
    const avgMargin = totalOmzet > 0 ? (totalProfit / totalOmzet) : 0;

    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const info = dateMap[d] || { tanggal: d, omzet: 0, pengeluaran: 0 };
      const profit = Math.round((info.omzet * avgMargin) - info.pengeluaran);
      daily.push({ tanggal: d, omzet: info.omzet, profit });
    }

    S.dashboardProfit = {
      daily,
      totalOmzet: daily.reduce((s, d) => s + d.omzet, 0),
      totalProfit: daily.reduce((s, d) => s + d.profit, 0),
      avgProfit: Math.round(daily.reduce((s, d) => s + d.profit, 0) / daily.length)
    };
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

function showMoreMenu() {
  const items = [
    { id:'katalog',       label:'Katalog',      icon:'box' },
    { id:'suppliers',     label:'Supplier',     icon:'truck' },
    { id:'lapak',         label:'Lapak',        icon:'store' },
    { id:'distribusi',    label:'Drop Stok',    icon:'boxes' },
    { id:'kartu-stok',    label:'Kartu Stok',   icon:'boxes' },
    { id:'retur',         label:'Retur',        icon:'return' },
    { id:'harga-tingkat', label:'Harga Grosir', icon:'tag' },
    { id:'pesanan',       label:'Pesanan',      icon:'cart' },
    { id:'belanja',       label:'Belanja',      icon:'cart' },
    { id:'jadwal',        label:'Jadwal',       icon:'cal' },
    { id:'kasbon',        label:'Kasbon',       icon:'money' },
    // Fase 1
    { id:'absensi',       label:'Absensi',      icon:'clock' },
    { id:'absensi-hari-ini', label:'Absen Hari Ini', icon:'list' },
    { id:'bonus-antar',   label:'Bonus Antar',  icon:'truck' },
    { id:'setting-payroll', label:'Setting Payroll', icon:'settings' },
    { id:'payroll',       label:'Rekap Payroll', icon:'money' },
    { id:'dashboard-profit', label:'Dashboard Profit', icon:'trending' },
    // Lama
    { id:'setting-gaji',  label:'Setting Gaji Lama', icon:'settings' },
    { id:'gaji',          label:'Riwayat Gaji', icon:'money' },
    { id:'tutup-buku',    label:'Tutup Buku',   icon:'lock' },
    { id:'users',         label:'Users',        icon:'users' },
    { id:'profil',        label:'Profil',       icon:'user' }
  ];
  modal({
    title: 'Menu Lainnya',
    body: '<div class="grid-3">' + items.map(m => '<button class="menu-tile" data-m="' + m.id + '">' + ico(m.icon) + '<span>' + m.label + '</span></button>').join('') + '</div>',
    actions: [{ label: 'Tutup', onClick: c => c() }],
    onMount: (wrap, close) => {
      wrap.addEventListener('click', e => {
        const b = e.target.closest('[data-m]');
        if (b) { close(); switchTab(b.dataset.m); }
      });
    }
  });
}

async function doRefresh() {
  showLoader();
  try {
    if (S.user.role === 'admin') {
      const [dash, lapak, sup, kat, users] = await Promise.all([
        api('getAdminDashboard', { token: S.token }),
        api('getLapak', { token: S.token }),
        api('getSuppliers', { token: S.token }),
        api('getKatalog', { token: S.token }),
        api('getUsers', { token: S.token })
      ]);
      Object.assign(S, { dash, lapak, suppliers: sup, katalog: kat, users });
    } else {
      await reloadKaryawan();
    }
    toast('Data dimuat ulang', 'success');
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

// ============================================
//  ADMIN ACTIONS — SETORAN
// ============================================
async function applySetoranFilter() {
  const dari = ($('[data-filter-dari]') || {}).value || '';
  const sampai = ($('[data-filter-sampai]') || {}).value || '';
  const lapakId = ($('[data-filter-lapak]') || {}).value || '';
  const status = ($('[data-filter-status]') || {}).value || '';
  S._setoranFilter = { dari, sampai, lapakId, status };
  showLoader();
  try {
    S.setoran = await api('getSetoranList', { token: S.token, filter: S._setoranFilter });
    toast('Filter diterapkan', 'success');
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

async function doApprove(id) {
  const ok = await confirmDlg('Terima Setoran?', 'Uang akan masuk ke Kas Besar.', 'Terima');
  if (!ok) return;
  showLoader();
  try {
    const r = await api('approveSetoran', { token: S.token, id });
    if (!r.success) return toast(r.message, 'error');
    toast('Setoran diterima!', 'success');
    S.setoran = await api('getSetoranList', { token: S.token, filter: S._setoranFilter || {} });
    S.dash = await api('getAdminDashboard', { token: S.token });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

async function doReject(id) {
  const reason = await new Promise(resolve => {
    modal({
      title: 'Tolak Setoran',
      body: '<div class="field"><label>Alasan (opsional)</label><textarea data-reason class="textarea"></textarea></div>',
      actions: [
        { label: 'Batal', onClick: c => { c(); resolve(null); } },
        { label: 'Tolak', className: 'btn-danger', onClick: (c, w) => { const r = w.querySelector('[data-reason]').value; c(); resolve(r); } }
      ]
    });
  });
  if (reason === null) return;
  showLoader();
  try {
    const r = await api('rejectSetoran', { token: S.token, id, reason });
    if (!r.success) return toast(r.message, 'error');
    toast('Setoran ditolak.', 'info');
    S.setoran = await api('getSetoranList', { token: S.token, filter: S._setoranFilter || {} });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

async function showSetoranDetail(id) {
  showLoader();
  try {
    const d = await api('getSetoranDetail', { token: S.token, id });
    hideLoader();
    const itemsHtml = (d.items || []).length ? d.items.map(it =>
      '<div class="row-between" style="padding:6px 0;border-bottom:1px solid var(--gray-100);font-size:13px">' +
      '<div style="min-width:0;flex:1"><strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(it.nama) + '</strong>' +
      '<span class="text-xs text-gray">Drop ' + it.qtyDrop + ' · Sisa ' + it.qtySisa + ' · Laku ' + it.qtyLaku + '</span></div>' +
      '<strong class="text-green">' + fmtRp(it.subtotal) + '</strong></div>'
    ).join('') : '<p class="text-xs text-gray">Tidak ada item.</p>';
    const pengHtml = (d.pengeluaran || []).length ? d.pengeluaran.map(p =>
      '<div class="row-between" style="padding:4px 0;font-size:13px"><span>' + esc(p.keterangan) + '</span><span class="text-red">- ' + fmtRp(p.nominal) + '</span></div>'
    ).join('') : '<p class="text-xs text-gray">Tidak ada pengeluaran.</p>';
    modal({
      title: 'Detail Setoran',
      body: '<strong class="text-sm">Item Terjual</strong><div class="mb-3 mt-2">' + itemsHtml + '</div><strong class="text-sm">Pengeluaran</strong><div class="mt-2">' + pengHtml + '</div>',
      actions: [{ label: 'Tutup', onClick: c => c() }]
    });
  } catch (e) { hideLoader(); toast(e.message, 'error'); }
}

async function formEditSetoran(id) {
  const s = (S.setoran || []).find(x => x.id === id);
  if (!s) return toast('Setoran tidak ditemukan', 'error');
  if (s.locked) return toast('Setoran terkunci (tutup buku).', 'error');
  modal({
    title: 'Edit Setoran',
    body: `
      <p class="text-xs text-gray mb-3">Koreksi data. Perubahan tercatat di audit log.</p>
      <div class="field"><label>Total Tunai</label><input type="number" data-f="totalTunai" class="input" value="${s.totalTunai}"></div>
      <div class="field"><label>Total QRIS</label><input type="number" data-f="totalQris" class="input" value="${s.totalQris}"></div>
      <div class="field"><label>Pengeluaran</label><input type="number" data-f="pengeluaran" class="input" value="${s.pengeluaran}"></div>
      <div class="field"><label>Uang Disetor</label><input type="number" data-f="uangDisetor" class="input" value="${s.uangDisetor}"></div>
      <div class="field"><label>Catatan</label><textarea data-f="catatan" class="textarea">${esc(s.catatan || '')}</textarea></div>
    `,
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
        const get = k => w.querySelector('[data-f="' + k + '"]').value;
        const updates = {
          totalTunai: parseInt(get('totalTunai'), 10) || 0,
          totalQris: parseInt(get('totalQris'), 10) || 0,
          pengeluaran: parseInt(get('pengeluaran'), 10) || 0,
          uangDisetor: parseInt(get('uangDisetor'), 10) || 0,
          catatan: get('catatan')
        };
        c(); showLoader();
        try {
          const r = await api('editSetoran', { token: S.token, id, updates });
          toast(r.message, r.success ? 'success' : 'error');
          if (r.success) S.setoran = await api('getSetoranList', { token: S.token, filter: S._setoranFilter || {} });
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); render(); }
      } }
    ]
  });
}

async function showStruk(setoranId) {
  showLoader();
  try {
    const d = await api('getStrukData', { token: S.token, setoranId });
    hideLoader();
    if (!d.success) return toast(d.message, 'error');
    const strukHTML = `
      <div id="struk-print" style="font-family:monospace;font-size:12px;max-width:280px;margin:0 auto;padding:8px;background:#fff">
        <div style="text-align:center;margin-bottom:8px">
          <strong style="font-size:14px">KUE AS-SYIFA</strong>
          <div>${esc(d.lapakNama)}</div>
          <div>${esc(d.tanggal)}</div>
          <div>ID: ${esc(String(d.id).slice(0, 12))}</div>
        </div>
        <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:6px 0;margin:6px 0">
          ${d.items.map(it => `
            <div>${esc(it.nama)}</div>
            <div style="display:flex;justify-content:space-between"><span>${it.qty} x ${it.harga.toLocaleString('id-ID')}</span><span>${it.subtotal.toLocaleString('id-ID')}</span></div>
          `).join('')}
        </div>
        <div style="display:flex;justify-content:space-between"><span>Tunai:</span><span>${d.totalTunai.toLocaleString('id-ID')}</span></div>
        <div style="display:flex;justify-content:space-between"><span>QRIS:</span><span>${d.totalQris.toLocaleString('id-ID')}</span></div>
        <div style="border-top:1px solid #000;margin-top:4px;padding-top:4px;display:flex;justify-content:space-between"><strong>TOTAL:</strong><strong>${d.totalSistem.toLocaleString('id-ID')}</strong></div>
        <div style="text-align:center;margin-top:12px;font-size:10px">-- Terima Kasih --</div>
      </div>`;
    modal({
      title: 'Struk / Nota',
      body: strukHTML,
      actions: [
        { label: 'Tutup', onClick: c => c() },
        { label: '🖨️ Cetak', className: 'btn-primary', onClick: (c) => {
          const w = window.open('', '_blank');
          w.document.write('<html><head><title>Struk</title></head><body onload="window.print();window.close()">' + strukHTML + '</body></html>');
          w.document.close();
        } }
      ]
    });
  } catch (e) { hideLoader(); toast(e.message, 'error'); }
}

// ============================================
//  ADMIN ACTIONS — KAS
// ============================================
function formKas() {
  formModal({
    title: 'Transaksi Kas Manual',
    fields: [
      { key:'tipe', label:'Tipe', type:'select', options:[{v:'Masuk',l:'Masuk'},{v:'Keluar',l:'Keluar'}] },
      { key:'keterangan', label:'Keterangan', placeholder:'Contoh: Beli gas' },
      { key:'kategori', label:'Kategori', placeholder:'Opsional' },
      { key:'nominal', label:'Nominal (Rp)', type:'number' }
    ],
    onSubmit: async (data, c) => {
      c(); showLoader();
      try {
        const r = await api('addKas', { token: S.token, item: data });
        toast(r.message, r.success ? 'success' : 'error');
        S.dash = await api('getAdminDashboard', { token: S.token });
      } catch (e) { toast(e.message, 'error'); }
      finally { hideLoader(); render(); }
    }
  });
}

// ============================================
//  ADMIN ACTIONS — KATALOG / SUPPLIER / LAPAK
// ============================================
function formKatalog(id) {
  const item = id ? S.katalog.find(k => k.id === id) : null;
  formModal({
    title: item ? 'Edit Item' : 'Tambah Item',
    fields: [
      { key:'nama', label:'Nama', value: item ? item.nama : '' },
      { key:'supplierId', label:'Supplier', type:'select', value: item ? item.supplierId : '',
        options: [{v:'',l:'-- Pilih --'}].concat(S.suppliers.map(s => ({ v:s.id, l:s.nama, selected: item && item.supplierId === s.id }))) },
      { key:'kategori', label:'Kategori', value: item ? item.kategori : '', placeholder:'Opsional' },
      { key:'hargaBeli', label:'Harga Beli', type:'number', value: item ? item.hargaBeli : 0 },
      { key:'hargaJual', label:'Harga Jual', type:'number', value: item ? item.hargaJual : 0 },
      { key:'aktif', label:'Aktif', type:'checkbox', checked: !item || item.aktif }
    ],
    onSubmit: async (data, c) => {
      data.id = item ? item.id : null;
      c(); showLoader();
      try {
        const r = await api('saveKatalog', { token: S.token, item: data });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) S.katalog = await api('getKatalog', { token: S.token });
      } catch (e) { toast(e.message, 'error'); }
      finally { hideLoader(); render(); }
    }
  });
}
async function delKatalog(id) {
  if (!(await confirmDlg('Hapus item?', 'Akan dihapus permanen.'))) return;
  showLoader();
  try {
    const r = await api('deleteKatalog', { token: S.token, id });
    toast(r.message, r.success ? 'success' : 'error');
    if (r.success) S.katalog = await api('getKatalog', { token: S.token });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
function formSupplier(id) {
  const item = id ? S.suppliers.find(s => s.id === id) : null;
  formModal({
    title: item ? 'Edit Supplier' : 'Tambah Supplier',
    fields: [
      { key:'nama', label:'Nama', value: item ? item.nama : '' },
      { key:'kontak', label:'Kontak', value: item ? item.kontak : '' },
      { key:'jadwalPesan', label:'Jadwal Pesan', value: item ? item.jadwalPesan : '', placeholder:'mis: Senin,Kamis' },
      { key:'catatan', label:'Catatan', type:'textarea', value: item ? item.catatan : '' }
    ],
    onSubmit: async (data, c) => {
      data.id = item ? item.id : null;
      data.aktif = true;
      c(); showLoader();
      try {
        const r = await api('saveSupplier', { token: S.token, item: data });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) S.suppliers = await api('getSuppliers', { token: S.token });
      } catch (e) { toast(e.message, 'error'); }
      finally { hideLoader(); render(); }
    }
  });
}
async function delSupplier(id) {
  if (!(await confirmDlg('Hapus supplier?', ''))) return;
  showLoader();
  try {
    await api('deleteSupplier', { token: S.token, id });
    S.suppliers = await api('getSuppliers', { token: S.token });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
function formLapak(id) {
  const item = id ? S.lapak.find(l => l.id === id) : null;
  formModal({
    title: item ? 'Edit Lapak' : 'Tambah Lapak',
    fields: [
      { key:'nama', label:'Nama', value: item ? item.nama : '' },
      { key:'alamat', label:'Alamat', value: item ? item.alamat : '' },
      { key:'aktif', label:'Aktif', type:'checkbox', checked: !item || item.aktif }
    ],
    onSubmit: async (data, c) => {
      data.id = item ? item.id : null;
      c(); showLoader();
      try {
        const r = await api('saveLapak', { token: S.token, item: data });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) S.lapak = await api('getLapak', { token: S.token });
      } catch (e) { toast(e.message, 'error'); }
      finally { hideLoader(); render(); }
    }
  });
}
async function delLapak(id) {
  if (!(await confirmDlg('Hapus lapak?', ''))) return;
  showLoader();
  try {
    await api('deleteLapak', { token: S.token, id });
    S.lapak = await api('getLapak', { token: S.token });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

// ============================================
//  ADMIN ACTIONS — DISTRIBUSI / BELANJA / JADWAL
// ============================================
async function loadDistribusi() {
  const tanggal = $('[data-dist-tgl]').value;
  const lapakId = $('[data-dist-lapak]').value;
  S._distTanggal = tanggal; S._distLapakId = lapakId;
  showLoader();
  try {
    const list = await api('getDistribusiHariIni', { token: S.token, lapakId, tanggal });
    const items = {};
    list.forEach(d => items[d.katalogId] = d.qtyDrop);
    S._distItems = items;
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
async function saveDistribusi() {
  const tanggal = $('[data-dist-tgl]').value;
  const lapakId = $('[data-dist-lapak]').value;
  const items = [];
  $$('[data-dist-item]').forEach(inp => {
    const qty = parseInt(inp.value, 10) || 0;
    if (qty > 0) items.push({ katalogId: inp.dataset.distItem, qtyDrop: qty });
  });
  if (!items.length) return toast('Isi minimal 1 qty', 'error');
  showLoader();
  try {
    const r = await api('saveDistribusi', { token: S.token, lapakId, tanggal, items });
    toast(r.message, r.success ? 'success' : 'error');
    S._distItems = {};
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
function formBelanja(id) {
  const item = id ? S.belanja.find(b => b.id === id) : null;
  formModal({
    title: item ? 'Edit Belanja' : 'Tambah Belanja',
    fields: [
      { key:'item', label:'Nama Item', value: item ? item.item : '' },
      { key:'supplierId', label:'Supplier', type:'select', value: item ? item.supplierId : '',
        options: [{v:'',l:'-- Pilih --'}].concat(S.suppliers.map(s => ({ v:s.id, l:s.nama, selected: item && item.supplierId === s.id }))) },
      { key:'qty', label:'Qty', type:'number', value: item ? item.qty : 1 },
      { key:'estimasiHarga', label:'Estimasi Harga', type:'number', value: item ? item.estimasiHarga : 0 }
    ],
    onSubmit: async (data, c) => {
      data.id = item ? item.id : null;
      data.checked = item ? item.checked : false;
      c(); showLoader();
      try {
        const r = await api('saveBelanja', { token: S.token, item: data });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) S.belanja = await api('getBelanja', { token: S.token, filter: {} });
      } catch (e) { toast(e.message, 'error'); }
      finally { hideLoader(); render(); }
    }
  });
}
async function doCheckBelanja(id, checked, hargaAktual) {
  showLoader();
  try {
    const r = await api('checkBelanja', { token: S.token, id, checked, hargaAktual });
    toast(r.message, r.success ? 'success' : 'error');
    S.belanja = await api('getBelanja', { token: S.token, filter: {} });
    S.dash = await api('getAdminDashboard', { token: S.token });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
async function delBelanja(id) {
  if (!(await confirmDlg('Hapus item?', ''))) return;
  showLoader();
  try {
    await api('deleteBelanja', { token: S.token, id });
    S.belanja = await api('getBelanja', { token: S.token, filter: {} });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
function formJadwal(id) {
  const item = id ? S.jadwal.find(j => j.id === id) : null;
  formModal({
    title: item ? 'Edit Jadwal' : 'Tambah Jadwal',
    fields: [
      { key:'tanggal', label:'Tanggal', type:'date', value: item ? item.tanggal : todayISO() },
      { key:'supplierId', label:'Supplier', type:'select', value: item ? item.supplierId : '',
        options: [{v:'',l:'-- Pilih --'}].concat(S.suppliers.map(s => ({ v:s.id, l:s.nama, selected: item && item.supplierId === s.id }))) },
      { key:'tipe', label:'Tipe', type:'select', value: item ? item.tipe : 'Pesanan',
        options: ['Pesanan','Pembayaran','Meeting','Lain'].map(t => ({ v:t, l:t, selected: item && item.tipe === t })) },
      { key:'keterangan', label:'Keterangan', type:'textarea', value: item ? item.keterangan : '' }
    ],
    onSubmit: async (data, c) => {
      data.id = item ? item.id : null;
      data.done = item ? item.done : false;
      c(); showLoader();
      try {
        const r = await api('saveJadwal', { token: S.token, item: data });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) S.jadwal = await api('getJadwal', { token: S.token, days: 30 });
      } catch (e) { toast(e.message, 'error'); }
      finally { hideLoader(); render(); }
    }
  });
}
async function delJadwal(id) {
  if (!(await confirmDlg('Hapus jadwal?', ''))) return;
  showLoader();
  try {
    await api('deleteJadwal', { token: S.token, id });
    S.jadwal = await api('getJadwal', { token: S.token, days: 30 });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

// ============================================
//  ADMIN ACTIONS — KASBON
// ============================================
function formKasbon(isAdmin) {
  if (isAdmin) {
    const karyawans = S.users.filter(u => u.role === 'karyawan');
    if (!karyawans.length) return toast('Tidak ada karyawan', 'error');
    formModal({
      title: 'Tambah Kasbon',
      fields: [
        { key:'userId', label:'Karyawan', type:'select', options: karyawans.map(u => ({ v:u.id, l:u.name })) },
        { key:'tipe', label:'Tipe', type:'select', options: [{v:'Kasbon',l:'Kasbon (utang)'},{v:'Bayar',l:'Bayar (angsuran)'}] },
        { key:'nominal', label:'Nominal', type:'number' },
        { key:'keterangan', label:'Keterangan', type:'textarea' }
      ],
      onSubmit: async (data, c) => {
        c(); showLoader();
        try {
          await api('addKasbon', { token: S.token, payload: data });
          S.kasbon = await api('getKasbon', { token: S.token, filter: {} });
          toast('Kasbon dicatat', 'success');
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); render(); }
      }
    });
  } else {
    formModal({
      title: 'Ajukan Kasbon',
      fields: [
        { key:'nominal', label:'Nominal', type:'number' },
        { key:'keterangan', label:'Keterangan', type:'textarea' }
      ],
      onSubmit: async (data, c) => {
        if (data.nominal <= 0) return toast('Nominal > 0', 'error');
        c(); showLoader();
        try {
          await api('addKasbon', { token: S.token, payload: { nominal: data.nominal, keterangan: data.keterangan } });
          S.kasbon = await api('getKasbon', { token: S.token, filter: {} });
          toast('Kasbon diajukan', 'success');
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); render(); }
      }
    });
  }
}
async function adminRejectKasbon(id) {
  if (!(await confirmDlg('Tolak kasbon?', ''))) return;
  showLoader();
  try {
    await api('rejectKasbon', { token: S.token, id });
    S.kasbon = await api('getKasbon', { token: S.token, filter: {} });
    toast('Ditolak', 'success');
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
async function delKasbon(id) {
  if (!(await confirmDlg('Hapus kasbon?', ''))) return;
  showLoader();
  try {
    await api('deleteKasbon', { token: S.token, id });
    S.kasbon = await api('getKasbon', { token: S.token, filter: {} });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

// ============================================
//  ADMIN ACTIONS — SETTING GAJI LAMA
// ============================================
function formSettingGaji(id) {
  const item = id && S.settingGaji ? S.settingGaji.find(x => x.id === id) : null;
  const karyawans = S.users.filter(u => u.role === 'karyawan');
  if (!karyawans.length) return toast('Tidak ada karyawan', 'error');
  formModal({
    title: item ? 'Edit Setting Gaji' : 'Tambah Setting Gaji',
    fields: [
      { key:'userId', label:'Karyawan', type:'select', options: karyawans.map(u => ({ v:u.id, l:u.name, selected: item && item.userId === u.id })) },
      { key:'tipe', label:'Tipe', type:'select', options: ['Harian','Mingguan','Bulanan'].map(t => ({ v:t, l:t, selected: (item && item.tipe === t) || (!item && t === 'Bulanan') })) },
      { key:'nominal', label:'Nominal', type:'number', value: item ? item.nominal : 0 },
      { key:'berlakuDari', label:'Berlaku Dari', type:'date', value: item ? item.berlakuDari : todayISO() },
      { key:'aktif', label:'Aktif', type:'checkbox', checked: !item || item.aktif }
    ],
    onSubmit: async (data, c) => {
      data.id = item ? item.id : null;
      c(); showLoader();
      try {
        const r = await api('saveSettingGaji', { token: S.token, item: data });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) S.settingGaji = await api('getSettingGaji', { token: S.token });
      } catch (e) { toast(e.message, 'error'); }
      finally { hideLoader(); render(); }
    }
  });
}
async function loadRekapGaji() {
  showLoader();
  try {
    const dari = monthStartISO();
    const sampai = todayISO();
    S.rekapGaji = await api('rekapGaji', { token: S.token, filter: { tipe: 'Bulanan', dari, sampai } });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
async function doBayarGajiBulk() { return toast('Gunakan Rekap Payroll untuk bayar.', 'info'); }

// ============================================
//  ADMIN ACTIONS — PESANAN
// ============================================
function formPesanan(id) {
  const item = id && S.pesanan ? S.pesanan.find(p => p.id === id) : null;
  formModal({
    title: item ? 'Edit Pesanan' : 'Tambah Pesanan',
    fields: [
      { key:'tanggal', label:'Tanggal', type:'date', value: item ? item.tanggal : todayISO() },
      { key:'supplierId', label:'Supplier', type:'select', value: item ? item.supplierId : '',
        options: [{v:'',l:'-- Pilih --'}].concat(S.suppliers.map(s => ({ v:s.id, l:s.nama, selected: item && item.supplierId === s.id }))) },
      { key:'item', label:'Item', value: item ? item.item : '' },
      { key:'qty', label:'Qty', type:'number', value: item ? item.qty : 1 },
      { key:'hargaSatuan', label:'Harga Satuan', type:'number', value: item ? item.hargaSatuan : 0 },
      { key:'status', label:'Status', type:'select', value: item ? item.status : 'Draft',
        options: ['Draft','Ordered','Received','Cancelled'].map(s => ({ v:s, l:s, selected: item && item.status === s })) },
      { key:'keterangan', label:'Keterangan', type:'textarea', value: item ? item.keterangan : '' }
    ],
    onSubmit: async (data, c) => {
      data.id = item ? item.id : null;
      c(); showLoader();
      try {
        const r = await api('savePesanan', { token: S.token, item: data });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) S.pesanan = await api('getPesanan', { token: S.token, filter: {} });
      } catch (e) { toast(e.message, 'error'); }
      finally { hideLoader(); render(); }
    }
  });
}
async function delPesanan(id) {
  if (!(await confirmDlg('Hapus pesanan?', ''))) return;
  showLoader();
  try {
    await api('deletePesanan', { token: S.token, id });
    S.pesanan = await api('getPesanan', { token: S.token, filter: {} });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
async function loadRekapPesanan() { return toast('Rekap pesanan otomatis dihitung.', 'info'); }

// ============================================
//  ADMIN ACTIONS — USERS
// ============================================
function formUser(id) {
  const item = id ? S.users.find(u => u.id === id) : null;
  formModal({
    title: item ? 'Edit User' : 'Tambah User',
    fields: [
      { key:'name', label:'Nama', value: item ? item.name : '' },
      { key:'username', label:'Username', value: item ? item.username : '' },
      { key:'password', label: 'Password ' + (item ? '(kosongkan jika tidak diubah)' : '(min 6)'), type:'password' },
      { key:'role', label:'Role', type:'select', value: item ? item.role : 'karyawan',
        options: [{v:'karyawan',l:'Karyawan',selected: item && item.role === 'karyawan'},{v:'admin',l:'Admin',selected: item && item.role === 'admin'}] },
      { key:'lapakId', label:'Lapak Utama', type:'select', value: item ? item.lapakId : '',
        options: [{v:'',l:'--'}].concat(S.lapak.map(l => ({ v:l.id, l:l.nama, selected: item && item.lapakId === l.id }))) },
      { key:'lapakIds', label:'Akses Lapak (pisahkan koma)', value: item ? item.lapakIds : '', placeholder:'L01,L02' },
      { key:'aktif', label:'Aktif', type:'checkbox', checked: !item || item.aktif }
    ],
    onSubmit: async (data, c) => {
      data.id = item ? item.id : null;
      if (!data.password) data.password = undefined;
      c(); showLoader();
      try {
        const r = await api('saveUser', { token: S.token, item: data });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) S.users = await api('getUsers', { token: S.token });
      } catch (e) { toast(e.message, 'error'); }
      finally { hideLoader(); render(); }
    }
  });
}
async function delUser(id) {
  if (!(await confirmDlg('Hapus user?', ''))) return;
  showLoader();
  try {
    await api('deleteUser', { token: S.token, id });
    S.users = await api('getUsers', { token: S.token });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
async function resetUserPwd(id) {
  const u = S.users.find(x => x.id === id);
  if (!u) return;
  const ok = await confirmDlg('Reset Password?', 'Password ' + u.name + ' akan direset ke "kue1234".', 'Reset');
  if (!ok) return;
  showLoader();
  try {
    const r = await api('adminResetPassword', { token: S.token, userId: id });
    toast(r.message, r.success ? 'success' : 'error');
    if (r.success) S.users = await api('getUsers', { token: S.token });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

// ============================================
//  ADMIN ACTIONS — RETUR / HARGA / TUTUP BUKU
// ============================================
function formReturKaryawan() {
  const dist = (S.karyawan && S.karyawan.distribusi) || [];
  if (!dist.length) return toast('Tidak ada distribusi hari ini', 'error');
  modal({
    title: 'Ajukan Retur',
    body: `<p class="text-sm text-gray mb-3">Masukkan jumlah yang perlu diretur:</p>
      ${dist.map(it => `
        <div class="card" style="padding:10px;margin-bottom:8px" data-retur-item="${esc(it.katalogId)}">
          <strong class="text-sm">${esc(it.nama)}</strong>
          <div class="row mt-2" style="gap:6px">
            <input type="number" min="0" max="${it.qtyDrop}" value="0" data-r-qty placeholder="Qty" class="input field-sm" style="flex:1">
            <select data-r-kondisi class="select field-sm" style="flex:1">
              <option value="Layak">Layak</option>
              <option value="Buang">Buang</option>
            </select>
          </div>
        </div>`).join('')}`,
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Ajukan', className: 'btn-primary', onClick: async (c, w) => {
        const items = [];
        w.querySelectorAll('[data-retur-item]').forEach(el => {
          const katalogId = el.dataset.returItem;
          const qty = parseInt(el.querySelector('[data-r-qty]').value, 10) || 0;
          const kondisi = el.querySelector('[data-r-kondisi]').value;
          if (qty > 0) items.push({ katalogId, qty, kondisi });
        });
        if (!items.length) return toast('Isi minimal 1 item', 'error');
        c(); showLoader();
        try {
          const r = await api('submitRetur', { token: S.token, payload: { items } });
          toast(r.message, r.success ? 'success' : 'error');
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); }
      } }
    ]
  });
}
async function approveRetur(id) {
  const lapaks = (S.lapak || []).filter(l => l.aktif);
  modal({
    title: 'Setujui Retur',
    body: '<p class="text-sm text-gray mb-3">Kirim ke lapak mana?</p>' +
      '<div class="field"><label>Kirim ke</label><select data-f="tujuan" class="select"><option value="">-- Tetap di lapak asal --</option>' +
      lapaks.map(l => `<option value="${esc(l.id)}">${esc(l.nama)}</option>`).join('') + '</select></div>',
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Setujui', className: 'btn-success', onClick: async (c, w) => {
        const tujuan = w.querySelector('[data-f="tujuan"]').value;
        c(); showLoader();
        try {
          const r = await api('approveRetur', { token: S.token, id, tujuanLapakId: tujuan });
          toast(r.message, r.success ? 'success' : 'error');
          if (r.success) S.retur = await api('getReturList', { token: S.token, filter: {} });
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); render(); }
      } }
    ]
  });
}
async function rejectRetur(id) {
  if (!(await confirmDlg('Tolak retur ini?', ''))) return;
  showLoader();
  try {
    await api('rejectRetur', { token: S.token, id, reason: '' });
    S.retur = await api('getReturList', { token: S.token, filter: {} });
    toast('Retur ditolak', 'success');
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
function formHargaTingkat(id) {
  const item = id && S.hargaTingkat ? S.hargaTingkat.find(x => x.id === id) : null;
  if (!S.katalog.length) return toast('Katalog kosong', 'error');
  formModal({
    title: item ? 'Edit Harga' : 'Tambah Harga Tingkat',
    fields: [
      { key:'katalogId', label:'Item', type:'select', value: item ? item.katalogId : '',
        options: S.katalog.map(k => ({ v:k.id, l:k.nama, selected: item && item.katalogId === k.id })) },
      { key:'tipePelanggan', label:'Tipe Pelanggan', type:'select', value: item ? item.tipePelanggan : 'Umum',
        options: ['Umum','Reseller','Grosir'].map(t => ({ v:t, l:t, selected: item && item.tipePelanggan === t })) },
      { key:'minimalQty', label:'Minimal Qty', type:'number', value: item ? item.minimalQty : 1 },
      { key:'hargaJual', label:'Harga Jual', type:'number', value: item ? item.hargaJual : 0 },
      { key:'aktif', label:'Aktif', type:'checkbox', checked: !item || item.aktif }
    ],
    onSubmit: async (data, c) => {
      data.id = item ? item.id : null;
      c(); showLoader();
      try {
        const r = await api('saveHargaTingkat', { token: S.token, item: data });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) S.hargaTingkat = await api('getHargaTingkat', { token: S.token });
      } catch (e) { toast(e.message, 'error'); }
      finally { hideLoader(); render(); }
    }
  });
}
async function delHargaTingkat(id) {
  if (!(await confirmDlg('Hapus harga khusus?', ''))) return;
  showLoader();
  try {
    await api('deleteHargaTingkat', { token: S.token, id });
    S.hargaTingkat = await api('getHargaTingkat', { token: S.token });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
function formTutupBuku() {
  modal({
    title: 'Kunci Periode',
    body: `<p class="text-xs text-gray mb-3">Setoran dalam rentang ini tidak bisa diedit lagi.</p>
      <div class="field"><label>Dari</label><input type="date" data-f="dari" class="input" value="${monthStartISO()}"></div>
      <div class="field"><label>Sampai</label><input type="date" data-f="sampai" class="input" value="${todayISO()}"></div>
      <div class="field"><label>Catatan</label><textarea data-f="catatan" class="textarea" placeholder="Opsional"></textarea></div>`,
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Kunci', className: 'btn-danger', onClick: async (c, w) => {
        const dari = w.querySelector('[data-f="dari"]').value;
        const sampai = w.querySelector('[data-f="sampai"]').value;
        const catatan = w.querySelector('[data-f="catatan"]').value;
        if (!dari || !sampai) return toast('Isi periode', 'error');
        c(); showLoader();
        try {
          const r = await api('lockPeriode', { token: S.token, payload: { dari, sampai, catatan } });
          toast(r.message, r.success ? 'success' : 'error');
          if (r.success) {
            S.tutupBuku = await api('getTutupBukuList', { token: S.token });
            S.setoran = await api('getSetoranList', { token: S.token, filter: S._setoranFilter || {} });
          }
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); render(); }
      } }
    ]
  });
}
async function unlockPeriode(id) {
  const ok = await confirmDlg('Buka Kunci Periode?', 'Setoran dalam rentang ini bisa diedit lagi.', 'Buka');
  if (!ok) return;
  showLoader();
  try {
    const r = await api('unlockPeriode', { token: S.token, id });
    toast(r.message, r.success ? 'success' : 'error');
    if (r.success) {
      S.tutupBuku = await api('getTutupBukuList', { token: S.token });
      S.setoran = await api('getSetoranList', { token: S.token, filter: S._setoranFilter || {} });
    }
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

// ============================================
//  ADMIN ACTIONS — NOTIFIKASI / LAPORAN / PROFIL
// ============================================
async function markNotifRead(id) {
  try {
    await api('markNotifRead', { token: S.token, id });
    S.notifikasi = await api('getNotifikasi', { token: S.token, filter: {} });
    S.dash = await api('getAdminDashboard', { token: S.token });
    render();
  } catch (e) { toast(e.message, 'error'); }
}
async function testNotif() {
  showLoader();
  try {
    const r = await api('testNotifikasi', { token: S.token });
    toast(r.message, 'info');
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
}
async function loadLaporan() {
  const dari = ($('[data-lap-dari]') || {}).value;
  const sampai = ($('[data-lap-sampai]') || {}).value;
  showLoader();
  try {
    S.laporan = await api('getLaporan', { token: S.token, filter: { dari, sampai } });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
async function doExportCSV() {
  showLoader();
  try {
    const r = await api('exportSetoranCSV', { token: S.token });
    if (!r.success) throw new Error('Gagal');
    const blob = new Blob([r.content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = r.filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast('File diunduh', 'success');
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
}
function formChangePwd() {
  modal({
    title: 'Ganti Password',
    body: '<div class="field"><label>Password Lama</label><input type="password" data-f="old" class="input"></div>' +
      '<div class="field"><label>Password Baru (min 6)</label><input type="password" data-f="new" class="input"></div>' +
      '<div class="field"><label>Konfirmasi</label><input type="password" data-f="conf" class="input"></div>',
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
        const get = s => w.querySelector('[data-f="' + s + '"]').value;
        if (get('new') !== get('conf')) return toast('Konfirmasi tidak cocok', 'error');
        if (get('new').length < 6) return toast('Minimal 6 karakter', 'error');
        const oldP = get('old'), newP = get('new');
        c(); showLoader();
        try {
          const r = await api('changePassword', { token: S.token, oldPwd: oldP, newPwd: newP });
          toast(r.message, r.success ? 'success' : 'error');
          if (r.success) setTimeout(() => sessionExpired(), 1200);
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); }
      } }
    ]
  });
}
async function doBackupAll() {
  if (!(await confirmDlg('Download Backup?', 'Semua sheet akan di-download dalam 1 file JSON.', 'Download'))) return;
  showLoader();
  try {
    const r = await api('backupAll', { token: S.token });
    if (!r.success) throw new Error('Gagal');
    const blob = new Blob([r.data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = r.filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast('Backup diunduh', 'success');
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
}
function formRestore() {
  modal({
    title: 'Restore dari Backup',
    body: `<p class="text-xs text-gray mb-3">Pilih file JSON backup.</p>
      <div class="field"><label>Mode</label>
        <select data-mode class="select">
          <option value="replace">Replace (ganti semua)</option>
          <option value="merge">Merge (tambahkan)</option>
        </select>
      </div>
      <div class="field"><label>File JSON</label><input type="file" accept=".json" data-file class="input"></div>
      <div class="alert alert-warn text-xs">${ico('lock','ico-sm')} Restore tidak bisa dibatalkan.</div>`,
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Restore', className: 'btn-danger', onClick: async (c, w) => {
        const file = w.querySelector('[data-file]').files[0];
        const mode = w.querySelector('[data-mode]').value;
        if (!file) return toast('Pilih file dulu', 'error');
        const ok = await confirmDlg('Konfirmasi Restore', 'Data akan di-' + mode + '. Lanjutkan?', 'Restore');
        if (!ok) return;
        const text = await file.text();
        c(); showLoader();
        try {
          const r = await api('restoreAll', { token: S.token, data: text, mode });
          toast(r.message, r.success ? 'success' : 'error');
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); }
      } }
    ]
  });
}

// ============================================
//  FASE 1 — ABSENSI ADMIN
// ============================================
async function loadAbsensi() {
  const bulanEl = $('[data-abs-bulan]');
  const lapakEl = $('[data-abs-lapak]');
  const bulan = bulanEl ? bulanEl.value : monthISO();
  const lapakId = lapakEl ? lapakEl.value : '';
  S.absensiFilter = { bulan, lapakId };
  showLoader();
  try {
    S.absensiList = await api('getAbsensiKaryawan', { token: S.token, filter: { bulan, lapakId } });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

function formIsiAbsensi(userId) {
  const karyawans = S.users.filter(u => u.role === 'karyawan');
  if (!karyawans.length) return toast('Tidak ada karyawan', 'error');
  const defaultUserId = userId || karyawans[0].id;
  const lapakOptions = S.lapak.map(l => ({ v:l.id, l:l.nama }));
  modal({
    title: 'Isi Absensi Manual',
    body: `
      <p class="text-xs text-gray mb-3">Untuk karyawan yang lupa absen.</p>
      <div class="field"><label>Karyawan</label>
        <select data-f="userId" class="select">
          ${karyawans.map(u => `<option value="${esc(u.id)}" ${u.id === defaultUserId ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Tanggal</label><input type="date" data-f="tanggal" class="input" value="${todayISO()}"></div>
      <div class="field"><label>Lapak</label>
        <select data-f="lapakId" class="select">
          ${lapakOptions.map(l => `<option value="${esc(l.v)}">${esc(l.l)}</option>`).join('')}
        </select>
      </div>
      <div class="form-grid">
        <div class="field"><label>Jam Masuk</label><input type="time" data-f="jamMasuk" class="input" value="05:00"></div>
        <div class="field"><label>Jam Keluar</label><input type="time" data-f="jamKeluar" class="input" value="10:00"></div>
      </div>
      <div class="field"><label>Status</label>
        <select data-f="status" class="select">
          <option value="Hadir">Hadir</option>
          <option value="SetengahHari">Setengah Hari</option>
          <option value="Izin">Izin</option>
          <option value="Sakit">Sakit</option>
        </select>
      </div>
      <div class="field"><label>Catatan</label><textarea data-f="catatan" class="textarea" placeholder="Opsional"></textarea></div>
    `,
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
        const get = s => w.querySelector('[data-f="' + s + '"]').value;
        const payload = {
          userId: get('userId'),
          tanggal: get('tanggal'),
          lapakId: get('lapakId'),
          jamMasuk: get('jamMasuk'),
          jamKeluar: get('jamKeluar'),
          status: get('status'),
          catatan: get('catatan')
        };
        c(); showLoader();
        try {
          const r = await api('isiAbsensiOrangLain', { token: S.token, payload });
          toast(r.message, r.success ? 'success' : 'error');
          await loadAbsensi();
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); render(); }
      } }
    ]
  });
}

function formEditAbsensi(id) {
  const a = (S.absensiList || []).find(x => x.id === id);
  if (!a) return toast('Absensi tidak ditemukan', 'error');
  modal({
    title: 'Edit Absensi',
    body: `
      <div class="field"><label>Karyawan</label><strong>${esc(a.userName)}</strong></div>
      <div class="field"><label>Tanggal</label><strong>${esc(a.tanggal)}</strong></div>
      <div class="field"><label>Lapak</label>
        <select data-f="lapakId" class="select">
          ${S.lapak.map(l => `<option value="${esc(l.id)}" ${l.id === a.lapakId ? 'selected' : ''}>${esc(l.nama)}</option>`).join('')}
        </select>
      </div>
      <div class="form-grid">
        <div class="field"><label>Jam Masuk</label><input type="time" data-f="jamMasuk" class="input" value="${a.jamMasuk || ''}"></div>
        <div class="field"><label>Jam Keluar</label><input type="time" data-f="jamKeluar" class="input" value="${a.jamKeluar || ''}"></div>
      </div>
      <div class="field"><label>Status</label>
        <select data-f="status" class="select">
          ${['Hadir','SetengahHari','Izin','Sakit'].map(s => `<option value="${s}" ${a.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Catatan</label><textarea data-f="catatan" class="textarea">${esc(a.catatan || '')}</textarea></div>
    `,
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
        const get = s => w.querySelector('[data-f="' + s + '"]').value;
        const updates = {
          lapakId: get('lapakId'),
          jamMasuk: get('jamMasuk'),
          jamKeluar: get('jamKeluar'),
          status: get('status'),
          catatan: get('catatan')
        };
        c(); showLoader();
        try {
          const r = await api('editAbsensi', { token: S.token, id, updates });
          toast(r.message, r.success ? 'success' : 'error');
          if (r.success) await loadAbsensi();
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); render(); }
      } }
    ]
  });
}

async function delAbsensi(id) {
  if (!(await confirmDlg('Hapus absensi ini?', ''))) return;
  showLoader();
  try {
    await api('deleteAbsensi', { token: S.token, id });
    await loadAbsensi();
    toast('Dihapus', 'success');
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

async function lihatDetailAbsensiUser(userId) {
  const bulan = (S.absensiFilter || {}).bulan || monthISO();
  showLoader();
  try {
    const list = await api('getAbsensiKaryawan', { token: S.token, filter: { bulan, userId } });
    hideLoader();
    const user = S.users.find(u => String(u.id) === String(userId));
    modal({
      title: 'Absensi ' + (user ? user.name : ''),
      body: list.length ? list.map(a => `
        <div class="absensi-row">
          <div class="info">
            <div class="name">${esc(a.tanggal)}</div>
            <div class="meta">${esc(a.lapakNama)} · ${esc(a.status)}</div>
          </div>
          <div class="time"><strong>${esc(a.jamMasuk || '-')}</strong> → <strong>${esc(a.jamKeluar || '...')}</strong></div>
        </div>`).join('') : '<p class="text-xs text-gray">Tidak ada data.</p>',
      actions: [{ label: 'Tutup', onClick: c => c() }]
    });
  } catch (e) { hideLoader(); toast(e.message, 'error'); }
}

// ============================================
//  FASE 1 — BONUS ANTAR ADMIN
// ============================================
function formBonusAntar(id) {
  const item = id && S.bonusAntar ? S.bonusAntar.find(x => x.id === id) : null;
  const karyawans = S.users.filter(u => u.role === 'karyawan');
  if (!karyawans.length) return toast('Tidak ada karyawan', 'error');
  formModal({
    title: item ? 'Edit Bonus Antar' : 'Tambah Bonus Antar',
    fields: [
      { key:'tanggal', label:'Tanggal', type:'date', value: item ? item.tanggal : todayISO() },
      { key:'userId', label:'Karyawan', type:'select', options: karyawans.map(u => ({ v:u.id, l:u.name, selected: item && item.userId === u.id })) },
      { key:'tujuan', label:'Tujuan', value: item ? item.tujuan : '', placeholder:'Contoh: Jl. Merdeka 5' },
      { key:'jarakKm', label:'Jarak (km)', type:'number', value: item ? item.jarakKm : 0 },
      { key:'qty', label:'Jumlah Item', type:'number', value: item ? item.qty : 0 },
      { key:'nominal', label:'Nominal Bonus (Rp)', type:'number', value: item ? item.nominal : 0 },
      { key:'keterangan', label:'Keterangan', type:'textarea', value: item ? item.keterangan : '' }
    ],
    onSubmit: async (data, c) => {
      data.id = item ? item.id : null;
      c(); showLoader();
      try {
        const r = await api('saveBonusAntar', { token: S.token, item: data });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) await loadBonusAntar();
      } catch (e) { toast(e.message, 'error'); }
      finally { hideLoader(); render(); }
    }
  });
}
async function delBonusAntar(id) {
  if (!(await confirmDlg('Hapus bonus ini?', ''))) return;
  showLoader();
  try {
    await api('deleteBonusAntar', { token: S.token, id });
    await loadBonusAntar();
    toast('Dihapus', 'success');
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

// ============================================
//  FASE 1 — SETTING PAYROLL
// ============================================
function formSettingPayroll(id) {
  const item = id && S.settingPayroll ? S.settingPayroll.find(x => x.id === id) : null;
  formModal({
    title: item ? 'Edit Setting Payroll' : 'Tambah Setting Payroll',
    fields: [
      { key:'lapakId', label:'Lapak', type:'select', value: item ? item.lapakId : '',
        options: S.lapak.map(l => ({ v:l.id, l:l.nama, selected: item && item.lapakId === l.id })) },
      { key:'bonusMerekap', label:'Bonus Merekap (Rp)', type:'number', value: item ? item.bonusMerekap : 0 },
      { key:'tunjanganLapak', label:'Tunjangan Lapak (Rp)', type:'number', value: item ? item.tunjanganLapak : 0 },
      { key:'berlakuDari', label:'Berlaku Dari', type:'date', value: item ? item.berlakuDari : todayISO() },
      { key:'aktif', label:'Aktif', type:'checkbox', checked: !item || item.aktif }
    ],
    onSubmit: async (data, c) => {
      data.id = item ? item.id : null;
      c(); showLoader();
      try {
        const r = await api('saveSettingPayroll', { token: S.token, item: data });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) S.settingPayroll = await api('getSettingPayroll', { token: S.token });
      } catch (e) { toast(e.message, 'error'); }
      finally { hideLoader(); render(); }
    }
  });
}
async function delSettingPayroll(id) {
  if (!(await confirmDlg('Hapus setting ini?', ''))) return;
  showLoader();
  try {
    await api('deleteSettingPayroll', { token: S.token, id });
    S.settingPayroll = await api('getSettingPayroll', { token: S.token });
    toast('Dihapus', 'success');
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
async function autoHariEfektif(bulan) {
  showLoader();
  try {
    const r = await api('autoHariEfektif', { token: S.token, bulan });
    if (!r.success) { toast(r.message, 'error'); return; }
    // Simpan tiap lapak
    for (const item of r.list) {
      await api('saveHariEfektif', { token: S.token, item: { bulan, lapakId: item.lapakId, jumlahHari: item.jumlahHari, catatan: 'Auto-hitung' } });
    }
    S.hariEfektif = await api('getHariEfektif', { token: S.token, bulan });
    toast('Hari efektif dihitung dari absensi', 'success');
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
function formEditHariEfektif(dataset) {
  const bulan = dataset.bulan;
  const lapakId = dataset.lapak;
  const hari = dataset.hari;
  modal({
    title: 'Edit Hari Efektif',
    body: `
      <div class="field"><label>Bulan</label><strong>${esc(bulanLabel(bulan))}</strong></div>
      <div class="field"><label>Lapak</label><strong>${esc(lapakId)}</strong></div>
      <div class="field"><label>Jumlah Hari Efektif</label><input type="number" data-f="hari" class="input" value="${hari}"></div>
      <div class="field"><label>Catatan</label><input type="text" data-f="catatan" class="input" placeholder="Opsional"></div>
    `,
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
        const jumlahHari = parseInt(w.querySelector('[data-f="hari"]').value, 10) || 0;
        const catatan = w.querySelector('[data-f="catatan"]').value;
        c(); showLoader();
        try {
          await api('saveHariEfektif', { token: S.token, item: { bulan, lapakId, jumlahHari, catatan } });
          S.hariEfektif = await api('getHariEfektif', { token: S.token, bulan });
          toast('Tersimpan', 'success');
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); render(); }
      } }
    ]
  });
}

// ============================================
//  FASE 1 — PAYROLL
// ============================================
async function bayarPayrollBulk() {
  const checks = $$('[data-payroll-pick]:checked');
  if (!checks.length) return toast('Pilih minimal 1 karyawan', 'error');
  const userIds = checks.map(c => c.dataset.userid);
  const total = checks.reduce((s, c) => s + (parseInt(c.dataset.total, 10) || 0), 0);
  const bulan = S.payrollBulan || monthISO();
  const ok = await confirmDlg('Bayar Payroll?', userIds.length + ' karyawan · Total ' + fmtRp(total), 'Bayar');
  if (!ok) return;
  showLoader();
  try {
    const r = await api('bayarPayrollBulk', { token: S.token, bulan, userIds });
    toast(r.message, r.success ? 'success' : 'error');
    if (r.success) {
      S.payrollData = await api('rekapPayroll', { token: S.token, bulan });
      S.payrollHistory = await api('getPayrollHistory', { token: S.token, filter: {} });
      S.kasbon = await api('getKasbon', { token: S.token, filter: {} });
      S.dash = await api('getAdminDashboard', { token: S.token });
    }
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

// ============================================
//  BOOT
// ============================================
(function boot() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryAutoLogin);
  } else {
    tryAutoLogin();
  }
})();
