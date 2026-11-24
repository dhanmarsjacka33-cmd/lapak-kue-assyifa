/* Konfigurasi frontend TESTING.
 * URL API diminta saat halaman dibuka dan hanya disimpan di memori tab ini.
 * Tidak membaca config.js produksi dan tidak menyimpan URL ke repositori.
 */
(() => {
  const raw = window.prompt('Tempel URL Web App Apps Script TESTING (akhiran /exec). Jangan gunakan URL produksi.');
  if (!raw) {
    window.APP_CONFIG = { API_URL: '' };
    window.alert('Mode TESTING dibatalkan. Aplikasi tidak akan terhubung ke API.');
    return;
  }
  const value = raw.trim();
  let parsed;
  try { parsed = new URL(value); } catch (_) {
    window.APP_CONFIG = { API_URL: '' };
    window.alert('URL tidak valid. Muat ulang halaman untuk mencoba lagi.');
    return;
  }
  const valid = parsed.protocol === 'https:' && parsed.hostname === 'script.google.com' && /^\\/macros\\/s\\/[^/]+\\/exec$/.test(parsed.pathname);
  if (!valid) {
    window.APP_CONFIG = { API_URL: '' };
    window.alert('URL ditolak. Gunakan URL Web App TESTING dari script.google.com yang berakhiran /exec.');
    return;
  }
  window.APP_CONFIG = { API_URL: value };
})();
