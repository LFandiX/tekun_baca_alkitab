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
  function dayName(s) { return NAMA_HARI[parseYmd(s).getUTCDay()]; }
  /** Jadwal ringkas dari server [hari, tanggal, bacaan, singkat, pasal] → objek lengkap */
  function expandSch(data) {
    if (data && data.sch && !data.schedule) {
      data.schedule = data.sch.map(a => ({ hari: a[0], tanggal: a[1], namaHari: dayName(a[1]), bacaan: a[2], singkat: a[3], pasal: a[4] }));
    }
    return data;
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
    el.classList.toggle('lift', !!document.querySelector('.actionbar.show, .bottomnav:not([hidden]), .reader'));
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
   *  RENUNGAN: teks WhatsApp → tampilan rapi
   *  *tebal*  _miring_  ~coret~  ```kode```, judul pasal, kotak Renungan & Pokok Doa
   * ============================================================ */
  const BULAN_PANJANG = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
  const stripMarks = t => String(t).replace(/[*_~`]/g, '');
  const DATE_RE = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/;
  const GUIDE_RE = /^guidelines?\b\s*:?\s*(.*)$/i;
  const LABEL_RE = /^(renungan|refleksi|aplikasi|pertanyaan(?: renungan)?|pokok doa|pokok-pokok doa|doa|ayat hafalan)\s*:?\s*$/i;
  const LABEL_INLINE_RE = /^(renungan|refleksi|aplikasi|pokok doa|doa|ayat hafalan)\s*:\s*(.+)$/i;
  const CLOSING_RE = /^(selamat (menikmati|membaca|bersaat teduh|bersekutu)|tuhan yesus memberkati|gbu\b|soli deo gloria)/i;

  function rnDateOf(line) {
    const m = stripMarks(line).match(DATE_RE);
    if (!m) return null;
    const mi = BULAN_PANJANG.indexOf(m[2].toLowerCase());
    return mi < 0 ? null : m[3] + '-' + String(mi + 1).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
  }
  /** Tanggal di baris-baris awal, mis. "*Jumat, 20 November 2026*" → "2026-11-20" */
  function rnParseDate(teks) {
    const lines = String(teks || '').split(/\r?\n/).slice(0, 6);
    for (const l of lines) { const d = rnDateOf(l); if (d) return d; }
    return null;
  }
  /** "*Guidelines: Kejadian 45–46*" → "Kejadian 45–46" */
  function rnParseGuide(teks) {
    const lines = String(teks || '').split(/\r?\n/).slice(0, 8);
    for (const l of lines) { const m = stripMarks(l).trim().match(GUIDE_RE); if (m && m[1]) return m[1].trim(); }
    return null;
  }
  // "Imamat 27 – Bilangan 1" / "Imamat 27 dan Bilangan 1" / "Imamat 27 & Bilangan 1" → sama
  const rnNorm = t => String(t || '').toLowerCase().replace(/[‐-―−]/g, '-').replace(/\s*-\s*/g, '-')
    .replace(/(\d)\s*(?:-|&|\+|;|,|\/|\bdan\b)\s*(?=(?:[1-3]\s*)?[a-z])/g, '$1 & ').replace(/\s+/g, ' ').trim();

  /** buang baris tanggal & "Guidelines" di awal (sudah tampil di judul) */
  function rnBodyLines(teks) {
    const lines = String(teks || '').replace(/^​/, '').replace(/\r\n?/g, '\n').split('\n');
    let i = 0, removed = 0;
    while (i < lines.length && removed < 4) {
      const t = stripMarks(lines[i]).trim();
      if (!t) { i++; continue; }
      if ((rnDateOf(t) && t.length < 60) || GUIDE_RE.test(t)) { i++; removed++; continue; }
      break;
    }
    return lines.slice(i);
  }

  function rnInline(escaped) {
    return escaped
      .replace(/```([^`]+)```/g, '<code>$1</code>')
      .replace(/(^|[^\w*])\*(?!\s)([^*\n]*?[^\s*])\*(?!\w)/g, '$1<strong>$2</strong>')
      .replace(/(^|[^\w_])_(?!\s)([^_\n]*?[^\s_])_(?!\w)/g, '$1<em>$2</em>')
      .replace(/(^|[^\w~])~(?!\s)([^~\n]*?[^\s~])~(?!\w)/g, '$1<s>$2</s>');
  }
  const capFirst = t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();

  /* --- blok desain (1 baris, simbol di awal & akhir baris) ---
   *  %teks%  poin bernomor        $teks$  ayat kunci          > teks  kutipan ayat
   *  !teks!  kotak penting        &teks&  "Lakukan hari ini"   ---     garis pemisah */
  const BLOK = [
    ['poin', /^%(?!\s)(.+?)%$/], ['ayat', /^\$(?!\s)(.+?)\$$/], ['penting', /^!(?!\s)(.+?)!$/],
    ['aksi', /^&(?!\s)(.+?)&$/], ['kutip', /^>\s?(.*)$/], ['garis', /^(?:-{3,}|={3,}|—{2,})$/],
  ];
  function rnBlok(t) {
    for (const [k, re] of BLOK) { const m = t.match(re); if (m) return { k, isi: (m[1] || '').trim() }; }
    return null;
  }
  /** "Yang kamu rencanakan ... (Kej 50:20)" → isi + sumber */
  const splitRef = t => { const m = t.match(/^(.*\S)\s*[(–—-]\s*([1-3]?\s?[A-Za-z][\w.\s]*\d+[:.]\d+[\d\-–,\s]*)\)?$/); return m ? [m[1].replace(/[\s–—-]+$/, ''), m[2].trim()] : [t, '']; };

  /** Teks renungan → HTML aman (semua teks di-escape dulu) */
  function rnFormat(teks) {
    const out = []; let para = []; let box = null; let grp = null; let ptN = 0;
    const target = () => (box ? box.parts : out);
    const flushGrp = () => {
      if (!grp) return;
      if (grp.k === 'kutip') target().push('<blockquote class="rn-kutip">' + grp.items.map(x => (x.ref ? '<cite>' + x.h + '</cite>' : '<p>' + x.h + '</p>')).join('') + '</blockquote>');
      else target().push('<div class="rn-aksi"><p class="rn-aksi-h">Lakukan hari ini</p>' +
        grp.items.map(x => '<label class="rn-aksi-i"><input type="checkbox"><span>' + x.h + '</span></label>').join('') + '</div>');
      grp = null;
    };
    const flushPara = () => { if (para.length) { target().push('<p>' + para.join('<br>') + '</p>'); para = []; } };
    const flush = () => { flushGrp(); flushPara(); };
    const closeBox = () => { flush(); if (box) { out.push('<div class="rn-box rn-' + box.type + '">' + box.parts.join('') + '</div>'); box = null; ptN = 0; } };
    const KELUAR = { ayat: 1, penting: 1, aksi: 1, garis: 1 };   // blok ini tidak dimasukkan ke kotak Renungan / Pokok Doa
    rnBodyLines(teks).forEach(raw => {
      const t = raw.trim();
      const plain = stripMarks(t).trim();
      if (!t) { if (grp && grp.k === 'kutip') flushGrp(); flushPara(); return; }   // daftar "Lakukan" boleh diselingi baris kosong
      const b = rnBlok(t);
      if (b) {
        if (KELUAR[b.k] && box && !(grp && grp.k === b.k)) closeBox();
        if (b.k === 'kutip' || b.k === 'aksi') {
          flushPara();
          if (grp && grp.k !== b.k) flushGrp();
          if (!grp) grp = { k: b.k, items: [] };
          if (b.isi) grp.items.push({ h: rnInline(esc(b.isi.replace(/^[\u2014\u2013-]\s*(?=\S)/, m => (b.k === 'kutip' ? '' : m)))), ref: b.k === 'kutip' && /^[\u2014\u2013-]\s*\S/.test(b.isi) });
          return;
        }
        flush();
        if (b.k === 'garis') { target().push('<div class="rn-garis" role="separator"><i></i><i></i><i></i></div>'); return; }
        if (b.k === 'poin') { ptN++; target().push('<div class="rn-pt"><span class="rn-pt-n" aria-hidden="true">' + ptN + '</span><p>' + rnInline(esc(b.isi)) + '</p></div>'); return; }
        if (b.k === 'penting') { target().push('<div class="rn-penting"><span class="rn-penting-i" aria-hidden="true">!</span><p>' + rnInline(esc(b.isi)) + '</p></div>'); return; }
        if (b.k === 'ayat') {
          const [isi, ref] = splitRef(b.isi);
          target().push('<figure class="rn-ayat"><p class="rn-ayat-h">Ayat kunci</p><blockquote>' + rnInline(esc(isi)) + '</blockquote>' +
            (ref ? '<figcaption>' + esc(ref) + '</figcaption>' : '') + '</figure>');
          return;
        }
      }
      flushGrp();
      if (CLOSING_RE.test(plain)) { closeBox(); out.push('<p class="rn-closing">' + rnInline(esc(t)) + '</p>'); return; }
      const lb = plain.match(LABEL_RE), li = !lb && plain.match(LABEL_INLINE_RE);
      if (lb || li) {
        closeBox();
        const name = (lb || li)[1];
        box = { type: /doa/i.test(name) ? 'doa' : 'refl', parts: ['<h4 class="rn-label">' + esc(capFirst(name)) + '</h4>'] }; ptN = 0;
        if (li) para.push(rnInline(esc(li[2])));
        return;
      }
      if (/^\*[^*]+\*$/.test(t) && plain.length <= 60) { closeBox(); ptN = 0; out.push('<h3 class="rn-h">' + esc(plain) + '</h3>'); return; }
      para.push(rnInline(esc(t)));
    });
    closeBox();
    return out.join('');
  }

  /** Versi untuk dikirim ke grup WA: simbol desain diganti tanda yang rapi di WhatsApp */
  function rnToWa(teks) {
    let n = 0;
    return String(teks || '').replace(/\r\n?/g, '\n').split('\n').map(raw => {
      const t = raw.trim();
      if (/^\*[^*]+\*$/.test(t)) n = 0;
      const b = t && rnBlok(t);
      if (!b || b.k === 'kutip') return raw;
      if (b.k === 'poin') { n++; return (n <= 9 ? n + '\uFE0F\u20E3' : n + '.') + ' ' + b.isi; }
      if (b.k === 'ayat') return '📖 _' + b.isi + '_';
      if (b.k === 'penting') return '📌 *' + b.isi + '*';
      if (b.k === 'aksi') return '☑️ ' + b.isi;
      return '〰️〰️〰️';
    }).join('\n');
  }

  /** Kalimat pembuka untuk kartu ringkas */
  function rnPreview(teks, max) {
    max = max || 150;
    for (const raw of rnBodyLines(teks)) {
      const t = raw.trim(); const plain = stripMarks(t).trim();
      if (!plain || /^\*[^*]+\*$/.test(t) || LABEL_RE.test(plain)) continue;
      const b = rnBlok(t); if (b && (b.k === 'garis' || !b.isi)) continue;
      const pl = b ? stripMarks(b.isi) : plain;
      return pl.length > max ? pl.slice(0, max).replace(/\s+\S*$/, '') + '…' : pl;
    }
    return '';
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

  function generateSchedule(mulai, perHari, libur, kitabMulai, lintas) {
    const idx = KITAB.findIndex(k => k[0].toLowerCase() === kitabMulai.toLowerCase());
    const chunks = [];
    const teks = segs => {
      const rng = ([, a, z]) => a === z ? String(a) : a + '-' + z;
      return { bacaan: segs.map(g => KITAB[g[0]][0] + ' ' + rng(g)).join(' & '),
        singkat: segs.map(g => KITAB[g[0]][1].toLowerCase() + ' ' + rng(g)).join(' & '),
        pasal: segs.reduce((n, [, a, z]) => n + z - a + 1, 0) };
    };
    if (lintas) { // tepat perHari pasal per hari, boleh menyambung ke kitab berikutnya
      let cur = [], n = 0;
      for (let b = idx; b < KITAB.length; b++) for (let c = 1; c <= KITAB[b][2]; c++) {
        const g = cur[cur.length - 1];
        if (g && g[0] === b && g[2] === c - 1) g[2] = c; else cur.push([b, c, c]);
        if (++n === perHari) { chunks.push(teks(cur)); cur = []; n = 0; }
      }
      if (cur.length) chunks.push(teks(cur));
    } else for (let b = idx; b < KITAB.length; b++) {
      const jml = KITAB[b][2];
      const parts = [];
      for (let c = 1; c <= jml; c += perHari) parts.push([c, Math.min(c + perHari - 1, jml)]);
      const last = parts[parts.length - 1];
      if (parts.length > 1 && last[1] - last[0] + 1 < perHari) { parts.pop(); parts[parts.length - 1][1] = jml; }
      parts.forEach(([a, z]) => chunks.push(teks([[b, a, z]])));
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
    const PIN_PENDETA = 'pendeta-demo';
    const NAMA_KELOMPOK = 'TEKUN BACA FIRMAN';
    const NAMES = ['Agustina', 'Ahong', 'Andang', 'Andre', 'Andy', 'Arini', 'Bryan', 'Clara', 'Dedi', 'Dedi SS',
      'Dewi H', 'Dharmawan', 'Dimas', 'Eben', 'Elfrida', 'Enjel', 'Erin', 'Erwis', 'Fandi', 'Fenny', 'Fian', 'Geta'];
    const LAG = { Andang: 3, Andre: 3, Elfrida: 3, Bryan: 2, Dedi: 2, Enjel: 2, Fandi: 2, Dimas: 6, Erin: 1, Geta: 1, Fian: 1, Ahong: 1 };
    const SCHEDULE = generateSchedule('2026-10-26', 2, [0], 'Kejadian', true);
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

    /* --- renungan (demo) --- */
    const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    function contohRenungan(s) {
      const d = parseYmd(s.tanggal);
      const tgl = `${NAMA_HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BLN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
      const pasal = [];
      s.bacaan.split(/\s*&\s*/).forEach(seg => {
        const m = seg.match(/^(.*\S)\s+(\d+)(?:-(\d+))?$/);
        if (m) for (let c = +m[2]; c <= +(m[3] || m[2]); c++) pasal.push(m[1] + ' ' + c);
      });
      return `*${tgl}*\n*Guidelines: ${s.bacaan.replace(/-/g, '–')}*\n\n\n` + pasal.map(p =>
        `*${p}*\nIni contoh renungan untuk *mode demo*. Di aplikasi asli, bagian ini berisi renungan dari pendeta untuk _${p}_.\n\n` +
        `%Contoh poin pertama dari ${p}%\n%Contoh poin kedua%\n\n` +
        `Renungan:\n1. Apa yang Tuhan ajarkan melalui pasal ini?\n2. Bagaimana kita menerapkannya hari ini?`).join('\n\n\n---\n\n') +
        `\n\n$Firman-Mu itu pelita bagi kakiku dan terang bagi jalanku. (Mzm 119:105)$\n\n&Baca ulang satu ayat yang paling menegur hari ini&` +
        `\n\n\n*Pokok Doa:*\n1. Berdoa agar kita tekun membaca Firman setiap hari.\n\n\nSelamat menikmati FirmanNya 🙏`;
    }
    const ver = () => Math.floor(Date.now() / 60000).toString(36);
    function rnStore() {
      const st = load();
      if (!st.rn) {
        const c = curDay(todayStr()); st.rn = {};
        [c, c - 1, c - 2, c - 4, c + 1].forEach(h => {
          const s = SCHEDULE[h - 1]; if (!s) return;
          const real = window.TBF_DEMO_RN && window.TBF_DEMO_RN[s.bacaan];
          st.rn[h] = { teks: real || contohRenungan(s), v: ver(), oleh: 'Pendeta', t: new Date().toISOString() };
        });
        save();
      }
      return st.rn;
    }
    const rnRec = h => { const r = rnStore()[h]; return r ? { hari: +h, teks: r.teks, v: r.v } : null; };
    const rnPub = c => Object.keys(rnStore()).map(Number).filter(h => h <= c).sort((a, b) => a - b).map(h => [h, rnStore()[h].v]);
    const rnMeta = () => Object.keys(rnStore()).map(Number).sort((a, b) => a - b)
      .map(h => ({ hari: h, v: rnStore()[h].v, oleh: rnStore()[h].oleh, t: rnStore()[h].t }));
    function role(pin) {
      const p = String(pin || '').trim();
      if (p === PIN) return 'admin';
      if (p === PIN_PENDETA) return 'pendeta';
      throw new Error('PIN_ADMIN_SALAH');
    }
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
            rnIdx: rnPub(c), renungan: rnStore()[c] ? rnRec(c) : null,
          });
        }
        if (p.action === 'renungan') {
          if (!byKode(p.k)) throw new Error('LINK_TIDAK_VALID');
          const items = {};
          String(p.hari || '').split(',').map(Number).filter(h => h >= 1 && h <= c).slice(0, 3)
            .forEach(h => { items[h] = rnRec(h); });
          return clone({ ok: true, items });
        }
        if (p.action === 'admin') throw new Error('PERBARUI_WEB');
        throw new Error('Aksi tidak dikenal');
      },
      adminData() {
        const today = todayStr(); const c = curDay(today);
        {
          const dm = doneMap(); const out = {
            ok: true, settings: settings(), members: NAMES.map(n => ({ nama: n, kode: load().kode[n] })),
            schedule: SCHEDULE, today, currentDay: c, progress: {}, terakhir: {},
            role: 'admin', rnMeta: rnMeta(),
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
        if (b.action === 'admin') {
          if (role(b.pin) === 'pendeta') {
            const c = curDay(todayStr());
            return clone({ ok: true, role: 'pendeta', settings: settings(), schedule: SCHEDULE,
              today: todayStr(), currentDay: c, rnMeta: rnMeta() });
          }
          return this.adminData();
        }
        if (b.action === 'rnGet') { role(b.pin); return clone({ ok: true, item: rnRec(b.hari) }); }
        if (b.action === 'rnSave') {
          const who = role(b.pin); const h = +b.hari; const c = curDay(todayStr());
          if (!SCHEDULE[h - 1]) throw new Error('Hari bacaan tidak ditemukan di jadwal');
          const teks = String(b.teks || '').replace(/\r\n?/g, '\n').trim();
          if (!teks) throw new Error('Teks renungan kosong');
          rnStore()[h] = { teks, v: ver() + Math.random().toString(36).slice(2, 4), oleh: who === 'admin' ? 'Admin' : 'Pendeta', t: new Date().toISOString() };
          save();
          return clone({ ok: true, item: rnRec(h), rnMeta: rnMeta() });
        }
        if (b.action === 'rnDelete') { role(b.pin); delete rnStore()[+b.hari]; save(); return clone({ ok: true, rnMeta: rnMeta() }); }
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
    IS_DEMO, store, esc, getToken, dayName, expandSch, personalLink, todayStr, fmtTanggal, fmtShort, relTime,
    indexSchedule, firstUnread, countUnread, countDone, pasalDone, buildRecap,
    waUrl, waTarget, apiGet, apiPost, cacheGet, cacheSet, cacheDel, syncing, toast, openModal, copyText, haptic, demoBanner,
    EMOJI_SUDAH, EMOJI_BELUM, demo: Demo,
    rn: { format: rnFormat, toWa: rnToWa, preview: rnPreview, parseDate: rnParseDate, parseGuide: rnParseGuide, norm: rnNorm },
  };
})();
