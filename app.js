'use strict';
/* Kue As-Syifa POS v4.1 */

const CFG = window.APP_CONFIG || {};
const API = CFG.API_URL;

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
  rekap: {}
};

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

const CACHE = {
  get(key) {
    try {
      const raw = sessionStorage.getItem('c_' + key);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (Date.now() > o.t) { sessionStorage.removeItem('c_' + key); return null; }
      return o.v;
    } catch { return null; }
  },
  set(key, v, ttl = 60000) {
    try { sessionStorage.setItem('c_' + key, JSON.stringify({ t: Date.now() + ttl, v })); } catch {}
  },
  clearAll() {
    Object.keys(sessionStorage).filter(k => k.startsWith('c_')).forEach(k => sessionStorage.removeItem(k));
  }
};

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

let loaderCount = 0;
function showLoader() { loaderCount++; $('#loader').classList.remove('hide'); }
function hideLoader() { loaderCount = Math.max(0, loaderCount - 1); if (loaderCount === 0) $('#loader').classList.add('hide'); }

function toast(msg, type = 'success') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.innerHTML = ico(type === 'success' ? 'check' : type === 'error' ? 'x' : 'inbox') + '<span></span>';
  el.querySelector('span').textContent = String(msg || '');
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 3000);
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

function confirmDlg(title, msg) {
  return new Promise(resolve => modal({
    title, body: `<p class="text-sm text-gray">${esc(msg)}</p>`,
    actions: [
      { label: 'Batal', onClick: c => { c(); resolve(false); } },
      { label: 'Ya', className: 'btn-danger', onClick: c => { c(); resolve(true); } }
    ]
  }));
}

function render() {
  const app = $('#app');
  let html = '';
  if (S.view === 'login') html = vLogin();
  else if (S.view === 'karyawan') html = vKaryawan();
  else if (S.view === 'admin') html = vAdmin();
  app.innerHTML = html;
}

document.addEventListener('click', handleClick);
document.addEventListener('input', handleInput);
document.addEventListener('change', handleChange);

// ============================================
//  LOGIN
// ============================================
function vLogin() {
  return `
    <div class="login">
      <div class="login-logo">${ico('cookie')}</div>
      <h1>Kue As-Syifa</h1>
      <p class="sub">Sistem Manajemen POS &amp; ERP</p>
      <form class="login-form" data-form="login">
        <div class="field">
          <label>Username / Nama</label>
          <input class="input" name="username" autocomplete="username" autofocus>
        </div>
        <div class="field">
          <label>Password</label>
          <input class="input" type="password" name="password" autocomplete="current-password">
        </div>
        <button class="btn btn-primary btn-block" type="submit">Masuk</button>
      </form>
    </div>`;
}

// ============================================
//  KARYAWAN
// ============================================
function vKaryawan() {
  const d = S.karyawan;
  if (!d) return '<div class="page"><div class="empty">Memuat...</div></div>';
  const isOpen = d.absen && d.absen.isOpen;

  let body = '';
  body += `
    <div class="card">
      <div class="row-between mb-3">
        <span class="text-sm text-gray">Status Lapak</span>
        <strong class="${isOpen ? 'text-green' : 'text-red'}">${isOpen ? 'BUKA' : 'TUTUP'}</strong>
      </div>
      ${d.absen && d.absen.jamBuka ? `<p class="text-xs text-gray mb-3">Buka: ${esc(d.absen.jamBuka)}${d.absen.jamTutup ? ' · Tutup: ' + esc(d.absen.jamTutup) : ''}</p>` : ''}
      <div class="row" style="gap:8px">
        <button class="btn btn-block ${isOpen ? 'btn-ghost' : 'btn-success'}" data-act="buka" ${isOpen ? 'disabled' : ''}>Buka Lapak</button>
        <button class="btn btn-block ${!isOpen ? 'btn-ghost' : 'btn-danger'}" data-act="tutup" ${!isOpen ? 'disabled' : ''}>Tutup Lapak</button>
      </div>
    </div>`;

  if (d.sudahSubmit) {
    body += `<div class="alert alert-success">${ico('check','ico')}<div><strong>Laporan sudah dikirim</strong><br><span class="text-xs">Menunggu persetujuan admin.</span></div></div>`;
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
            <p class="text-sm" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k.keterangan || k.tipe)}</p>
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
  if (!katalog.length) return `<div class="card empty">${ico('box')}<p>Katalog kosong.</p></div>`;
  return `
    <div class="card" style="border:1px solid var(--amber);">
      <div class="card-title">${ico('boxes')} Input Stok Diterima</div>
      <p class="text-xs text-gray mb-4">Masukkan jumlah kue yang Anda terima pagi ini.</p>
      ${katalog.map(k => `
        <div class="row-between" style="padding:8px 0;border-bottom:1px solid var(--gray-100)">
          <div style="min-width:0;flex:1;padding-right:8px">
            <p class="text-sm font-semibold" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k.nama)}</p>
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
              <p class="text-sm font-semibold" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.nama)}</p>
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
          <div class="field"><label>Tunai Fisik (Rp)</label><input type="number" name="tunai" min="0" inputmode="numeric" class="input field-sm"></div>
          <div class="field"><label>Total QRIS (Rp)</label><input type="number" name="qris" min="0" inputmode="numeric" class="input field-sm"></div>
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
  const tunai = parseInt(($('input[name=tunai]') || {}).value, 10) || 0;
  const qris = parseInt(($('input[name=qris]') || {}).value, 10) || 0;
  const expected = total - pengeluaran;
  const selisih = total - (tunai + qris);
  return `
    <div style="flex:1">
      <div class="row-between text-xs"><span>Penjualan Sistem</span><strong>${fmtRp(total)}</strong></div>
      <div class="row-between text-xs text-red"><span>Pengeluaran</span><span>- ${fmtRp(pengeluaran)}</span></div>
      <div class="row-between text-xs text-green font-bold mt-2"><span>Harus Disetor</span><span>${fmtRp(Math.max(0, expected))}</span></div>
      <div class="divider"></div>
      <div class="row-between text-xs"><span>Tunai + QRIS</span><span>${fmtRp(tunai + qris)}</span></div>
      <div class="row-between text-xs font-bold ${Math.abs(selisih) < 1 ? 'text-green' : 'text-red'}">
        <span>Selisih</span><span>${fmtRp(selisih)}</span>
      </div>
    </div>`;
}

function updateSummary() {
  const sum = $('[data-summary]');
  if (sum) sum.innerHTML = summaryHTML();
}

// ============================================
//  ADMIN
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
  else if (S.tab === 'profil') body = tabProfil();

  return `
    <div class="page">
      <div class="topbar topbar-dark">
        <div class="topbar-title">
          <h2>Admin Panel</h2>
          <p>${esc(S.user.name)}</p>
        </div>
        <button class="icon-btn" data-act="logout">${ico('out')}</button>
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

function tabHome() {
  const d = S.dash || { kasBesar: 0, pendingCount: 0, todayPenjualan: 0, todayTunai: 0, todayQris: 0, todaySetoranCount: 0, recentKas: [] };
  return `
    <div class="kpi-hero">
      <div class="kpi-hero-label">Saldo Kas Besar</div>
      <div class="kpi-hero-value">${fmtRp(d.kasBesar)}</div>
      <button class="btn btn-ghost btn-sm" data-act="refresh">${ico('sync','ico-sm')} Refresh</button>
    </div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Penjualan Hari Ini</div><div class="kpi-value text-green">${fmtRp(d.todayPenjualan)}</div><div class="kpi-sub">${d.todaySetoranCount} setoran</div></div>
      <div class="kpi"><div class="kpi-label">Tunai / QRIS</div><div class="kpi-value" style="font-size:13px">${fmtRp(d.todayTunai)}</div><div class="kpi-value text-amber" style="font-size:13px">${fmtRp(d.todayQris)}</div></div>
    </div>
    ${d.pendingCount > 0 ? `<div class="alert alert-warn">${ico('inbox','ico')}<div style="flex:1"><strong>${d.pendingCount} setoran pending</strong><br><button class="btn btn-primary btn-sm mt-2" data-act="tab" data-tab="setoran">Lihat</button></div></div>` : ''}
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

function tabSetoran() {
  const list = S.setoran || [];
  const pending = list.filter(s => s.status === 'pending');
  const done = list.filter(s => s.status !== 'pending').slice(0, 20);
  let html = `<h3 class="card-title">${ico('file')} Setoran Pending (${pending.length})</h3>`;
  if (!pending.length) html += '<div class="empty">' + ico('inbox') + '<p>Tidak ada setoran pending</p></div>';
  else html += pending.map(s => {
    const status = s.selisih === 0 ? 'Match' : s.selisih > 0 ? 'Shortage' : 'Overage';
    const cls = s.selisih === 0 ? 'badge-success' : s.selisih > 0 ? 'badge-danger' : 'badge-blue';
    return `<div class="card" style="border:1px solid var(--amber-bg)">
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
      <div class="row mt-3" style="gap:6px">
        <button class="btn btn-ghost btn-sm" data-act="detail-setoran" data-id="${esc(s.id)}">${ico('eye','ico-sm')}</button>
        <button class="btn btn-danger btn-sm" style="flex:1" data-act="reject" data-id="${esc(s.id)}">Tolak</button>
        <button class="btn btn-success btn-sm" style="flex:1" data-act="approve" data-id="${esc(s.id)}">Terima</button>
      </div>
    </div>`;
  }).join('');
  html += `<h3 class="card-title mt-3">${ico('file')} Riwayat</h3>`;
  if (!done.length) html += '<div class="empty"><p>Belum ada riwayat</p></div>';
  else html += done.map(s => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">${esc(s.lapakId)} · ${esc(s.tanggal)}</div>
        <div class="list-item-sub">${fmtRp(s.totalSistem)}</div>
      </div>
      <span class="badge ${s.status === 'approved' ? 'badge-success' : 'badge-danger'}">${esc(s.status)}</span>
    </div>`).join('');
  return html;
}

function tabKatalog() {
  const isAdmin = S.user.role === 'admin';
  return `
    <div class="row-between mb-3">
      <h3 class="card-title" style="margin:0">${ico('box')} Katalog (${S.katalog.length})</h3>
      <button class="btn btn-primary btn-sm" data-act="add-katalog">+ Tambah</button>
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

function tabDistribusi() {
  const today = todayISO();
  const tanggal = S._distTanggal || today;
  const lapakId = S._distLapakId || (S.lapak[0] ? S.lapak[0].id : '');
  const items = S._distItems || {};
  return `
    <h3 class="card-title">${ico('boxes')} Drop Stok ke Lapak</h3>
    <div class="card">
      <div class="field"><label>Tanggal</label><input type="date" data-dist-tgl value="${tanggal}" class="input field-sm"></div>
      <div class="field"><label>Lapak</label><select data-dist-lapak class="select field-sm">${S.lapak.map(l => `<option value="${esc(l.id)}" ${l.id === lapakId ? 'selected' : ''}>${esc(l.nama)}</option>`).join('')}</select></div>
      <button class="btn btn-ghost btn-block mt-2" data-act="load-distribusi">Muat Distribusi</button>
    </div>
    <div class="card">
      ${!S.katalog.length ? '<p class="text-xs text-gray">Katalog kosong.</p>' :
        S.katalog.map(k => `
          <div class="row-between" style="padding:8px 0;border-bottom:1px solid var(--gray-100)">
            <div style="min-width:0;flex:1;padding-right:8px">
              <p class="text-sm font-semibold" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k.nama)}</p>
              <p class="text-xs text-gray">${esc(k.supplierNama)} · ${fmtRp(k.hargaJual)}</p>
            </div>
            <input type="number" min="0" inputmode="numeric" value="${items[k.id] || 0}" data-dist-item="${esc(k.id)}" class="input field-sm" style="width:70px;text-align:center">
          </div>`).join('')}
    </div>
    <button class="btn btn-primary btn-block mt-3" data-act="save-distribusi">Simpan Drop</button>`;
}

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
            <div class="list-item-sub">${b.qty}x · ${fmtRp(b.hargaAktual || b.estimasiHarga)}${b.checked && b.kasId ? ' · OK Kas' : ''}</div>
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

function tabGajiRiwayat() {
  const data = S.gaji || [];
  let html = `<h3 class="card-title">${ico('money')} Riwayat Gaji</h3>`;
  if (!data.length) html += '<div class="empty"><p>Belum ada riwayat gaji</p></div>';
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
      <h3 class="card-title" style="margin:0">${ico('money')} Setting Gaji</h3>
      <button class="btn btn-primary btn-sm" data-act="add-setting-gaji">+ Tambah</button>
    </div>
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
  if (!L) return '<div class="empty">Memuat rekap gaji...</div>';
  const tipe = S._rekapGajiTipe || 'Bulanan';
  const dari = S._rekapGajiDari || L.periode.dari;
  const sampai = S._rekapGajiSampai || L.periode.sampai;
  return `
    <h3 class="card-title">${ico('money')} Rekap Penggajian</h3>
    <div class="card">
      <div class="field"><label>Tipe</label>
        <select data-rekap-tipe class="select field-sm">
          ${['Harian','Mingguan','Bulanan'].map(t => `<option ${t === tipe ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-grid">
        <div class="field"><label>Dari</label><input type="date" data-rekap-dari value="${dari}" class="input field-sm"></div>
        <div class="field"><label>Sampai</label><input type="date" data-rekap-sampai value="${sampai}" class="input field-sm"></div>
      </div>
      <button class="btn btn-primary btn-block btn-sm" data-act="rekap-gaji-load">Tampilkan</button>
    </div>
    <div class="grid-3 mb-3">
      <div class="kpi"><div class="kpi-label">Karyawan</div><div class="kpi-value">${L.list.length}</div></div>
      <div class="kpi"><div class="kpi-label">Gaji Pokok</div><div class="kpi-value" style="font-size:12px">${fmtRp(L.totals.gajiPokok)}</div></div>
      <div class="kpi"><div class="kpi-label">Kasbon</div><div class="kpi-value text-red" style="font-size:12px">${fmtRp(L.totals.potonganKasbon)}</div></div>
    </div>
    <div class="kpi-hero">
      <div class="kpi-hero-label">Total Gaji Bersih</div>
      <div class="kpi-hero-value">${fmtRp(L.totals.totalBersih)}</div>
    </div>
    <div class="row-between mb-3">
      <strong class="text-sm">Daftar Karyawan</strong>
      <button class="btn btn-success btn-sm" data-act="bayar-gaji-bulk">Bayar Terpilih</button>
    </div>
    ${L.list.map(x => `
      <div class="card" style="padding:12px">
        <div class="row mb-2">
          <input type="checkbox" data-gaji-pick data-userid="${esc(x.userId)}" data-gajipokok="${x.gajiPokok}" data-kasbon="${x.potonganKasbon}">
          <div style="flex:1;min-width:0">
            <strong>${esc(x.userName)}</strong>
            <div class="text-xs text-gray">Hadir: ${x.hadir} hari · Setting: ${fmtRp(x.nominalSetting)}</div>
          </div>
        </div>
        <div class="text-sm" style="background:var(--gray-50);padding:8px;border-radius:8px">
          <div class="row-between"><span class="text-gray">Gaji Pokok</span><span>${fmtRp(x.gajiPokok)}</span></div>
          <div class="row-between text-red"><span>Potongan Kasbon</span><span>${x.potonganKasbon > 0 ? '- ' + fmtRp(x.potonganKasbon) : '-'}</span></div>
          <div class="row-between font-bold text-green" style="border-top:1px solid var(--gray-200);padding-top:4px;margin-top:4px"><span>Total Bersih</span><span>${fmtRp(x.totalBersih)}</span></div>
        </div>
      </div>`).join('')}`;
}

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
    ${!list.length ? '<div class="empty"><p>Belum ada pesanan</p></div>' : ''}
    <div class="divider"></div>
    <h3 class="card-title">${ico('bar')} Rekap Pesanan</h3>
    <div class="card">
      <div class="form-grid">
        <div class="field"><label>Dari</label><input type="date" data-pes-dari value="${S._pesananDari || todayISO().slice(0,8)+'01'}" class="input field-sm"></div>
        <div class="field"><label>Sampai</label><input type="date" data-pes-sampai value="${S._pesananSampai || todayISO()}" class="input field-sm"></div>
      </div>
      <button class="btn btn-primary btn-block btn-sm" data-act="load-rekap-pesanan">Tampilkan Rekap</button>
    </div>
    ${S.rekapPesanan ? `
      <div class="grid-3 mb-3">
        <div class="kpi"><div class="kpi-label">Jumlah</div><div class="kpi-value">${S.rekapPesanan.totals.count}</div></div>
        <div class="kpi"><div class="kpi-label">Qty</div><div class="kpi-value text-amber">${S.rekapPesanan.totals.qty}</div></div>
        <div class="kpi"><div class="kpi-label">Total</div><div class="kpi-value text-green" style="font-size:12px">${fmtRp(S.rekapPesanan.totals.total)}</div></div>
      </div>
      <div class="card">
        <div class="card-title">Status</div>
        <div class="row-between text-sm"><span>Draft</span><strong>${S.rekapPesanan.perStatus.Draft || 0}</strong></div>
        <div class="row-between text-sm"><span>Ordered</span><strong class="text-amber">${S.rekapPesanan.perStatus.Ordered || 0}</strong></div>
        <div class="row-between text-sm"><span>Received</span><strong class="text-green">${S.rekapPesanan.perStatus.Received || 0}</strong></div>
        <div class="row-between text-sm"><span>Cancelled</span><strong class="text-red">${S.rekapPesanan.perStatus.Cancelled || 0}</strong></div>
      </div>
      <div class="card">
        <div class="card-title">Per Supplier</div>
        ${!S.rekapPesanan.perSupplier.length ? '<p class="text-xs text-gray">Tidak ada data.</p>' :
          S.rekapPesanan.perSupplier.map(s => `
            <div class="row-between text-sm" style="padding:6px 0;border-bottom:1px solid var(--gray-100)">
              <div><strong>${esc(s.nama)}</strong><div class="text-xs text-gray">${s.count} pesanan · ${s.qty} qty</div></div>
              <strong class="text-green">${fmtRp(s.total)}</strong>
            </div>`).join('')}
      </div>
    ` : ''}`;
}

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
      <div class="kpi"><div class="kpi-label">Profit</div><div class="kpi-value" style="font-size:13px;color:var(--blue)">${fmtRp(L.ringkasan.totalProfit)}</div></div>
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
      <div class="card-title">Bottom 10 (Evaluasi)</div>
      ${!L.bottomItems.length ? '<p class="text-xs text-gray">Belum ada data.</p>' :
        L.bottomItems.map(it => `<div class="row-between text-sm" style="padding:4px 0"><span>${esc(it.nama)}</span><span class="text-gray">${it.qtyLaku} pcs</span></div>`).join('')}
    </div>
    <div class="card">
      <div class="card-title">Performa Supplier</div>
      ${!L.perSupplier.length ? '<p class="text-xs text-gray">Belum ada data.</p>' :
        L.perSupplier.map(s => `
          <div style="padding:8px 0;border-bottom:1px solid var(--gray-100)">
            <div class="row-between text-sm mb-2"><strong>${esc(s.nama)}</strong><span class="text-gray">${s.margin.toFixed(1)}% margin</span></div>
            <div class="row-between text-xs text-gray"><span>${s.qtyLaku} pcs · ${s.itemCount} item</span><span class="text-green font-semibold">${fmtRp(s.omzet)}</span></div>
            <div class="text-xs" style="color:var(--blue)">Profit: ${fmtRp(s.profit)}</div>
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
            ${u.lapakIds ? `<div class="text-xs text-gray mt-1">Akses lapak: ${esc(u.lapakIds)}</div>` : ''}
          </div>
          <div class="list-item-actions">
            <button class="action-btn action-edit" data-act="edit-user" data-id="${esc(u.id)}">${ico('edit','ico-sm')}</button>
            <button class="action-btn action-del" data-act="del-user" data-id="${esc(u.id)}">${ico('trash','ico-sm')}</button>
          </div>
        </div>`).join('')}`;
}

function tabProfil() {
  return `
    <h3 class="card-title">${ico('user')} Profil</h3>
    <div class="card">
      <div class="field"><label class="text-gray">Username</label><strong>${esc(S.user.username)}</strong></div>
      <div class="field"><label class="text-gray">Nama</label><strong>${esc(S.user.name)}</strong></div>
      <div class="field"><label class="text-gray">Role</label><strong>${esc(S.user.role)}</strong></div>
    </div>
    <button class="btn btn-primary btn-block" data-act="change-password">${ico('key','ico-sm')} Ganti Password</button>`;
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
  if (a === 'buka') return karyawanAction('bukaLapak');
  if (a === 'tutup') return karyawanAction('tutupLapak');
  if (a === 'save-drop') return karyawanSaveDrop();
  if (a === 'edit-drop') { S.karyawan.distribusi = []; return render(); }
  if (a === 'submit-rekap') return doSubmitRekap();
  if (a === 'add-peng') return addPengRow();
  if (a === 'del-peng') { const r = e.target.closest('[data-peng-row]'); if (r) r.remove(); return updateSummary(); }
  if (a === 'ajukan-kasbon') return formKasbon(false);
  if (a === 'ganti-lapak') return showGantiLapakModal();
  if (a === 'tab') return switchTab(tab);
  if (a === 'refresh') return doRefresh();
  if (a === 'approve') return doApprove(id);
  if (a === 'reject') return doReject(id);
  if (a === 'detail-setoran') return showSetoranDetail(id);
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
  if (a === 'bayar-gaji') return formBayarGaji();
  if (a === 'add-setting-gaji') return formSettingGaji();
  if (a === 'edit-setting-gaji') return formSettingGaji(id);
  if (a === 'rekap-gaji-load') return loadRekapGaji(true);
  if (a === 'bayar-gaji-bulk') return doBayarGajiBulk();
  if (a === 'add-pesanan') return formPesanan();
  if (a === 'edit-pesanan') return formPesanan(id);
  if (a === 'del-pesanan') return delPesanan(id);
  if (a === 'load-rekap-pesanan') return loadRekapPesanan();
  if (a === 'add-user') return formUser();
  if (a === 'edit-user') return formUser(id);
  if (a === 'del-user') return delUser(id);
  if (a === 'change-password') return formChangePwd();
  if (a === 'load-laporan') return loadLaporan();
  if (a === 'export-csv') return doExportCSV();
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
    await bootstrap();
  } catch (err) { toast(err.message, 'error'); }
  finally { hideLoader(); btn.disabled = false; btn.textContent = 'Masuk'; }
}

async function doLogout() {
  try { if (S.token) await api('logout', { token: S.token }); } catch (e) {}
  localStorage.removeItem('tk');
  localStorage.removeItem('lapakAktif');
  CACHE.clearAll();
  Object.assign(S, { user: null, token: null, lapakAktif: null, view: 'login', tab: 'home',
    lapak: [], suppliers: [], katalog: [], users: [], belanja: [], jadwal: [],
    dash: null, karyawan: null, kasbon: null, gaji: null, laporan: null, setoran: null,
    pesanan: null, settingGaji: null, rekapGaji: null, rekapPesanan: null, rekap: {} });
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
      CACHE.set('bootstrap', { dash, lapak, suppliers: sup, katalog: kat, users });
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
      const [d, kb] = await Promise.all([
        api('getKaryawanDashboard', { token: S.token }),
        api('getKasbon', { token: S.token, filter: {} })
      ]);
      S.karyawan = d; S.kasbon = kb;
      S.karyawan.distribusi.forEach(x => { if (S.rekap[x.katalogId] === undefined) S.rekap[x.katalogId] = 0; });
      S.view = 'karyawan';
    }
  } catch (e) {
    toast(e.message, 'error');
    if (e.message.indexOf('UNAUTHORIZED') !== -1) sessionExpired();
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
  const d = await api('getKaryawanDashboard', { token: S.token });
  S.karyawan = d;
  S.karyawan.distribusi.forEach(x => { if (S.rekap[x.katalogId] === undefined) S.rekap[x.katalogId] = 0; });
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

  const ok = await confirmDlg('Kirim Laporan?', 'Data tidak bisa diubah setelah dikirim.');
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
    if (tab === 'setoran' && !S.setoran) S.setoran = await api('getSetoranList', { token: S.token, filter: {} });
    if (tab === 'belanja' && !S.belanja.length) S.belanja = await api('getBelanja', { token: S.token, filter: {} });
    if (tab === 'jadwal' && !S.jadwal.length) S.jadwal = await api('getJadwal', { token: S.token, days: 30 });
    if (tab === 'kasbon') S.kasbon = await api('getKasbon', { token: S.token, filter: {} });
    if (tab === 'gaji' && !S.gaji) S.gaji = await api('getGaji', { token: S.token, filter: {} });
    if (tab === 'setting-gaji' && !S.settingGaji) S.settingGaji = await api('getSettingGaji', { token: S.token });
    if (tab === 'rekap-gaji' && !S.rekapGaji) await loadRekapGaji(false);
    if (tab === 'pesanan' && !S.pesanan) S.pesanan = await api('getPesanan', { token: S.token, filter: {} });
    if (tab === 'laporan' && !S.laporan) S.laporan = await api('getLaporan', { token: S.token, filter: {} });
  } catch (e) { toast(e.message, 'error'); }
}

function showMoreMenu() {
  const items = [
    { id:'katalog',      label:'Katalog',      icon:'box' },
    { id:'suppliers',    label:'Supplier',     icon:'truck' },
    { id:'lapak',        label:'Lapak',        icon:'store' },
    { id:'distribusi',   label:'Drop Stok',    icon:'boxes' },
    { id:'pesanan',      label:'Pesanan',      icon:'cart' },
    { id:'belanja',      label:'Belanja',      icon:'cart' },
    { id:'jadwal',       label:'Jadwal',       icon:'cal' },
    { id:'kasbon',       label:'Kasbon',       icon:'money' },
    { id:'setting-gaji', label:'Setting Gaji', icon:'money' },
    { id:'rekap-gaji',   label:'Rekap Gaji',   icon:'bar' },
    { id:'gaji',         label:'Riwayat Gaji', icon:'money' },
    { id:'users',        label:'Users',        icon:'users' },
    { id:'profil',       label:'Profil',       icon:'user' }
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
    await bootstrap();
    toast('Data dimuat ulang', 'success');
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
}

// ============================================
//  ADMIN ACTIONS
// ============================================
async function doApprove(id) {
  const ok = await confirmDlg('Terima Setoran?', 'Uang akan masuk ke Kas Besar.');
  if (!ok) return;
  showLoader();
  try {
    const r = await api('approveSetoran', { token: S.token, id });
    if (!r.success) return toast(r.message, 'error');
    toast('Setoran diterima!', 'success');
    S.setoran = await api('getSetoranList', { token: S.token, filter: {} });
    await bootstrap();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
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
    S.setoran = await api('getSetoranList', { token: S.token, filter: {} });
    render();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
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

function formKas() {
  modal({
    title: 'Transaksi Kas Manual',
    body: '<div class="field"><label>Tipe</label><select data-f="tipe" class="select"><option value="Masuk">Masuk</option><option value="Keluar">Keluar</option></select></div>' +
      '<div class="field"><label>Keterangan</label><input type="text" data-f="keterangan" class="input"></div>' +
      '<div class="field"><label>Kategori</label><input type="text" data-f="kategori" class="input" placeholder="Opsional"></div>' +
      '<div class="field"><label>Nominal</label><input type="number" data-f="nominal" class="input"></div>',
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
        const get = s => w.querySelector('[data-f="' + s + '"]').value;
        c(); showLoader();
        try {
          await api('addKas', { token: S.token, item: { tipe: get('tipe'), keterangan: get('keterangan'), kategori: get('kategori'), nominal: parseInt(get('nominal'), 10) || 0 } });
          await bootstrap();
          toast('Ditambahkan', 'success');
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); }
      } }
    ]
  });
}

function formKatalog(id) {
  const item = id ? S.katalog.find(k => k.id === id) : null;
  modal({
    title: item ? 'Edit Item' : 'Tambah Item',
    body: '<div class="field"><label>Nama</label><input type="text" data-f="nama" class="input" value="' + (item ? esc(item.nama) : '') + '"></div>' +
      '<div class="field"><label>Supplier</label><select data-f="supplierId" class="select"><option value="">-- Pilih --</option>' +
      S.suppliers.map(s => '<option value="' + esc(s.id) + '"' + (item && item.supplierId === s.id ? ' selected' : '') + '>' + esc(s.nama) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Kategori</label><input type="text" data-f="kategori" class="input" value="' + (item ? esc(item.kategori || '') : '') + '"></div>' +
      '<div class="form-grid"><div class="field"><label>Harga Beli</label><input type="number" data-f="hargaBeli" class="input" value="' + (item ? item.hargaBeli : '') + '"></div>' +
      '<div class="field"><label>Harga Jual</label><input type="number" data-f="hargaJual" class="input" value="' + (item ? item.hargaJual : '') + '"></div></div>' +
      '<label class="row text-sm"><input type="checkbox" data-f="aktif"' + (!item || item.aktif ? ' checked' : '') + '> Aktif</label>',
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
        const get = s => w.querySelector('[data-f="' + s + '"]').value;
        c(); showLoader();
        try {
          await api('saveKatalog', { token: S.token, item: {
            id: item ? item.id : null, nama: get('nama'), supplierId: get('supplierId'), kategori: get('kategori'),
            hargaBeli: parseInt(get('hargaBeli'), 10) || 0, hargaJual: parseInt(get('hargaJual'), 10) || 0,
            aktif: w.querySelector('[data-f="aktif"]').checked
          }});
          S.katalog = await api('getKatalog', { token: S.token });
          toast('Tersimpan', 'success'); render();
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); }
      } }
    ]
  });
}

async function delKatalog(id) {
  if (!(await confirmDlg('Hapus item?', 'Akan dihapus permanen.'))) return;
  showLoader();
  try {
    await api('deleteKatalog', { token: S.token, id });
    S.katalog = await api('getKatalog', { token: S.token });
    toast('Dihapus', 'success'); render();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
}

function formSupplier(id) {
  const item = id ? S.suppliers.find(s => s.id === id) : null;
  modal({
    title: item ? 'Edit Supplier' : 'Tambah Supplier',
    body: '<div class="field"><label>Nama</label><input type="text" data-f="nama" class="input" value="' + (item ? esc(item.nama) : '') + '"></div>' +
      '<div class="field"><label>Kontak</label><input type="text" data-f="kontak" class="input" value="' + (item ? esc(item.kontak || '') : '') + '"></div>' +
      '<div class="field"><label>Jadwal Pesan</label><input type="text" data-f="jadwalPesan" class="input" placeholder="mis: Senin,Kamis" value="' + (item ? esc(item.jadwalPesan || '') : '') + '"></div>' +
      '<div class="field"><label>Catatan</label><textarea data-f="catatan" class="textarea">' + (item ? esc(item.catatan || '') : '') + '</textarea></div>',
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
        const get = s => w.querySelector('[data-f="' + s + '"]').value;
        c(); showLoader();
        try {
          await api('saveSupplier', { token: S.token, item: { id: item ? item.id : null, nama: get('nama'), kontak: get('kontak'), jadwalPesan: get('jadwalPesan'), catatan: get('catatan'), aktif: true } });
          S.suppliers = await api('getSuppliers', { token: S.token });
          toast('Tersimpan', 'success'); render();
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); }
      } }
    ]
  });
}

async function delSupplier(id) {
  if (!(await confirmDlg('Hapus supplier?', ''))) return;
  showLoader();
  try {
    await api('deleteSupplier', { token: S.token, id });
    S.suppliers = await api('getSuppliers', { token: S.token });
    render();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
}

function formLapak(id) {
  const item = id ? S.lapak.find(l => l.id === id) : null;
  modal({
    title: item ? 'Edit Lapak' : 'Tambah Lapak',
    body: '<div class="field"><label>Nama</label><input type="text" data-f="nama" class="input" value="' + (item ? esc(item.nama) : '') + '"></div>' +
      '<div class="field"><label>Alamat</label><input type="text" data-f="alamat" class="input" value="' + (item ? esc(item.alamat || '') : '') + '"></div>' +
      '<label class="row text-sm"><input type="checkbox" data-f="aktif"' + (!item || item.aktif ? ' checked' : '') + '> Aktif</label>',
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
        const get = s => w.querySelector('[data-f="' + s + '"]').value;
        c(); showLoader();
        try {
          await api('saveLapak', { token: S.token, item: { id: item ? item.id : null, nama: get('nama'), alamat: get('alamat'), aktif: w.querySelector('[data-f="aktif"]').checked } });
          S.lapak = await api('getLapak', { token: S.token });
          toast('Tersimpan', 'success'); render();
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); }
      } }
    ]
  });
}

async function delLapak(id) {
  if (!(await confirmDlg('Hapus lapak?', ''))) return;
  showLoader();
  try {
    await api('deleteLapak', { token: S.token, id });
    S.lapak = await api('getLapak', { token: S.token });
    render();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
}

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
    render();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
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
  modal({
    title: item ? 'Edit Belanja' : 'Tambah Belanja',
    body: '<div class="field"><label>Nama Item</label><input type="text" data-f="item" class="input" value="' + (item ? esc(item.item) : '') + '"></div>' +
      '<div class="field"><label>Supplier</label><select data-f="supplierId" class="select"><option value="">-- Pilih --</option>' +
      S.suppliers.map(s => '<option value="' + esc(s.id) + '"' + (item && item.supplierId === s.id ? ' selected' : '') + '>' + esc(s.nama) + '</option>').join('') + '</select></div>' +
      '<div class="form-grid"><div class="field"><label>Qty</label><input type="number" min="1" data-f="qty" class="input" value="' + (item ? item.qty : 1) + '"></div>' +
      '<div class="field"><label>Estimasi Rp</label><input type="number" data-f="estimasiHarga" class="input" value="' + (item ? item.estimasiHarga : '') + '"></div></div>',
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
        const get = s => w.querySelector('[data-f="' + s + '"]').value;
        c(); showLoader();
        try {
          await api('saveBelanja', { token: S.token, item: {
            id: item ? item.id : null, item: get('item'), supplierId: get('supplierId'),
            qty: parseInt(get('qty'), 10) || 1, estimasiHarga: parseInt(get('estimasiHarga'), 10) || 0,
            checked: item ? item.checked : false
          }});
          S.belanja = await api('getBelanja', { token: S.token, filter: {} });
          toast('Tersimpan', 'success'); render();
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); }
      } }
    ]
  });
}

async function doCheckBelanja(id, checked, hargaAktual) {
  showLoader();
  try {
    const r = await api('checkBelanja', { token: S.token, id, checked, hargaAktual });
    toast(r.message, r.success ? 'success' : 'error');
    S.belanja = await api('getBelanja', { token: S.token, filter: {} });
    await bootstrap();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); render(); }
}

async function delBelanja(id) {
  if (!(await confirmDlg('Hapus item?', ''))) return;
  showLoader();
  try {
    await api('deleteBelanja', { token: S.token, id });
    S.belanja = await api('getBelanja', { token: S.token, filter: {} });
    render();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
}

function formJadwal(id) {
  const item = id ? S.jadwal.find(j => j.id === id) : null;
  modal({
    title: item ? 'Edit Jadwal' : 'Tambah Jadwal',
    body: '<div class="field"><label>Tanggal</label><input type="date" data-f="tanggal" class="input" value="' + (item ? item.tanggal : todayISO()) + '"></div>' +
      '<div class="field"><label>Supplier</label><select data-f="supplierId" class="select"><option value="">-- Pilih --</option>' +
      S.suppliers.map(s => '<option value="' + esc(s.id) + '"' + (item && item.supplierId === s.id ? ' selected' : '') + '>' + esc(s.nama) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Tipe</label><select data-f="tipe" class="select">' +
      ['Pesanan','Pembayaran','Meeting','Lain'].map(t => '<option' + (item && item.tipe === t ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Keterangan</label><textarea data-f="keterangan" class="textarea">' + (item ? esc(item.keterangan || '') : '') + '</textarea></div>',
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
        const get = s => w.querySelector('[data-f="' + s + '"]').value;
        c(); showLoader();
        try {
          await api('saveJadwal', { token: S.token, item: {
            id: item ? item.id : null, tanggal: get('tanggal'), supplierId: get('supplierId'),
            tipe: get('tipe'), keterangan: get('keterangan'), done: item ? item.done : false
          }});
          S.jadwal = await api('getJadwal', { token: S.token, days: 30 });
          toast('Tersimpan', 'success'); render();
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); }
      } }
    ]
  });
}

async function delJadwal(id) {
  if (!(await confirmDlg('Hapus jadwal?', ''))) return;
  showLoader();
  try {
    await api('deleteJadwal', { token: S.token, id });
    S.jadwal = await api('getJadwal', { token: S.token, days: 30 });
    render();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
}

function formKasbon(isAdmin) {
  if (isAdmin) {
    modal({
      title: 'Tambah Kasbon',
      body: '<div class="field"><label>Karyawan</label><select data-f="userId" class="select">' +
        S.users.filter(u => u.role === 'karyawan').map(u => '<option value="' + esc(u.id) + '">' + esc(u.name) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Tipe</label><select data-f="tipe" class="select"><option value="Kasbon">Kasbon (utang)</option><option value="Bayar">Bayar (angsuran)</option></select></div>' +
        '<div class="field"><label>Nominal</label><input type="number" data-f="nominal" class="input"></div>' +
        '<div class="field"><label>Keterangan</label><textarea data-f="keterangan" class="textarea"></textarea></div>',
      actions: [
        { label: 'Batal', onClick: c => c() },
        { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
          const get = s => w.querySelector('[data-f="' + s + '"]').value;
          c(); showLoader();
          try {
            await api('addKasbon', { token: S.token, payload: { userId: get('userId'), tipe: get('tipe'), nominal: parseInt(get('nominal'), 10) || 0, keterangan: get('keterangan') } });
            S.kasbon = await api('getKasbon', { token: S.token, filter: {} });
            toast('Kasbon dicatat', 'success'); render();
          } catch (e) { toast(e.message, 'error'); }
          finally { hideLoader(); }
        } }
      ]
    });
  } else {
    modal({
      title: 'Ajukan Kasbon',
      body: '<div class="field"><label>Nominal</label><input type="number" data-f="nominal" class="input"></div>' +
        '<div class="field"><label>Keterangan</label><textarea data-f="keterangan" class="textarea"></textarea></div>' +
        '<p class="text-xs text-gray">Kasbon akan mengurangi gaji Anda berikutnya.</p>',
      actions: [
        { label: 'Batal', onClick: c => c() },
        { label: 'Ajukan', className: 'btn-primary', onClick: async (c, w) => {
          const nom = parseInt(w.querySelector('[data-f="nominal"]').value, 10) || 0;
          const ket = w.querySelector('[data-f="keterangan"]').value;
          if (nom <= 0) return toast('Nominal > 0', 'error');
          c(); showLoader();
          try {
            await api('addKasbon', { token: S.token, payload: { nominal: nom, keterangan: ket } });
            S.kasbon = await api('getKasbon', { token: S.token, filter: {} });
            toast('Kasbon diajukan', 'success'); render();
          } catch (e) { toast(e.message, 'error'); }
          finally { hideLoader(); }
        } }
      ]
    });
  }
}

async function adminRejectKasbon(id) {
  if (!(await confirmDlg('Tolak kasbon?', ''))) return;
  showLoader();
  try {
    await api('rejectKasbon', { token: S.token, id });
    S.kasbon = await api('getKasbon', { token: S.token, filter: {} });
    toast('Ditolak', 'success'); render();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
}

async function delKasbon(id) {
  if (!(await confirmDlg('Hapus kasbon?', ''))) return;
  showLoader();
  try {
    await api('deleteKasbon', { token: S.token, id });
    S.kasbon = await api('getKasbon', { token: S.token, filter: {} });
    render();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
}

function formBayarGaji() {
  const karyawans = S.users.filter(u => u.role === 'karyawan');
  if (!karyawans.length) return toast('Tidak ada karyawan', 'error');
  modal({
    title: 'Bayar Gaji (Single)',
    body: '<div class="field"><label>Karyawan</label><select data-f="userId" class="select"><option value="">-- Pilih --</option>' +
      karyawans.map(u => '<option value="' + esc(u.id) + '">' + esc(u.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Periode</label><input type="month" data-f="periode" class="input" value="' + new Date().toISOString().slice(0,7) + '"></div>' +
      '<div class="field"><label>Gaji Pokok</label><input type="number" data-f="gajiPokok" class="input"></div>' +
      '<div class="field"><label>Tunjangan</label><input type="number" data-f="tunjangan" class="input"></div>' +
      '<div class="alert alert-warn hide" data-outstanding></div>' +
      '<div class="field"><label>Catatan</label><textarea data-f="catatan" class="textarea"></textarea></div>',
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Bayar', className: 'btn-success', onClick: async (c, w) => {
        const get = s => w.querySelector('[data-f="' + s + '"]').value;
        const uid = get('userId');
        if (!uid) return toast('Pilih karyawan', 'error');
        c(); showLoader();
        try {
          const r = await api('bayarGaji', { token: S.token, payload: { userId: uid, periode: get('periode'), gajiPokok: parseInt(get('gajiPokok'), 10) || 0, tunjangan: parseInt(get('tunjangan'), 10) || 0, catatan: get('catatan') } });
          toast(r.message, r.success ? 'success' : 'error');
          S.gaji = await api('getGaji', { token: S.token, filter: {} });
          S.kasbon = await api('getKasbon', { token: S.token, filter: {} });
          await bootstrap();
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); }
      } }
    ],
    onMount: (w) => {
      const sel = w.querySelector('[data-f="userId"]');
      const box = w.querySelector('[data-outstanding]');
      sel.addEventListener('change', async () => {
        if (!sel.value) { box.classList.add('hide'); return; }
        try {
          const r = await api('getOutstandingKasbon', { token: S.token, userId: sel.value });
          if (r.total > 0) {
            box.classList.remove('hide');
            box.textContent = 'Kasbon outstanding: ' + fmtRp(r.total) + ' akan dipotong.';
          } else box.classList.add('hide');
        } catch (e) {}
      });
    }
  });
}

function formSettingGaji(id) {
  const item = id && S.settingGaji ? S.settingGaji.find(x => x.id === id) : null;
  const karyawans = S.users.filter(u => u.role === 'karyawan');
  modal({
    title: item ? 'Edit Setting Gaji' : 'Tambah Setting Gaji',
    body: '<div class="field"><label>Karyawan</label><select data-f="userId" class="select">' +
      karyawans.map(u => '<option value="' + esc(u.id) + '"' + (item && item.userId === u.id ? ' selected' : '') + '>' + esc(u.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Tipe</label><select data-f="tipe" class="select">' +
      ['Harian','Mingguan','Bulanan'].map(t => '<option' + ((item && item.tipe === t) || (!item && t === 'Bulanan') ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Nominal</label><input type="number" data-f="nominal" class="input" value="' + (item ? item.nominal : '') + '"></div>' +
      '<div class="field"><label>Berlaku Dari</label><input type="date" data-f="berlakuDari" class="input" value="' + (item ? item.berlakuDari : todayISO()) + '"></div>' +
      '<label class="row text-sm"><input type="checkbox" data-f="aktif"' + (!item || item.aktif ? ' checked' : '') + '> Aktif</label>',
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
        const get = s => w.querySelector('[data-f="' + s + '"]').value;
        c(); showLoader();
        try {
          await api('saveSettingGaji', { token: S.token, item: {
            id: item ? item.id : null, userId: get('userId'), tipe: get('tipe'),
            nominal: parseInt(get('nominal'), 10) || 0, berlakuDari: get('berlakuDari'),
            aktif: w.querySelector('[data-f="aktif"]').checked
          }});
          S.settingGaji = await api('getSettingGaji', { token: S.token });
          toast('Tersimpan', 'success'); render();
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); }
      } }
    ]
  });
}

async function loadRekapGaji(force) {
  const tipeEl = $('[data-rekap-tipe]');
  const dariEl = $('[data-rekap-dari]');
  const sampaiEl = $('[data-rekap-sampai]');
  const tipe = tipeEl ? tipeEl.value : 'Bulanan';
  const dari = dariEl ? dariEl.value : (function(){ const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10); })();
  const sampai = sampaiEl ? sampaiEl.value : todayISO();
  showLoader();
  try {
    S.rekapGaji = await api('rekapGaji', { token: S.token, filter: { tipe, dari, sampai } });
    S._rekapGajiTipe = tipe;
    S._rekapGajiDari = dari;
    S._rekapGajiSampai = sampai;
    render();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
}

async function doBayarGajiBulk() {
  const checks = $$('[data-gaji-pick]:checked');
  if (!checks.length) return toast('Pilih minimal 1 karyawan', 'error');
  const items = checks.map(c => ({
    userId: c.dataset.userid,
    gajiPokok: parseInt(c.dataset.gajipokok, 10) || 0,
    tunjangan: 0, bonus: 0
  }));
  const total = items.reduce((s, x) => s + x.gajiPokok, 0);
  const ok = await confirmDlg('Bayar Gaji?', items.length + ' karyawan · Total bruto ' + fmtRp(total));
  if (!ok) return;
  showLoader();
  try {
    const r = await api('bayarGajiBulk', { token: S.token, payload: {
      items, periode: (S._rekapGajiTipe || 'Bulanan') + ' ' + S._rekapGajiDari + ' s/d ' + S._rekapGajiSampai
    }});
    toast(r.message, r.success ? 'success' : 'error');
    if (r.success) {
      S.rekapGaji = null; S.kasbon = null; S.gaji = null;
      await bootstrap();
    }
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
}

async function loadRekapPesanan() {
  const dari = ($('[data-pes-dari]') || {}).value || todayISO().slice(0,8) + '01';
  const sampai = ($('[data-pes-sampai]') || {}).value || todayISO();
  showLoader();
  try {
    S.rekapPesanan = await api('rekapPesanan', { token: S.token, filter: { dari, sampai } });
    S._pesananDari = dari; S._pesananSampai = sampai;
    render();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
}

function formPesanan(id) {
  const item = id && S.pesanan ? S.pesanan.find(p => p.id === id) : null;
  modal({
    title: item ? 'Edit Pesanan' : 'Tambah Pesanan',
    body: '<div class="field"><label>Tanggal</label><input type="date" data-f="tanggal" class="input" value="' + (item ? item.tanggal : todayISO()) + '"></div>' +
      '<div class="field"><label>Supplier</label><select data-f="supplierId" class="select"><option value="">-- Pilih --</option>' +
      S.suppliers.map(s => '<option value="' + esc(s.id) + '"' + (item && item.supplierId === s.id ? ' selected' : '') + '>' + esc(s.nama) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Item</label><input type="text" data-f="item" class="input" value="' + (item ? esc(item.item) : '') + '"></div>' +
      '<div class="form-grid"><div class="field"><label>Qty</label><input type="number" min="1" data-f="qty" class="input" value="' + (item ? item.qty : 1) + '"></div>' +
      '<div class="field"><label>Harga Satuan</label><input type="number" data-f="hargaSatuan" class="input" value="' + (item ? item.hargaSatuan : '') + '"></div></div>' +
      '<div class="field"><label>Status</label><select data-f="status" class="select">' +
      ['Draft','Ordered','Received','Cancelled'].map(s => '<option' + (item && item.status === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Keterangan</label><textarea data-f="keterangan" class="textarea">' + (item ? esc(item.keterangan || '') : '') + '</textarea></div>',
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
        const get = s => w.querySelector('[data-f="' + s + '"]').value;
        c(); showLoader();
        try {
          await api('savePesanan', { token: S.token, item: {
            id: item ? item.id : null, tanggal: get('tanggal'), supplierId: get('supplierId'),
            item: get('item'), qty: parseInt(get('qty'), 10) || 1,
            hargaSatuan: parseInt(get('hargaSatuan'), 10) || 0,
            status: get('status'), keterangan: get('keterangan')
          }});
          S.pesanan = await api('getPesanan', { token: S.token, filter: {} });
          toast('Tersimpan', 'success'); render();
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); }
      } }
    ]
  });
}

async function delPesanan(id) {
  if (!(await confirmDlg('Hapus pesanan?', ''))) return;
  showLoader();
  try {
    await api('deletePesanan', { token: S.token, id });
    S.pesanan = await api('getPesanan', { token: S.token, filter: {} });
    render();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
}

function formUser(id) {
  const item = id ? S.users.find(u => u.id === id) : null;
  modal({
    title: item ? 'Edit User' : 'Tambah User',
    body: '<div class="field"><label>Nama</label><input type="text" data-f="name" class="input" value="' + (item ? esc(item.name) : '') + '"></div>' +
      '<div class="field"><label>Username</label><input type="text" data-f="username" class="input" value="' + (item ? esc(item.username) : '') + '"></div>' +
      '<div class="field"><label>Password ' + (item ? '(kosongkan jika tidak diubah)' : '') + '</label><input type="password" data-f="password" class="input"></div>' +
      '<div class="field"><label>Role</label><select data-f="role" class="select"><option value="karyawan"' + (item && item.role === 'karyawan' ? ' selected' : '') + '>Karyawan</option><option value="admin"' + (item && item.role === 'admin' ? ' selected' : '') + '>Admin</option></select></div>' +
      '<div class="field"><label>Lapak Utama</label><select data-f="lapakId" class="select"><option value="">--</option>' +
      S.lapak.map(l => '<option value="' + esc(l.id) + '"' + (item && item.lapakId === l.id ? ' selected' : '') + '>' + esc(l.nama) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Akses Lapak (pisahkan koma)</label><input type="text" data-f="lapakIds" class="input" placeholder="L01,L02" value="' + (item ? esc(item.lapakIds || '') : '') + '"></div>' +
      '<label class="row text-sm"><input type="checkbox" data-f="aktif"' + (!item || item.aktif ? ' checked' : '') + '> Aktif</label>',
    actions: [
      { label: 'Batal', onClick: c => c() },
      { label: 'Simpan', className: 'btn-primary', onClick: async (c, w) => {
        const get = s => w.querySelector('[data-f="' + s + '"]').value;
        c(); showLoader();
        try {
          await api('saveUser', { token: S.token, item: {
            id: item ? item.id : null, name: get('name'), username: get('username'),
            password: get('password') || undefined, role: get('role'),
            lapakId: get('lapakId'), lapakIds: get('lapakIds'),
            aktif: w.querySelector('[data-f="aktif"]').checked
          }});
          S.users = await api('getUsers', { token: S.token });
          toast('Tersimpan', 'success'); render();
        } catch (e) { toast(e.message, 'error'); }
        finally { hideLoader(); }
      } }
    ]
  });
}

async function delUser(id) {
  if (!(await confirmDlg('Hapus user?', ''))) return;
  showLoader();
  try {
    await api('deleteUser', { token: S.token, id });
    S.users = await api('getUsers', { token: S.token });
    render();
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

async function loadLaporan() {
  const dari = $('[data-lap-dari]').value;
  const sampai = $('[data-lap-sampai]').value;
  showLoader();
  try {
    S.laporan = await api('getLaporan', { token: S.token, filter: { dari, sampai } });
    render();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoader(); }
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

(async function boot() {
  tryAutoLogin();
})();
