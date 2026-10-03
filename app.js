'use strict';
/* Kue As-Syifa POS v5.6 — Frontend + OneSignal Web Push */

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
  setoran: null, kas: null, pesanan: null, settingGaji: null, rekapGaji: null,
  kartuStok: null, stokSaldo: null, retur: null, hargaTingkat: null,
  tutupBuku: null, notifikasi: null,
  absensiList: null, absensiFilter: {},
  bonusAntar: null, bonusFilter: {},
  settingPayroll: null, hariEfektif: null,
  payrollBulan: null, payrollData: null, payrollHistory: null,
  dashboardProfit: null, profitRange: 30,
  absensiHariIni: null,
  konsinyasi: null, saldoSupplier: null, konsinyasiFilter: {},
  riwayatBayarSupplier: null,
  templateBox: null,
  pesananPelanggan: null, pesananFilter: {},
  pesananPelangganDetail: null,
  kalenderBulan: null, kalenderData: null,
  analytics: null, analyticsRange: 30,
  rekap: {},
  _setoranFilter: {},
  _distTanggal: null, _distLapakId: null, _distItems: {}
};

const MEM = {
  data: {},
  set(k, v, ttlMs = 60000) { this.data[k] = { v, exp: Date.now() + ttlMs }; },
  get(k) { const o = this.data[k]; if (!o) return null; if (Date.now() > o.exp) { delete this.data[k]; return null; } return o.v; },
  clear(p) { if (!p) { this.data = {}; return; } Object.keys(this.data).filter(k => k.startsWith(p)).forEach(k => delete this.data[k]); }
};

// ============================================
//  UTILS
// ============================================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

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

const fmtDateShort = (d) => {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
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

// ============================================
//  API CLIENT
// ============================================
async function api(action, payload = {}) {
  if (!API || API.indexOf('PASTE_') !== -1) throw new Error('API_URL belum diset di config.js');
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

async function apiCached(action, payload, key, ttlMs) {
  if (key) { const c = MEM.get(key); if (c) return c; }
  const data = await api(action, payload);
  if (key) MEM.set(key, data, ttlMs || 60000);
  return data;
}

// ============================================
//  UI HELPERS
// ============================================
let loaderCount = 0;
function showLoader() { loaderCount++; const e = $('#loader'); if (e) e.classList.remove('hide'); }
function hideLoader() { loaderCount = Math.max(0, loaderCount - 1); if (loaderCount === 0) { const e = $('#loader'); if (e) e.classList.add('hide'); } }

// ============================================
//  ONESIGNAL WEB PUSH
// ============================================
let __oneSignalReady = false;

async function waitOneSignal(timeoutMs = 10000) {
  if (__oneSignalReady && window.OneSignal) return window.OneSignal;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.OneSignal && typeof window.OneSignal.init === 'function') {
      __oneSignalReady = true;
      return window.OneSignal;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  console.warn('[OneSignal] SDK tidak siap dalam ' + timeoutMs + 'ms');
  return null;
}

async function setupOneSignalForUser() {
  try {
    const OneSignal = await waitOneSignal();
    if (!OneSignal) return false;

    const permission = OneSignal.Notifications.permission;
    console.log('[OneSignal] Status izin:', permission);

    if (permission === 'granted') {
      console.log('[OneSignal] Izin sudah diberikan');
      return true;
    }

    console.log('[OneSignal] Meminta izin...');
    const granted = await OneSignal.Notifications.requestPermission();
    if (granted) {
      toast('Notifikasi browser aktif', 'success');
      console.log('[OneSignal] Izin diberikan');
      return true;
    } else {
      console.log('[OneSignal] Izin ditolak');
      return false;
    }
  } catch (e) {
    console.error('[OneSignal] Setup error:', e);
    return false;
  }
}

async function setOneSignalUser(userId) {
  try {
    const OneSignal = await waitOneSignal();
    if (!OneSignal) return;
    await OneSignal.login(String(userId));
    console.log('[OneSignal] User login:', userId);
  } catch (e) {
    console.warn('[OneSignal] Gagal set user ID:', e);
  }
}

async function logoutOneSignal() {
  try {
    const OneSignal = await waitOneSignal(3000);
    if (!OneSignal) return;
    await OneSignal.logout();
    console.log('[OneSignal] User logout');
  } catch (e) {
    console.warn('[OneSignal] Logout error:', e);
  }
}

async function testBrowserNotif() {
  const ok = await setupOneSignalForUser();
  if (!ok) {
    toast('Izin notifikasi ditolak. Cek pengaturan browser.', 'error');
    return;
  }
  // Notifikasi test lokal
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('🔔 Test Notifikasi Berhasil', {
        body: 'Notifikasi browser sudah aktif! Anda akan menerima update dari Kue As-Syifa.',
        icon: 'https://dhanmarsjacka33-cmd.github.io/lapak-kue-assyifa/icon-192.png'
      });
      toast('Test notifikasi dikirim!', 'success');
    } catch (e) {
      console.error('Gagal tampilkan notif lokal:', e);
      toast('Gagal tampilkan notifikasi', 'error');
    }
  }
}

// ============================================
//  TOAST / MODAL
// ============================================
function toast(msg, type = 'success') {
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.innerHTML = ico(type === 'success' ? 'check' : type === 'error' ? 'x' : 'inbox') + '<span></span>';
  el.querySelector('span').textContent = String(msg || '');
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 280); }, 3000);
}

function modal({ title, body, actions = [], onMount }) {
  const root = $('#modals');
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <h3>${esc(title)}</h3>
        <button class="modal-close" data-close>${ico('x','ico-sm')}</button>
      </div>
      <div data-body>${body || ''}</div>
      <div class="modal-actions" data-actions></div>
    </div>`;
  const ab = bg.querySelector('[data-actions]');
  actions.forEach(a => {
    const b = document.createElement('button');
    b.className = 'btn ' + (a.className || 'btn-ghost');
    b.textContent = a.label;
    b.onclick = () => a.onClick ? a.onClick(close, bg) : close();
    ab.appendChild(b);
  });
  function close() { bg.style.animation = 'fadeIn .15s reverse'; setTimeout(() => bg.remove(), 100); }
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
    if (f.type === 'radio') {
      return `<div class="field"><label>${esc(f.label)}</label>
        <div class="row" style="gap:16px;margin-top:6px;flex-wrap:wrap">
          ${(f.options || []).map(o => `
            <label class="row text-sm" style="cursor:pointer;gap:6px">
              <input type="radio" name="__r_${f.key}" value="${esc(o.v)}" ${o.selected ? 'checked' : ''} data-f="${f.key}">
              <span>${esc(o.l)}</span>
            </label>`).join('')}
        </div></div>`;
    }
    if (f.type === 'textarea') {
      return `<div class="field"><label>${esc(f.label)}</label>
        <textarea data-f="${f.key}" class="textarea" ${f.attrs || ''}>${esc(f.value || '')}</textarea></div>`;
    }
    if (f.type === 'checkbox') {
      return `<label class="row text-sm mb-3" style="gap:8px;cursor:pointer"><input type="checkbox" data-f="${f.key}" ${f.checked ? 'checked' : ''}> ${esc(f.label)}</label>`;
    }
    return `<div class="field"><label>${esc(f.label)}</label>
      <input type="${f.type || 'text'}" data-f="${f.key}" class="input" value="${esc(f.value || '')}" ${f.attrs || ''} placeholder="${esc(f.placeholder || '')}"></div>`;
  }).join('');

  modal({
    title, body,
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: submitLabel, className: submitClass, onClick: async (c, w) => {
        const data = {};
        fields.forEach(f => {
          if (f.type === 'radio') {
            const sel = w.querySelector(`input[type="radio"][data-f="${f.key}"]:checked`);
            data[f.key] = sel ? sel.value : (f.options && f.options[0] ? f.options[0].v : '');
            return;
          }
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
//  RENDER
// ============================================
function render() {
  const app = $('#app'); if (!app) return;
  let html = '';
  if (S.view === 'login') html = vLogin();
  else if (S.view === 'karyawan') html = vKaryawan();
  else if (S.view === 'admin') html = vAdmin();
  app.innerHTML = html;
  if (S.view === 'karyawan' && S.karyawan && S.karyawan.absen && S.karyawan.absen.isOpen &&
      S.karyawan.distribusi && S.karyawan.distribusi.length && !S.karyawan.sudahSubmit) {
    const l = $('[data-peng-list]');
    if (l && !l.children.length) addPengRow();
  }
  if (S.view === 'karyawan') startClock();
}

document.addEventListener('click', handleClick);
document.addEventListener('input', handleInput);
document.addEventListener('change', handleChange);

let __clockTimer = null;
function startClock() {
  if (__clockTimer) clearInterval(__clockTimer);
  if (!$('[data-live-clock]')) return;
  const upd = () => {
    const e = $('[data-live-clock]');
    if (!e) { clearInterval(__clockTimer); __clockTimer = null; return; }
    const d = new Date();
    e.textContent = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0');
  };
  upd();
  __clockTimer = setInterval(upd, 1000);
}

// ============================================
//  LOGIN
// ============================================
function vLogin() {
  return `
    <div class="login">
      <div class="login-logo">${ico('cookie', 'ico-lg')}</div>
      <h1>Kue As-Syifa</h1>
      <p class="sub">Sistem Manajemen POS &amp; ERP</p>
      <form class="login-form" data-form="login">
        <div class="field"><label>Username / Nama</label>
          <input class="input" name="username" autocomplete="username" autofocus placeholder="admin / Siti">
        </div>
        <div class="field"><label>Password</label>
          <input class="input" type="password" name="password" autocomplete="current-password" placeholder="••••••">
        </div>
        <button class="btn btn-primary btn-block btn-lg mt-2" type="submit">Masuk</button>
      </form>
      <p class="text-center text-xs text-gray mt-3">v5.6 · Kue As-Syifa</p>
    </div>`;
}

// ============================================
//  KARYAWAN
// ============================================
function vKaryawan() {
  const d = S.karyawan;
  if (!d) return '<div class="page"><div class="empty">Memuat...</div></div>';
  const isOpen = d.absen && d.absen.isOpen;
  const ak = d.absensiKaryawan || S.absensiHariIni || { status: 'belum' };
  let body = '';
  const statusMap = { belum: 'Belum Absen', bekerja: 'Bekerja', selesai: 'Selesai' };
  const statusCls = { belum: 'status-belum', bekerja: 'status-bekerja', selesai: 'status-selesai' };

  body += `
    <div class="clock-card">
      <div class="clock-time" data-live-clock>--:--:--</div>
      <div class="clock-label">
        ${esc(fmtDateID(new Date()))} · 
        <span class="status-pill ${statusCls[ak.status] || 'status-belum'}">${statusMap[ak.status] || 'Belum Absen'}</span>
      </div>
      ${ak.jamMasuk ? `<div class="text-xs" style="opacity:.7;margin-bottom:12px">Masuk: ${esc(ak.jamMasuk)}${ak.jamKeluar ? ' · Keluar: ' + esc(ak.jamKeluar) : ''}</div>` : ''}
      <div class="clock-actions">
        <button class="btn" data-act="absen-masuk" ${ak.status !== 'belum' ? 'disabled' : ''}>
          ${ico('login','ico-sm')} Absen Masuk
        </button>
        <button class="btn" data-act="absen-keluar" ${ak.status !== 'bekerja' ? 'disabled' : ''}>
          ${ico('logout','ico-sm')} Absen Keluar
        </button>
      </div>
    </div>`;

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
    body += `<div class="alert alert-warn">${ico('inbox','ico')}<span>Buka lapak dulu untuk mulai rekap.</span></div>`;
    body += `<div class="card"><div class="row-between mb-3"><strong class="text-sm">Drop Stok Hari Ini</strong><button class="btn btn-ghost btn-sm" data-act="edit-drop">Edit</button></div>`;
    body += d.distribusi.map(it => `
      <div class="row-between" style="padding:8px 0;border-bottom:1px solid #f8fafc">
        <div style="min-width:0;flex:1">
          <span class="text-sm">${esc(it.nama)}</span>
          ${it.tipeTransaksi === 'TitipJual' ? ' <span class="badge badge-warn" style="font-size:9px">TITIP</span>' : ''}
        </div>
        <strong>${it.qtyDrop} pcs</strong>
      </div>`).join('');
    body += `</div>`;
  } else {
    body += renderRekapForm(d);
  }

  const kb = (S.kasbon && S.kasbon.list) || [];
  body += `<div class="card">
    <div class="row-between mb-3">
      <strong class="text-sm">${ico('money','ico-sm')} Kasbon Saya</strong>
      <button class="btn btn-primary btn-sm" data-act="ajukan-kasbon">+ Ajukan</button>
    </div>
    ${kb.length === 0 ? '<p class="text-xs text-gray text-center" style="padding:12px 0">Belum ada kasbon.</p>' :
      kb.slice(0, 5).map(k => `
        <div class="row-between" style="padding:8px 0;border-bottom:1px solid #f8fafc">
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
      <div class="topbar">
        <div class="topbar-title">
          <h2>${esc(S.user.name)}</h2>
          <p>${esc(d.lapakNama || '')}</p>
        </div>
        <div class="row" style="gap:4px">
          <button class="icon-btn" data-act="ganti-lapak">${ico('store')}</button>
          <button class="icon-btn" data-act="logout">${ico('out')}</button>
        </div>
      </div>
      <div class="page-body fade-in">${body}</div>
    </div>`;
}

function renderDropForm(d) {
  const katalog = d.katalogFull || [];
  if (!katalog.length) return `<div class="card empty">${ico('box','ico')}<p>Katalog kosong.</p></div>`;
  return `
    <div class="card" style="border:1.5px solid var(--amber);background:var(--amber-50)">
      <div class="card-title" style="color:var(--amber-600)">${ico('boxes')} Input Stok Diterima</div>
      <p class="text-xs text-gray mb-4">Masukkan jumlah kue yang Anda terima pagi ini.</p>
      ${katalog.map(k => `
        <div class="row-between" style="padding:10px 0;border-bottom:1px solid rgba(245,158,11,.15)">
          <div style="min-width:0;flex:1;padding-right:8px">
            <p class="text-sm font-semibold">${esc(k.nama)}</p>
            <p class="text-xs text-gray">${esc(k.supplierNama)} · ${fmtRp(k.hargaJual)}</p>
          </div>
          <input type="number" min="0" inputmode="numeric" value="0" data-drop-item="${esc(k.id)}" class="input field-sm" style="width:72px;text-align:center">
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
        <div class="card card-flat" style="padding:12px;margin-bottom:8px">
          <div class="row-between mb-3">
            <div style="min-width:0;flex:1;padding-right:8px">
              <p class="text-sm font-semibold">${esc(it.nama)} ${it.tipeTransaksi === 'TitipJual' ? '<span class="badge badge-warn" style="font-size:9px">TITIP</span>' : ''}</p>
              <p class="text-xs text-gray">${fmtRp(it.hargaJual)}/pcs · Drop: <strong>${it.qtyDrop}</strong></p>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <label class="text-xs text-gray">Sisa</label>
              <input type="number" min="0" max="${it.qtyDrop}" inputmode="numeric" value="${S.rekap[it.katalogId] || 0}" data-rekap-item="${esc(it.katalogId)}" data-max="${it.qtyDrop}" class="input field-sm" style="width:68px;text-align:center">
            </div>
          </div>
          <div class="row-between text-xs" style="border-top:1px solid #e2e8f0;padding-top:8px">
            <span class="text-gray">Laku: <strong data-laku="${esc(it.katalogId)}">${it.qtyDrop - (S.rekap[it.katalogId] || 0)}</strong></span>
            <span class="text-green font-bold" data-sub="${esc(it.katalogId)}">${fmtRp((it.qtyDrop - (S.rekap[it.katalogId] || 0)) * it.hargaJual)}</span>
          </div>
        </div>`).join('')}
      <div style="border-top:1px solid #f1f5f9;padding-top:14px;margin-top:10px">
        <p class="text-xs font-semibold mb-2">Pengeluaran Lapak (opsional)</p>
        <div data-peng-list></div>
        <button class="btn btn-ghost btn-sm mt-2" data-act="add-peng">+ Tambah pengeluaran</button>
      </div>
      <div style="border-top:1px solid #f1f5f9;padding-top:14px;margin-top:14px">
        <p class="text-xs font-semibold mb-2">Total Penerimaan</p>
        <div class="form-grid">
          <div class="field"><label>Tunai (Rp)</label><input type="number" name="tunai" min="0" inputmode="numeric" class="input field-sm"></div>
          <div class="field"><label>QRIS (Rp)</label><input type="number" name="qris" min="0" inputmode="numeric" class="input field-sm"></div>
        </div>
      </div>
      <div class="alert alert-info" data-summary>${summaryHTML()}</div>
      <button class="btn btn-primary btn-block btn-lg ${d.locked ? 'hide' : ''}" data-act="submit-rekap">Kirim Laporan</button>
    </div>`;
}

function summaryHTML() {
  const d = S.karyawan || {};
  let total = 0;
  (d.distribusi || []).forEach(it => { total += (it.qtyDrop - (S.rekap[it.katalogId] || 0)) * it.hargaJual; });
  let pengeluaran = 0;
  $$('[data-peng-row]').forEach(r => { const el = r.querySelector('[data-peng-nom]'); if (el) pengeluaran += parseInt(el.value, 10) || 0; });
  const tunaiEl = $('input[name="tunai"]'), qrisEl = $('input[name="qris"]');
  const tunai = tunaiEl ? (parseInt(tunaiEl.value, 10) || 0) : 0;
  const qris = qrisEl ? (parseInt(qrisEl.value, 10) || 0) : 0;
  const expected = total - pengeluaran;
  const selisih = total - (tunai + qris);
  return `
    <div style="flex:1">
      <div class="row-between text-xs"><span>Penjualan</span><strong>${fmtRp(total)}</strong></div>
      <div class="row-between text-xs text-red"><span>Pengeluaran</span><span>- ${fmtRp(pengeluaran)}</span></div>
      <div class="row-between text-xs text-green font-bold mt-2"><span>Harus Disetor</span><span>${fmtRp(Math.max(0, expected))}</span></div>
      <div class="divider" style="margin:10px 0"></div>
      <div class="row-between text-xs"><span>Tunai + QRIS</span><span>${fmtRp(tunai + qris)}</span></div>
      <div class="row-between text-xs font-bold ${Math.abs(selisih) < 1 ? 'text-green' : 'text-red'}"><span>Selisih</span><span>${fmtRp(selisih)}</span></div>
    </div>`;
}

function updateSummary() { const s = $('[data-summary]'); if (s) s.innerHTML = summaryHTML(); }

function addPengRow() {
  const list = $('[data-peng-list]'); if (!list) return;
  const row = document.createElement('div');
  row.dataset.pengRow = '1';
  row.className = 'row mb-2 fade-in';
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
    { id:'pesanan-pelanggan', label:'Pesanan', icon:'shopping-bag' },
    { id:'more',    label:'Menu',    icon:'menu' }
  ];

  let body = '';
  const T = S.tab;
  if (T === 'home') body = tabHome();
  else if (T === 'kas') body = tabKas();
  else if (T === 'setoran') body = tabSetoran();
  else if (T === 'laporan') body = tabLaporan();
  else if (T === 'analytics') body = tabAnalytics();
  else if (T === 'katalog') body = tabKatalog();
  else if (T === 'suppliers') body = tabSuppliers();
  else if (T === 'lapak') body = tabLapak();
  else if (T === 'distribusi') body = tabDistribusi();
  else if (T === 'belanja') body = tabBelanja();
  else if (T === 'jadwal') body = tabJadwal();
  else if (T === 'kasbon') body = tabKasbon();
  else if (T === 'gaji') body = tabGajiRiwayat();
  else if (T === 'setting-gaji') body = tabSettingGaji();
  else if (T === 'pesanan') body = tabPesanan();
  else if (T === 'users') body = tabUsers();
  else if (T === 'kartu-stok') body = tabKartuStok();
  else if (T === 'retur') body = tabRetur();
  else if (T === 'harga-tingkat') body = tabHargaTingkat();
  else if (T === 'tutup-buku') body = tabTutupBuku();
  else if (T === 'notifikasi') body = tabNotifikasi();
  else if (T === 'profil') body = tabProfil();
  else if (T === 'absensi') body = tabAbsensi();
  else if (T === 'absensi-hari-ini') body = tabAbsensiHariIni();
  else if (T === 'bonus-antar') body = tabBonusAntar();
  else if (T === 'setting-payroll') body = tabSettingPayroll();
  else if (T === 'payroll') body = tabPayroll();
  else if (T === 'dashboard-profit') body = tabDashboardProfit();
  else if (T === 'konsinyasi') body = tabKonsinyasi();
  else if (T === 'riwayat-bayar-supplier') body = tabRiwayatBayarSupplier();
  else if (T === 'template-box') body = tabTemplateBox();
  else if (T === 'pesanan-pelanggan') body = tabPesananPelanggan();
  else if (T === 'kalender-pesanan') body = tabKalenderPesanan();

  const unread = S.dash ? (S.dash.unreadNotif || 0) : 0;
  const pesananBadge = S.dash ? (S.dash.todayPesananCount || 0) : 0;

  return `
    <div class="page">
      <div class="topbar">
        <div class="topbar-title">
          <h2>${esc(S.user.name)}</h2>
          <p>Admin Panel</p>
        </div>
        <div class="row" style="gap:4px">
          <button class="icon-btn icon-btn-relative" data-act="open-notif">
            ${ico('bell')}
            ${unread > 0 ? `<span class="badge-dot">${unread > 9 ? '9+' : unread}</span>` : ''}
          </button>
          <button class="icon-btn" data-act="logout">${ico('out')}</button>
        </div>
      </div>
      <div class="page-body fade-in">${body}</div>
      <div class="tabbar">
        ${tabs.map(t => {
          const badge = t.id === 'pesanan-pelanggan' ? pesananBadge : t.badge;
          return `
          <button class="tab ${S.tab === t.id ? 'active' : ''}" data-act="tab" data-tab="${t.id}">
            ${ico(t.icon)}<span>${t.label}</span>
            ${badge > 0 ? `<span class="badge-dot">${badge > 9 ? '9+' : badge}</span>` : ''}
          </button>`;
        }).join('')}
      </div>
    </div>`;
}

// ============================================
//  TAB: HOME
// ============================================
function tabHome() {
  const d = S.dash || { kasBesar: 0, pendingCount: 0, todayPenjualan: 0, todayTunai: 0, todayQris: 0, todaySetoranCount: 0, recentKas: [], utangKonsinyasi: 0, todayPesananCount: 0 };
  return `
    <div class="hero hero-amber">
      <div class="hero-label">Saldo Kas Besar</div>
      <div class="hero-value">${fmtRp(d.kasBesar)}</div>
      <div class="hero-sub">${d.todaySetoranCount} setoran hari ini</div>
    </div>

    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">Penjualan Hari Ini</div>
        <div class="kpi-value text-green" style="font-size:16px">${fmtRp(d.todayPenjualan)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Pesanan Hari Ini</div>
        <div class="kpi-value text-amber">${d.todayPesananCount || 0}</div>
      </div>
    </div>

    ${d.utangKonsinyasi > 0 ? `
      <div class="alert alert-warn">
        ${ico('truck','ico')}
        <div style="flex:1">
          <strong>Utang Konsinyasi: ${fmtRp(d.utangKonsinyasi)}</strong>
          <br><button class="btn btn-primary btn-sm mt-2" data-act="tab" data-tab="konsinyasi">Bayar</button>
        </div>
      </div>` : ''}

    ${d.pendingCount > 0 ? `
      <div class="alert alert-warn">
        ${ico('inbox','ico')}
        <div style="flex:1">
          <strong>${d.pendingCount} setoran pending</strong>
          <br><button class="btn btn-primary btn-sm mt-2" data-act="tab" data-tab="setoran">Lihat</button>
        </div>
      </div>` : ''}

    <div class="row" style="gap:8px;margin-bottom:16px">
      <button class="btn btn-ghost btn-block" data-act="tab" data-tab="analytics">${ico('trending-up','ico-sm')} Analytics</button>
      <button class="btn btn-ghost btn-block" data-act="refresh">${ico('refresh','ico-sm')} Refresh</button>
    </div>

    <h3 class="card-title">${ico('wallet')} Kas Terbaru</h3>
    ${!d.recentKas || !d.recentKas.length ? '<div class="empty">' + ico('inbox','ico') + '<p>Belum ada transaksi</p></div>' :
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
    <div class="hero">
      <div class="hero-label">Saldo Saat Ini</div>
      <div class="hero-value">${fmtRp(d.kasBesar)}</div>
    </div>
    ${!d.recentKas || !d.recentKas.length ? '<div class="empty">' + ico('inbox','ico') + '<p>Belum ada transaksi</p></div>' :
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
  const done = list.filter(s => s.status !== 'pending').slice(0, 30);

  let html = `
    <div class="card">
      <div class="form-grid">
        <div class="field"><label>Dari</label><input type="date" data-filter-dari value="${f.dari || ''}" class="input field-sm"></div>
        <div class="field"><label>Sampai</label><input type="date" data-filter-sampai value="${f.sampai || ''}" class="input field-sm"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Lapak</label>
          <select data-filter-lapak class="select field-sm">
            <option value="">Semua</option>
            ${S.lapak.map(l => `<option value="${esc(l.id)}" ${f.lapakId === l.id ? 'selected' : ''}>${esc(l.nama)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Status</label>
          <select data-filter-status class="select field-sm">
            <option value="">Semua</option>
            <option value="pending" ${f.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="approved" ${f.status === 'approved' ? 'selected' : ''}>Approved</option>
            <option value="rejected" ${f.status === 'rejected' ? 'selected' : ''}>Rejected</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary btn-block btn-sm" data-act="apply-setoran-filter">Terapkan Filter</button>
    </div>`;

  html += `<h3 class="card-title">${ico('inbox')} Pending (${pending.length})</h3>`;
  if (!pending.length) html += '<div class="empty">' + ico('check','ico') + '<p>Tidak ada setoran pending</p></div>';
  else html += pending.map(s => {
    const status = s.selisih === 0 ? 'Match' : s.selisih > 0 ? 'Shortage' : 'Overage';
    const cls = s.selisih === 0 ? 'badge-success' : s.selisih > 0 ? 'badge-danger' : 'badge-blue';
    return `
      <div class="card">
        <div class="row-between mb-3">
          <div><strong>${esc(s.lapakId)}</strong><div class="text-xs text-gray">${esc(s.tanggal)}</div></div>
          <span class="badge ${cls}">${status}</span>
        </div>
        <div class="card-flat" style="padding:12px;font-size:13px">
          <div class="row-between"><span class="text-gray">Penjualan</span><strong>${fmtRp(s.totalSistem)}</strong></div>
          <div class="row-between text-gray"><span>Tunai</span><span>${fmtRp(s.totalTunai)}</span></div>
          <div class="row-between text-gray"><span>QRIS</span><span>${fmtRp(s.totalQris)}</span></div>
          <div class="row-between text-red"><span>Pengeluaran</span><span>- ${fmtRp(s.pengeluaran)}</span></div>
          <div class="row-between text-green font-bold" style="border-top:1px solid #e2e8f0;padding-top:8px;margin-top:8px"><span>Setoran</span><span>${fmtRp(s.expectedSetoran)}</span></div>
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

  if (done.length) {
    html += `<h3 class="card-title mt-3">${ico('file')} Riwayat</h3>`;
    html += done.map(s => `
      <div class="list-item">
        <div class="list-item-main">
          <div class="list-item-title">${esc(s.lapakId)} · ${esc(s.tanggal)}</div>
          <div class="list-item-sub">${fmtRp(s.totalSistem)}${s.locked ? ' · 🔒' : ''}</div>
        </div>
        <span class="badge ${s.status === 'approved' ? 'badge-success' : 'badge-danger'}">${esc(s.status)}</span>
      </div>`).join('');
  }
  return html;
}

// ============================================
//  TAB: LAPORAN
// ============================================
function tabLaporan() {
  const L = S.laporan;
  if (!L) return '<div class="empty">Memuat laporan...</div>';
  const maxQty = L.topItems.length ? Math.max(...L.topItems.map(i => i.qtyLaku)) : 1;
  return `
    <div class="card">
      <div class="form-grid">
        <div class="field"><label>Dari</label><input type="date" data-lap-dari value="${L.periode.dari}" class="input field-sm"></div>
        <div class="field"><label>Sampai</label><input type="date" data-lap-sampai value="${L.periode.sampai}" class="input field-sm"></div>
      </div>
      <button class="btn btn-primary btn-block btn-sm" data-act="load-laporan">Terapkan</button>
    </div>
    <div class="grid-3 mb-3">
      <div class="kpi"><div class="kpi-label">Omzet</div><div class="kpi-value text-green" style="font-size:13px">${fmtRp(L.ringkasan.totalOmzet)}</div></div>
      <div class="kpi"><div class="kpi-label">Profit</div><div class="kpi-value text-blue" style="font-size:13px">${fmtRp(L.ringkasan.totalProfit)}</div></div>
      <div class="kpi"><div class="kpi-label">Qty</div><div class="kpi-value text-amber">${L.ringkasan.totalQty}</div></div>
    </div>
    <div class="card">
      <div class="card-title">Top 10 Item</div>
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
          <div style="padding:10px 0;border-bottom:1px solid #f8fafc">
            <div class="row-between text-sm mb-2"><strong>${esc(s.nama)}</strong><span class="text-gray">${s.margin.toFixed(1)}% margin</span></div>
            <div class="row-between text-xs text-gray"><span>${s.qtyLaku} pcs · ${s.itemCount} item</span><span class="text-green font-semibold">${fmtRp(s.omzet)}</span></div>
          </div>`).join('')}
    </div>
    <div class="card">
      <div class="card-title">Performa Lapak</div>
      ${!L.perLapak.length ? '<p class="text-xs text-gray">Belum ada data.</p>' :
        L.perLapak.map(l => `
          <div style="padding:10px 0;border-bottom:1px solid #f8fafc">
            <div class="row-between text-sm mb-2"><strong>${esc(l.nama)}</strong><span class="text-gray">${l.margin.toFixed(1)}%</span></div>
            <div class="row-between text-xs text-gray"><span>${l.qtyLaku} pcs · ${l.setoranCount} setoran</span><span class="text-green font-semibold">${fmtRp(l.omzet)}</span></div>
          </div>`).join('')}
    </div>
    <button class="btn btn-success btn-block" data-act="export-csv">${ico('csv','ico-sm')} Export CSV</button>`;
}

// ============================================
//  FASE 4: ANALYTICS DASHBOARD
// ============================================
function tabAnalytics() {
  const range = S.analyticsRange || 30;
  const A = S.analytics;
  if (!A) return '<div class="empty">' + ico('trending-up','ico') + '<p>Memuat analytics...</p></div>';

  const maxDaily = A.daily.length ? Math.max(...A.daily.map(d => d.omzet), 1) : 1;
  const maxForecast = A.forecast.length ? Math.max(...A.forecast.map(d => d.omzet), 1) : 1;
  const maxHour = Math.max(...A.perJam.map(h => h.omzet), 1);

  return `
    <div class="analytics-hero">
      <div class="hero-label">Total Omzet (${range} hari)</div>
      <div class="hero-value">${fmtRp(A.ringkasan.totalOmzet)}</div>
      <div class="hero-sub">Profit: ${fmtRp(A.ringkasan.totalProfit)} · ${A.ringkasan.totalQty} pcs</div>
    </div>

    <div class="range-selector">
      ${[7,14,30,90].map(r => `<button class="range-btn ${range === r ? 'active' : ''}" data-act="analytics-range" data-range="${r}">${r}h</button>`).join('')}
    </div>

    ${A.insights.length ? `
      <h3 class="card-title">${ico('zap')} Insight</h3>
      ${A.insights.map((ins, i) => `
        <div class="insight-card insight-${ins.type}" style="animation-delay:${i*0.08}s">
          ${ico(ins.type === 'success' ? 'trending-up' : ins.type === 'warn' ? 'trending-down' : 'info', 'ico')}
          <div class="insight-text">${esc(ins.text)}</div>
        </div>`).join('')}
    ` : ''}

    <div class="card">
      <div class="card-title">${ico('bar')} Tren Omzet Harian</div>
      <div class="grafik-simple">
        ${A.daily.map(d => `<div class="grafik-bar" style="height:${Math.max(3, d.omzet / maxDaily * 100).toFixed(1)}%" title="${d.tanggal}: ${fmtRp(d.omzet)}"></div>`).join('')}
      </div>
      <div class="row-between text-xs text-gray mt-2">
        <span>${A.daily[0] ? A.daily[0].tanggal : ''}</span>
        <span>${A.daily[A.daily.length-1] ? A.daily[A.daily.length-1].tanggal : ''}</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">${ico('trending-up')} Forecast 7 Hari</div>
      <p class="text-xs text-gray mb-2">Estimasi berdasarkan rata-rata 7 hari terakhir</p>
      <div class="grafik-simple">
        ${A.forecast.map(d => `<div class="forecast-bar" style="flex:1;height:${Math.max(3, d.omzet / maxForecast * 100).toFixed(1)}%;min-height:3px" title="${d.tanggal}: ${fmtRp(d.omzet)}"></div>`).join('')}
      </div>
      <div class="row-between text-xs text-gray mt-2">
        <span>Besok</span>
        <span>+7 hari</span>
      </div>
      <div class="divider"></div>
      <div class="row-between text-xs">
        <span class="text-gray">Rata-rata omzet harian</span>
        <strong class="text-amber">${fmtRp(A.ringkasan.avgOmzet)}</strong>
      </div>
    </div>

    ${A.peakHour !== null ? `
      <div class="card">
        <div class="card-title">${ico('clock')} Jam Teramai</div>
        <div class="row-between mb-3">
          <span class="peak-hour-badge">${ico('zap','ico-sm')} Pukul ${String(A.peakHour).padStart(2,'0')}:00</span>
          <strong class="text-sm">${fmtRp(A.perJam[A.peakHour].omzet)}</strong>
        </div>
        <div class="grafik-simple" style="height:60px">
          ${A.perJam.map(h => `<div class="grafik-bar ${h.jam === A.peakHour ? '' : 'green'}" style="height:${Math.max(3, h.omzet / maxHour * 100).toFixed(1)}%" title="${h.jam}:00 = ${fmtRp(h.omzet)}"></div>`).join('')}
        </div>
        <div class="row-between text-xs text-gray mt-2">
          <span>00:00</span><span>23:00</span>
        </div>
      </div>
    ` : ''}

    <div class="card">
      <div class="card-title">${ico('store')} Performa Lapak</div>
      ${!A.perLapak.length ? '<p class="text-xs text-gray">Belum ada data.</p>' :
        A.perLapak.map(l => `
          <div style="padding:10px 0;border-bottom:1px solid #f8fafc">
            <div class="row-between text-sm mb-2">
              <strong>${esc(l.nama)}</strong>
              <strong class="text-green">${fmtRp(l.omzet)}</strong>
            </div>
            <div class="row-between text-xs text-gray">
              <span>${l.qty} pcs · ${l.setoranCount} setoran</span>
              <span>Profit: ${fmtRp(l.profit)}</span>
            </div>
            <div class="bar-track mt-2"><div class="bar-fill green" style="width:${(l.omzet / (A.perLapak[0].omzet || 1) * 100).toFixed(1)}%"></div></div>
          </div>`).join('')}
    </div>

    <div class="card">
      <div class="card-title">${ico('users')} Ranking Karyawan</div>
      ${!A.perKaryawan.length ? '<p class="text-xs text-gray">Belum ada data.</p>' :
        `<table class="analytics-table">
          <thead><tr>
            <th style="width:40px">#</th>
            <th>Nama</th>
            <th class="text-right">Omzet</th>
          </tr></thead>
          <tbody>
            ${A.perKaryawan.slice(0, 10).map((k, i) => `
              <tr>
                <td><span class="rank ${i < 3 ? 'top' : ''}">${i+1}</span></td>
                <td>
                  <div style="font-weight:600;color:var(--ink);">${esc(k.nama)}</div>
                  <div class="text-xs text-gray">${k.setoranCount}× rekap · avg ${fmtRp(k.avgOmzet)}</div>
                </td>
                <td class="num">${fmtRp(k.omzet)}</td>
              </tr>`).join('')}
          </tbody>
        </table>`}
    </div>

    <div class="card">
      <div class="card-title">${ico('grid')} Per Kategori</div>
      ${!A.perKategori.length ? '<p class="text-xs text-gray">Belum ada data.</p>' :
        `<div class="bar-list">
          ${A.perKategori.map(k => `
            <div class="bar-row">
              <div class="bar-meta"><span>${esc(k.kategori)}</span><strong>${fmtRp(k.omzet)}</strong></div>
              <div class="bar-track"><div class="bar-fill purple" style="width:${(k.omzet / (A.perKategori[0].omzet || 1) * 100).toFixed(1)}%"></div></div>
              <div class="text-xs text-gray">${k.qty} pcs · profit ${fmtRp(k.profit)}</div>
            </div>`).join('')}
        </div>`}
    </div>

    <button class="btn btn-primary btn-block" data-act="refresh-analytics">${ico('refresh','ico-sm')} Muat Ulang</button>
  `;
}

// ============================================
//  TAB: KATALOG / SUPPLIERS / LAPAK / USERS
// ============================================
function tabKatalog() {
  const isAdmin = S.user.role === 'admin';
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('box')} Katalog (${S.katalog.length})</h3>
      <div class="row" style="gap:4px">
        <button class="btn btn-ghost btn-sm" data-act="tab" data-tab="harga-tingkat">${ico('tag','ico-sm')}</button>
        <button class="btn btn-primary btn-sm" data-act="add-katalog">+ Tambah</button>
      </div>
    </div>
    ${!S.katalog.length ? '<div class="empty">' + ico('box','ico') + '<p>Belum ada item</p></div>' :
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

function tabSuppliers() {
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('truck')} Suppliers</h3>
      <button class="btn btn-primary btn-sm" data-act="add-supplier">+ Tambah</button>
    </div>
    ${!S.suppliers.length ? '<div class="empty">' + ico('truck','ico') + '<p>Belum ada supplier</p></div>' :
      S.suppliers.map(s => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">
              ${esc(s.nama)}
              ${s.tipeTransaksi === 'TitipJual' ? '<span class="badge badge-warn" style="font-size:9px;margin-left:4px">TITIP</span>' : '<span class="badge badge-gray" style="font-size:9px;margin-left:4px">BELI PUTUS</span>'}
            </div>
            <div class="list-item-sub">${esc(s.kontak || '-')}</div>
            ${s.jadwalPesan ? `<div class="text-xs text-amber mt-2">${esc(s.jadwalPesan)}</div>` : ''}
          </div>
          <div class="list-item-actions">
            <button class="action-btn action-edit" data-act="edit-supplier" data-id="${esc(s.id)}">${ico('edit','ico-sm')}</button>
            <button class="action-btn action-del" data-act="del-supplier" data-id="${esc(s.id)}">${ico('trash','ico-sm')}</button>
          </div>
        </div>`).join('')}`;
}

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
            ${u.email ? `<div class="text-xs text-blue mt-1">${ico('mail','ico-sm')} ${esc(u.email)}</div>` : '<div class="text-xs text-gray mt-1">📧 Belum ada email</div>'}
            ${u.mustChangePassword ? '<span class="badge badge-warn mt-1">Perlu ganti pwd</span>' : ''}
          </div>
          <div class="list-item-actions">
            <button class="action-btn action-info" data-act="reset-user-pwd" data-id="${esc(u.id)}">${ico('key','ico-sm')}</button>
            <button class="action-btn action-edit" data-act="edit-user" data-id="${esc(u.id)}">${ico('edit','ico-sm')}</button>
            <button class="action-btn action-del" data-act="del-user" data-id="${esc(u.id)}">${ico('trash','ico-sm')}</button>
          </div>
        </div>`).join('')}`;
}

// ============================================
//  TAB: DISTRIBUSI / BELANJA / JADWAL / KASBON
// ============================================
function tabDistribusi() {
  const tgl = S._distTanggal || todayISO();
  const lapakId = S._distLapakId || (S.lapak[0] ? S.lapak[0].id : '');
  const items = S._distItems || {};
  return `
    <h3 class="card-title">${ico('boxes')} Drop Stok</h3>
    <div class="card">
      <div class="form-grid">
        <div class="field"><label>Tanggal</label><input type="date" data-dist-tgl value="${tgl}" class="input field-sm"></div>
        <div class="field"><label>Lapak</label>
          <select data-dist-lapak class="select field-sm">
            ${S.lapak.map(l => `<option value="${esc(l.id)}" ${l.id === lapakId ? 'selected' : ''}>${esc(l.nama)}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn btn-ghost btn-block btn-sm" data-act="load-distribusi">Muat</button>
    </div>
    <div class="card">
      ${!S.katalog.length ? '<p class="text-xs text-gray">Katalog kosong.</p>' :
        S.katalog.map(k => `
          <div class="row-between" style="padding:10px 0;border-bottom:1px solid #f8fafc">
            <div style="min-width:0;flex:1;padding-right:8px">
              <p class="text-sm font-semibold">${esc(k.nama)}</p>
              <p class="text-xs text-gray">${esc(k.supplierNama)} · ${fmtRp(k.hargaJual)}</p>
            </div>
            <input type="number" min="0" inputmode="numeric" value="${items[k.id] || 0}" data-dist-item="${esc(k.id)}" class="input field-sm" style="width:72px;text-align:center">
          </div>`).join('')}
    </div>
    <button class="btn btn-primary btn-block mt-3" data-act="save-distribusi">Simpan Drop</button>`;
}

function tabBelanja() {
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('cart')} Belanja</h3>
      <button class="btn btn-primary btn-sm" data-act="add-belanja">+ Tambah</button>
    </div>
    ${!S.belanja.length ? '<div class="empty"><p>Belum ada item</p></div>' :
      S.belanja.map(b => `
        <div class="list-item">
          <input type="checkbox" data-act="check-belanja" data-id="${esc(b.id)}" ${b.checked ? 'checked' : ''} style="margin-top:2px">
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

function tabJadwal() {
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('cal')} Jadwal</h3>
      <button class="btn btn-primary btn-sm" data-act="add-jadwal">+ Tambah</button>
    </div>
    ${!S.jadwal.length ? '<div class="empty"><p>Belum ada jadwal</p></div>' :
      S.jadwal.map(j => `
        <div class="list-item">
          <input type="checkbox" data-act="toggle-jadwal" data-id="${esc(j.id)}" ${j.done ? 'checked' : ''} style="margin-top:2px">
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

function tabKasbon() {
  const data = S.kasbon || { list: [], summary: [] };
  const outstanding = (data.summary || []).filter(s => s.outstanding > 0);
  let html = `<div class="row-between mb-3"><h3 class="card-title" style="margin:0">${ico('money')} Kasbon</h3><button class="btn btn-primary btn-sm" data-act="add-kasbon">+ Tambah</button></div>`;
  if (outstanding.length) {
    html += `<div class="card"><div class="card-title">Outstanding</div>` +
      outstanding.map(s => `<div class="row-between text-sm" style="padding:6px 0;border-bottom:1px solid #f8fafc"><span>${esc(s.userName)}</span><strong class="text-red">${fmtRp(s.outstanding)}</strong></div>`).join('') + `</div>`;
  }
  html += !data.list.length ? '<div class="empty"><p>Belum ada kasbon</p></div>' :
    data.list.map(k => `
      <div class="list-item">
        <div class="list-item-main">
          <div class="list-item-title">${esc(k.userName)}</div>
          <div class="list-item-sub">${esc(k.tanggal)} · ${esc(k.tipe)}</div>
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
//  TAB: KARTU STOK / RETUR / HARGA / TUTUP BUKU
// ============================================
function tabKartuStok() {
  const saldo = S.stokSaldo || [];
  const list = S.kartuStok || [];
  let html = `<div class="row-between mb-3"><h3 class="card-title" style="margin:0">${ico('boxes')} Stok</h3>
    <button class="btn btn-ghost btn-sm" data-act="refresh-stok">${ico('refresh','ico-sm')}</button></div>`;
  html += `<div class="card"><div class="card-title">Saldo</div>`;
  if (!saldo.length) html += '<p class="text-xs text-gray">Belum ada pergerakan.</p>';
  else html += saldo.map(s => `
    <div class="row-between text-sm" style="padding:8px 0;border-bottom:1px solid #f8fafc">
      <div style="min-width:0;flex:1"><strong>${esc(s.nama)}</strong><div class="text-xs text-gray">In ${s.masuk} · Out ${s.keluar}</div></div>
      <strong class="${s.saldo < 10 ? 'text-red' : 'text-green'}">${s.saldo}</strong>
    </div>`).join('');
  html += `</div>`;
  if (list.length) {
    html += `<div class="card"><div class="card-title">Riwayat (50)</div>`;
    html += list.slice(0, 50).map(k => `
      <div class="row-between text-xs" style="padding:8px 0;border-bottom:1px solid #f8fafc">
        <div style="min-width:0;flex:1">
          <strong>${esc(k.nama)}</strong>
          <div class="text-gray">${esc(k.tanggal)} · ${esc(k.tipe)} · ${esc(k.lapakNama || '-')}</div>
        </div>
        <div class="text-right">
          ${k.masuk > 0 ? `<div class="text-green font-bold">+${k.masuk}</div>` : ''}
          ${k.keluar > 0 ? `<div class="text-red font-bold">-${k.keluar}</div>` : ''}
          <div class="text-gray">${k.saldo}</div>
        </div>
      </div>`).join('');
    html += `</div>`;
  }
  return html;
}

function tabRetur() {
  const list = S.retur || [];
  const pending = list.filter(r => r.status === 'pending');
  let html = `<h3 class="card-title">${ico('return')} Retur (${pending.length})</h3>`;
  if (!pending.length) html += '<div class="empty"><p>Tidak ada retur pending.</p></div>';
  else html += pending.map(r => `
    <div class="card">
      <div class="row-between mb-2">
        <div><strong>${esc(r.nama)}</strong><div class="text-xs text-gray">${esc(r.dariLapakNama)} · ${esc(r.tanggal)}</div></div>
        <span class="badge ${r.kondisi === 'Layak' ? 'badge-success' : 'badge-danger'}">${esc(r.kondisi)}</span>
      </div>
      <div class="text-sm mb-3">Qty: <strong>${r.qty}</strong></div>
      <div class="row" style="gap:8px">
        <button class="btn btn-danger btn-sm" style="flex:1" data-act="reject-retur" data-id="${esc(r.id)}">Tolak</button>
        <button class="btn btn-success btn-sm" style="flex:1" data-act="approve-retur" data-id="${esc(r.id)}">Setujui</button>
      </div>
    </div>`).join('');
  return html;
}

function tabHargaTingkat() {
  const list = S.hargaTingkat || [];
  const katMap = {}; S.katalog.forEach(k => katMap[k.id] = k);
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('tag')} Harga Grosir</h3>
      <button class="btn btn-primary btn-sm" data-act="add-harga-tingkat">+ Tambah</button>
    </div>
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

function tabTutupBuku() {
  const list = S.tutupBuku || [];
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('lock')} Tutup Buku</h3>
      <button class="btn btn-primary btn-sm" data-act="add-tutup-buku">+ Kunci</button>
    </div>
    ${!list.length ? '<div class="empty"><p>Belum ada periode terkunci.</p></div>' :
      list.map(t => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${esc(t.periode)}</div>
            <div class="list-item-sub">${esc(t.ditutupAt)} · ${esc(t.ditutupBy)}</div>
          </div>
          <div class="row" style="gap:4px">
            <span class="badge ${t.status === 'Locked' ? 'badge-warn' : 'badge-success'}">${esc(t.status)}</span>
            ${t.status === 'Locked' ? `<button class="action-btn action-del" data-act="unlock-periode" data-id="${esc(t.id)}">${ico('key','ico-sm')}</button>` : ''}
          </div>
        </div>`).join('')}`;
}

// ============================================
//  TAB: GAJI / PESANAN SUPPLIER / NOTIF / PROFIL
// ============================================
function tabGajiRiwayat() {
  const data = S.gaji || [];
  let html = `<h3 class="card-title">${ico('money')} Riwayat Gaji</h3>`;
  if (!data.length) html += '<div class="empty"><p>Belum ada riwayat</p></div>';
  else html += data.map(g => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">${esc(g.userName)}</div>
        <div class="list-item-sub">${esc(g.periode)}</div>
      </div>
      <div class="text-sm font-bold text-green">${fmtRp(g.gajiBersih)}</div>
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
    <p class="text-xs text-gray mb-3">Untuk sistem baru, gunakan <strong>Setting Payroll</strong>.</p>
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

function tabPesanan() {
  const list = S.pesanan || [];
  const statusCls = { Draft:'badge-gray', Ordered:'badge-blue', Received:'badge-success', Cancelled:'badge-danger' };
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('cart')} Pesanan Supplier</h3>
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

function tabNotifikasi() {
  const list = S.notifikasi || [];
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('bell')} Notifikasi</h3>
      <button class="btn btn-ghost btn-sm" data-act="test-notif">${ico('mail','ico-sm')} Test Email</button>
    </div>
    ${!list.length ? '<div class="empty">' + ico('inbox','ico') + '<p>Tidak ada notifikasi.</p></div>' :
      list.map(n => `
        <div class="card">
          <div class="row-between mb-2">
            <strong class="text-sm">${esc(n.subjek)}</strong>
            <div class="row" style="gap:4px">
              ${n.channel === 'email' ? '<span class="badge badge-blue" style="font-size:9px">EMAIL</span>' : ''}
              <span class="badge ${n.status === 'unread' ? 'badge-warn' : 'badge-gray'}">${esc(n.status)}</span>
            </div>
          </div>
          <p class="text-sm mb-2">${esc(n.pesan)}</p>
          <div class="row-between text-xs text-gray">
            <span>${esc(n.tanggal)}</span>
            ${n.status === 'unread' ? `<button class="text-amber font-semibold" data-act="mark-notif-read" data-id="${esc(n.id)}">Tandai dibaca</button>` : ''}
          </div>
        </div>`).join('')}`;
}

function tabProfil() {
  const email = (S.user && S.user.email) || '-';
  return `
    <div class="card">
      <div class="field"><label>Username</label><strong>${esc(S.user.username)}</strong></div>
      <div class="field"><label>Nama</label><strong>${esc(S.user.name)}</strong></div>
      <div class="field"><label>Role</label><strong>${esc(S.user.role)}</strong></div>
      <div class="field" style="margin-bottom:0"><label>Email Notifikasi</label><strong>${esc(email === '-' ? '(belum diset)' : email)}</strong></div>
    </div>
    <button class="btn btn-primary btn-block mb-2" data-act="test-browser-notif">${ico('bell','ico-sm')} Test Notifikasi Browser</button>
    <button class="btn btn-primary btn-block mb-2" data-act="change-password">${ico('key','ico-sm')} Ganti Password</button>
    <button class="btn btn-outline btn-block mb-2" data-act="test-notif">${ico('mail','ico-sm')} Test Notifikasi Email</button>
    <button class="btn btn-ghost btn-block mb-2" data-act="send-email-manual">${ico('mail','ico-sm')} Kirim Email Manual</button>
    <button class="btn btn-ghost btn-block mb-2" data-act="backup-all">${ico('download','ico-sm')} Download Backup</button>
    <button class="btn btn-ghost btn-block mb-2" data-act="restore-modal">${ico('upload','ico-sm')} Restore</button>
    <button class="btn btn-danger btn-block" data-act="logout">${ico('out','ico-sm')} Logout</button>`;
}

// ============================================
//  FASE 1: ABSENSI / BONUS / PAYROLL / PROFIT
// ============================================
function tabAbsensi() {
  const f = S.absensiFilter || {};
  const list = S.absensiList || [];
  const bulan = f.bulan || monthISO();
  const perUser = {};
  list.forEach(a => {
    if (!perUser[a.userId]) perUser[a.userId] = { userId: a.userId, userName: a.userName, hadir: 0, telat: 0, setengah: 0 };
    perUser[a.userId].hadir++;
    if (a.jamMasuk) {
      const [hh, mm] = a.jamMasuk.split(':').map(Number);
      if (hh * 60 + mm > 5 * 60 + 15) perUser[a.userId].telat++;
    }
    if (a.status === 'SetengahHari') perUser[a.userId].setengah++;
  });
  let html = `<h3 class="card-title">${ico('clock')} Absensi</h3>`;
  html += `<div class="card">
    <div class="form-grid">
      <div class="field"><label>Bulan</label><input type="month" data-abs-bulan value="${bulan}" class="input field-sm"></div>
      <div class="field"><label>Lapak</label>
        <select data-abs-lapak class="select field-sm">
          <option value="">Semua</option>
          ${S.lapak.map(l => `<option value="${esc(l.id)}" ${f.lapakId === l.id ? 'selected' : ''}>${esc(l.nama)}</option>`).join('')}
        </select>
      </div>
    </div>
    <button class="btn btn-primary btn-block btn-sm" data-act="load-absensi">Terapkan</button>
  </div>`;
  html += `<div class="row-between mb-3">
    <strong class="text-sm">Rekap (${bulanLabel(bulan)})</strong>
    <button class="btn btn-ghost btn-sm" data-act="isi-absensi-form">${ico('plus','ico-sm')} Isi</button>
  </div>`;
  const users = Object.values(perUser);
  if (!users.length) html += '<div class="empty"><p>Belum ada data.</p></div>';
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
        <button class="btn btn-ghost btn-sm btn-block mt-3" data-act="lihat-absensi-user" data-id="${esc(u.userId)}">Detail</button>
      </div>`;
  }).join('');
  return html;
}

function tabAbsensiHariIni() {
  const list = S.absensiList || [];
  const hariIni = todayISO();
  const today = list.filter(a => a.tanggal === hariIni);
  let html = `<h3 class="card-title">${ico('clock')} Absensi Hari Ini</h3>
    <p class="text-xs text-gray mb-3">${fmtDateID(new Date())}</p>`;
  const karyawans = S.users.filter(u => u.role === 'karyawan' && u.aktif);
  if (!karyawans.length) return html + '<div class="empty"><p>Tidak ada karyawan aktif.</p></div>';
  html += `<div class="card">${karyawans.map(u => {
    const a = today.find(x => String(x.userId) === String(u.id));
    if (!a) {
      return `<div class="absensi-row">
        <div class="info">
          <div class="name">${esc(u.name)}</div>
          <div class="meta"><span class="badge badge-gray">Belum Absen</span></div>
        </div>
        <button class="btn btn-primary btn-sm" data-act="isi-absensi-user" data-userid="${esc(u.id)}">Isi</button>
      </div>`;
    }
    return `<div class="absensi-row">
      <div class="info">
        <div class="name">${esc(u.name)}</div>
        <div class="meta">${esc(a.lapakNama)} · ${esc(a.status)}${a.filledBy && a.filledBy !== u.username ? ` · oleh ${esc(a.filledBy)}` : ''}</div>
      </div>
      <div class="time">
        <div><strong>${esc(a.jamMasuk)}</strong> → <strong>${esc(a.jamKeluar || '...')}</strong></div>
        <div class="text-xs text-gray">${a.jamKerja ? a.jamKerja + ' jam' : ''}</div>
      </div>
      <div class="row" style="gap:4px;margin-left:8px">
        <button class="action-btn action-edit" data-act="edit-absensi" data-id="${esc(a.id)}">${ico('edit','ico-sm')}</button>
        <button class="action-btn action-del" data-act="del-absensi" data-id="${esc(a.id)}">${ico('trash','ico-sm')}</button>
      </div>
    </div>`;
  }).join('')}</div>`;
  return html;
}

function tabBonusAntar() {
  const f = S.bonusFilter || {};
  const list = S.bonusAntar || [];
  const bulan = f.bulan || monthISO();
  const total = list.reduce((s, b) => s + (b.nominal || 0), 0);
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('truck')} Bonus Antar</h3>
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
    <div class="hero hero-amber">
      <div class="hero-label">Total Bonus</div>
      <div class="hero-value">${fmtRp(total)}</div>
      <div class="hero-sub">${list.length} pengantaran</div>
    </div>
    ${!list.length ? '<div class="empty"><p>Belum ada bonus antar.</p></div>' :
      list.map(b => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${esc(b.userName)}</div>
            <div class="list-item-sub">${esc(b.tanggal)} · ${esc(b.tujuan || '-')}${b.jarakKm > 0 ? ' · ' + b.jarakKm + ' km' : ''}</div>
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

function tabSettingPayroll() {
  const list = S.settingPayroll || [];
  const heList = S.hariEfektif || [];
  const bulan = monthISO();
  let html = `<h3 class="card-title">${ico('settings')} Setting Payroll</h3>`;
  html += `<div class="row-between mb-3">
    <strong class="text-sm">Rate per Lapak</strong>
    <button class="btn btn-primary btn-sm" data-act="add-setting-payroll">+ Tambah</button>
  </div>`;
  if (!list.length) html += '<div class="empty"><p>Belum ada setting.</p></div>';
  else html += list.map(s => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">${esc(s.lapakNama)}</div>
        <div class="list-item-sub">Merekap: <strong>${fmtRp(s.bonusMerekap)}</strong> · Tunjangan: <strong>${fmtRp(s.tunjanganLapak)}</strong></div>
      </div>
      <div class="list-item-actions">
        <button class="action-btn action-edit" data-act="edit-setting-payroll" data-id="${esc(s.id)}">${ico('edit','ico-sm')}</button>
        <button class="action-btn action-del" data-act="del-setting-payroll" data-id="${esc(s.id)}">${ico('trash','ico-sm')}</button>
      </div>
    </div>`).join('');
  html += `<div class="divider"></div>`;
  html += `<div class="row-between mb-3">
    <strong class="text-sm">Hari Efektif</strong>
    <button class="btn btn-ghost btn-sm" data-act="auto-hari-efektif" data-bulan="${bulan}">${ico('refresh','ico-sm')} Auto</button>
  </div>`;
  html += `<div class="card">
    <div class="field"><label>Bulan</label><input type="month" data-he-bulan value="${bulan}" class="input field-sm"></div>
    <button class="btn btn-ghost btn-block btn-sm" data-act="load-hari-efektif">Muat</button>
  </div>`;
  if (heList.length) html += heList.map(h => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">${esc(h.lapakNama)}</div>
        <div class="list-item-sub">${esc(bulanLabel(h.bulan))}</div>
      </div>
      <div class="row" style="gap:8px;align-items:center">
        <strong class="text-amber">${h.jumlahHari} hari</strong>
        <button class="action-btn action-edit" data-act="edit-hari-efektif" data-id="${esc(h.id)}" data-bulan="${esc(h.bulan)}" data-lapak="${esc(h.lapakId)}" data-hari="${h.jumlahHari}">${ico('edit','ico-sm')}</button>
      </div>
    </div>`).join('');
  return html;
}

function tabPayroll() {
  const bulan = S.payrollBulan || monthISO();
  const data = S.payrollData;
  const hist = S.payrollHistory || [];
  let html = `<h3 class="card-title">${ico('money')} Rekap Payroll</h3>`;
  html += `<div class="card">
    <div class="field"><label>Bulan</label><input type="month" data-payroll-bulan value="${bulan}" class="input field-sm"></div>
    <button class="btn btn-primary btn-block btn-sm" data-act="load-payroll">Tampilkan</button>
  </div>`;
  if (!data) {
    html += `<div class="alert alert-info">${ico('inbox','ico-sm')}<span>Pilih bulan lalu klik Tampilkan.</span></div>`;
    if (hist.length) {
      html += `<h3 class="card-title mt-3">${ico('file')} Riwayat</h3>`;
      html += hist.slice(0, 20).map(h => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${esc(h.userName)}</div>
            <div class="list-item-sub">${esc(bulanLabel(h.bulan))} · ${esc(h.dibayarAt)}</div>
          </div>
          <div class="text-sm font-bold text-green">${fmtRp(h.totalBersih)}</div>
        </div>`).join('');
    }
    return html;
  }
  html += `<div class="grid-3 mb-3">
    <div class="kpi"><div class="kpi-label">Karyawan</div><div class="kpi-value">${data.list.length}</div></div>
    <div class="kpi"><div class="kpi-label">Total</div><div class="kpi-value text-green" style="font-size:12px">${fmtRp(data.totals.totalBersih)}</div></div>
    <div class="kpi"><div class="kpi-label">Kasbon</div><div class="kpi-value text-red" style="font-size:12px">${fmtRp(data.totals.totalKasbon)}</div></div>
  </div>`;
  html += `<div class="row-between mb-3">
    <strong class="text-sm">Detail</strong>
    <button class="btn btn-success btn-sm" data-act="bayar-payroll-bulk">${ico('check','ico-sm')} Bayar</button>
  </div>`;
  html += data.list.map(x => {
    const skor = x.kehadiran.skor;
    const skorCls = skor >= 90 ? 'skor-high' : skor >= 70 ? 'skor-mid' : 'skor-low';
    return `
      <div class="card">
        <div class="row mb-3" style="gap:10px">
          <input type="checkbox" data-payroll-pick data-userid="${esc(x.userId)}" data-total="${x.totalBersih}">
          <div style="flex:1;min-width:0">
            <div class="row-between"><strong>${esc(x.userName)}</strong><span class="skor-label">${skor}</span></div>
            <div class="kehadiran-cell mt-2">
              <span class="kehadiran-tag hadir">H${x.kehadiran.hadir}</span>
              ${x.kehadiran.telat > 0 ? `<span class="kehadiran-tag telat">T${x.kehadiran.telat}</span>` : ''}
              ${x.kehadiran.setengahHari > 0 ? `<span class="kehadiran-tag setengah">½${x.kehadiran.setengahHari}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="card-flat" style="padding:12px">
          <div class="text-xs font-semibold text-gray mb-2">Bonus Merekap</div>
          ${x.rincianMerekap.length ? x.rincianMerekap.map(r => `
            <div class="payroll-line">
              <span class="label">${esc(r.lapakNama)} (${r.hariMerekap}/${r.hariEfektif})</span>
              <span class="value">${fmtRp(r.bonus)}</span>
            </div>`).join('') : '<p class="text-xs text-gray">Belum ada</p>'}
          ${x.totalTunjangan > 0 ? `
            <div class="text-xs font-semibold text-gray mb-2 mt-3">Tunjangan</div>
            ${x.rincianTunjangan.map(r => `<div class="payroll-line"><span class="label">${esc(r.lapakNama)}</span><span class="value">${fmtRp(r.nominal)}</span></div>`).join('')}
          ` : ''}
          ${x.totalBonusAntar > 0 ? `<div class="payroll-line mt-3"><span class="label">Bonus Antar (${x.bonusAntarList.length}×)</span><span class="value">${fmtRp(x.totalBonusAntar)}</span></div>` : ''}
          ${x.totalKasbon > 0 ? `<div class="payroll-line deduction"><span class="label">Potongan Kasbon</span><span class="value">- ${fmtRp(x.totalKasbon)}</span></div>` : ''}
          <div class="payroll-line subtotal"><span class="label">Total Bersih</span><span class="value">${fmtRp(x.totalBersih)}</span></div>
        </div>
      </div>`;
  }).join('');
  return html;
}

function tabDashboardProfit() {
  const range = S.profitRange || 30;
  const data = S.dashboardProfit;
  let html = `<h3 class="card-title">${ico('trending')} Dashboard Profit</h3>`;
  html += `<div class="card"><div class="row" style="gap:6px">
    ${[7, 14, 30, 90].map(r => `<button class="btn btn-sm ${range === r ? 'btn-primary' : 'btn-ghost'}" data-act="profit-range" data-range="${r}" style="flex:1">${r}h</button>`).join('')}
  </div></div>`;
  if (!data) return html + `<div class="alert alert-info">${ico('inbox','ico-sm')}<span>Memuat...</span></div>`;
  html += `<div class="grid-3 mb-3">
    <div class="kpi"><div class="kpi-label">Omzet</div><div class="kpi-value text-green" style="font-size:13px">${fmtRp(data.totalOmzet)}</div></div>
    <div class="kpi"><div class="kpi-label">Profit</div><div class="kpi-value text-blue" style="font-size:13px">${fmtRp(data.totalProfit)}</div></div>
    <div class="kpi"><div class="kpi-label">Rata-rata</div><div class="kpi-value text-amber" style="font-size:13px">${fmtRp(data.avgProfit)}</div></div>
  </div>`;
  const maxP = Math.max(1, ...data.daily.map(d => d.profit));
  html += `<div class="card">
    <div class="card-title">Profit Harian</div>
    <div class="grafik-simple">
      ${data.daily.map(d => `<div class="grafik-bar" style="height:${Math.max(3, d.profit / maxP * 100).toFixed(1)}%" title="${d.tanggal}: ${fmtRp(d.profit)}"></div>`).join('')}
    </div>
    <div class="row-between text-xs text-gray mt-2">
      <span>${data.daily[0] ? data.daily[0].tanggal : ''}</span>
      <span>${data.daily[data.daily.length - 1] ? data.daily[data.daily.length - 1].tanggal : ''}</span>
    </div>
  </div>`;
  const sorted = [...data.daily].sort((a, b) => b.profit - a.profit);
  html += `<div class="card"><div class="card-title">Hari Terbaik</div>
    ${sorted.slice(0, 3).map(d => `<div class="row-between text-sm" style="padding:6px 0"><span>${esc(d.tanggal)}</span><strong class="text-green">${fmtRp(d.profit)}</strong></div>`).join('')}
  </div>`;
  html += `<div class="card"><div class="card-title">Hari Terendah</div>
    ${sorted.slice(-3).reverse().map(d => `<div class="row-between text-sm" style="padding:6px 0"><span>${esc(d.tanggal)}</span><strong class="text-red">${fmtRp(d.profit)}</strong></div>`).join('')}
  </div>`;
  return html;
}

// ============================================
//  FASE 2: KONSINYASI
// ============================================
function tabKonsinyasi() {
  const saldo = S.saldoSupplier || [];
  const list = S.konsinyasi || [];
  const totalUtang = saldo.reduce((s, x) => s + (x.pending || 0), 0);
  let html = `<h3 class="card-title">${ico('truck')} Konsinyasi</h3>`;
  html += `<div class="hero hero-amber">
    <div class="hero-label">Total Utang Supplier</div>
    <div class="hero-value">${fmtRp(totalUtang)}</div>
    <div class="hero-sub">${saldo.filter(s => s.pending > 0).length} supplier belum dibayar</div>
  </div>`;
  html += `<h3 class="card-title">${ico('list')} Saldo per Supplier</h3>`;
  const withPending = saldo.filter(s => s.pending > 0);
  if (!withPending.length) html += '<div class="empty"><p>Tidak ada utang pending.</p></div>';
  else html += withPending.map(s => `
    <div class="card">
      <div class="row-between mb-3">
        <div style="min-width:0;flex:1">
          <strong>${esc(s.nama)}</strong>
          <div class="text-xs text-gray mt-1">
            ${s.tipeTransaksi === 'TitipJual' ? '<span class="badge badge-warn" style="font-size:9px">TITIP</span>' : '<span class="badge badge-gray" style="font-size:9px">BELI</span>'}
            ${s.pendingCount} transaksi
          </div>
        </div>
        <div class="text-sm font-bold text-red">${fmtRp(s.pending)}</div>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn btn-ghost btn-sm" data-act="detail-konsinyasi" data-id="${esc(s.supplierId)}" style="flex:1">Detail</button>
        <button class="btn btn-success btn-sm" data-act="bayar-supplier" data-id="${esc(s.supplierId)}" style="flex:1">Bayar</button>
      </div>
    </div>`).join('');
  html += `<div class="divider"></div>`;
  html += `<h3 class="card-title">${ico('file')} Riwayat Transaksi</h3>`;
  if (!list.length) html += '<div class="empty"><p>Belum ada transaksi.</p></div>';
  else html += list.slice(0, 30).map(k => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">${esc(k.nama)} · ${k.qtyLaku} pcs</div>
        <div class="list-item-sub">${esc(k.supplierNama)} · ${esc(k.tanggal)}</div>
      </div>
      <div class="text-right">
        <div class="text-sm font-bold ${k.status === 'Pending' ? 'text-red' : 'text-green'}">${fmtRp(k.utang)}</div>
        <span class="badge ${k.status === 'Pending' ? 'badge-warn' : 'badge-success'}" style="margin-top:4px">${esc(k.status)}</span>
      </div>
    </div>`).join('');
  return html;
}

function tabRiwayatBayarSupplier() {
  const list = S.riwayatBayarSupplier || [];
  const total = list.reduce((s, x) => s + (x.total || 0), 0);
  return `
    <h3 class="card-title">${ico('file')} Riwayat Bayar Supplier</h3>
    <div class="hero">
      <div class="hero-label">Total Dibayar</div>
      <div class="hero-value">${fmtRp(total)}</div>
      <div class="hero-sub">${list.length} pembayaran</div>
    </div>
    ${!list.length ? '<div class="empty"><p>Belum ada riwayat.</p></div>' :
      list.map(r => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${esc(r.supplierNama)}</div>
            <div class="list-item-sub">${esc(r.bayarAt)} · ${esc(r.bayarBy)}</div>
            <div class="text-xs text-gray mt-1">${r.count} transaksi</div>
          </div>
          <div class="text-sm font-bold text-green">${fmtRp(r.total)}</div>
        </div>`).join('')}`;
}

// ============================================
//  FASE 3: TEMPLATE BOX
// ============================================
function tabTemplateBox() {
  const list = S.templateBox || [];
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('package')} Template Box (${list.length})</h3>
      <button class="btn btn-primary btn-sm" data-act="add-template-box">+ Tambah</button>
    </div>
    <p class="text-xs text-gray mb-3">Template paket kue untuk pesanan pelanggan.</p>
    ${!list.length ? '<div class="empty">' + ico('package','ico') + '<p>Belum ada template box.</p></div>' :
      list.map(b => {
        const itemCount = b.items.reduce((s, it) => s + it.qty, 0);
        return `
          <div class="box-card">
            <div class="box-card-header">
              <div style="min-width:0;flex:1">
                <div class="box-card-title">${esc(b.nama)}</div>
                ${b.keterangan ? `<div class="box-card-desc">${esc(b.keterangan)}</div>` : ''}
                <div class="text-xs text-gray">${b.items.length} jenis · ${itemCount} pcs total</div>
              </div>
              <div class="box-card-price">${fmtRp(b.hargaPaket)}</div>
            </div>
            <div class="box-card-items">
              ${b.items.map(it => `
                <div class="box-item-row">
                  <span class="box-item-name">${esc(it.nama)}</span>
                  <span class="box-item-qty">${it.qty} pcs</span>
                </div>`).join('')}
            </div>
            <div class="row mt-3" style="gap:6px">
              <button class="btn btn-ghost btn-sm" data-act="edit-template-box" data-id="${esc(b.id)}" style="flex:1">${ico('edit','ico-sm')} Edit</button>
              <button class="btn btn-danger btn-sm" data-act="del-template-box" data-id="${esc(b.id)}" style="flex:0 0 auto">${ico('trash','ico-sm')}</button>
            </div>
          </div>`;
      }).join('')}`;
}

function formTemplateBox(id) {
  const item = id && S.templateBox ? S.templateBox.find(x => x.id === id) : null;
  const katalog = S.katalog || [];
  if (!katalog.length) return toast('Katalog kosong. Isi katalog dulu.', 'error');

  const itemState = {};
  if (item) item.items.forEach(it => { itemState[it.katalogId] = it.qty; });

  const bodyHtml = `
    <div class="field"><label>Nama Box</label>
      <input type="text" data-f="nama" class="input" value="${item ? esc(item.nama) : ''}" placeholder="Contoh: Box Hemat">
    </div>
    <div class="field"><label>Harga Paket (Rp)</label>
      <input type="number" data-f="hargaPaket" class="input" value="${item ? item.hargaPaket : 0}" placeholder="0">
    </div>
    <div class="field"><label>Keterangan (opsional)</label>
      <input type="text" data-f="keterangan" class="input" value="${item ? esc(item.keterangan) : ''}">
    </div>
    <div class="field">
      <label>Isi Box</label>
      <p class="field-hint mb-3" style="margin-bottom:8px">Pilih item + qty:</p>
      <div style="max-height:280px;overflow-y:auto;padding-right:4px">
        ${katalog.map(k => `
          <div class="item-selector" data-box-item="${esc(k.id)}">
            <input type="checkbox" data-box-check data-kat="${esc(k.id)}" ${itemState[k.id] ? 'checked' : ''}>
            <div class="item-selector-info">
              <div class="item-selector-name">${esc(k.nama)}</div>
              <div class="item-selector-price">${fmtRp(k.hargaJual)} · ${esc(k.supplierNama)}</div>
            </div>
            <input type="number" min="0" data-box-qty data-kat="${esc(k.id)}" value="${itemState[k.id] || 0}" class="item-selector-qty">
          </div>`).join('')}
      </div>
    </div>
    <label class="row text-sm mb-3" style="gap:8px;cursor:pointer">
      <input type="checkbox" data-f="aktif" ${!item || item.aktif ? 'checked' : ''}> Aktif
    </label>
  `;

  modal({
    title: item ? 'Edit Template Box' : 'Tambah Template Box',
    body: bodyHtml,
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
        const get = s => w.querySelector(`[data-f="${s}"]`).value;
        const nama = String(get('nama') || '').trim();
        const hargaPaket = parseInt(get('hargaPaket'), 10) || 0;
        if (!nama) return toast('Nama wajib.', 'error');
        if (hargaPaket <= 0) return toast('Harga paket > 0.', 'error');
        const items = [];
        w.querySelectorAll('[data-box-check]').forEach(chk => {
          if (!chk.checked) return;
          const kat = chk.dataset.kat;
          const qtyEl = w.querySelector(`[data-box-qty][data-kat="${kat}"]`);
          const qty = parseInt(qtyEl.value, 10) || 0;
          if (qty > 0) items.push({ katalogId: kat, qty });
        });
        if (!items.length) return toast('Pilih minimal 1 item.', 'error');
        c(); showLoader();
        try {
          const r = await api('saveTemplateBox', { token: S.token, payload: {
            id: item ? item.id : null,
            nama, hargaPaket,
            keterangan: get('keterangan'),
            aktif: w.querySelector('[data-f="aktif"]').checked,
            items
          }});
          toast(r.message, r.success ? 'success' : 'error');
          if (r.success) { S.templateBox = await api('getTemplateBox', { token: S.token }); MEM.clear(); }
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); render(); }
      } }
    ],
    onMount: (w) => {
      w.addEventListener('change', e => {
        const chk = e.target.closest('[data-box-check]');
        if (chk) {
          const kat = chk.dataset.kat;
          const qtyEl = w.querySelector(`[data-box-qty][data-kat="${kat}"]`);
          if (chk.checked && (parseInt(qtyEl.value, 10) || 0) === 0) qtyEl.value = 1;
          if (!chk.checked) qtyEl.value = 0;
          chk.closest('.item-selector').classList.toggle('selected', chk.checked);
        }
      });
      w.querySelectorAll('[data-box-qty]').forEach(inp => {
        inp.addEventListener('input', () => {
          const kat = inp.dataset.kat;
          const chk = w.querySelector(`[data-box-check][data-kat="${kat}"]`);
          const qty = parseInt(inp.value, 10) || 0;
          if (qty > 0 && chk) { chk.checked = true; chk.closest('.item-selector').classList.add('selected'); }
          else if (chk) { chk.checked = false; chk.closest('.item-selector').classList.remove('selected'); }
        });
      });
    }
  });
}

async function delTemplateBox(id) {
  if (!(await confirmDlg('Hapus template box?', 'Box tidak bisa dikembalikan.'))) return;
  showLoader();
  try {
    const r = await api('deleteTemplateBox', { token: S.token, id });
    toast(r.message, r.success ? 'success' : 'error');
    if (r.success) { S.templateBox = await api('getTemplateBox', { token: S.token }); MEM.clear(); }
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

// ============================================
//  FASE 3: PESANAN PELANGGAN
// ============================================
function tabPesananPelanggan() {
  const f = S.pesananFilter || {};
  const list = S.pesananPelanggan || [];
  const statusMap = { 'Dipesan':'dipesan', 'Siap':'siap', 'Diambil':'diambil', 'Selesai':'selesai', 'Batal':'batal' };
  const showDone = f.showDone === true;
  let filtered = list.filter(p => showDone ? true : (p.status !== 'Selesai' && p.status !== 'Batal'));

  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('shopping-bag')} Pesanan</h3>
      <div class="row" style="gap:4px">
        <button class="btn btn-ghost btn-sm" data-act="tab" data-tab="kalender-pesanan">${ico('cal','ico-sm')}</button>
        <button class="btn btn-primary btn-sm" data-act="add-pesanan-pelanggan">+ Pesanan</button>
      </div>
    </div>

    <div class="card">
      <div class="form-grid">
        <div class="field"><label>Dari Tanggal</label><input type="date" data-pes-filter-dari value="${f.dari || ''}" class="input field-sm"></div>
        <div class="field"><label>Sampai</label><input type="date" data-pes-filter-sampai value="${f.sampai || ''}" class="input field-sm"></div>
      </div>
      <div class="row" style="gap:6px">
        <button class="btn btn-primary btn-block btn-sm" data-act="apply-pesanan-filter">Terapkan</button>
        <button class="btn ${showDone ? 'btn-primary' : 'btn-ghost'} btn-sm" data-act="toggle-pesanan-done" data-show="${showDone ? '0' : '1'}" style="flex:0 0 auto">
          ${showDone ? '✓ Selesai' : 'Semua'}
        </button>
      </div>
    </div>

    ${!filtered.length ? '<div class="empty">' + ico('shopping-bag','ico') + '<p>Belum ada pesanan.</p></div>' :
      filtered.map(p => {
        const sCls = statusMap[p.status] || 'dipesan';
        const metodeCls = p.metodeAmbil === 'Diantar' ? 'metode-diantar' : 'metode-ambil';
        const jenisCls = p.jenisAmbil === 'WalkIn' ? 'metode-walkin' : 'metode-terjadwal';
        return `
          <div class="pesanan-card status-${sCls}">
            <div class="pesanan-header">
              <div style="min-width:0;flex:1">
                <div class="pesanan-nama">${esc(p.pelangganNama)}</div>
                ${p.pelangganHp ? `<div class="pesanan-hp">${ico('phone','ico-sm')} ${esc(p.pelangganHp)}</div>` : ''}
                <div class="pesanan-tanggal">${ico('cal','ico-sm')} Ambil: ${fmtDateShort(p.tanggalAmbil)}</div>
              </div>
              <div class="text-right" style="flex-shrink:0">
                <span class="status-badge ${sCls}">${esc(p.status)}</span>
              </div>
            </div>
            <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">
              <span class="pesanan-metode ${metodeCls}">${p.metodeAmbil === 'Diantar' ? ico('truck','ico-sm') : ico('store','ico-sm')} ${esc(p.metodeAmbil)}</span>
              <span class="pesanan-metode ${jenisCls}">${esc(p.jenisAmbil)}</span>
            </div>
            ${p.alamat ? `<div class="text-xs text-gray mt-2">${ico('home','ico-sm')} ${esc(p.alamat)}</div>` : ''}
            <div class="pesanan-total">
              <div class="row-between"><span class="text-gray">Total</span><strong>${fmtRp(p.totalSistem)}</strong></div>
              ${p.dp > 0 ? `<div class="row-between"><span class="text-gray">DP</span><span class="text-green">${fmtRp(p.dp)}</span></div>` : ''}
              ${p.sisaBayar > 0 ? `<div class="row-between"><span class="text-gray">Sisa</span><span class="text-amber font-semibold">${fmtRp(p.sisaBayar)}</span></div>` : ''}
              <div class="row-between total"><span>Total Bayar</span><span class="value">${fmtRp(p.dp > 0 ? p.dp : p.totalSistem)}</span></div>
            </div>
            <div class="row mt-3" style="gap:6px;flex-wrap:wrap">
              <button class="btn btn-ghost btn-sm" data-act="detail-pesanan-pelanggan" data-id="${esc(p.id)}">${ico('eye','ico-sm')} Detail</button>
              <button class="btn btn-ghost btn-sm" data-act="cetak-struk-pesanan" data-id="${esc(p.id)}">${ico('print','ico-sm')}</button>
              ${p.status === 'Dipesan' ? `
                <button class="btn btn-ghost btn-sm" data-act="status-pesanan" data-id="${esc(p.id)}" data-status="Siap">${ico('check','ico-sm')} Siap</button>
              ` : ''}
              ${(p.status === 'Siap' || p.status === 'Dipesan') ? `
                <button class="btn btn-success btn-sm" style="flex:1" data-act="selesaikan-pesanan" data-id="${esc(p.id)}">${ico('check','ico-sm')} Selesaikan</button>
              ` : ''}
              ${p.status !== 'Selesai' && p.status !== 'Batal' ? `
                <button class="btn btn-danger btn-sm" style="flex:0 0 auto" data-act="batal-pesanan" data-id="${esc(p.id)}">${ico('x','ico-sm')}</button>
              ` : ''}
              ${p.status === 'Batal' ? `
                <button class="btn btn-ghost btn-sm" data-act="del-pesanan-pelanggan" data-id="${esc(p.id)}" style="flex:0 0 auto">${ico('trash','ico-sm')}</button>
              ` : ''}
            </div>
          </div>`;
      }).join('')}`;
}

function formPesananPelanggan(id) {
  const item = id && S.pesananPelanggan ? S.pesananPelanggan.find(p => p.id === id) : null;

  const state = {
    items: [],
    addedBoxes: {}
  };

  const rebuildItemsFromBoxes = () => {
    const freeItems = state.items.filter(it => !it.dariBoxId);
    state.items = freeItems;

    Object.entries(state.addedBoxes).forEach(([boxId, qtyBox]) => {
      const qtyBoxNum = parseInt(qtyBox, 10) || 0;
      if (qtyBoxNum <= 0) { delete state.addedBoxes[boxId]; return; }
      const box = (S.templateBox || []).find(b => String(b.id) === String(boxId));
      if (!box) return;
      const totalPcsInBox = box.items.reduce((sum, bi) => sum + (bi.qty || 0), 0);
      const hargaPerPcs = totalPcsInBox > 0 ? Math.round(box.hargaPaket / totalPcsInBox) : 0;
      box.items.forEach(bi => {
        state.items.push({
          katalogId: bi.katalogId,
          namaItem: bi.nama,
          qty: bi.qty * qtyBoxNum,
          hargaJual: hargaPerPcs,
          dariBoxId: box.id,
          dariBoxNama: box.nama + (qtyBoxNum > 1 ? ' ×' + qtyBoxNum : '')
        });
      });
    });
  };

  const updateBoxQuantity = (boxId, qtyValue) => {
    const qtyBox = parseInt(qtyValue, 10) || 0;
    if (qtyBox <= 0) delete state.addedBoxes[boxId];
    else state.addedBoxes[boxId] = qtyBox;
    rebuildItemsFromBoxes();
    renderFormBody();
    const totalEl = $('#form-pesanan-body [data-total-display]');
    if (totalEl) {
      const total = state.items.reduce((s, it) => s + (it.qty * it.hargaJual), 0);
      totalEl.textContent = fmtRp(total);
    }
  };

  window.__updateBoxQty = updateBoxQuantity;

  const initForm = async () => {
    if (item && !state.items.length) {
      showLoader();
      try {
        const detail = await api('getPesananPelangganDetail', { token: S.token, id });
        state.items = (detail.items || []).map(it => ({
          katalogId: it.katalogId, namaItem: it.nama, qty: it.qty,
          hargaJual: it.hargaJual, dariBoxId: it.dariBoxId, dariBoxNama: it.dariBoxNama
        }));
        state.items.forEach(it => {
          if (it.dariBoxId) {
            const m = String(it.dariBoxNama || '').match(/×(\d+)/);
            const qtyBox = m ? parseInt(m[1], 10) : 1;
            state.addedBoxes[it.dariBoxId] = qtyBox;
          }
        });
      } catch (e) { toast(e.message, 'error'); }
      finally { hideLoader(); }
    }
    renderFormBody();
  };

  const renderFormBody = () => {
    const boxList = S.templateBox || [];
    const katalog = S.katalog || [];
    const totalSistem = state.items.reduce((s, it) => s + (it.qty * it.hargaJual), 0);
    const bodyEl = $('#form-pesanan-body');
    if (!bodyEl) return;

    bodyEl.innerHTML = `
      <div class="card card-flat" style="padding:14px">
        <div class="card-title" style="margin-bottom:10px;font-size:12px">${ico('user','ico-sm')} Pelanggan</div>
        <div class="field"><label>Nama *</label>
          <input type="text" data-f="pelangganNama" class="input" value="${item ? esc(item.pelangganNama) : ''}" placeholder="Nama pelanggan">
        </div>
        <div class="field"><label>No. HP</label>
          <input type="tel" data-f="pelangganHp" class="input" value="${item ? esc(item.pelangganHp) : ''}" placeholder="08xxx">
        </div>
        <div class="field" style="margin-bottom:0"><label>Email (opsional)</label>
          <input type="email" data-f="pelangganEmail" class="input" value="${item ? esc(item.pelangganEmail || '') : ''}" placeholder="nama@email.com">
        </div>
      </div>

      <div class="card card-flat" style="padding:14px">
        <div class="card-title" style="margin-bottom:10px;font-size:12px">${ico('cal','ico-sm')} Pengambilan</div>
        <div class="field"><label>Tanggal Ambil *</label>
          <input type="date" data-f="tanggalAmbil" class="input" value="${item ? item.tanggalAmbil : todayISO()}">
        </div>
        <div class="field"><label>Jenis</label>
          <div class="chip-group" data-f="jenisAmbil">
            <button type="button" class="chip ${!item || item.jenisAmbil === 'Terjadwal' ? 'active' : ''}" data-val="Terjadwal">Terjadwal</button>
            <button type="button" class="chip ${item && item.jenisAmbil === 'WalkIn' ? 'active' : ''}" data-val="WalkIn">Walk-in</button>
          </div>
        </div>
        <div class="field"><label>Metode</label>
          <div class="chip-group" data-f="metodeAmbil">
            <button type="button" class="chip ${!item || item.metodeAmbil === 'Ambil' ? 'active' : ''}" data-val="Ambil">Ambil Sendiri</button>
            <button type="button" class="chip ${item && item.metodeAmbil === 'Diantar' ? 'active' : ''}" data-val="Diantar">Diantar</button>
          </div>
        </div>
        <div class="field" data-alamat-field style="margin-bottom:0;${(!item || item.metodeAmbil !== 'Diantar') ? 'display:none' : ''}">
          <label>Alamat Pengiriman</label>
          <textarea data-f="alamat" class="textarea">${item ? esc(item.alamat || '') : ''}</textarea>
        </div>
      </div>

      <div class="card card-flat" style="padding:14px">
        <div class="card-title" style="margin-bottom:10px;font-size:12px">${ico('package','ico-sm')} Item Pesanan</div>
        ${boxList.length ? `
          <p class="text-xs font-semibold text-gray mb-2">Paket Box:</p>
          ${boxList.map(b => {
            const addedQty = state.addedBoxes[b.id] || 0;
            const isAdded = addedQty > 0;
            const totalPcs = b.items.reduce((s, i) => s + i.qty, 0);
            return `
              <div class="box-card" style="margin-bottom:8px;padding:12px;${isAdded ? 'border:1.5px solid #10b981;background:#f0fdf4' : ''}">
                <div class="row-between mb-2">
                  <strong style="font-size:13px">${esc(b.nama)}</strong>
                  <strong style="color:var(--amber-600);font-size:14px">${fmtRp(b.hargaPaket)}</strong>
                </div>
                <div class="text-xs text-gray mb-3">${b.items.length} jenis · ${totalPcs} pcs</div>
                <div class="row" style="gap:6px">
                  <input type="number" min="0" value="${addedQty}" data-box-add-qty="${esc(b.id)}"
                    class="input field-sm" style="width:70px;text-align:center"
                    oninput="window.__updateBoxQty('${esc(b.id)}', this.value)">
                  ${isAdded
                    ? `<button class="btn btn-ghost btn-sm" data-act="reset-box" data-id="${esc(b.id)}" style="flex:1">Kosongkan</button>`
                    : `<button class="btn btn-primary btn-sm" data-act="add-box" data-id="${esc(b.id)}" style="flex:1">+ Tambah Box</button>`
                  }
                </div>
              </div>`;
          }).join('')}
        ` : ''}

        <p class="text-xs font-semibold text-gray mb-2 mt-3">Atau Item Bebas:</p>
        ${katalog.map(k => `
          <div class="item-selector">
            <div class="item-selector-info">
              <div class="item-selector-name">${esc(k.nama)}</div>
              <div class="item-selector-price">${fmtRp(k.hargaJual)}</div>
            </div>
            <input type="number" min="0" value="0" data-free-qty data-kat="${esc(k.id)}" class="item-selector-qty">
            <button class="btn btn-primary btn-sm" data-act="add-free-item" data-kat="${esc(k.id)}">+</button>
          </div>`).join('')}
      </div>

      ${state.items.length ? `
        <div class="card" style="padding:14px">
          <div class="card-title" style="margin-bottom:10px;font-size:12px">Item Ditambahkan (${state.items.length})</div>
          ${state.items.map((it, idx) => `
            <div class="detail-item-row">
              <div class="detail-item-main">
                <div class="detail-item-name">${esc(it.namaItem)}</div>
                <div class="detail-item-meta">${it.qty} × ${fmtRp(it.hargaJual)}${it.dariBoxNama ? ' · dari ' + esc(it.dariBoxNama) : ''}</div>
              </div>
              <div class="detail-item-price">${fmtRp(it.qty * it.hargaJual)}</div>
              <button class="action-btn action-del" data-act="remove-item" data-idx="${idx}">${ico('x','ico-sm')}</button>
            </div>`).join('')}
        </div>
      ` : ''}

      <div class="card card-flat" style="padding:14px">
        <div class="card-title" style="margin-bottom:10px;font-size:12px">${ico('money','ico-sm')} Pembayaran</div>
        <div class="row-between text-sm mb-2">
          <span class="text-gray">Total</span>
          <strong data-total-display>${fmtRp(totalSistem)}</strong>
        </div>
        <div class="field"><label>DP (uang muka)</label>
          <input type="number" data-f="dp" class="input" value="${item ? item.dp : 0}" placeholder="0" min="0">
        </div>
        <div class="field"><label>Metode Bayar</label>
          <div class="chip-group" data-f="metodeBayar">
            <button type="button" class="chip ${!item || item.metodeBayar === 'Tunai' ? 'active' : ''}" data-val="Tunai">Tunai</button>
            <button type="button" class="chip ${item && item.metodeBayar === 'QRIS' ? 'active' : ''}" data-val="QRIS">QRIS</button>
          </div>
        </div>
        <div class="field" style="margin-bottom:0"><label>Catatan</label>
          <textarea data-f="catatan" class="textarea">${item ? esc(item.catatan || '') : ''}</textarea>
        </div>
      </div>
    `;
  };

  modal({
    title: item ? 'Edit Pesanan' : 'Pesanan Baru',
    body: `<div id="form-pesanan-body"></div>`,
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
        const get = s => w.querySelector(`[data-f="${s}"]`)?.value || '';
        const jenis = w.querySelector('[data-f="jenisAmbil"] .chip.active')?.dataset.val || 'Terjadwal';
        const metode = w.querySelector('[data-f="metodeAmbil"] .chip.active')?.dataset.val || 'Ambil';
        const metodeBayar = w.querySelector('[data-f="metodeBayar"] .chip.active')?.dataset.val || 'Tunai';

        if (!get('pelangganNama').trim()) return toast('Nama pelanggan wajib.', 'error');
        if (!state.items.length) return toast('Tambahkan minimal 1 item.', 'error');

        c(); showLoader();
        try {
          const r = await api('savePesananPelanggan', { token: S.token, payload: {
            id: item ? item.id : null,
            pelangganNama: get('pelangganNama'),
            pelangganHp: get('pelangganHp'),
            pelangganEmail: get('pelangganEmail'),
            tanggalAmbil: get('tanggalAmbil'),
            jenisAmbil: jenis,
            metodeAmbil: metode,
            alamat: get('alamat'),
            catatan: get('catatan'),
            dp: parseInt(get('dp'), 10) || 0,
            metodeBayar,
            items: state.items
          }});
          toast(r.message, r.success ? 'success' : 'error');
          if (r.success) {
            S.pesananPelanggan = await api('getPesananPelanggan', { token: S.token, filter: S.pesananFilter || {} });
            S.dash = await api('getAdminDashboard', { token: S.token });
            MEM.clear();
          }
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); render(); }
      } }
    ],
    onMount: async (w, close) => {
      w.addEventListener('click', async e => {
        const chip = e.target.closest('.chip');
        if (chip) {
          const group = chip.closest('.chip-group');
          group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          if (group.dataset.f === 'metodeAmbil') {
            const af = w.querySelector('[data-alamat-field]');
            if (af) af.style.display = chip.dataset.val === 'Diantar' ? '' : 'none';
          }
          return;
        }
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const a = btn.dataset.act;

        if (a === 'add-box') {
          const boxId = btn.dataset.id;
          const box = (S.templateBox || []).find(b => String(b.id) === String(boxId));
          if (!box) return;
          const qtyEl = w.querySelector(`[data-box-add-qty="${boxId}"]`);
          const qtyBox = parseInt(qtyEl.value, 10) || 0;
          if (qtyBox <= 0) return toast('Isi qty box minimal 1.', 'error');

          state.addedBoxes[boxId] = qtyBox;
          rebuildItemsFromBoxes();
          renderFormBody();
          toast(`Box "${box.nama}" ditambahkan (${qtyBox}×)`, 'success');
          return;
        }

        if (a === 'reset-box') {
          const boxId = btn.dataset.id;
          delete state.addedBoxes[boxId];
          rebuildItemsFromBoxes();
          renderFormBody();
          toast('Box dikosongkan.', 'info');
          return;
        }

        if (a === 'add-free-item') {
          const katId = btn.dataset.kat;
          const qtyEl = w.querySelector(`[data-free-qty][data-kat="${katId}"]`);
          const qty = parseInt(qtyEl.value, 10) || 0;
          if (qty <= 0) return toast('Isi qty dulu.', 'error');
          const k = S.katalog.find(x => String(x.id) === String(katId));
          if (!k) return;
          state.items.push({
            katalogId: k.id,
            namaItem: k.nama,
            qty,
            hargaJual: k.hargaJual,
            dariBoxId: '',
            dariBoxNama: ''
          });
          qtyEl.value = 0;
          renderFormBody();
          toast('Item ditambahkan.', 'success');
          return;
        }

        if (a === 'remove-item') {
          const idx = parseInt(btn.dataset.idx, 10);
          const removed = state.items[idx];
          if (removed && removed.dariBoxId) {
            const stillHas = state.items.some((it, i) => i !== idx && it.dariBoxId === removed.dariBoxId);
            if (!stillHas) delete state.addedBoxes[removed.dariBoxId];
          }
          state.items.splice(idx, 1);
          renderFormBody();
          return;
        }
      });

      await initForm();
    }
  });
}

async function showDetailPesananPelanggan(id) {
  showLoader();
  try {
    const d = await api('getPesananPelangganDetail', { token: S.token, id });
    hideLoader();
    const itemsHtml = (d.items || []).length ? d.items.map(it =>
      `<div class="detail-item-row">
        <div class="detail-item-main">
          <div class="detail-item-name">${esc(it.nama)}</div>
          <div class="detail-item-meta">${it.qty} × ${fmtRp(it.hargaJual)}${it.dariBoxNama ? ' · dari ' + esc(it.dariBoxNama) : ''}</div>
        </div>
        <div class="detail-item-price">${fmtRp(it.subtotal)}</div>
      </div>`
    ).join('') : '<p class="text-xs text-gray">Tidak ada item.</p>';

    const statusSteps = ['Dipesan','Siap','Diambil','Selesai'];
    const currentIdx = statusSteps.indexOf(d.status);
    const timelineHtml = statusSteps.map((s, i) => {
      const cls = i < currentIdx ? 'done' : i === currentIdx ? 'current' : '';
      return `<div class="timeline-item ${cls}"><div class="timeline-label">${s}</div></div>`;
    }).join('');

    modal({
      title: 'Detail Pesanan',
      body: `
        <div class="card-flat" style="padding:12px;margin-bottom:12px">
          <div class="row-between mb-2">
            <strong>${esc(d.pelangganNama)}</strong>
            <span class="status-badge ${d.status.toLowerCase()}">${esc(d.status)}</span>
          </div>
          ${d.pelangganHp ? `<div class="text-xs text-gray">${ico('phone','ico-sm')} ${esc(d.pelangganHp)}</div>` : ''}
          ${d.pelangganEmail ? `<div class="text-xs text-gray mt-1">${ico('mail','ico-sm')} ${esc(d.pelangganEmail)}</div>` : ''}
          <div class="text-xs text-gray mt-1">${ico('cal','ico-sm')} Ambil: ${fmtDateShort(d.tanggalAmbil)}</div>
          <div class="text-xs text-gray mt-1">${d.metodeAmbil === 'Diantar' ? ico('truck','ico-sm') : ico('store','ico-sm')} ${esc(d.metodeAmbil)} · ${esc(d.jenisAmbil)}</div>
          ${d.alamat ? `<div class="text-xs text-gray mt-1">${ico('home','ico-sm')} ${esc(d.alamat)}</div>` : ''}
        </div>
        <p class="text-xs font-semibold text-gray mb-2">Timeline</p>
        <div class="timeline">${timelineHtml}</div>
        <p class="text-xs font-semibold text-gray mb-2 mt-3">Item</p>
        ${itemsHtml}
        <div class="card-flat" style="padding:12px;margin-top:12px">
          <div class="row-between text-sm mb-1"><span class="text-gray">Total</span><strong>${fmtRp(d.totalSistem)}</strong></div>
          ${d.dp > 0 ? `<div class="row-between text-sm"><span class="text-gray">DP</span><span class="text-green">${fmtRp(d.dp)}</span></div>` : ''}
          ${d.sisaBayar > 0 ? `<div class="row-between text-sm"><span class="text-gray">Sisa</span><span class="text-amber font-bold">${fmtRp(d.sisaBayar)}</span></div>` : ''}
        </div>
        ${d.catatan ? `<div class="alert alert-info mt-3">${ico('info','ico-sm')}<span>${esc(d.catatan)}</span></div>` : ''}
      `,
      actions: [{ label: 'Tutup', onClick: c => c() }]
    });
  } catch (e) { hideLoader(); toast(e.message, 'error'); }
}

async function updateStatusPesanan(id, status) {
  showLoader();
  try {
    const r = await api('updateStatusPesanan', { token: S.token, id, status });
    toast(r.message, r.success ? 'success' : 'error');
    if (r.success) S.pesananPelanggan = await api('getPesananPelanggan', { token: S.token, filter: S.pesananFilter || {} });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

async function selesaikanPesanan(id) {
  const p = (S.pesananPelanggan || []).find(x => x.id === id);
  if (!p) return toast('Pesanan tidak ditemukan.', 'error');

  const needBonus = p.metodeAmbil === 'Diantar';
  const karyawans = S.users.filter(u => u.role === 'karyawan' && u.aktif);

  modal({
    title: 'Selesaikan Pesanan',
    body: `
      <div class="card-flat" style="padding:12px;margin-bottom:12px">
        <strong>${esc(p.pelangganNama)}</strong>
        <div class="text-xs text-gray mt-1">Total: ${fmtRp(p.totalSistem)}</div>
        ${p.sisaBayar > 0 ? `<div class="text-sm text-amber font-bold mt-2">Sisa bayar: ${fmtRp(p.sisaBayar)}</div>` : ''}
      </div>
      <div class="alert alert-info">${ico('info','ico-sm')}<span>Stok akan otomatis berkurang, Kas akan bertambah${p.sisaBayar > 0 ? ' (pelunasan ' + fmtRp(p.sisaBayar) + ')' : ''}.</span></div>
      ${needBonus && karyawans.length ? `
        <p class="text-xs font-semibold text-gray mb-2 mt-3">${ico('truck','ico-sm')} Bonus Antar (opsional)</p>
        <div class="field"><label>Karyawan yang antar</label>
          <select data-b="userId" class="select">
            <option value="">-- Tidak ada bonus --</option>
            ${karyawans.map(u => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-grid">
          <div class="field"><label>Jarak (km)</label><input type="number" data-b="jarakKm" class="input" value="0"></div>
          <div class="field"><label>Nominal Bonus</label><input type="number" data-b="nominal" class="input" value="0"></div>
        </div>
      ` : ''}
    `,
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Selesaikan', className: 'btn-success', onClick: async (c, w) => {
        const bonus = { userId: '', jarakKm: 0, nominal: 0 };
        if (needBonus) {
          bonus.userId = w.querySelector('[data-b="userId"]')?.value || '';
          bonus.jarakKm = parseInt(w.querySelector('[data-b="jarakKm"]')?.value, 10) || 0;
          bonus.nominal = parseInt(w.querySelector('[data-b="nominal"]')?.value, 10) || 0;
        }
        c(); showLoader();
        try {
          const r = await api('selesaikanPesanan', { token: S.token, id, payload: { bonusAntar: bonus } });
          toast(r.message, r.success ? 'success' : 'error');
          if (r.success) {
            S.pesananPelanggan = await api('getPesananPelanggan', { token: S.token, filter: S.pesananFilter || {} });
            S.dash = await api('getAdminDashboard', { token: S.token });
            MEM.clear();
          }
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); render(); }
      } }
    ]
  });
}

async function batalPesanan(id) {
  if (!(await confirmDlg('Batalkan pesanan?', 'Status akan jadi Batal.'))) return;
  updateStatusPesanan(id, 'Batal');
}

async function delPesananPelanggan(id) {
  if (!(await confirmDlg('Hapus pesanan?', 'Pesanan akan dihapus permanen.'))) return;
  showLoader();
  try {
    const r = await api('deletePesananPelanggan', { token: S.token, id });
    toast(r.message, r.success ? 'success' : 'error');
    if (r.success) S.pesananPelanggan = await api('getPesananPelanggan', { token: S.token, filter: S.pesananFilter || {} });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

async function applyPesananFilter() {
  S.pesananFilter = {
    dari: ($('[data-pes-filter-dari]') || {}).value || '',
    sampai: ($('[data-pes-filter-sampai]') || {}).value || '',
    showDone: S.pesananFilter.showDone || false
  };
  showLoader();
  try {
    S.pesananPelanggan = await api('getPesananPelanggan', { token: S.token, filter: S.pesananFilter });
    toast('Filter diterapkan', 'success');
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

function togglePesananDone(show) {
  S.pesananFilter = S.pesananFilter || {};
  S.pesananFilter.showDone = show;
  render();
}

async function cetakStrukPesanan(id) {
  showLoader();
  try {
    const d = await api('getPesananPelangganDetail', { token: S.token, id });
    hideLoader();
    const itemsHtml = (d.items || []).map(it =>
      `<div>${esc(it.nama)}</div>
       <div style="display:flex;justify-content:space-between"><span>${it.qty} x ${(it.hargaJual||0).toLocaleString('id-ID')}</span><span>${(it.subtotal||0).toLocaleString('id-ID')}</span></div>`
    ).join('');
    const html = `
      <div id="struk-print" style="font-family:monospace;font-size:12px;max-width:280px;margin:0 auto;padding:8px;background:#fff">
        <div style="text-align:center;margin-bottom:8px">
          <strong style="font-size:14px">KUE AS-SYIFA</strong>
          <div>Struk Pesanan</div>
          <div>${esc(d.tanggalAmbil)}</div>
        </div>
        <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:6px 0;margin:6px 0">
          <div><strong>${esc(d.pelangganNama)}</strong></div>
          ${d.pelangganHp ? `<div>${esc(d.pelangganHp)}</div>` : ''}
          <div style="margin-top:4px">${d.metodeAmbil === 'Diantar' ? 'Diantar' : 'Ambil Sendiri'}</div>
        </div>
        <div style="border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px">${itemsHtml}</div>
        <div style="display:flex;justify-content:space-between"><span>TOTAL:</span><strong>${(d.totalSistem||0).toLocaleString('id-ID')}</strong></div>
        ${d.dp > 0 ? `<div style="display:flex;justify-content:space-between"><span>DP:</span><span>${(d.dp).toLocaleString('id-ID')}</span></div>` : ''}
        ${d.sisaBayar > 0 ? `<div style="display:flex;justify-content:space-between"><strong>SISA:</strong><strong>${(d.sisaBayar).toLocaleString('id-ID')}</strong></div>` : ''}
        <div style="text-align:center;margin-top:12px;font-size:10px">-- Terima Kasih --</div>
      </div>`;
    modal({
      title: 'Struk Pesanan',
      body: html,
      actions: [
        { label: 'Tutup', onClick: c => c() },
        { label: '🖨️ Cetak', className: 'btn-primary', onClick: (c) => {
          const w = window.open('', '_blank');
          w.document.write('<html><head><title>Struk</title></head><body onload="window.print();window.close()">' + html + '</body></html>');
          w.document.close();
        } }
      ]
    });
  } catch (e) { hideLoader(); toast(e.message, 'error'); }
}

// ============================================
//  FASE 3: KALENDER PESANAN
// ============================================
function tabKalenderPesanan() {
  const bulan = S.kalenderBulan || monthISO();
  const data = S.kalenderData;
  const [yy, mm] = bulan.split('-').map(Number);
  const firstDay = new Date(yy, mm - 1, 1);
  const lastDay = new Date(yy, mm, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const today = todayISO();

  const pesananMap = {};
  if (data) data.forEach(d => { pesananMap[d.tanggal] = d; });

  let html = `<h3 class="card-title">${ico('cal')} Kalender Pesanan</h3>`;
  html += `<div class="card">
    <div class="row" style="gap:8px;align-items:center">
      <button class="btn btn-ghost btn-sm" data-act="kalender-prev">${ico('chevron-left','ico-sm')}</button>
      <input type="month" data-kalender-bulan value="${bulan}" class="input field-sm" style="flex:1;text-align:center">
      <button class="btn btn-ghost btn-sm" data-act="kalender-next">${ico('chevron-right','ico-sm')}</button>
    </div>
    <button class="btn btn-primary btn-block btn-sm mt-2" data-act="load-kalender">Muat Kalender</button>
  </div>`;

  html += `<div class="card">
    <div class="calendar-grid">
      ${['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map(d => `<div class="calendar-header">${d}</div>`).join('')}
      ${Array.from({ length: startDow }, () => '<div class="calendar-day empty-day"></div>').join('')}
      ${Array.from({ length: daysInMonth }, (_, i) => {
        const dayNum = i + 1;
        const ds = `${bulan}-${String(dayNum).padStart(2,'0')}`;
        const p = pesananMap[ds];
        const isToday = ds === today;
        const cls = ['calendar-day'];
        if (isToday) cls.push('today');
        if (p && p.pesanan.length > 0) cls.push('has-pesanan');
        return `<div class="${cls.join(' ')}" data-act="kalender-day" data-tgl="${ds}">
          ${dayNum}
          ${p && p.pesanan.length > 0 ? `<span class="count">${p.pesanan.length}</span>` : ''}
        </div>`;
      }).join('')}
    </div>
    ${data ? `<div class="text-xs text-gray mt-3 text-center">
      Total: ${data.reduce((s, d) => s + d.pesanan.length, 0)} pesanan bulan ini
    </div>` : ''}
  </div>`;

  if (data && data.length) {
    html += `<h3 class="card-title">Detail per Tanggal</h3>`;
    html += data.map(d => `
      <div class="card">
        <div class="row-between mb-2">
          <strong class="text-sm">${fmtDateShort(d.tanggal)}</strong>
          <span class="badge badge-amber">${d.pesanan.length} pesanan</span>
        </div>
        ${d.pesanan.map(p => `
          <div class="row-between" style="padding:6px 0;border-bottom:1px solid #f8fafc;font-size:13px">
            <div style="min-width:0;flex:1">
              <div style="font-weight:600">${esc(p.pelangganNama)}</div>
              <div class="text-xs text-gray">${esc(p.metodeAmbil)} · ${fmtRp(p.totalSistem)}</div>
            </div>
            <span class="status-badge ${p.status.toLowerCase()}">${esc(p.status)}</span>
          </div>`).join('')}
      </div>`).join('');
  }
  return html;
}

async function loadKalender() {
  const el = $('[data-kalender-bulan]');
  const bulan = el ? el.value : monthISO();
  S.kalenderBulan = bulan;
  showLoader();
  try {
    S.kalenderData = await api('getPesananKalender', { token: S.token, bulan });
    render();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
}

function kalenderPrev() {
  const b = S.kalenderBulan || monthISO();
  const [yy, mm] = b.split('-').map(Number);
  const prev = new Date(yy, mm - 2, 1);
  S.kalenderBulan = prev.toISOString().slice(0, 7);
  loadKalender();
}

function kalenderNext() {
  const b = S.kalenderBulan || monthISO();
  const [yy, mm] = b.split('-').map(Number);
  const next = new Date(yy, mm, 1);
  S.kalenderBulan = next.toISOString().slice(0, 7);
  loadKalender();
}

function kalenderDay(tgl) {
  const data = (S.kalenderData || []).find(d => d.tanggal === tgl);
  if (!data || !data.pesanan.length) return toast('Tidak ada pesanan.', 'info');
  modal({
    title: 'Pesanan ' + fmtDateShort(tgl),
    body: data.pesanan.map(p => `
      <div class="row-between" style="padding:10px 0;border-bottom:1px solid #f8fafc">
        <div style="min-width:0;flex:1">
          <div style="font-weight:600">${esc(p.pelangganNama)}</div>
          <div class="text-xs text-gray">${esc(p.metodeAmbil)} · ${fmtRp(p.totalSistem)}</div>
        </div>
        <span class="status-badge ${p.status.toLowerCase()}">${esc(p.status)}</span>
      </div>`).join(''),
    actions: [{ label: 'Tutup', onClick: c => c() }]
  });
}

// ============================================
//  FASE 4: ANALYTICS
// ============================================
async function loadAnalytics() {
  const range = S.analyticsRange || 30;
  showLoader();
  try {
    S.analytics = await api('getAnalytics', { token: S.token, range });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
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

  // Global
  if (a === 'logout') return doLogout();
  if (a === 'tab') return switchTab(tab);
  if (a === 'refresh') return doRefresh();
  if (a === 'refresh-stok') return loadKartuStok();
  if (a === 'refresh-analytics') return loadAnalytics();

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
  if (a === 'absen-masuk') return doAbsenMasuk();
  if (a === 'absen-keluar') return doAbsenKeluar();

  // Admin — Setoran
  if (a === 'apply-setoran-filter') return applySetoranFilter();
  if (a === 'approve') return doApprove(id);
  if (a === 'reject') return doReject(id);
  if (a === 'detail-setoran') return showSetoranDetail(id);
  if (a === 'edit-setoran') return formEditSetoran(id);
  if (a === 'cetak-struk') return showStruk(id);
  if (a === 'add-kas') return formKas();

  // Master
  if (a === 'add-katalog') return formKatalog();
  if (a === 'edit-katalog') return formKatalog(id);
  if (a === 'del-katalog') return delKatalog(id);
  if (a === 'add-supplier') return formSupplier();
  if (a === 'edit-supplier') return formSupplier(id);
  if (a === 'del-supplier') return delSupplier(id);
  if (a === 'add-lapak') return formLapak();
  if (a === 'edit-lapak') return formLapak(id);
  if (a === 'del-lapak') return delLapak(id);
  if (a === 'add-user') return formUser();
  if (a === 'edit-user') return formUser(id);
  if (a === 'del-user') return delUser(id);
  if (a === 'reset-user-pwd') return resetUserPwd(id);

  // Distribusi / belanja / jadwal
  if (a === 'load-distribusi') return loadDistribusi();
  if (a === 'save-distribusi') return saveDistribusi();
  if (a === 'add-belanja') return formBelanja();
  if (a === 'edit-belanja') return formBelanja(id);
  if (a === 'del-belanja') return delBelanja(id);
  if (a === 'add-jadwal') return formJadwal();
  if (a === 'edit-jadwal') return formJadwal(id);
  if (a === 'del-jadwal') return delJadwal(id);

  // Kasbon
  if (a === 'add-kasbon') return formKasbon(true);
  if (a === 'reject-kasbon') return adminRejectKasbon(id);
  if (a === 'del-kasbon') return delKasbon(id);

  // Gaji / pesanan supplier
  if (a === 'add-setting-gaji') return formSettingGaji();
  if (a === 'edit-setting-gaji') return formSettingGaji(id);
  if (a === 'add-pesanan') return formPesanan();
  if (a === 'edit-pesanan') return formPesanan(id);
  if (a === 'del-pesanan') return delPesanan(id);

  // Laporan
  if (a === 'load-laporan') return loadLaporan();
  if (a === 'export-csv') return doExportCSV();

  // Retur / Harga / Tutup buku
  if (a === 'approve-retur') return approveRetur(id);
  if (a === 'reject-retur') return rejectRetur(id);
  if (a === 'add-harga-tingkat') return formHargaTingkat();
  if (a === 'edit-harga-tingkat') return formHargaTingkat(id);
  if (a === 'del-harga-tingkat') return delHargaTingkat(id);
  if (a === 'add-tutup-buku') return formTutupBuku();
  if (a === 'unlock-periode') return unlockPeriode(id);

  // Notifikasi / profil
  if (a === 'open-notif') return switchTab('notifikasi');
  if (a === 'mark-notif-read') return markNotifRead(id);
  if (a === 'test-notif') return testNotif();
  if (a === 'test-browser-notif') { testBrowserNotif(); return; }
  if (a === 'send-email-manual') return formSendEmailManual();
  if (a === 'change-password') return formChangePwd();
  if (a === 'backup-all') return doBackupAll();
  if (a === 'restore-modal') return formRestore();

  // Absensi
  if (a === 'load-absensi') return loadAbsensi();
  if (a === 'isi-absensi-form') return formIsiAbsensi();
  if (a === 'isi-absensi-user') return formIsiAbsensi(btn.dataset.userid);
  if (a === 'edit-absensi') return formEditAbsensi(id);
  if (a === 'del-absensi') return delAbsensi(id);
  if (a === 'lihat-absensi-user') return lihatDetailAbsensiUser(id);

  // Bonus
  if (a === 'add-bonus-antar') return formBonusAntar();
  if (a === 'edit-bonus-antar') return formBonusAntar(id);
  if (a === 'del-bonus-antar') return delBonusAntar(id);
  if (a === 'load-bonus') return loadBonusAntar();

  // Payroll
  if (a === 'add-setting-payroll') return formSettingPayroll();
  if (a === 'edit-setting-payroll') return formSettingPayroll(id);
  if (a === 'del-setting-payroll') return delSettingPayroll(id);
  if (a === 'load-hari-efektif') return loadHariEfektif();
  if (a === 'auto-hari-efektif') return autoHariEfektif(btn.dataset.bulan);
  if (a === 'edit-hari-efektif') return formEditHariEfektif(btn.dataset);
  if (a === 'load-payroll') return loadPayroll();
  if (a === 'bayar-payroll-bulk') return bayarPayrollBulk();
  if (a === 'profit-range') { S.profitRange = parseInt(btn.dataset.range, 10); return loadDashboardProfit(); }

  // Konsinyasi
  if (a === 'load-konsinyasi') return loadKonsinyasi();
  if (a === 'bayar-supplier') return formBayarSupplier(id);
  if (a === 'detail-konsinyasi') return showDetailKonsinyasi(id);

  // Analytics
  if (a === 'analytics-range') { S.analyticsRange = parseInt(btn.dataset.range, 10); return loadAnalytics(); }

  // FASE 3
  if (a === 'add-template-box') return formTemplateBox();
  if (a === 'edit-template-box') return formTemplateBox(id);
  if (a === 'del-template-box') return delTemplateBox(id);
  if (a === 'add-pesanan-pelanggan') return formPesananPelanggan();
  if (a === 'detail-pesanan-pelanggan') return showDetailPesananPelanggan(id);
  if (a === 'status-pesanan') return updateStatusPesanan(id, btn.dataset.status);
  if (a === 'selesaikan-pesanan') return selesaikanPesanan(id);
  if (a === 'batal-pesanan') return batalPesanan(id);
  if (a === 'del-pesanan-pelanggan') return delPesananPelanggan(id);
  if (a === 'apply-pesanan-filter') return applyPesananFilter();
  if (a === 'toggle-pesanan-done') return togglePesananDone(btn.dataset.show === '1');
  if (a === 'cetak-struk-pesanan') return cetakStrukPesanan(id);
  if (a === 'load-kalender') return loadKalender();
  if (a === 'kalender-prev') return kalenderPrev();
  if (a === 'kalender-next') return kalenderNext();
  if (a === 'kalender-day') return kalenderDay(btn.dataset.tgl);
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
      MEM.clear('jadwal');
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
    if (res.bootstrap) applyBootstrap(res.bootstrap);
    if (res.user.role === 'karyawan') await initKaryawan();
    render();
    setTimeout(preloadCommon, 500);

    // OneSignal: subscribe & set user (khusus admin)
    if (res.user.role === 'admin') {
      setTimeout(async () => {
        await setupOneSignalForUser();
        await setOneSignalUser(res.user.id);
      }, 1500);
    }
  } catch (err) { toast(err.message, 'error'); }
  finally { hideLoader(); btn.disabled = false; btn.textContent = 'Masuk'; }
}

function applyBootstrap(b) {
  if (!b) return;
  if (b.lapak) S.lapak = b.lapak;
  if (b.suppliers) S.suppliers = b.suppliers;
  if (b.katalog) S.katalog = b.katalog;
  if (b.users) S.users = b.users;
  if (b.templateBox) S.templateBox = b.templateBox;
  if (b.dash) S.dash = b.dash;
  if (b.setoran) S.setoran = b.setoran;
  if (b.kas) S.kas = b.kas;
  if (b.laporan) S.laporan = b.laporan;
  if (b.role === 'admin') { S.view = 'admin'; S.tab = 'home'; }
}

async function initKaryawan() {
  try {
    const myLapak = await api('getMyLapak', { token: S.token });
    if (myLapak.length === 0) {
      toast('Akun Anda belum ditugaskan ke lapak manapun. Hubungi admin.', 'error');
      S.view = 'login'; return;
    }
    if (myLapak.length > 1 && !S.lapakAktif) {
      S.view = 'karyawan';
      showPilihLapak(myLapak);
      return;
    }
    if (myLapak.length === 1) {
      S.lapakAktif = myLapak[0];
      localStorage.setItem('lapakAktif', JSON.stringify(S.lapakAktif));
      await api('setLapakAktif', { token: S.token, lapakId: S.lapakAktif.id });
    } else if (S.lapakAktif) {
      const valid = myLapak.some(l => l.id === S.lapakAktif.id);
      if (!valid) S.lapakAktif = myLapak[0];
      localStorage.setItem('lapakAktif', JSON.stringify(S.lapakAktif));
      await api('setLapakAktif', { token: S.token, lapakId: S.lapakAktif.id });
    }
    const [d, kb, ak] = await Promise.all([
      api('getKaryawanDashboard', { token: S.token }),
      api('getKasbon', { token: S.token, filter: {} }),
      api('absensiHariIni', { token: S.token }).catch(() => ({ status: 'belum' }))
    ]);
    S.karyawan = d; S.kasbon = kb; S.absensiHariIni = ak;
    if (S.karyawan.distribusi) {
      S.karyawan.distribusi.forEach(x => {
        if (S.rekap[x.katalogId] === undefined) S.rekap[x.katalogId] = 0;
      });
    }
    S.view = 'karyawan'; S.tab = 'home';
  } catch (e) {
    console.error('initKaryawan error:', e);
    toast('Gagal memuat data karyawan: ' + e.message, 'error');
    S.view = 'login';
  }
}

async function doLogout() {
  await logoutOneSignal();
  try { if (S.token) await api('logout', { token: S.token }); } catch (e) {}
  localStorage.removeItem('tk');
  localStorage.removeItem('lapakAktif');
  MEM.clear();
  Object.assign(S, {
    user: null, token: null, lapakAktif: null, view: 'login', tab: 'home',
    lapak: [], suppliers: [], katalog: [], users: [], belanja: [], jadwal: [],
    dash: null, karyawan: null, kasbon: null, gaji: null, laporan: null, setoran: null,
    kas: null, pesanan: null, settingGaji: null, rekapGaji: null,
    kartuStok: null, stokSaldo: null, retur: null, hargaTingkat: null,
    tutupBuku: null, notifikasi: null, rekap: {},
    absensiList: null, absensiFilter: {}, bonusAntar: null, bonusFilter: {},
    settingPayroll: null, hariEfektif: null,
    payrollBulan: null, payrollData: null, payrollHistory: null,
    dashboardProfit: null, absensiHariIni: null,
    konsinyasi: null, saldoSupplier: null, konsinyasiFilter: {},
    riwayatBayarSupplier: null,
    templateBox: null, pesananPelanggan: null, pesananFilter: {},
    pesananPelangganDetail: null, kalenderBulan: null, kalenderData: null,
    analytics: null, analyticsRange: 30
  });
  render();
}

function sessionExpired() {
  logoutOneSignal();
  localStorage.removeItem('tk');
  localStorage.removeItem('lapakAktif');
  MEM.clear();
  S.token = null; S.user = null; S.lapakAktif = null; S.view = 'login';
  render();
  toast('Sesi berakhir. Login ulang.', 'error');
}

async function tryAutoLogin() {
  if (!S.token) return render();
  try {
    const res = await api('bootstrap', { token: S.token });
    S.user = await api('getMe', { token: S.token });
    if (!S.user) throw new Error('UNAUTHORIZED');
    applyBootstrap(res);
    if (S.user.role === 'karyawan') await initKaryawan();
    render();
    setTimeout(preloadCommon, 500);

    // OneSignal: re-subscribe saat auto-login admin
    if (S.user.role === 'admin') {
      setTimeout(async () => {
        await setupOneSignalForUser();
        await setOneSignalUser(S.user.id);
      }, 1500);
    }
  } catch (e) {
    localStorage.removeItem('tk'); S.token = null; render();
  }
}

async function bootstrap() {
  showLoader();
  try {
    const res = await api('bootstrap', { token: S.token });
    applyBootstrap(res);
  } catch (e) {
    toast(e.message, 'error');
    if (String(e.message).indexOf('UNAUTHORIZED') !== -1) sessionExpired();
  } finally { hideLoader(); render(); }
}

async function preloadCommon() {
  if (!S.token || S.user.role !== 'admin') return;
  try {
    if (!S.belanja.length) apiCached('getBelanja', { token: S.token, filter: {} }, 'belanja', 60000).then(d => { S.belanja = d; }).catch(() => {});
    if (!S.jadwal.length) apiCached('getJadwal', { token: S.token, days: 30 }, 'jadwal', 120000).then(d => { S.jadwal = d; }).catch(() => {});
  } catch (e) {}
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
  if (S.karyawan.distribusi) S.karyawan.distribusi.forEach(x => { if (S.rekap[x.katalogId] === undefined) S.rekap[x.katalogId] = 0; });
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
  const tunaiEl = $('input[name=tunai]'), qrisEl = $('input[name=qris]');
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

async function doAbsenMasuk() {
  const lapakList = await api('getMyLapak', { token: S.token });
  const defaultLapak = (S.lapakAktif && S.lapakAktif.id) || (lapakList[0] && lapakList[0].id) || '';
  modal({
    title: 'Absen Masuk',
    body: `<p class="text-sm text-gray mb-3">Pilih lapak tempat Anda bekerja hari ini:</p>
      <div class="field"><label>Lapak</label>
        <select data-f="lapakId" class="select">
          ${lapakList.map(l => `<option value="${esc(l.id)}" ${l.id === defaultLapak ? 'selected' : ''}>${esc(l.nama)}</option>`).join('')}
        </select>
      </div>`,
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
  const ok = await confirmDlg('Absen Keluar?', 'Yakin absen keluar sekarang?', 'Ya, Keluar');
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
  showLoader();
  try {
    if (tab === 'setoran') S.setoran = await apiCached('getSetoranList', { token: S.token, filter: S._setoranFilter || {} }, 'setoran_' + JSON.stringify(S._setoranFilter || {}), 30000);
    if (tab === 'belanja') S.belanja = await apiCached('getBelanja', { token: S.token, filter: {} }, 'belanja', 60000);
    if (tab === 'jadwal') S.jadwal = await apiCached('getJadwal', { token: S.token, days: 30 }, 'jadwal', 120000);
    if (tab === 'kasbon') S.kasbon = await api('getKasbon', { token: S.token, filter: {} });
    if (tab === 'gaji') S.gaji = await api('getGaji', { token: S.token, filter: {} });
    if (tab === 'setting-gaji') S.settingGaji = await api('getSettingGaji', { token: S.token });
    if (tab === 'pesanan') S.pesanan = await api('getPesanan', { token: S.token, filter: {} });
    if (tab === 'laporan') S.laporan = await apiCached('getLaporan', { token: S.token, filter: {} }, 'laporan_default', 60000);
    if (tab === 'analytics') await loadAnalytics();
    if (tab === 'kartu-stok') await loadKartuStokData();
    if (tab === 'retur') S.retur = await api('getReturList', { token: S.token, filter: {} });
    if (tab === 'harga-tingkat') S.hargaTingkat = await api('getHargaTingkat', { token: S.token });
    if (tab === 'tutup-buku') S.tutupBuku = await api('getTutupBukuList', { token: S.token });
    if (tab === 'notifikasi') S.notifikasi = await api('getNotifikasi', { token: S.token, filter: {} });
    if (tab === 'absensi') await loadAbsensi();
    if (tab === 'absensi-hari-ini') S.absensiList = await api('getAbsensiKaryawan', { token: S.token, filter: { bulan: monthISO() } });
    if (tab === 'bonus-antar') await loadBonusAntar();
    if (tab === 'setting-payroll') {
      S.settingPayroll = await api('getSettingPayroll', { token: S.token });
      S.hariEfektif = await api('getHariEfektif', { token: S.token, bulan: monthISO() });
    }
    if (tab === 'payroll') S.payrollHistory = await api('getPayrollHistory', { token: S.token, filter: {} });
    if (tab === 'dashboard-profit') await loadDashboardProfit();
    if (tab === 'konsinyasi') await loadKonsinyasi();
    if (tab === 'riwayat-bayar-supplier') S.riwayatBayarSupplier = await api('getRiwayatBayarSupplier', { token: S.token, filter: {} });
    if (tab === 'template-box' && !S.templateBox) S.templateBox = await api('getTemplateBox', { token: S.token });
    if (tab === 'pesanan-pelanggan') S.pesananPelanggan = await api('getPesananPelanggan', { token: S.token, filter: S.pesananFilter || {} });
    if (tab === 'kalender-pesanan' && !S.kalenderData) await loadKalender();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
}

async function loadKartuStokData() {
  const [stok, saldo] = await Promise.all([
    api('getKartuStok', { token: S.token, filter: {} }),
    api('getStokSaldo', { token: S.token })
  ]);
  S.kartuStok = stok; S.stokSaldo = saldo;
}
async function loadKartuStok() { await loadKartuStokData(); render(); }

async function loadAbsensi() {
  const bulanEl = $('[data-abs-bulan]'), lapakEl = $('[data-abs-lapak]');
  const bulan = bulanEl ? bulanEl.value : monthISO();
  const lapakId = lapakEl ? lapakEl.value : '';
  S.absensiFilter = { bulan, lapakId };
  showLoader();
  try {
    S.absensiList = await api('getAbsensiKaryawan', { token: S.token, filter: { bulan, lapakId } });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
async function loadBonusAntar() {
  const f = S.bonusFilter || {};
  const bulan = f.bulan || monthISO();
  const userId = f.userId || '';
  S.bonusAntar = await api('getBonusAntar', { token: S.token, filter: { bulan, userId } });
  S.bonusFilter = { bulan, userId };
}
async function loadHariEfektif() {
  const el = $('[data-he-bulan]');
  const bulan = el ? el.value : monthISO();
  S.hariEfektif = await api('getHariEfektif', { token: S.token, bulan });
  render();
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
    const setoran = await api('getSetoranList', { token: S.token, filter: { dari: start, sampai: end } });
    const daily = [];
    const dateMap = {};
    setoran.forEach(s => {
      if (s.status !== 'approved' && s.status !== 'pending') return;
      if (!dateMap[s.tanggal]) dateMap[s.tanggal] = { tanggal: s.tanggal, omzet: 0, pengeluaran: 0 };
      dateMap[s.tanggal].omzet += s.totalSistem || 0;
      dateMap[s.tanggal].pengeluaran += s.pengeluaran || 0;
    });
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
async function loadKonsinyasi() {
  const supEl = $('[data-kons-supplier]'), statEl = $('[data-kons-status]');
  const supplierId = supEl ? supEl.value : '';
  const status = statEl ? statEl.value : '';
  S.konsinyasiFilter = { supplierId, status };
  const [list, saldo] = await Promise.all([
    api('getKonsinyasi', { token: S.token, filter: { supplierId, status } }),
    api('getSaldoSupplier', { token: S.token })
  ]);
  S.konsinyasi = list; S.saldoSupplier = saldo;
}

// ============================================
//  MENU SHEET
// ============================================
function showMoreMenu() {
  const sections = [
    {
      title: 'Operasional Harian',
      items: [
        { id:'distribusi', label:'Drop Stok', icon:'boxes' },
        { id:'kartu-stok', label:'Kartu Stok', icon:'boxes' },
        { id:'belanja', label:'Daftar Belanja', icon:'cart' },
        { id:'jadwal', label:'Jadwal Supplier', icon:'cal' },
        { id:'retur', label:'Retur Kue', icon:'return' }
      ]
    },
    {
      title: 'Pesanan & Paket',
      items: [
        { id:'template-box', label:'Template Box', icon:'package' },
        { id:'pesanan-pelanggan', label:'Pesanan Pelanggan', icon:'shopping-bag' },
        { id:'kalender-pesanan', label:'Kalender Pesanan', icon:'cal' },
        { id:'pesanan', label:'Pesanan Supplier', icon:'cart' }
      ]
    },
    {
      title: 'Master Data',
      items: [
        { id:'katalog', label:'Katalog Produk', icon:'box' },
        { id:'suppliers', label:'Supplier', icon:'truck' },
        { id:'lapak', label:'Lapak', icon:'store' },
        { id:'harga-tingkat', label:'Harga Grosir', icon:'tag' },
        { id:'users', label:'Users', icon:'users' }
      ]
    },
    {
      title: 'Karyawan & Payroll',
      items: [
        { id:'absensi', label:'Rekap Absensi', icon:'clock' },
        { id:'absensi-hari-ini', label:'Absen Hari Ini', icon:'list' },
        { id:'bonus-antar', label:'Bonus Antar', icon:'truck' },
        { id:'payroll', label:'Rekap Payroll', icon:'money' },
        { id:'setting-payroll', label:'Setting Payroll', icon:'settings' },
        { id:'kasbon', label:'Kasbon', icon:'money' }
      ]
    },
    {
      title: 'Konsinyasi & Keuangan',
      items: [
        { id:'konsinyasi', label:'Konsinyasi', icon:'truck' },
        { id:'riwayat-bayar-supplier', label:'Riwayat Bayar Supplier', icon:'file' },
        { id:'tutup-buku', label:'Tutup Buku', icon:'lock' },
        { id:'dashboard-profit', label:'Dashboard Profit', icon:'trending' },
        { id:'analytics', label:'Analytics Lengkap', icon:'trending-up' },
        { id:'laporan', label:'Laporan Lengkap', icon:'bar' }
      ]
    },
    {
      title: 'Akun',
      items: [
        { id:'profil', label:'Profil & Pengaturan', icon:'user' }
      ]
    }
  ];

  const body = `<div class="menu-sheet">
    ${sections.map(sec => `
      <div>
        <div class="menu-section-title">${esc(sec.title)}</div>
        <div class="menu-list">
          ${sec.items.map(m => `
            <button class="menu-item" data-m="${m.id}">
              ${ico(m.icon)}
              <span class="menu-item-label">${esc(m.label)}</span>
              ${ico('chevron-right', 'menu-item-chevron')}
            </button>`).join('')}
        </div>
      </div>`).join('')}
  </div>`;

  modal({
    title: 'Menu Lainnya',
    body,
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
    MEM.clear();
    await bootstrap();
    toast('Data dimuat ulang', 'success');
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

// ============================================
//  ADMIN ACTIONS — Setoran, Kas, Belanja
// ============================================
async function applySetoranFilter() {
  S._setoranFilter = {
    dari: ($('[data-filter-dari]') || {}).value || '',
    sampai: ($('[data-filter-sampai]') || {}).value || '',
    lapakId: ($('[data-filter-lapak]') || {}).value || '',
    status: ($('[data-filter-status]') || {}).value || ''
  };
  showLoader();
  try {
    S.setoran = await api('getSetoranList', { token: S.token, filter: S._setoranFilter });
    MEM.clear('setoran');
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
    MEM.clear();
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
    MEM.clear('setoran');
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
      '<div class="row-between" style="padding:8px 0;border-bottom:1px solid #f8fafc;font-size:13px">' +
      '<div style="min-width:0;flex:1"><strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(it.nama) + '</strong>' +
      '<span class="text-xs text-gray">Drop ' + it.qtyDrop + ' · Sisa ' + it.qtySisa + ' · Laku ' + it.qtyLaku + '</span></div>' +
      '<strong class="text-green">' + fmtRp(it.subtotal) + '</strong></div>'
    ).join('') : '<p class="text-xs text-gray">Tidak ada item.</p>';
    const pengHtml = (d.pengeluaran || []).length ? d.pengeluaran.map(p =>
      '<div class="row-between" style="padding:6px 0;font-size:13px"><span>' + esc(p.keterangan) + '</span><span class="text-red">- ' + fmtRp(p.nominal) + '</span></div>'
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
  if (s.locked) return toast('Setoran terkunci.', 'error');
  modal({
    title: 'Edit Setoran',
    body: `
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
          if (r.success) {
            MEM.clear('setoran');
            S.setoran = await api('getSetoranList', { token: S.token, filter: S._setoranFilter || {} });
          }
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
      title: 'Struk',
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
function formKas() {
  formModal({
    title: 'Transaksi Kas',
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

// Master CRUD
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
        if (r.success) { S.katalog = await api('getKatalog', { token: S.token }); MEM.clear(); }
      } catch (e) { toast(e.message, 'error'); }
      finally { hideLoader(); render(); }
    }
  });
}
async function delKatalog(id) {
  if (!(await confirmDlg('Hapus item?', ''))) return;
  showLoader();
  try {
    const r = await api('deleteKatalog', { token: S.token, id });
    toast(r.message, r.success ? 'success' : 'error');
    if (r.success) { S.katalog = await api('getKatalog', { token: S.token }); MEM.clear(); }
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
      { key:'tipeTransaksi', label:'Tipe Transaksi', type:'radio',
        options: [
          { v:'BeliPutus', l:'Beli Putus', selected: item && item.tipeTransaksi === 'BeliPutus' },
          { v:'TitipJual', l:'Titip Jual', selected: item && item.tipeTransaksi === 'TitipJual' }
        ] },
      { key:'jadwalPesan', label:'Jadwal Pesan', value: item ? item.jadwalPesan : '', placeholder:'Senin,Kamis' },
      { key:'catatan', label:'Catatan', type:'textarea', value: item ? item.catatan : '' }
    ],
    onSubmit: async (data, c) => {
      data.id = item ? item.id : null;
      data.aktif = true;
      c(); showLoader();
      try {
        const r = await api('saveSupplier', { token: S.token, item: data });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) { S.suppliers = await api('getSuppliers', { token: S.token }); MEM.clear(); }
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
    MEM.clear();
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
        if (r.success) { S.lapak = await api('getLapak', { token: S.token }); MEM.clear(); }
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
    MEM.clear();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
function formUser(id) {
  const item = id ? S.users.find(u => u.id === id) : null;
  formModal({
    title: item ? 'Edit User' : 'Tambah User',
    fields: [
      { key:'name', label:'Nama', value: item ? item.name : '' },
      { key:'username', label:'Username', value: item ? item.username : '' },
      { key:'email', label:'Email Notifikasi', type:'email', value: item ? (item.email || '') : '', placeholder:'nama@email.com' },
      { key:'password', label:'Password ' + (item ? '(kosongkan jika tidak diubah)' : '(min 6)'), type:'password' },
      { key:'role', label:'Role', type:'select', value: item ? item.role : 'karyawan',
        options: [{v:'karyawan',l:'Karyawan',selected: item && item.role === 'karyawan'},{v:'admin',l:'Admin',selected: item && item.role === 'admin'}] },
      { key:'lapakId', label:'Lapak Utama', type:'select', value: item ? item.lapakId : '',
        options: [{v:'',l:'--'}].concat(S.lapak.map(l => ({ v:l.id, l:l.nama, selected: item && item.lapakId === l.id }))) },
      { key:'lapakIds', label:'Akses Lapak (koma)', value: item ? item.lapakIds : '', placeholder:'L01,L02' },
      { key:'aktif', label:'Aktif', type:'checkbox', checked: !item || item.aktif }
    ],
    onSubmit: async (data, c) => {
      data.id = item ? item.id : null;
      if (!data.password) data.password = undefined;
      c(); showLoader();
      try {
        const r = await api('saveUser', { token: S.token, item: data });
        toast(r.message, r.success ? 'success' : 'error');
        if (r.success) { S.users = await api('getUsers', { token: S.token }); MEM.clear(); }
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
    MEM.clear();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
async function resetUserPwd(id) {
  const u = S.users.find(x => x.id === id);
  if (!u) return;
  const ok = await confirmDlg('Reset Password?', 'Password ' + u.name + ' direset ke "kue1234".', 'Reset');
  if (!ok) return;
  showLoader();
  try {
    const r = await api('adminResetPassword', { token: S.token, userId: id });
    toast(r.message, r.success ? 'success' : 'error');
    if (r.success) { S.users = await api('getUsers', { token: S.token }); MEM.clear(); }
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

// Distribusi / Belanja / Jadwal
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
    MEM.clear();
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
        if (r.success) { S.belanja = await api('getBelanja', { token: S.token, filter: {} }); MEM.clear('belanja'); }
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
    MEM.clear('belanja');
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
async function delBelanja(id) {
  if (!(await confirmDlg('Hapus item?', ''))) return;
  showLoader();
  try {
    await api('deleteBelanja', { token: S.token, id });
    S.belanja = await api('getBelanja', { token: S.token, filter: {} });
    MEM.clear('belanja');
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
        if (r.success) { S.jadwal = await api('getJadwal', { token: S.token, days: 30 }); MEM.clear('jadwal'); }
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
    MEM.clear('jadwal');
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

// Kasbon
function formKasbon(isAdmin) {
  if (isAdmin) {
    const karyawans = S.users.filter(u => u.role === 'karyawan');
    if (!karyawans.length) return toast('Tidak ada karyawan', 'error');
    formModal({
      title: 'Tambah Kasbon',
      fields: [
        { key:'userId', label:'Karyawan', type:'select', options: karyawans.map(u => ({ v:u.id, l:u.name })) },
        { key:'tipe', label:'Tipe', type:'select', options: [{v:'Kasbon',l:'Kasbon (utang)'},{v:'Bayar',l:'Bayar'}] },
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

// Setting Gaji Lama
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

// Pesanan Supplier
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

// Retur
function formReturKaryawan() {
  const dist = (S.karyawan && S.karyawan.distribusi) || [];
  if (!dist.length) return toast('Tidak ada distribusi', 'error');
  modal({
    title: 'Ajukan Retur',
    body: `<p class="text-sm text-gray mb-3">Masukkan jumlah retur:</p>
      ${dist.map(it => `
        <div class="card card-flat" style="padding:10px;margin-bottom:8px" data-retur-item="${esc(it.katalogId)}">
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
        if (!items.length) return toast('Isi minimal 1', 'error');
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
    body: '<div class="field"><label>Kirim ke</label><select data-f="tujuan" class="select"><option value="">-- Lapak asal --</option>' +
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
  if (!(await confirmDlg('Tolak retur?', ''))) return;
  showLoader();
  try {
    await api('rejectRetur', { token: S.token, id, reason: '' });
    S.retur = await api('getReturList', { token: S.token, filter: {} });
    toast('Ditolak', 'success');
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

// Harga Tingkat
function formHargaTingkat(id) {
  const item = id && S.hargaTingkat ? S.hargaTingkat.find(x => x.id === id) : null;
  if (!S.katalog.length) return toast('Katalog kosong', 'error');
  formModal({
    title: item ? 'Edit Harga' : 'Tambah Harga Tingkat',
    fields: [
      { key:'katalogId', label:'Item', type:'select', value: item ? item.katalogId : '',
        options: S.katalog.map(k => ({ v:k.id, l:k.nama, selected: item && item.katalogId === k.id })) },
      { key:'tipePelanggan', label:'Tipe', type:'select', value: item ? item.tipePelanggan : 'Umum',
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
  if (!(await confirmDlg('Hapus harga?', ''))) return;
  showLoader();
  try {
    await api('deleteHargaTingkat', { token: S.token, id });
    S.hargaTingkat = await api('getHargaTingkat', { token: S.token });
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

// Tutup Buku
function formTutupBuku() {
  modal({
    title: 'Kunci Periode',
    body: `<p class="text-xs text-gray mb-3">Setoran dalam rentang ini tidak bisa diedit.</p>
      <div class="field"><label>Dari</label><input type="date" data-f="dari" class="input" value="${monthStartISO()}"></div>
      <div class="field"><label>Sampai</label><input type="date" data-f="sampai" class="input" value="${todayISO()}"></div>
      <div class="field"><label>Catatan</label><textarea data-f="catatan" class="textarea"></textarea></div>`,
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
  const ok = await confirmDlg('Buka Kunci?', 'Setoran bisa diedit lagi.', 'Buka');
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

// Notifikasi / Laporan / Profil
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
    if (r && r.success) toast(r.message || 'Email terkirim', 'success');
    else toast((r && r.message) || 'Gagal kirim email', 'error');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
  finally { hideLoader(); }
}
function formSendEmailManual() {
  modal({
    title: 'Kirim Email Manual',
    body: `
      <div class="field"><label>Ke</label><input type="email" data-f="to" class="input" placeholder="tujuan@email.com"></div>
      <div class="field"><label>Subjek</label><input type="text" data-f="subject" class="input" placeholder="Subjek email"></div>
      <div class="field"><label>Pesan</label><textarea data-f="body" class="textarea" rows="4" placeholder="Isi email..."></textarea></div>
    `,
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Kirim', className: 'btn-primary', onClick: async (c, w) => {
        const to = w.querySelector('[data-f="to"]').value.trim();
        const subject = w.querySelector('[data-f="subject"]').value.trim();
        const body = w.querySelector('[data-f="body"]').value.trim();
        if (!to || !subject || !body) return toast('Isi semua field', 'error');
        c(); showLoader();
        try {
          const r = await api('sendEmailManual', { token: S.token, payload: { to, subject, body } });
          toast(r.message, r.success ? 'success' : 'error');
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); }
      } }
    ]
  });
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
  if (!(await confirmDlg('Download Backup?', 'Semua sheet jadi 1 file JSON.', 'Download'))) return;
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
    title: 'Restore Backup',
    body: `<p class="text-xs text-gray mb-3">Pilih file JSON backup.</p>
      <div class="field"><label>Mode</label>
        <select data-mode class="select">
          <option value="replace">Replace</option>
          <option value="merge">Merge</option>
        </select>
      </div>
      <div class="field"><label>File JSON</label><input type="file" accept=".json" data-file class="input"></div>`,
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Restore', className: 'btn-danger', onClick: async (c, w) => {
        const file = w.querySelector('[data-file]').files[0];
        const mode = w.querySelector('[data-mode]').value;
        if (!file) return toast('Pilih file', 'error');
        const ok = await confirmDlg('Konfirmasi', 'Data akan di-' + mode, 'Restore');
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
//  ABSENSI ADMIN
// ============================================
function formIsiAbsensi(userId) {
  const karyawans = S.users.filter(u => u.role === 'karyawan');
  if (!karyawans.length) return toast('Tidak ada karyawan', 'error');
  const defaultUserId = userId || karyawans[0].id;
  modal({
    title: 'Isi Absensi',
    body: `
      <div class="field"><label>Karyawan</label>
        <select data-f="userId" class="select">
          ${karyawans.map(u => `<option value="${esc(u.id)}" ${u.id === defaultUserId ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Tanggal</label><input type="date" data-f="tanggal" class="input" value="${todayISO()}"></div>
      <div class="field"><label>Lapak</label>
        <select data-f="lapakId" class="select">
          ${S.lapak.map(l => `<option value="${esc(l.id)}">${esc(l.nama)}</option>`).join('')}
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
      <div class="field"><label>Catatan</label><textarea data-f="catatan" class="textarea"></textarea></div>
    `,
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
        const get = s => w.querySelector('[data-f="' + s + '"]').value;
        const payload = {
          userId: get('userId'), tanggal: get('tanggal'), lapakId: get('lapakId'),
          jamMasuk: get('jamMasuk'), jamKeluar: get('jamKeluar'),
          status: get('status'), catatan: get('catatan')
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
  if (!a) return toast('Tidak ditemukan', 'error');
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
          lapakId: get('lapakId'), jamMasuk: get('jamMasuk'), jamKeluar: get('jamKeluar'),
          status: get('status'), catatan: get('catatan')
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
  if (!(await confirmDlg('Hapus absensi?', ''))) return;
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

// BONUS ANTAR
function formBonusAntar(id) {
  const item = id && S.bonusAntar ? S.bonusAntar.find(x => x.id === id) : null;
  const karyawans = S.users.filter(u => u.role === 'karyawan');
  if (!karyawans.length) return toast('Tidak ada karyawan', 'error');
  formModal({
    title: item ? 'Edit Bonus' : 'Tambah Bonus Antar',
    fields: [
      { key:'tanggal', label:'Tanggal', type:'date', value: item ? item.tanggal : todayISO() },
      { key:'userId', label:'Karyawan', type:'select', options: karyawans.map(u => ({ v:u.id, l:u.name, selected: item && item.userId === u.id })) },
      { key:'tujuan', label:'Tujuan', value: item ? item.tujuan : '', placeholder:'Jl. Merdeka 5' },
      { key:'jarakKm', label:'Jarak (km)', type:'number', value: item ? item.jarakKm : 0 },
      { key:'qty', label:'Jumlah Item', type:'number', value: item ? item.qty : 0 },
      { key:'nominal', label:'Nominal Bonus', type:'number', value: item ? item.nominal : 0 },
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

// SETTING PAYROLL
function formSettingPayroll(id) {
  const item = id && S.settingPayroll ? S.settingPayroll.find(x => x.id === id) : null;
  formModal({
    title: item ? 'Edit Setting Payroll' : 'Tambah Setting Payroll',
    fields: [
      { key:'lapakId', label:'Lapak', type:'select', value: item ? item.lapakId : '',
        options: S.lapak.map(l => ({ v:l.id, l:l.nama, selected: item && item.lapakId === l.id })) },
      { key:'bonusMerekap', label:'Bonus Merekap', type:'number', value: item ? item.bonusMerekap : 0 },
      { key:'tunjanganLapak', label:'Tunjangan Lapak', type:'number', value: item ? item.tunjanganLapak : 0 },
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
    for (const item of r.list) {
      await api('saveHariEfektif', { token: S.token, item: { bulan, lapakId: item.lapakId, jumlahHari: item.jumlahHari, catatan: 'Auto' } });
    }
    S.hariEfektif = await api('getHariEfektif', { token: S.token, bulan });
    toast('Hari efektif dihitung', 'success');
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}
function formEditHariEfektif(dataset) {
  const { bulan, lapak, hari } = dataset;
  modal({
    title: 'Edit Hari Efektif',
    body: `
      <div class="field"><label>Bulan</label><strong>${esc(bulanLabel(bulan))}</strong></div>
      <div class="field"><label>Lapak</label><strong>${esc(lapak)}</strong></div>
      <div class="field"><label>Jumlah Hari</label><input type="number" data-f="hari" class="input" value="${hari}"></div>
      <div class="field"><label>Catatan</label><input type="text" data-f="catatan" class="input"></div>
    `,
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
        const jumlahHari = parseInt(w.querySelector('[data-f="hari"]').value, 10) || 0;
        const catatan = w.querySelector('[data-f="catatan"]').value;
        c(); showLoader();
        try {
          await api('saveHariEfektif', { token: S.token, item: { bulan, lapakId: lapak, jumlahHari, catatan } });
          S.hariEfektif = await api('getHariEfektif', { token: S.token, bulan });
          toast('Tersimpan', 'success');
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); render(); }
      } }
    ]
  });
}

async function bayarPayrollBulk() {
  const checks = $$('[data-payroll-pick]:checked');
  if (!checks.length) return toast('Pilih minimal 1', 'error');
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
      MEM.clear();
    }
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

// KONSINYASI
async function formBayarSupplier(supplierId) {
  if (!supplierId) return toast('Supplier wajib', 'error');
  showLoader();
  try {
    const detail = await api('getKonsinyasiDetailSupplier', { token: S.token, supplierId });
    hideLoader();
    if (detail.total <= 0) return toast('Tidak ada utang pending.', 'info');
    const sup = S.suppliers.find(s => String(s.id) === String(supplierId)) || {};
    modal({
      title: 'Bayar Supplier',
      body: `
        <div class="card-flat" style="padding:12px;margin-bottom:12px">
          <strong>${esc(sup.nama || supplierId)}</strong>
          <div class="text-xs text-gray mt-1">${detail.count} transaksi pending</div>
          <div class="hero" style="margin-top:12px;margin-bottom:0;padding:16px">
            <div class="hero-label">Total Bayar</div>
            <div class="hero-value" style="font-size:22px;margin-bottom:0">${fmtRp(detail.total)}</div>
          </div>
        </div>
        <p class="text-xs font-semibold text-gray mb-2">Rincian</p>
        <div style="max-height:300px;overflow-y:auto">
          ${detail.items.map(it => `
            <div class="row-between text-xs" style="padding:8px 0;border-bottom:1px solid #f8fafc">
              <div style="min-width:0;flex:1">
                <div class="font-semibold">${esc(it.nama)}</div>
                <div class="text-gray">${esc(it.tanggal)} · ${esc(it.lapakNama)}</div>
                <div class="text-gray">${it.qtyLaku} × ${fmtRp(it.hargaTitip)}</div>
              </div>
              <div class="text-right font-bold">${fmtRp(it.utang)}</div>
            </div>`).join('')}
        </div>`,
      actions: [
        { label: 'Batal', onClick: c => c() },
        { label: 'Bayar ' + fmtRp(detail.total), className: 'btn-success', onClick: async (c) => {
          c(); showLoader();
          try {
            const r = await api('bayarSupplier', { token: S.token, payload: { supplierId } });
            toast(r.message, r.success ? 'success' : 'error');
            if (r.success) {
              await loadKonsinyasi();
              S.dash = await api('getAdminDashboard', { token: S.token });
              MEM.clear();
            }
          } catch (e) { toast(e.message, 'error'); }
          finally { hideLoader(); render(); }
        } }
      ]
    });
  } catch (e) { hideLoader(); toast(e.message, 'error'); }
}
async function showDetailKonsinyasi(supplierId) {
  showLoader();
  try {
    const detail = await api('getKonsinyasiDetailSupplier', { token: S.token, supplierId });
    hideLoader();
    const sup = S.suppliers.find(s => String(s.id) === String(supplierId)) || {};
    modal({
      title: 'Detail: ' + (sup.nama || supplierId),
      body: `
        <div class="row-between mb-3">
          <strong>Total Utang</strong>
          <div class="text-lg font-bold text-red">${fmtRp(detail.total)}</div>
        </div>
        <div class="text-xs text-gray mb-3">${detail.count} transaksi pending</div>
        <div style="max-height:400px;overflow-y:auto">
          ${detail.items.length ? detail.items.map(it => `
            <div class="row-between text-sm" style="padding:10px 0;border-bottom:1px solid #f8fafc">
              <div style="min-width:0;flex:1">
                <div class="font-semibold">${esc(it.nama)}</div>
                <div class="text-xs text-gray">${esc(it.tanggal)} · ${esc(it.lapakNama)}</div>
                <div class="text-xs text-gray">${it.qtyLaku} × ${fmtRp(it.hargaTitip)}</div>
              </div>
              <div class="text-right font-bold">${fmtRp(it.utang)}</div>
            </div>`).join('') : '<p class="text-xs text-gray text-center" style="padding:20px">Tidak ada transaksi pending.</p>'}
        </div>`,
      actions: [
        { label: 'Tutup', onClick: c => c() },
        { label: 'Bayar', className: 'btn-success', onClick: (c) => { c(); formBayarSupplier(supplierId); } }
      ]
    });
  } catch (e) { hideLoader(); toast(e.message, 'error'); }
}

// MULTI-LAPAK
function showPilihLapak(list) {
  modal({
    title: 'Pilih Lapak',
    body: '<p class="text-sm text-gray mb-3">Anda punya akses ke beberapa lapak. Pilih lapak aktif:</p>' +
      list.map(l => `
        <button data-lapak="${esc(l.id)}" class="menu-item" style="border:1px solid #f1f5f9;border-radius:12px;margin-bottom:6px">
          ${ico('store')}
          <span class="menu-item-label">${esc(l.nama)}</span>
          ${ico('chevron-right','menu-item-chevron')}
        </button>`).join(''),
    actions: [],
    onMount: (wrap, close) => {
      wrap.addEventListener('click', async e => {
        const b = e.target.closest('[data-lapak]');
        if (!b) return;
        const lapakId = b.dataset.lapak;
        const lapakObj = list.find(l => l.id === lapakId);
        try {
          const r = await api('setLapakAktif', { token: S.token, lapakId });
          if (!r.success) return toast(r.message, 'error');
          S.lapakAktif = lapakObj;
          localStorage.setItem('lapakAktif', JSON.stringify(lapakObj));
          close();
          MEM.clear();
          await initKaryawan();
          render();
          toast('Lapak: ' + lapakObj.nama, 'success');
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    }
  });
}
async function showGantiLapakModal() {
  showLoader();
  try {
    const list = await api('getMyLapak', { token: S.token });
    hideLoader();
    if (list.length <= 1) return toast('Anda hanya punya 1 lapak.', 'info');
    modal({
      title: 'Ganti Lapak',
      body: list.map(l => {
        const isActive = S.lapakAktif && S.lapakAktif.id === l.id;
        return `<button data-lapak="${esc(l.id)}" class="menu-item" style="background:${isActive ? 'var(--amber-50)' : 'transparent'};border:1px solid #f1f5f9;border-radius:12px;margin-bottom:6px">
          ${ico('store')}
          <span class="menu-item-label" style="color:${isActive ? 'var(--amber-600)' : 'var(--ink-2)'}">${esc(l.nama)}${isActive ? ' (aktif)' : ''}</span>
        </button>`;
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
            MEM.clear();
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
//  BOOT
// ============================================
(function boot() {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryAutoLogin);
  else tryAutoLogin();
})();