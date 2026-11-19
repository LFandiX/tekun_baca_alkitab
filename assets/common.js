/* Tekun Baca Firman — utilitas bersama (anggota & admin) */
(function () {
  'use strict';

  const CFG = window.TBF_CONFIG || {};
  const API_URL = String(CFG.API_URL || '').trim();
  const IS_DEMO = !API_URL;
  const TZ = 'Asia/Jakarta';
  const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  const EMOJI_SUDAH = ['🥶', '🔥', '✅', '🙏', '📖', '💪', '⭐', '🎉', '😇', '🕊️', '🌟', '💯', '🥳', '❤️', '🌱', '👑', '😎', '🙌'];
  const EMOJI_BELUM = ['🙅🙅', '😴', '🐢', '⏳', '🥺', '💤', '🙈', '📚', '🫣', '🐌', '⌛', '🏃'];

  /* ---------- penyimpanan lokal (aman bila diblokir) ---------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } },
  };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- kode link pribadi ---------- */
  const KODE_RE = /^[a-z0-9]{6,16}$/i;
  /** Ambil kode dari ?k=… atau #… di alamat, lalu dari penyimpanan HP */
  function getToken() {
    let k = '';
    try { k = new URLSearchParams(location.search).get('k') || ''; } catch (e) { /* abaikan */ }
    if (!k && location.hash) k = location.hash.slice(1);
    if (KODE_RE.test(k)) return { kode: k.toLowerCase(), fromUrl: true };
    const saved = store.get('tbf_kode');
    return saved && KODE_RE.test(saved) ? { kode: saved, fromUrl: false } : null;
  }
  function personalLink(kode) {
    return IS_DEMO
      ? new URL('index.html#' + kode, location.href).href
      : new URL('./?k=' + kode, location.href).href;
  }

  /* ---------- tanggal ---------- */
  function todayStr() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function parseYmd(s) { const p = String(s).split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
  function fmtTanggal(s, opt) {
    const d = parseYmd(s); const h = NAMA_HARI[d.getUTCDay()];
    return (opt && opt.short ? h.slice(0, 3) : h) + ', ' + d.getUTCDate() + ' ' + BULAN[d.getUTCMonth()];
  }
  function fmtShort(s) { const d = parseYmd(s); return d.getUTCDate() + '/' + (d.getUTCMonth() + 1); }
  function relTime(iso) {
    if (!iso) return 'belum pernah';
    const diff = (Date.now() - Date.parse(iso)) / 1000;
    if (diff < 90) return 'baru saja';
    if (diff < 3600) return Math.round(diff / 60) + ' mnt lalu';
    if (diff < 86400) return Math.round(diff / 3600) + ' jam lalu';
    const days = Math.round(diff / 86400);
    return days === 1 ? 'kemarin' : days + ' hari lalu';
  }

  /* ---------- logika progres ---------- */
  function indexSchedule(schedule) { const m = {}; schedule.forEach(s => { m[s.hari] = s; }); return m; }
  function firstUnread(set, upTo) { for (let d = 1; d <= upTo; d++) if (!set.has(d)) return d; return null; }
  function countUnread(set, upTo) { let n = 0; for (let d = 1; d <= upTo; d++) if (!set.has(d)) n++; return n; }
  function countDone(set, upTo) { let n = 0; set.forEach(d => { if (d <= upTo) n++; }); return n; }
  function pasalDone(set, byDay, upTo) { let n = 0; set.forEach(d => { if (d <= upTo && byDay[d]) n += byDay[d].pasal || 0; }); return n; }

  /** Teks rekap format grup WA: "Kejadian 31-32 kamis 🥶" lalu daftar nama */
  function buildRecap(reading, members, getSet, emo, byDay) {
    const head = reading.bacaan + ' ' + reading.namaHari.toLowerCase() + ' ' + emo.emojiJudul;
    const lines = members.map((m, i) => {
      const b = firstUnread(getSet(m.nama) || new Set(), reading.hari);
      return (i + 1) + '. ' + m.nama + ' : ' + (b ? byDay[b].singkat + emo.emojiBelum : emo.emojiSudah);
    });
    return [head].concat(lines).join('\n');
  }

  /* ---------- API ---------- */
  async function readJson(r) {
    if (!r.ok) throw new Error('Server error ' + r.status);
    let j;
    try { j = await r.json(); } catch (e) {
      throw new Error('Respons server tidak valid. Cek URL di config.js dan pastikan deploy "Who has access: Anyone".');
    }
    if (!j.ok) throw new Error(j.error || 'Gagal');
    return j;
  }
  // Error sementara (server sibuk, antrean penuh, sinyal putus) → dicoba ulang otomatis.
  // Aman diulang karena setiap laporan bersifat "set sudah/belum", bukan "tambah".
  const RETRY_RE = /too many|simultan|invoked|lock|timeout|timed out|busy|sibuk|Server error (5\d\d|429)|Failed to fetch|NetworkError|Load failed|network/i;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function withRetry(fn) {
    const waits = [1200, 2600];
    for (let i = 0; ; i++) {
      try { return await fn(); } catch (e) {
        if (i >= waits.length || !RETRY_RE.test(String(e && e.message))) throw e;
        await sleep(waits[i] + Math.random() * 400);
      }
    }
  }
  async function apiGet(params) {
    if (IS_DEMO) return withRetry(() => Demo.get(params));
    return withRetry(async () => readJson(await fetch(API_URL + '?' + new URLSearchParams(params).toString())));
  }
  async function apiPost(body) {
    if (IS_DEMO) return withRetry(() => Demo.post(body));
    return withRetry(async () => readJson(await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // text/plain = tanpa preflight CORS
      body: JSON.stringify(body),
    })));
  }

  /* ---------- simpan data terakhir di HP (tampil instan saat dibuka) ---------- */
  function cacheGet(key, storage) {
    try { const j = JSON.parse((storage || localStorage).getItem(key) || 'null'); return j && j.v === 3 ? j.d : null; } catch (e) { return null; }
  }
  function cacheSet(key, data, storage) {
    try { (storage || localStorage).setItem(key, JSON.stringify({ v: 3, t: Date.now(), d: data })); } catch (e) { /* penuh / diblokir */ }
  }
  function cacheDel(key, storage) { try { (storage || localStorage).removeItem(key); } catch (e) { /* abaikan */ } }
  function syncing(on) {
    const el = document.getElementById('sync'); if (el) el.hidden = !on;
    // halaman anggota: cincin berputar di tombol akun (tidak memakan tempat)
    const ab = document.getElementById('acct-btn');
    if (ab) { ab.classList.toggle('is-syncing', !!on); ab.title = on ? 'Memperbarui data…' : ''; }
  }

  /* ---------- UI kecil ---------- */
  let toastTimer;
  function toast(msg, opt) {
    opt = opt || {};
    const el = document.getElementById('toast');
    if (!el) return;
    el.innerHTML = '<span>' + esc(msg) + '</span>' + (opt.action ? '<button type="button">' + esc(opt.action) + '</button>' : '');
    if (opt.action) el.querySelector('button').onclick = () => { el.classList.remove('show'); opt.onAction(); };
    el.classList.toggle('lift', !!document.querySelector('.actionbar.show, .bottomnav:not([hidden])'));
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), opt.ms || (opt.action ? 6000 : 2600));
  }

  function openModal(html, opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = '<div class="modal-sheet" role="dialog" aria-modal="true"><div class="grab" aria-hidden="true"></div><div class="modal-body">' + html + '</div></div>';
    document.body.appendChild(wrap);
    document.body.classList.add('no-scroll');
    const onKey = e => { if (e.key === 'Escape') close(); };
    function close() {
      if (!wrap.isConnected) return;
      wrap.remove();
      document.body.classList.remove('no-scroll');
      document.removeEventListener('keydown', onKey);
      if (opts.onClose) opts.onClose();
    }
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
    return { el: wrap, close, setHtml(h) { wrap.querySelector('.modal-body').innerHTML = h; } };
  }

  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (_) { /* abaikan */ }
      ta.remove(); return ok;
    }
  }

  /* ---------- link WhatsApp ----------
   * Di HP langsung buka aplikasi WhatsApp (whatsapp://). Link wa.me melewati
   * halaman pengalihan yang di sebagian HP merusak emoji jadi "�".            */
  const IS_MOBILE = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  function waUrl(text) {
    const enc = encodeURIComponent(String(text || '').normalize('NFC'));
    return IS_MOBILE ? 'whatsapp://send?text=' + enc : 'https://wa.me/?text=' + enc;
  }
  const waTarget = IS_MOBILE ? '_self' : '_blank';

  function haptic(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 12); } catch (e) { /* abaikan */ } }

  function demoBanner(extra) {
    if (!IS_DEMO) return;
    const el = document.getElementById('demo-banner');
    if (!el) return;
    el.hidden = false;
    el.innerHTML = '<strong>Mode demo</strong> · data contoh. ' + (extra || '') +
      ' <button type="button" class="link-btn" id="demo-reset">Reset</button>';
    el.querySelector('#demo-reset').onclick = () => { Demo.reset(); location.reload(); };
  }

  /* ============================================================
   *  MODE DEMO — meniru perilaku Code.gs, tanpa server
   * ============================================================ */
  const KITAB = [
    ['Kejadian', 'Kej', 50], ['Keluaran', 'Kel', 40], ['Imamat', 'Im', 27], ['Bilangan', 'Bil', 36],
    ['Ulangan', 'Ul', 34], ['Yosua', 'Yos', 24], ['Hakim-hakim', 'Hak', 21], ['Rut', 'Rut', 4],
    ['1 Samuel', '1Sam', 31], ['2 Samuel', '2Sam', 24], ['1 Raja-raja', '1Raj', 22], ['2 Raja-raja', '2Raj', 25],
    ['1 Tawarikh', '1Taw', 29], ['2 Tawarikh', '2Taw', 36], ['Ezra', 'Ezr', 10], ['Nehemia', 'Neh', 13],
    ['Ester', 'Est', 10], ['Ayub', 'Ayb', 42], ['Mazmur', 'Mzm', 150], ['Amsal', 'Ams', 31],
    ['Pengkhotbah', 'Pkh', 12], ['Kidung Agung', 'Kid', 8], ['Yesaya', 'Yes', 66], ['Yeremia', 'Yer', 52],
    ['Ratapan', 'Rat', 5], ['Yehezkiel', 'Yeh', 48], ['Daniel', 'Dan', 12], ['Hosea', 'Hos', 14],
    ['Yoel', 'Yl', 3], ['Amos', 'Am', 9], ['Obaja', 'Ob', 1], ['Yunus', 'Yun', 4], ['Mikha', 'Mi', 7],
    ['Nahum', 'Nah', 3], ['Habakuk', 'Hab', 3], ['Zefanya', 'Zef', 3], ['Hagai', 'Hag', 2],
    ['Zakharia', 'Za', 14], ['Maleakhi', 'Mal', 4],
    ['Matius', 'Mat', 28], ['Markus', 'Mrk', 16], ['Lukas', 'Luk', 24], ['Yohanes', 'Yoh', 21],
    ['Kisah Para Rasul', 'Kis', 28], ['Roma', 'Rm', 16], ['1 Korintus', '1Kor', 16], ['2 Korintus', '2Kor', 13],
    ['Galatia', 'Gal', 6], ['Efesus', 'Ef', 6], ['Filipi', 'Flp', 4], ['Kolose', 'Kol', 4],
    ['1 Tesalonika', '1Tes', 5], ['2 Tesalonika', '2Tes', 3], ['1 Timotius', '1Tim', 6], ['2 Timotius', '2Tim', 4],
    ['Titus', 'Tit', 3], ['Filemon', 'Flm', 1], ['Ibrani', 'Ibr', 13], ['Yakobus', 'Yak', 5],
    ['1 Petrus', '1Ptr', 5], ['2 Petrus', '2Ptr', 3], ['1 Yohanes', '1Yoh', 5], ['2 Yohanes', '2Yoh', 1],
    ['3 Yohanes', '3Yoh', 1], ['Yudas', 'Yud', 1], ['Wahyu', 'Why', 22],
  ];

  function generateSchedule(mulai, perHari, libur, kitabMulai) {
    const idx = KITAB.findIndex(k => k[0].toLowerCase() === kitabMulai.toLowerCase());
    const chunks = [];
    for (let b = idx; b < KITAB.length; b++) {
      const [nama, sgk, jml] = KITAB[b];
      const parts = [];
      for (let c = 1; c <= jml; c += perHari) parts.push([c, Math.min(c + perHari - 1, jml)]);
      const last = parts[parts.length - 1];
      if (parts.length > 1 && last[1] - last[0] + 1 < perHari) { parts.pop(); parts[parts.length - 1][1] = jml; }
      parts.forEach(([a, z]) => {
        const rng = a === z ? String(a) : a + '-' + z;
        chunks.push({ bacaan: nama + ' ' + rng, singkat: sgk.toLowerCase() + ' ' + rng, pasal: z - a + 1 });
      });
    }
    let t = parseYmd(mulai).getTime();
    return chunks.map((ch, i) => {
      while (libur.indexOf(new Date(t).getUTCDay()) >= 0) t += 86400000;
      const d = new Date(t); t += 86400000;
      return Object.assign({ hari: i + 1, tanggal: d.toISOString().slice(0, 10), namaHari: NAMA_HARI[d.getUTCDay()] }, ch);
    });
  }

  const Demo = (function () {
    const KEY = 'tbf_demo_v2';
    const PIN = '1234';
    const NAMA_KELOMPOK = 'TEKUN BACA FIRMAN';
    const NAMES = ['Agustina', 'Ahong', 'Andang', 'Andre', 'Andy', 'Arini', 'Bryan', 'Clara', 'Dedi', 'Dedi SS',
      'Dewi H', 'Dharmawan', 'Dimas', 'Eben', 'Elfrida', 'Enjel', 'Erin', 'Erwis', 'Fandi', 'Fenny', 'Fian', 'Geta'];
    const LAG = { Andang: 3, Andre: 3, Elfrida: 3, Bryan: 2, Dedi: 2, Enjel: 2, Fandi: 2, Dimas: 6, Erin: 1, Geta: 1, Fian: 1, Ahong: 1 };
    const SCHEDULE = generateSchedule('2026-10-26', 2, [0], 'Kejadian');
    const HURUF = 'abcdefghjkmnpqrstuvwxyz23456789';
    let mem = null;

    function rng(seed) {
      return function () {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const kodeAcak = r => Array.from({ length: 8 }, () => HURUF[Math.floor(r() * HURUF.length)]).join('');
    function curDay(today) { let c = 0; SCHEDULE.forEach(s => { if (s.tanggal <= today) c = s.hari; }); return c; }
    function seed() {
      const c = curDay(todayStr()); const r = rng(7); const reports = [];
      NAMES.forEach(nama => {
        const upto = c - (LAG[nama] || 0);
        for (let d = 1; d <= upto; d++) {
          if (nama === 'Clara' && d === c - 5) continue; // contoh: satu bacaan terlewat di tengah
          const base = Date.parse(SCHEDULE[d - 1].tanggal + 'T00:00:00+07:00');
          let t = base + (5 + r() * 16) * 3600000;
          if (t > Date.now()) t = Date.now() - r() * 7200000;
          reports.push({ nama, hari: d, waktu: new Date(t).toISOString() });
        }
      });
      const kr = rng(42); const kode = {};
      NAMES.forEach(n => { kode[n] = kodeAcak(kr); });
      return { v: 2, reports, kode, emoji: { emojiJudul: '🥶', emojiSudah: '🥶', emojiBelum: '🙅🙅' } };
    }
    function load() {
      if (mem) return mem;
      try { const j = JSON.parse(store.get(KEY) || 'null'); if (j && j.v === 2) mem = j; } catch (e) { /* abaikan */ }
      if (!mem) { mem = seed(); save(); }
      return mem;
    }
    function save() { store.set(KEY, JSON.stringify(mem)); }
    function doneMap() {
      const m = {};
      load().reports.forEach(r => { (m[r.nama] = m[r.nama] || new Set()).add(r.hari); });
      return m;
    }
    const sorted = set => Array.from(set || []).sort((a, b) => a - b);
    const byKode = k => NAMES.find(n => load().kode[n] === String(k || '').toLowerCase());
    const byNama = n => NAMES.find(x => x.toLowerCase() === String(n || '').trim().toLowerCase());
    const settings = () => Object.assign({ namaKelompok: NAMA_KELOMPOK }, load().emoji);
    const checkPin = p => { if (String(p || '').trim() !== PIN) throw new Error('PIN_ADMIN_SALAH'); };
    function write(nama, hariList, status) {
      const c = curDay(todayStr());
      const hari = Array.from(new Set((hariList || []).map(Number))).filter(d => d >= 1 && d <= c);
      if (!hari.length) throw new Error('Tidak ada bacaan yang bisa dilaporkan');
      const st = load();
      const have = new Set(st.reports.filter(r => r.nama === nama).map(r => r.hari));
      if (status) {
        const now = new Date().toISOString();
        hari.filter(d => !have.has(d)).forEach(d => st.reports.push({ nama, hari: d, waktu: now }));
      } else {
        const del = new Set(hari);
        st.reports = st.reports.filter(r => !(r.nama === nama && del.has(r.hari)));
      }
      save();
      return sorted(doneMap()[nama]);
    }
    const wait = () => new Promise(r => setTimeout(r, (window.__tbfDemoDelay || 0) + 350 + Math.random() * 450));
    const clone = o => JSON.parse(JSON.stringify(o));

    return {
      reset() { store.del(KEY); mem = null; },
      sample(names) { return names.map(n => ({ nama: n, kode: load().kode[n] })); },
      async get(p) {
        await wait();
        const today = todayStr(); const c = curDay(today);
        if (p.action === 'init') {
          const me = byKode(p.k); if (!me) throw new Error('LINK_TIDAK_VALID');
          const dm = doneMap();
          return clone({
            ok: true, settings: settings(), me: { nama: me }, done: sorted(dm[me]),
            schedule: SCHEDULE.filter(s => s.hari <= c + 7), today, currentDay: c,
            board: NAMES.map(n => { const s = dm[n] || new Set(); return { nama: n, belum: firstUnread(s, c), tertinggal: countUnread(s, c) }; }),
          });
        }
        if (p.action === 'admin') throw new Error('PERBARUI_WEB');
        throw new Error('Aksi tidak dikenal');
      },
      adminData() {
        const today = todayStr(); const c = curDay(today);
        {
          const dm = doneMap(); const out = {
            ok: true, settings: settings(), members: NAMES.map(n => ({ nama: n, kode: load().kode[n] })),
            schedule: SCHEDULE.filter(s => s.hari <= Math.max(c, 1)), today, currentDay: c, progress: {}, terakhir: {},
          };
          NAMES.forEach(n => {
            out.progress[n] = sorted(dm[n]);
            const ts = load().reports.filter(r => r.nama === n).map(r => r.waktu).sort();
            out.terakhir[n] = ts.length ? ts[ts.length - 1] : null;
          });
          return clone(out);
        }
      },
      async post(b) {
        await wait();
        if (b.action === 'admin') { checkPin(b.pin); return this.adminData(); }
        if (b.action === 'lapor') {
          const me = byKode(b.k); if (!me) throw new Error('LINK_TIDAK_VALID');
          return { ok: true, done: write(me, b.hari, b.status !== false) };
        }
        checkPin(b.pin);
        if (b.action === 'adminLapor') {
          const n = byNama(b.nama); if (!n) throw new Error('Nama tidak terdaftar: ' + b.nama);
          return { ok: true, nama: n, done: write(n, b.hari, b.status !== false) };
        }
        if (b.action === 'simpanEmoji') {
          ['emojiJudul', 'emojiSudah', 'emojiBelum'].forEach(k => {
            if (!String(b[k] || '').trim()) throw new Error('Emoji tidak boleh kosong');
          if (/^[=+\-@]/.test(String(b[k]).trim())) throw new Error('Emoji tidak boleh diawali = + - @');
          });
          load().emoji = { emojiJudul: b.emojiJudul.trim(), emojiSudah: b.emojiSudah.trim(), emojiBelum: b.emojiBelum.trim() };
          save();
          return { ok: true, settings: settings() };
        }
        if (b.action === 'resetKode') {
          const n = byNama(b.nama); if (!n) throw new Error('Nama tidak terdaftar');
          load().kode[n] = kodeAcak(rng(Date.now() & 0xffff)); save();
          return { ok: true, nama: n, kode: load().kode[n] };
        }
        throw new Error('Aksi tidak dikenal');
      },
    };
  })();

  window.TBF = {
    IS_DEMO, store, esc, getToken, personalLink, todayStr, fmtTanggal, fmtShort, relTime,
    indexSchedule, firstUnread, countUnread, countDone, pasalDone, buildRecap,
    waUrl, waTarget, apiGet, apiPost, cacheGet, cacheSet, cacheDel, syncing, toast, openModal, copyText, haptic, demoBanner,
    EMOJI_SUDAH, EMOJI_BELUM, demo: Demo,
  };
})();
