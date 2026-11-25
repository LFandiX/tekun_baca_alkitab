/* Tekun Baca Firman — halaman admin */
(function () {
  'use strict';
  const T = window.TBF;
  const $app = document.getElementById('app');
  const $day = document.getElementById('daybar');
  const $nav = document.getElementById('bottomnav');
  const $tools = document.getElementById('admin-tools');
  const PIN_KEY = 'tbf_admin_pin';
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* abaikan */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* abaikan */ } },
  };

  const ICON = {
    hari: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="m8.5 12.2 2.5 2.5 4.6-5"/></svg>',
    progres: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
    renungan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5C10.4 5 8.2 4.3 4 4.3v14c4.2 0 6.4.7 8 2.2 1.6-1.5 3.8-2.2 8-2.2v-14c-4.2 0-6.4.7-8 2.2zM12 6.5v14"/></svg>',
    atur: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/></svg>',
    cari: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/></svg>',
  };
  const VIEWS_ADMIN = [['hari', 'Hari ini'], ['progres', 'Progres'], ['renungan', 'Renungan'], ['atur', 'Pengaturan']];
  const VIEWS_PENDETA = [['renungan', 'Renungan']];
  let VIEWS = VIEWS_ADMIN;
  let ROLE = 'admin';
  const EMO_KEYS = [['emojiJudul', 'Emoji judul', T.EMOJI_SUDAH], ['emojiSudah', 'Emoji sudah', T.EMOJI_SUDAH], ['emojiBelum', 'Emoji belum / tertinggal', T.EMOJI_BELUM]];

  // jumlah pasal tiap kitab (Kejadian … Wahyu), untuk pita perjalanan Alkitab
  const KITAB_N = ['Kejadian', 'Keluaran', 'Imamat', 'Bilangan', 'Ulangan', 'Yosua', 'Hakim-hakim', 'Rut', '1 Samuel', '2 Samuel', '1 Raja-raja', '2 Raja-raja',
    '1 Tawarikh', '2 Tawarikh', 'Ezra', 'Nehemia', 'Ester', 'Ayub', 'Mazmur', 'Amsal', 'Pengkhotbah', 'Kidung Agung', 'Yesaya', 'Yeremia', 'Ratapan',
    'Yehezkiel', 'Daniel', 'Hosea', 'Yoel', 'Amos', 'Obaja', 'Yunus', 'Mikha', 'Nahum', 'Habakuk', 'Zefanya', 'Hagai', 'Zakharia', 'Maleakhi',
    'Matius', 'Markus', 'Lukas', 'Yohanes', 'Kisah Para Rasul', 'Roma', '1 Korintus', '2 Korintus', 'Galatia', 'Efesus', 'Filipi', 'Kolose',
    '1 Tesalonika', '2 Tesalonika', '1 Timotius', '2 Timotius', 'Titus', 'Filemon', 'Ibrani', 'Yakobus', '1 Petrus', '2 Petrus', '1 Yohanes',
    '2 Yohanes', '3 Yohanes', 'Yudas', 'Wahyu'];
  const KITAB_C = [50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4,
    28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22];
  const KITAB_AWAL = KITAB_C.reduce((a, c, i) => { a.push(i ? a[i - 1] + KITAB_C[i - 1] : 0); return a; }, []);
  const TOTAL_PASAL = KITAB_C.reduce((a, c) => a + c, 0);

  let D = null, BY = {}, P = {}, PIN = null, SEL = 0, CUM = {};
  const OLD_VIEW = T.store.get('tbf_admin_view');
  let VIEW = OLD_VIEW === 'rekap' || OLD_VIEW === 'checklist' ? 'hari' : (OLD_VIEW || 'hari');
  let FILTER = 'semua', CQ = '', PQ = '', SORT = 'tertinggal', PMODE = 'daftar';
  let PENDING = new Set(), EMO = null, MODAL = null, MODAL_NAMA = null, MODAL_ALL = false, SHEET = null;
  let CONFIRM = null, confirmTimer = null, SAVING_EMO = false, RECAP_EDIT = null;
  let RN_FORCE = {};                          // "tetap simpan di hari ini" walau tanggal di teks berbeda
  let RSEL = 0, RN_TEXT = {}, RN_DRAFT = {}, RN_LOADING = new Set(), RN_SAVING = 0, RN_PREVIEW = false, RN_DEL = false;
  if (!VIEWS.some(v => v[0] === VIEW)) VIEW = 'hari';
  const $side = document.getElementById('side');
  const $sideNav = document.getElementById('side-nav');
  const $rbar = document.getElementById('rbar');

  /* ============ muat data ============ */
  const DATA_KEY = 'tbf_admin_data';
  let store2 = null;
  try { store2 = sessionStorage; } catch (e) { /* diblokir */ }

  async function boot() {
    T.demoBanner('PIN admin: <b>1234</b> · PIN pendeta: <b>pendeta-demo</b>. <a class="demo-admin" href="index.html">← Halaman anggota</a>');
    PIN = ss.get(PIN_KEY);
    if (!PIN) return renderLogin();
    // tampilkan data terakhir (hanya selama tab ini terbuka), lalu perbarui di belakang
    const cached = store2 && T.cacheGet(DATA_KEY, store2);
    if (cached) { LAST_JSON = JSON.stringify(cached); apply(cached); }
    load();
  }

  function loginError(e) {
    const m = String(e.message || '');
    if (m === 'PIN_ADMIN_SALAH') return 'PIN salah.';
    if (m === 'PIN_LEMAH') return 'PIN di Google Sheet masih bawaan atau kurang dari 8 karakter. Ganti dulu di sheet Pengaturan (kolom Nilai, baris PIN Admin / PIN Renungan), lalu coba lagi.';
    if (m.indexOf('ADMIN_TERKUNCI') === 0) return `Terlalu banyak PIN salah. Login admin dikunci, coba lagi dalam ${m.split(':')[1] || 15} menit. (Pemilik Sheet bisa membuka kunci lewat menu 📖 Tekun Baca → Buka kunci login admin.)`;
    return null;
  }

  async function load(fresh) {
    if (!D) $app.innerHTML = '<div class="loading">Memuat data…</div>';
    T.syncing(true);
    let data;
    try {
      data = await T.apiPost({ action: 'admin', pin: PIN, fresh: !!fresh });
    } catch (e) {
      T.syncing(false);
      const msg = loginError(e);
      if (msg) { ss.del(PIN_KEY); if (store2) T.cacheDel(DATA_KEY, store2); PIN = null; D = null; return renderLogin(msg); }
      if (D) return T.toast('Belum bisa terhubung. Menampilkan data terakhir.', { ms: 4000 });
      $app.innerHTML = `<section class="card center-card"><div class="big-icon">⚠️</div><h2>Gagal memuat</h2>
        <p class="muted">${T.esc(e.message)}</p><button class="btn-primary btn-wide" data-act="reload">Coba lagi</button></section>`;
      return;
    }
    T.syncing(false);
    ss.set(PIN_KEY, PIN);
    markUpdated();
    if (PENDING.size || SAVING_EMO || RN_SAVING) return; // ada perubahan yang sedang disimpan → jangan timpa
    const json = JSON.stringify(data);
    if (D && json === LAST_JSON) { if (fresh) T.toast('Data sudah yang terbaru'); return; } // tidak ada yang berubah
    LAST_JSON = json;
    apply(data);
    if (fresh) T.toast('Data terbaru dimuat');
  }

  function saveCache() {
    if (!D || !store2) return;
    // (jadwal disimpan versi ringkas saja)
    const progress = {};
    (D.members || []).forEach(m => { progress[m.nama] = Array.from(P[m.nama] || []).sort((a, b) => a - b); });
    const snap = Object.assign({}, D, { progress }); if (snap.sch) delete snap.schedule;
    T.cacheSet(DATA_KEY, snap, store2);
  }

  let LAST_JSON = '';
  function markUpdated() {
    const el = document.getElementById('updated'); if (!el) return;
    const d = new Date();
    el.textContent = 'Diperbarui ' + String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0');
  }
  function apply(data) {
    const keepModal = MODAL_NAMA;
    const emoDirty = D && EMO && EMO_KEYS.some(([k]) => EMO[k] !== D.settings[k]);
    D = T.expandSch(data);
    BY = T.indexSchedule(D.schedule);
    P = {};
    (D.members || []).forEach(m => { P[m.nama] = new Set(D.progress[m.nama] || []); });
    ROLE = D.role === 'pendeta' ? 'pendeta' : 'admin';
    VIEWS = ROLE === 'pendeta' ? VIEWS_PENDETA : VIEWS_ADMIN;
    if (!VIEWS.some(v => v[0] === VIEW)) VIEW = VIEWS[0][0];
    if (!RSEL || !BY[RSEL]) RSEL = D.currentDay || 1;
    document.querySelector('.topbar .tag').textContent = ROLE === 'pendeta' ? 'Pendeta' : 'Admin';
    document.getElementById('side-role').textContent = ROLE === 'pendeta' ? 'Pendeta' : 'Admin';
    document.getElementById('side-name').textContent = D.settings.namaKelompok;
    hitungPita();
    if (!emoDirty) EMO = pickEmo(D.settings);
    document.getElementById('group-name').textContent = D.settings.namaKelompok;
    document.title = (ROLE === 'pendeta' ? 'Renungan · ' : 'Admin · ') + D.settings.namaKelompok;
    if (!SEL || SEL > D.currentDay) SEL = D.currentDay;
    $tools.hidden = false;
    renderAll();
    if (WKM && WK) wkRefresh();          // jendela rangkuman ikut memakai data terbaru
    if (MODAL && keepModal && P[keepModal]) MODAL.setHtml(personHtml(keepModal));
    if (store2) saveCache();
  }

  const pickEmo = s => ({ emojiJudul: s.emojiJudul, emojiSudah: s.emojiSudah, emojiBelum: s.emojiBelum });

  function renderLogin(err) {
    $tools.hidden = true; $day.hidden = true; $nav.hidden = true; $side.hidden = true; $rbar.hidden = true;
    document.body.classList.remove('has-nav', 'has-rbar');
    $app.innerHTML = `<section class="card login">
      <div class="big-icon">🔐</div><h2>Masuk admin / pendeta</h2>
      <form id="login"><input class="input pin-input" type="password" placeholder="PIN" autocomplete="current-password" autocapitalize="off" spellcheck="false" required aria-label="PIN">
        ${err ? `<p class="err">${T.esc(err)}</p>` : ''}
        <button class="btn-primary btn-big" type="submit">Masuk</button></form>
      <p class="muted small">Pakai <b>PIN Admin</b>, atau <b>PIN Renungan</b> untuk pendeta (hanya mengelola renungan). Keduanya diatur di sheet <b>Pengaturan</b>.</p></section>`;
    const f = document.getElementById('login');
    f.querySelector('input').focus();
    f.addEventListener('submit', e => { e.preventDefault(); PIN = f.querySelector('input').value.trim(); load(); });
  }

  /* ============ kerangka: menu samping (laptop) / bawah (HP) + kepala hari ============ */
  function renderAll() { renderNav(); renderDaybar(); renderView(); }

  function renderNav() {
    const btn = ([k, l]) => `<button class="side-link ${VIEW === k ? 'on' : ''}" data-view="${k}" title="${l}" aria-current="${VIEW === k ? 'page' : 'false'}">
        ${ICON[k]}<span class="side-label">${l}</span></button>`;
    $side.hidden = false;
    $sideNav.innerHTML = VIEWS.map(btn).join('');
    syncSideToggle();
    if (VIEWS.length < 2) { $nav.hidden = true; document.body.classList.remove('has-nav'); return; }
    $nav.hidden = false;
    document.body.classList.add('has-nav');
    $nav.innerHTML = `<div class="bottomnav-in">${VIEWS.map(([k, l]) => `
      <button class="nav-btn ${VIEW === k ? 'on' : ''}" data-view="${k}" aria-current="${VIEW === k ? 'page' : 'false'}">
        ${ICON[k]}<span>${l}</span></button>`).join('')}</div>`;
  }
  function syncSideToggle() {
    const mini = document.documentElement.classList.contains('side-mini');
    const b = document.querySelector('.side-toggle'); if (!b) return;
    b.setAttribute('aria-expanded', String(!mini));
    b.title = mini ? 'Lebarkan menu' : 'Ciutkan menu';
    b.querySelector('.side-label').textContent = mini ? 'Lebarkan menu' : 'Ciutkan menu';
  }

  /* --- pita perjalanan Alkitab --- */
  function hitungPita() {
    CUM = {};
    let start = 0;
    const f = D.schedule[0] && String(D.schedule[0].bacaan).match(/^(.*\S)\s+(\d+)/);
    if (f) { const i = KITAB_N.findIndex(n => n.toLowerCase() === f[1].toLowerCase()); if (i >= 0) start = KITAB_AWAL[i] + (+f[2] - 1); }
    let c = start;
    D.schedule.forEach(x => { CUM[x.hari] = c; c += x.pasal || 0; });
  }
  function pitaHtml(h) {
    const g = CUM[h] || 0; const pct = Math.min(100, (g / TOTAL_PASAL) * 100);
    const books = KITAB_C.map((n, i) => {
      const fill = Math.max(0, Math.min(1, (g - KITAB_AWAL[i]) / n)) * 100;
      return `<i class="${i >= 39 ? 'nt' : ''}" style="flex:${n} 1 0px">${fill ? `<b style="width:${fill.toFixed(1)}%"></b>` : ''}</i>`;
    }).join('');
    const last = D.schedule[D.schedule.length - 1];
    const pb = D.schedule.find(x => /(^|&\s*)Matius\s+1(?!\d)/.test(x.bacaan));
    const mid = pb ? (pb.hari <= h ? 'Sudah di Perjanjian Baru' : 'Perjanjian Baru mulai ' + fmtLong(pb.tanggal, true)) : '';
    const n = g.toLocaleString('id-ID');
    return `<div class="pita" role="img" aria-label="Posisi bacaan: ${n} dari ${TOTAL_PASAL.toLocaleString('id-ID')} pasal Alkitab">
        <div class="pita-books" aria-hidden="true">${books}</div>
        <span class="pita-mark" aria-hidden="true" style="left:${pct.toFixed(2)}%"></span>
        <div class="pita-cap" aria-hidden="true"><span><b>${n} dari ${TOTAL_PASAL.toLocaleString('id-ID')} pasal</b></span>
          ${mid ? `<span class="pc-mid">${mid}</span>` : ''}
          ${last ? `<span>Selesai ${fmtLong(last.tanggal, true)}</span>` : ''}</div>
      </div>`;
  }

  function renderDaybar() {
    const cur = D.currentDay;
    if (!cur || (VIEW !== 'hari' && VIEW !== 'progres')) { $day.hidden = true; return; }
    const r = BY[SEL];
    $day.hidden = false;
    $day.innerHTML = `<div class="wrap dh-in">
      <div class="dh-top">
        <button class="icon-btn" data-act="prev" ${SEL <= 1 ? 'disabled' : ''} aria-label="Bacaan sebelumnya">‹</button>
        <button class="icon-btn dh-next-desk" data-act="next" ${SEL >= cur ? 'disabled' : ''} aria-label="Bacaan berikutnya">›</button>
        <div class="dh-date"><span>${fmtLong(r.tanggal)}, hari ke-${SEL}</span>
          ${SEL !== cur ? '<button class="mini-pill" data-act="latest">Ke hari ini ›</button>' : ''}</div>
        <button class="icon-btn dh-next-mob" data-act="next" ${SEL >= cur ? 'disabled' : ''} aria-label="Bacaan berikutnya">›</button>
      </div>
      <h1 class="dh-title">${T.esc(r.bacaan).replace(/(\d)-(\d)/g, '$1–$2')}</h1>
      ${pitaHtml(SEL)}
    </div>`;
  }

  function renderView() {
    closeSheet();
    if (!D.currentDay && VIEW !== 'atur' && VIEW !== 'renungan') {
      const f = D.schedule[0];
      $app.innerHTML = `<section class="card center-card"><div class="big-icon">📅</div><h2>Pembacaan belum dimulai</h2>
        <p class="muted">${f ? 'Mulai ' + T.fmtTanggal(f.tanggal) + ': ' + T.esc(f.bacaan) : 'Jadwal kosong. Jalankan setupAwal di Apps Script.'}</p></section>`;
      renderRbar();
      return;
    }
    if (VIEW === 'hari') { $app.innerHTML = viewHari(); renderCFilter(); renderCList(); renderRecap(); }
    else if (VIEW === 'progres') { $app.innerHTML = viewProgres(); renderPBody(); }
    else if (VIEW === 'renungan') { $app.innerHTML = viewRenungan(); bindRenungan(); }
    else { $app.innerHTML = viewAtur(); syncEmoUI(); }
    renderRbar();
  }

  /** setelah data berubah: gambar ulang bagian yang terlihat saja (input pencarian tetap fokus) */
  function refresh() {
    if (VIEW === 'hari') { renderCFilter(); renderCList(); renderRecap(); }
    else if (VIEW === 'progres') renderPBody();
    renderRbar();
    if (MODAL) MODAL.setHtml(personHtml(MODAL_NAMA));
  }

  function computeRows(upTo) {
    return D.members.map(m => {
      const set = P[m.nama];
      const selesai = T.countDone(set, upTo);
      return {
        nama: m.nama, belum: T.firstUnread(set, upTo), tertinggal: T.countUnread(set, upTo),
        selesai, pct: upTo ? Math.round((selesai / upTo) * 100) : 0, terakhir: D.terakhir[m.nama] || null,
      };
    });
  }

  /* ============ 1. HARI INI: checklist + rekap ============ */
  function weekDays() { const out = []; for (let d = SEL - 6; d <= SEL; d++) out.push(d); return out; }
  function viewHari() {
    const wk = weekDays().map(d => `<span>${BY[d] ? +BY[d].tanggal.slice(8) : ''}</span>`).join('');
    return `<div class="hari-grid">
      <section class="card roster" aria-labelledby="h-anggota">
        <div class="roster-head">
          <h2 id="h-anggota">Anggota</h2>
          <div class="seg" id="cfilter" role="group" aria-label="Saring"></div>
          <label class="roster-search">${ICON.cari}<input class="input" id="cq" type="search" placeholder="Cari nama" value="${T.esc(CQ)}" autocomplete="off" aria-label="Cari nama"></label>
        </div>
        <div class="rhead" aria-hidden="true"><span>Nama</span><span class="wk-h">${wk}</span><span>Belum dibaca</span><span class="r-today">Hari ini</span></div>
        <div id="clist"></div>
      </section>
      <aside class="recap-side" aria-label="Rekap">
        <section class="card" data-rbox>
          <div class="rbox-head"><h2>Rekap untuk grup</h2><button class="link-btn" data-view="atur">Ubah emoji</button></div>
          <div class="bubble-wrap"><textarea class="bubble" id="recap" aria-label="Teks rekap WhatsApp"></textarea></div>
          <div class="rbox-btns">
            <button class="btn-secondary" data-act="copy-recap">Salin teks</button>
            <a class="btn-primary" data-wa href="#" target="${T.waTarget}" rel="noopener">Kirim ke WhatsApp</a>
          </div>
          <p class="rbox-note" id="recap-note"></p>
        </section>
        <section class="card lag" id="lag"></section>
      </aside>
    </div>`;
  }
  function renderCFilter() {
    const el = document.getElementById('cfilter'); if (!el) return;
    const sudah = D.members.filter(m => P[m.nama].has(SEL)).length;
    const opts = [['semua', 'Semua', D.members.length], ['belum', 'Belum', D.members.length - sudah], ['sudah', 'Sudah', sudah]];
    el.innerHTML = opts.map(([k, l, n]) => `<button class="seg-btn ${FILTER === k ? 'on' : ''}" data-filter="${k}" aria-pressed="${FILTER === k}">${l} <b>${n}</b></button>`).join('');
  }
  function renderCList() {
    const el = document.getElementById('clist'); if (!el) return;
    const q = CQ.trim().toLowerCase();
    const days = weekDays();
    const list = D.members.filter(m => {
      const on = P[m.nama].has(SEL);
      return (!q || m.nama.toLowerCase().includes(q)) && (FILTER === 'semua' || (FILTER === 'sudah') === on);
    });
    el.innerHTML = list.map(m => {
      const set = P[m.nama]; const on = set.has(SEL); const fu = T.firstUnread(set, SEL); const n = T.countUnread(set, SEL);
      const sub = !fu ? 'Lengkap' : on ? `Hari ini sudah, masih tertinggal ${n}`
        : n === 1 ? 'Belum lapor hari ini' : `Tertinggal ${n} bacaan`;
      const subCls = !fu ? '' : n >= 3 ? 'danger' : n >= 2 ? 'warn' : '';
      const nRead = days.filter(d => d >= 1 && set.has(d)).length, nDays = days.filter(d => d >= 1).length;
      const dots = days.map(d => d < 1 ? '<i class="na"></i>' : `<i class="${set.has(d) ? 'on' : ''}"></i>`).join('');
      const badge = fu ? `<span class="badge ${n >= 3 ? 'danger' : 'warn'}">${T.esc(BY[fu].singkat)}</span>` : '<span class="badge ok">Lengkap</span>';
      const busy = PENDING.has(m.nama + '|' + SEL);
      return `<div class="rrow ${on ? 'on' : ''}">
        <button class="rr-main" data-person="${T.esc(m.nama)}"><span class="rr-name">${T.esc(m.nama)}</span>
          <span class="rr-sub ${subCls}">${sub}</span></button>
        <span class="wk" role="img" aria-label="7 bacaan terakhir: ${nRead} dari ${nDays} sudah">${dots}</span>
        <span class="rr-badge">${badge}</span>
        <button class="tick-btn ${on ? 'on' : ''} ${busy ? 'busy' : ''}" data-tick="${T.esc(m.nama)}" aria-pressed="${on}"
          aria-label="${T.esc(m.nama)}: ${on ? 'sudah' : 'tandai sudah'} baca ${T.esc(BY[SEL].bacaan)}">✓</button></div>`;
    }).join('') || '<p class="roster-empty">Tidak ada nama di daftar ini.</p>';
  }

  /* --- rekap WA (laptop: kolom kanan; HP: bilah bawah + lembar) --- */
  const autoRecap = () => T.buildRecap(BY[SEL], D.members, n => P[n], D.settings, BY);
  const recapText = () => (RECAP_EDIT && RECAP_EDIT.hari === SEL ? RECAP_EDIT.text : autoRecap());
  function renderRecap() {
    const ta = document.getElementById('recap');
    if (ta && document.activeElement !== ta) ta.value = recapText();
    syncWaLinks();
    const note = document.getElementById('recap-note');
    if (note) note.innerHTML = RECAP_EDIT && RECAP_EDIT.hari === SEL
      ? 'Teks sudah Anda ubah, jadi tidak ikut berubah saat mencentang. <button class="link-btn" data-act="recap-reset">Pakai teks otomatis</button>'
      : 'Teks ikut berubah saat Anda mencentang anggota.';
    const lag = document.getElementById('lag');
    if (lag) {
      const rows = computeRows(SEL).filter(r => r.tertinggal >= 3).sort((a, b) => b.tertinggal - a.tertinggal || a.nama.localeCompare(b.nama, 'id'));
      lag.innerHTML = `<h3>Perlu diingatkan</h3><p>Tertinggal 3 bacaan atau lebih</p>${rows.length
        ? rows.map(r => `<button class="lag-row" data-person="${T.esc(r.nama)}"><b>${T.esc(r.nama)}</b><span>${r.tertinggal} bacaan</span></button>`).join('')
        : '<p class="nomb">Tidak ada. Semua masih dekat dengan jadwal.</p>'}`;
    }
  }
  function syncWaLinks() {
    document.querySelectorAll('[data-rbox]').forEach(box => {
      const ta = box.querySelector('textarea'); const a = box.querySelector('[data-wa]');
      if (ta && a) a.href = T.waUrl(ta.value);
    });
  }
  function renderRbar() {
    const show = !!D && VIEW === 'hari' && !!D.currentDay && ROLE === 'admin';
    $rbar.hidden = !show;
    document.body.classList.toggle('has-rbar', show);
    if (!show) return;
    const sudah = D.members.filter(m => P[m.nama].has(SEL)).length;
    $rbar.innerHTML = `<div class="wrap rbar-in">
      <div class="rbar-txt"><b>${sudah} dari ${D.members.length} sudah</b><span>Rekap ${T.esc(BY[SEL].singkat)} siap dikirim</span></div>
      <button class="btn-light" data-act="recap-sheet">Kirim rekap</button></div>`;
  }
  function sheetHtml() {
    const s = D.settings;
    return `<div class="sheet-recap" data-rbox>
      <header class="modal-head"><div><h2>Rekap untuk grup</h2>
        <p class="muted small nomb">${D.members.filter(m => P[m.nama].has(SEL)).length} sudah, ${D.members.filter(m => !P[m.nama].has(SEL)).length} belum</p></div>
        <button class="icon-btn" data-close aria-label="Tutup">×</button></header>
      <div class="bubble-wrap"><textarea class="bubble" id="recap-s" aria-label="Teks rekap WhatsApp">${T.esc(recapText())}</textarea></div>
      <div class="emo-line"><span>Emoji: ${T.esc(s.emojiSudah)} sudah, ${T.esc(s.emojiBelum)} belum</span>
        <button class="link-btn" data-view="atur">Ubah</button></div>
      <div class="rbox-btns">
        <button class="btn-secondary" data-act="copy-recap">Salin teks</button>
        <a class="btn-primary" data-wa href="#" target="${T.waTarget}" rel="noopener">Kirim ke WhatsApp</a>
      </div></div>`;
  }
  function openSheet() { SHEET = T.openModal(sheetHtml(), { onClose: () => { SHEET = null; } }); syncWaLinks(); }
  function closeSheet() { if (SHEET) { const s = SHEET; SHEET = null; s.close(); } }

  /* ============ 2. PROGRES ============ */
  function viewProgres() {
    return `<section class="card">
      <div class="seg" role="tablist">
        <button class="seg-btn ${PMODE === 'daftar' ? 'on' : ''}" data-pmode="daftar">Per orang</button>
        <button class="seg-btn ${PMODE === 'matriks' ? 'on' : ''}" data-pmode="matriks">Matriks 14 hari</button></div>
      ${PMODE === 'daftar' ? `<div class="list-tools">
          <input class="input" id="pq" type="search" placeholder="Cari nama…" value="${T.esc(PQ)}" autocomplete="off" aria-label="Cari nama">
          <select class="input" id="psort" aria-label="Urutkan">
            <option value="tertinggal" ${SORT === 'tertinggal' ? 'selected' : ''}>Paling tertinggal</option>
            <option value="nama" ${SORT === 'nama' ? 'selected' : ''}>Nama A–Z</option>
            <option value="lapor" ${SORT === 'lapor' ? 'selected' : ''}>Lama tak lapor</option></select></div>` : ''}
      <div id="pbody"></div></section>`;
  }
  function renderPBody() {
    const el = document.getElementById('pbody'); if (!el) return;
    if (PMODE === 'matriks') { el.innerHTML = matrixHtml(); return; }
    let rows = computeRows(SEL);
    const q = PQ.trim().toLowerCase();
    if (q) rows = rows.filter(r => r.nama.toLowerCase().includes(q));
    const ts = r => (r.terakhir ? Date.parse(r.terakhir) : 0);
    rows.sort(SORT === 'nama' ? (a, b) => a.nama.localeCompare(b.nama, 'id')
      : SORT === 'lapor' ? (a, b) => ts(a) - ts(b)
        : (a, b) => b.tertinggal - a.tertinggal || a.nama.localeCompare(b.nama, 'id'));
    el.innerHTML = `<div class="plist">${rows.map(r => `
      <button class="person" data-person="${T.esc(r.nama)}">
        <span class="p-main"><span class="p-name">${T.esc(r.nama)}</span>
          <span class="p-sub">${r.tertinggal ? `Tertinggal ${r.tertinggal} · ` : ''}lapor ${T.relTime(r.terakhir)}</span></span>
        <span class="p-right">
          <span class="badge ${r.belum ? (r.tertinggal > 3 ? 'danger' : 'warn') : 'ok'}">${r.belum ? T.esc(BY[r.belum].singkat) : 'Lengkap'}</span>
          <span class="mini-bar"><span style="width:${r.pct}%"></span></span></span>
      </button>`).join('') || '<p class="muted center">Tidak ada nama yang cocok.</p>'}</div>`;
  }
  /** judul kolom tabel: "kej 45-46" → "45-46", "im 27 & bil 1" → "im 27+bil 1" */
  const colLabel = sg => /&/.test(sg) ? sg.replace(/\s*&\s*/g, '+') : sg.split(' ').slice(1).join(' ');
  function matrixHtml() {
    const from = Math.max(1, SEL - 13); const days = [];
    for (let d = SEL; d >= from; d--) days.push(d); // terbaru di kiri: langsung terlihat di HP
    const head = days.map(d => `<th class="${d === SEL ? 'sel' : ''}"><span>${T.fmtShort(BY[d].tanggal)}</span><small>${T.esc(colLabel(BY[d].singkat))}</small></th>`).join('');
    const body = D.members.map(m => `<tr><th class="m-name"><button data-person="${T.esc(m.nama)}">${T.esc(m.nama)}</button></th>${
      days.map(d => {
        const on = P[m.nama].has(d); const busy = PENDING.has(m.nama + '|' + d);
        return `<td><button class="cell ${on ? 'on' : ''} ${busy ? 'busy' : ''}" data-cell="${T.esc(m.nama)}|${d}" aria-pressed="${on}" aria-label="${T.esc(m.nama)} ${T.esc(BY[d].singkat)}">${on ? '✓' : ''}</button></td>`;
      }).join('')}</tr>`).join('');
    const tot = days.map(d => `<td class="tot">${D.members.filter(m => P[m.nama].has(d)).length}</td>`).join('');
    return `<p class="muted small">Terbaru di kiri. Ketuk kotak untuk menandai sudah / belum.</p>
      <div class="matrix-wrap"><table class="matrix"><thead><tr><th class="m-name"></th>${head}</tr></thead>
      <tbody>${body}</tbody><tfoot><tr><th class="m-name">Jumlah</th>${tot}</tr></tfoot></table></div>`;
  }

  /* ============ RENUNGAN (admin & pendeta) ============ */
  function rnMetaMap() { const m = {}; (D.rnMeta || []).forEach(x => { m[x.hari] = x; }); return m; }
  function rnMaxDay() { return D.schedule.length ? D.schedule[D.schedule.length - 1].hari : 1; }
  function rnValue(h) { return h in RN_DRAFT ? RN_DRAFT[h] : (RN_TEXT[h] || ''); }
  function rnDirty(h) { return h in RN_DRAFT && RN_DRAFT[h] !== (RN_TEXT[h] || ''); }

  function viewRenungan() {
    const cur = D.currentDay || 1; const s = BY[RSEL]; const mm = rnMetaMap(); const meta = mm[RSEL];
    const loading = RN_LOADING.has(RSEL);
    const when = RSEL === cur ? 'hari ini' : RSEL === cur + 1 ? 'besok' : RSEL < cur ? 'sudah lewat' : 'akan datang';
    const st = h => (rnDirty(h) ? 'draft' : mm[h] ? 'ok' : '');
    const bac = x => T.esc(x.bacaan).replace(/(\d)-(\d)/g, '$1–$2');
    // laptop: daftar hari di kiri
    const lf = Math.max(1, Math.min(RSEL - 4, rnMaxDay() - 13)), lt = Math.min(rnMaxDay(), lf + 13);
    let list = '';
    for (let h = lf; h <= lt; h++) {
      const x = BY[h]; if (!x) continue;
      const note = h === cur ? 'Hari ini' : rnDirty(h) ? 'Draf belum disimpan' : mm[h] ? 'Sudah ada' : 'Belum ada';
      list += `<button class="rn-day ${h === RSEL ? 'sel' : ''}" data-rsel="${h}" aria-current="${h === RSEL}">
        <span class="rn-day-d">${T.fmtTanggal(x.tanggal, { short: true }).split(',')[0]}<b>${T.fmtTanggal(x.tanggal, { short: true }).split(', ')[1]}</b></span>
        <span><span class="rn-day-r">${bac(x)}</span><span class="rn-day-n ${h === cur ? 'is-today' : ''}">${note}</span></span>
        <span class="st-dot ${st(h)}" aria-hidden="true"></span></button>`;
    }
    // HP: deretan tanggal
    const cf = Math.max(1, RSEL - 7), ct = Math.min(rnMaxDay(), RSEL + 14);
    let chips = '';
    for (let h = cf; h <= ct; h++) {
      const x = BY[h]; if (!x) continue;
      const p = x.tanggal.split('-');
      chips += `<button class="rn-chip-d ${h === RSEL ? 'sel' : ''} ${h === cur ? 'is-today' : ''}" data-rsel="${h}" aria-pressed="${h === RSEL}"
        aria-label="${T.fmtTanggal(x.tanggal)}, ${T.esc(x.bacaan)}, ${mm[h] ? 'renungan sudah ada' : 'belum ada renungan'}">
        <small>${h === cur ? 'Hari ini' : x.namaHari.slice(0, 3)}</small><b>${+p[2]}</b><span class="st-dot ${st(h)}"></span></button>`;
    }
    return `
      <div class="rn-top">
        <div><h1>Renungan</h1><p>${(D.rnMeta || []).length} dari ${D.schedule.length} hari sudah ada renungannya</p></div>
        <div class="rn-top-tools">
          <label class="rn-jump-date"><span>Lompat ke</span>
            <input type="date" id="rn-date" value="${s.tanggal}" min="${D.schedule[0].tanggal}" max="${D.schedule[D.schedule.length - 1].tanggal}"></label>
          <button class="chip-btn" data-act="rn-nextempty">Hari kosong berikutnya ›</button>
          <button class="chip-btn" data-act="wk-open"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6"/></svg>Rangkuman mingguan</button>
        </div>
      </div>
      <div class="rn-chips" id="rn-chips" role="group" aria-label="Pilih hari">${chips}</div>
      <div class="rn-grid">
        <section class="card rn-list-card" aria-label="Daftar hari">${list}
          ${RSEL !== cur ? '<button class="link-btn rn-list-more" data-act="rn-today">Kembali ke hari ini</button>' : ''}</section>
        <section class="card rn-editor">
          <div class="rn-ed-head">
            <div>
              <div class="rn-ed-date">${fmtLong(s.tanggal)}, ${when}</div>
              <h2 class="rn-ed-title">${bac(s)}</h2>
            </div>
            <div class="rn-ed-nav">
              <button class="icon-btn" data-act="rn-prevday" ${RSEL <= 1 ? 'disabled' : ''} aria-label="Hari sebelumnya">‹</button>
              <button class="icon-btn" data-act="rn-nextday" ${RSEL >= rnMaxDay() ? 'disabled' : ''} aria-label="Hari berikutnya">›</button>
            </div>
          </div>
          <div class="rn-hint" id="rn-hint" hidden></div>
          <div class="rn-label-row"><label for="rn-text">${meta ? 'Teks renungan' : 'Tempel teks dari WhatsApp'}</label><span class="muted small" id="rn-count"></span></div>
          <div class="rn-tools" role="toolbar" aria-label="Sisipkan desain">
            ${RN_FMT.map(([k, l, g]) => `<button type="button" class="rn-tool" data-fmt="${k}" title="${l}"><span class="rn-tool-g" aria-hidden="true">${g}</span>${l}</button>`).join('')}
            <button type="button" class="rn-tool rn-tool-help" data-act="rn-guide">Panduan</button>
          </div>
          <textarea class="recap-text rn-input" id="rn-text" placeholder="${loading ? 'Memuat renungan…' : 'Tempel renungan dari WhatsApp di sini. Guidelines dan tanggal di awal teks dikenali otomatis.'}" ${loading ? 'disabled' : ''}></textarea>
          <p class="muted small rn-status" id="rn-status">${meta ? `Tersimpan ${T.relTime(meta.t)} oleh ${T.esc(meta.oleh || '-')}.` : 'Belum ada renungan untuk tanggal ini.'}
            ${RSEL > cur ? ` Tampil ke anggota pada ${T.fmtTanggal(s.tanggal, { short: true })}.` : ''}</p>
          <button class="link-btn rn-copywa" data-act="rn-copywa">Salin versi WhatsApp</button>
          ${meta ? `<button class="link-btn danger ${RN_DEL ? 'confirm' : ''}" data-act="rn-del">${RN_DEL ? 'Yakin hapus? Ketuk lagi' : 'Hapus renungan ini'}</button>` : ''}
          <div class="rn-actions">
            <button class="btn-secondary rn-prevbtn" data-act="rn-preview" aria-pressed="${RN_PREVIEW}">${RN_PREVIEW ? 'Tutup pratinjau' : 'Pratinjau'}</button>
            <button class="btn-primary" data-act="rn-save" id="rn-save">Simpan</button>
          </div>
        </section>
        <aside class="rn-prev-wrap ${RN_PREVIEW ? 'show' : ''}" id="rn-prev-card" aria-label="Pratinjau seperti yang dilihat anggota">
          <p class="rn-prev-cap">Yang dilihat anggota</p>
          <div class="phone"><div class="phone-head"><small>${fmtLong(s.tanggal)}</small><b>${bac(s)}</b></div>
            <div class="phone-body"><article class="rn rn-preview" id="rn-prev"></article></div></div>
        </aside>
      </div>`;
  }

  /* --- desain renungan: tombol sisip + panduan --- */
  const RN_FMT = [
    ['judul', 'Judul pasal', '*A*'], ['poin', 'Poin', '%A%'], ['ayat', 'Ayat kunci', '$A$'], ['kutip', 'Kutipan', '&gt; A'],
    ['penting', 'Penting', '!A!'], ['aksi', 'Lakukan', '&amp;A&amp;'], ['garis', 'Pemisah', '---'],
  ];
  const RN_SISIP = {
    judul: ['*', '*', 'Kejadian 1'], poin: ['%', '%', 'Tulis poin di sini'], ayat: ['$', '$', 'Tulis ayat di sini (Kej 1:1)'],
    kutip: ['> ', '', 'Tulis kutipan ayat'], penting: ['!', '!', 'Tulis hal yang penting'], aksi: ['&', '&', 'Tulis langkah untuk hari ini'],
    garis: ['---', '', ''],
  };
  function rnInsert(k) {
    const ta = document.getElementById('rn-text'); if (!ta || ta.disabled) return;
    const [a, z, ph] = RN_SISIP[k];
    const v = ta.value; const s0 = ta.selectionStart, s1 = ta.selectionEnd; const sel = v.slice(s0, s1);
    const ins = k === 'garis' ? '---' : sel.trim()
      ? sel.split('\n').map(l => (l.trim() ? a + l.trim().replace(/^[%$!&>*]\s?|[%$!&*]$/g, '') + z : l)).join('\n') : a + ph + z;
    const pre = s0 > 0 && v[s0 - 1] !== '\n' ? '\n' : '';
    const post = s1 < v.length && v[s1] !== '\n' ? '\n' : '';
    ta.focus(); ta.setSelectionRange(s0, s1);
    const text = pre + ins + post;
    let ok = false; try { ok = document.execCommand('insertText', false, text); } catch (e) { /* lama */ }
    if (!ok || ta.value.indexOf(ins) < 0) ta.setRangeText(text, s0, s1, 'end');
    if (!sel.trim() && ph) { const st = s0 + pre.length + a.length; ta.setSelectionRange(st, st + ph.length); }
    RN_DRAFT[RSEL] = ta.value; syncRn();
  }
  const RN_CONTOH = [
    ['*Kejadian 1*', 'Judul pasal. Satu baris pendek diapit bintang.'],
    ['%Allah berfirman dan semuanya jadi%\n%Manusia diciptakan menurut gambar Allah%', 'Poin bernomor. Nomornya otomatis, mulai dari 1 lagi setiap judul pasal.'],
    ['$Pada mulanya Allah menciptakan langit dan bumi. (Kej 1:1)$', 'Ayat kunci. Alamat ayat di dalam kurung ditulis di bawahnya.'],
    ['> Jadilah terang. Lalu terang itu jadi.\n> — Kejadian 1:3', 'Kutipan ayat. Baris yang diawali tanda — menjadi sumbernya.'],
    ['!Jangan lewatkan doa pagi hari ini!', 'Kotak penting.'],
    ['&Baca Mazmur 8 sebelum tidur&\n&Ucapkan syukur untuk satu hal kecil&', 'Daftar "Lakukan hari ini". Anggota bisa mencentangnya.'],
    ['---', 'Pemisah antarbagian.'],
  ];
  function rnGuideHtml() {
    return `<header class="modal-head"><div><h2>Desain renungan</h2>
        <p class="muted small nomb">Tulis simbol di awal dan akhir baris. Simbol di tengah kalimat tidak berpengaruh.</p></div>
        <button class="icon-btn" data-close aria-label="Tutup">×</button></header>
      <div class="rn-guide">${RN_CONTOH.map(([src, note]) => `<div class="rn-g-row">
          <div><p class="rn-g-note">${T.esc(note)}</p><pre class="rn-g-src">${T.esc(src)}</pre></div>
          <div class="rn rn-g-out">${T.rn.format(src)}</div></div>`).join('')}</div>
      <p class="muted small">Untuk dikirim ke grup WA, pakai <b>Salin versi WhatsApp</b> di bawah kotak teks: simbolnya diganti tanda yang rapi di WhatsApp (1️⃣ 📖 📌 ☑️).</p>`;
  }

  /* ============ RANGKUMAN MINGGUAN: gabungkan renungan beberapa hari → PDF / teks WA ============ */
  let WK = null, WKM = null;
  const initials = t => String(t || '').split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).join('');
  function wkRange(kind) {
    const ref = BY[Math.min(D.currentDay || 1, rnMaxDay())] || D.schedule[0];
    if (kind === '7') return { from: Math.max(1, ref.hari - 6), to: ref.hari };   // 7 bacaan terakhir s/d hari ini
    // minggu kalender (Senin–Minggu) dari hari acuan; "lalu" = minggu sebelumnya
    const p = ref.tanggal.split('-').map(Number); const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - (kind === 'lalu' ? 7 : 0));
    const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
    const a = mon.toISOString().slice(0, 10), z = sun.toISOString().slice(0, 10);
    const days = D.schedule.filter(x => x.tanggal >= a && x.tanggal <= z).map(x => x.hari);
    return days.length ? { from: days[0], to: days[days.length - 1] } : { from: ref.hari, to: ref.hari };
  }
  function wkAutoTitle() {
    const f = BY[WK.from], l = BY[WK.to];
    const pf = f && String(f.bacaan).split(/\s*&\s*/)[0].match(/^(.*\S)\s+(\d+)/);
    const pl = l && String(l.bacaan).split(/\s*&\s*/).pop().match(/^(.*\S)\s+(\d+)(?:\s*[-–]\s*(\d+))?$/);
    let r = '';
    if (pf && pl) r = pf[1] === pl[1] ? `${pf[1]} ${pf[2]}-${pl[3] || pl[2]}` : `${pf[1]} ${pf[2]} - ${pl[1]} ${pl[3] || pl[2]}`;
    return ('Guidelines ' + r + ' ' + initials(D.settings.namaKelompok)).replace(/\s+/g, ' ').trim();
  }
  function wkDays() { const out = []; for (let h = WK.from; h <= WK.to; h++) if (BY[h]) out.push(h); return out; }
  function wkHtml() {
    const mm = rnMetaMap(); const days = wkDays(); const ada = days.filter(h => mm[h]);
    const opt = sel => D.schedule.map(x => `<option value="${x.hari}" ${x.hari === sel ? 'selected' : ''}>${T.fmtTanggal(x.tanggal, { short: true })}: ${T.esc(x.bacaan)}</option>`).join('');
    return `<header class="modal-head"><div><h2>Rangkuman mingguan</h2>
        <p class="muted small nomb">Gabungkan renungan beberapa hari jadi satu PDF atau satu teks WA.</p></div>
        <button class="icon-btn" data-close aria-label="Tutup">×</button></header>
      <div class="seg wk-seg" role="group" aria-label="Pilih minggu">
        <button class="seg-btn ${WK.preset === '7' ? 'on' : ''}" data-act="wk-preset" data-p="7">7 hari terakhir</button>
        <button class="seg-btn ${WK.preset === 'ini' ? 'on' : ''}" data-act="wk-preset" data-p="ini">Minggu ini</button>
        <button class="seg-btn ${WK.preset === 'lalu' ? 'on' : ''}" data-act="wk-preset" data-p="lalu">Minggu lalu</button></div>
      <div class="wk-range">
        <label><span>Dari</span><select class="input" id="wk-from">${opt(WK.from)}</select></label>
        <label><span>Sampai</span><select class="input" id="wk-to">${opt(WK.to)}</select></label>
      </div>
      <ul class="wk-list">${days.map(h => `<li class="${mm[h] ? 'ok' : 'no'}"><span>${T.fmtTanggal(BY[h].tanggal, { short: true })}</span>
        <b>${T.esc(BY[h].bacaan)}</b><em>${mm[h] ? '✓ ada' : 'dilewati'}</em></li>`).join('')}</ul>
      <label class="wk-title"><span>Judul</span><input class="input" id="wk-title" value="${T.esc(WK.title)}" autocomplete="off"></label>
      <label class="wk-check"><input type="checkbox" id="wk-page" ${WK.newPage ? 'checked' : ''}> Setiap hari mulai di halaman baru</label>
      <p class="muted small wk-sum">${ada.length} dari ${days.length} hari ada renungannya${ada.length < days.length ? '; hari yang belum ada dilewati' : ''}.${WK.err ? ` <b class="danger">${T.esc(WK.err)}</b>` : ''}</p>
      <div class="rbox-btns">
        <button class="btn-secondary" data-act="wk-copy" ${ada.length && !WK.busy ? '' : 'disabled'}>Salin teks</button>
        <button class="btn-primary" data-act="wk-pdf" ${ada.length && !WK.busy ? '' : 'disabled'}>${WK.busy ? 'Menyiapkan…' : 'Buat PDF'}</button>
      </div>
      <p class="muted small nomb">Di HP: setelah layar cetak muncul, pilih <b>Simpan sebagai PDF</b>, lalu kirim filenya ke grup.</p>`;
  }
  function wkOpen() {
    WK = Object.assign({ preset: '7', newPage: false, busy: false, err: '' }, wkRange('7'));
    WK.title = wkAutoTitle(); WK.titleEdited = false;
    WKM = T.openModal(wkHtml(), { onClose: () => { WKM = null; } });
  }
  function wkRefresh() { if (!WK.titleEdited) WK.title = wkAutoTitle(); if (WKM) WKM.setHtml(wkHtml()); }
  /** ambil teks renungan yang belum ada di HP (bersamaan) */
  async function wkTexts() {
    const mm = rnMetaMap(); const need = wkDays().filter(h => mm[h] && !(h in RN_TEXT));
    const res = await Promise.allSettled(need.map(h => T.apiPost({ action: 'rnGet', pin: PIN, hari: h })
      .then(r => { RN_TEXT[h] = r.item ? r.item.teks : ''; })));
    const bad = res.filter(r => r.status === 'rejected').length;
    if (bad) throw new Error(`${bad} renungan gagal dimuat. Coba lagi.`);
    return wkDays().filter(h => (RN_TEXT[h] || '').trim());
  }
  async function wkRun(kind) {
    if (!WK || WK.busy) return;
    WK.busy = true; WK.err = ''; wkRefresh();
    let days = [];
    try { days = await wkTexts(); } catch (e) { WK.err = loginError(e) || e.message; }
    WK.busy = false; wkRefresh();
    if (!days.length) return;
    if (kind === 'copy') {
      const txt = `*${WK.title}*\n\n` + days.map(h => T.rn.toWa(RN_TEXT[h]).trim()).join('\n\n━━━━━━━━━━\n\n');
      return T.toast((await T.copyText(txt)) ? `Teks ${days.length} renungan disalin` : 'Gagal menyalin');
    }
    wkPrint(days);
  }
  function wkPrint(days) {
    let root = document.getElementById('print-root');
    if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
    const t = WK.title;
    root.innerHTML = `<h1 class="pr-title">${T.esc(t)}</h1>` + days.map(h => `
      <section class="pr-day ${WK.newPage ? 'pr-newpage' : ''}">
        <p class="pr-date">${fmtLong(BY[h].tanggal)}</p>
        <p class="pr-guide">Guidelines: ${T.esc(BY[h].bacaan).replace(/(\d)-(\d)/g, '$1–$2')}</p>
        <div class="rn pr-body">${T.rn.format(RN_TEXT[h])}</div>
      </section>`).join('');
    // judul & nomor halaman di kaki setiap halaman (Chrome 131+)
    let st = document.getElementById('print-page');
    if (!st) { st = document.createElement('style'); st.id = 'print-page'; document.head.appendChild(st); }
    const q = JSON.stringify(t);
    st.textContent = `@page { size: A4; margin: 18mm 18mm 20mm;
      @bottom-left { content: ${q}; font: 9pt "Plus Jakarta Sans", sans-serif; color: #8a918b; }
      @bottom-right { content: counter(page); font: 9pt "Plus Jakarta Sans", sans-serif; color: #8a918b; } }`;
    const oldTitle = document.title;
    const done = () => { document.title = oldTitle; document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
    document.title = t;                      // nama file PDF mengikuti judul
    document.body.classList.add('printing');
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 60);
  }

  function bindRenungan() {
    const ta = document.getElementById('rn-text'); if (!ta) return;
    ta.value = rnValue(RSEL);
    ta.addEventListener('paste', () => { const wasEmpty = !ta.value.trim(); setTimeout(() => rnDetect(wasEmpty), 0); });
    syncRn();
    const chips = document.getElementById('rn-chips'); const sel = chips && chips.querySelector('.sel');
    if (sel && chips.clientWidth) chips.scrollLeft = sel.offsetLeft - chips.offsetLeft - (chips.clientWidth - sel.offsetWidth) / 2;
    if (rnMetaMap()[RSEL] && !(RSEL in RN_TEXT) && !RN_LOADING.has(RSEL)) rnFetchText(RSEL);
  }

  const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  /** "Jumat, 30 Jun" (+ tahun kalau bukan tahun ini, karena jadwal s/d Wahyu melewati beberapa tahun) */
  /** "Sabtu, 21 November 2026"; noDay → "18 September 2028" */
  const fmtLong = (ymd, noDay) => { const p = ymd.split('-').map(Number); return (noDay ? '' : T.dayName(ymd) + ', ') + p[2] + ' ' + BLN[p[1] - 1] + ' ' + p[0]; };
  const fmtY = (ymd, opt) => T.fmtTanggal(ymd, opt) + (ymd.slice(0, 4) !== (D.today || '').slice(0, 4) ? ' ' + ymd.slice(0, 4) : '');
  const tglTeks = ymd => { const p = ymd.split('-').map(Number); return p[2] + ' ' + BLN[p[1] - 1] + ' ' + p[0]; };

  /**
   * Teks ini untuk hari bacaan yang mana?
   * 1) Guidelines (mis. "Kejadian 43–44") dicocokkan ke jadwal — paling bisa diandalkan.
   * 2) Tanggal di teks; kalau tahunnya salah ketik (2025 vs 2026), dicari tanggal & bulan yang sama.
   */
  function rnTarget(v) {
    const g = T.rn.parseGuide(v);
    const gDay = g ? D.schedule.find(x => T.rn.norm(x.bacaan) === T.rn.norm(g)) || null : null;
    const tgl = T.rn.parseDate(v);
    let dDay = tgl ? D.schedule.find(x => x.tanggal === tgl) || null : null, yearFix = false;
    if (tgl && !dDay) {
      const md = tgl.slice(5);
      const c = D.schedule.filter(x => x.tanggal.slice(5) === md);
      dDay = (gDay && c.find(x => x.hari === gDay.hari)) || c.sort((a, b) => Math.abs(a.hari - RSEL) - Math.abs(b.hari - RSEL))[0] || null;
      yearFix = !!dDay;
    }
    return { g, gDay, tgl, dDay, yearFix, target: gDay || dDay, conflict: !!(gDay && dDay && gDay.hari !== dDay.hari) };
  }

  /** perbarui hitungan karakter, peringatan, tombol simpan & pratinjau (tanpa menggambar ulang kotak teks) */
  function syncRn() {
    const ta = document.getElementById('rn-text'); if (!ta) return;
    const v = ta.value; const n = v.trim().length;
    document.getElementById('rn-count').textContent = n ? n.toLocaleString('id-ID') + ' karakter' : '';
    const save = document.getElementById('rn-save');
    const dirty = rnDirty(RSEL) && n > 0;
    // peringatan hari / tanggal / guidelines
    const hints = [];
    const t = rnTarget(v);
    const sel = BY[RSEL];
    const wrongDay = !!(t.target && t.target.hari !== RSEL && !RN_FORCE[RSEL]);
    if (t.target && t.target.hari === RSEL) hints.push(`<p class="ok">✓ Cocok dengan jadwal: ${T.esc(sel.bacaan)}</p>`);
    if (wrongDay) hints.push(`<p class="warn">⚠️ Teks ini untuk <b>${T.fmtTanggal(t.target.tanggal, { short: true })} · ${T.esc(t.target.bacaan)}</b>
        (menurut ${t.gDay ? 'Guidelines' : 'tanggal di teks'}), tapi yang dipilih <b>${T.fmtTanggal(sel.tanggal, { short: true })} · ${T.esc(sel.bacaan)}</b>.<br>
        <button class="link-btn" data-act="rn-move" data-h="${t.target.hari}">Pindahkan ke ${T.fmtTanggal(t.target.tanggal, { short: true })}</button> ·
        <button class="link-btn" data-act="rn-force">Tetap simpan di ${T.fmtTanggal(sel.tanggal, { short: true })}</button></p>`);
    if (t.yearFix) hints.push(`<p class="info">ℹ️ Tahun di teks tertulis <b>${tglTeks(t.tgl)}</b>, dianggap <b>${tglTeks(t.dDay.tanggal)}</b> sesuai jadwal.</p>`);
    if (t.conflict) hints.push(`<p class="warn">⚠️ Tanggal di teks (${tglTeks(t.tgl)}) dan Guidelines (${T.esc(t.g)}) menunjuk hari berbeda. Aplikasi memakai Guidelines.</p>`);
    if (t.g && !t.gDay) hints.push(`<p class="warn">⚠️ Guidelines "${T.esc(t.g)}" tidak ditemukan di jadwal. Cek penulisannya.</p>`);
    if (t.tgl && !t.dDay && !t.gDay) hints.push(`<p class="warn">⚠️ Tanggal di teks (${tglTeks(t.tgl)}) tidak ada di jadwal.</p>`);
    const savingThis = RN_SAVING === RSEL;
    save.disabled = savingThis || !dirty || n > 30000 || wrongDay;
    save.textContent = savingThis ? 'Menyimpan…' : wrongDay && dirty ? 'Cek hari dulu ↑'
      : rnMetaMap()[RSEL] ? (dirty ? 'Simpan perubahan' : 'Tersimpan ✓') : 'Simpan';
    if (n > 30000) hints.push('<p class="warn">⚠️ Terlalu panjang (maks. 30.000 karakter).</p>');
    const hint = document.getElementById('rn-hint');
    hint.innerHTML = hints.join(''); hint.hidden = !hints.length;
    const pv = document.getElementById('rn-prev');
    if (pv && pv.offsetParent !== null) pv.innerHTML = v.trim() ? T.rn.format(v) : '<p class="muted">Belum ada teks.</p>';
  }

  /** setelah tempel: kalau tanggal di teks menunjuk hari lain yang masih kosong, pindah otomatis */
  function rnDetect(wasEmpty) {
    const ta = document.getElementById('rn-text'); if (!ta) return;
    RN_DRAFT[RSEL] = ta.value;
    const day = rnTarget(ta.value).target;
    if (wasEmpty && day && day.hari !== RSEL && !rnDirty(day.hari)) {
      const replace = !!rnMetaMap()[day.hari];
      rnMove(day.hari);
      T.toast('Hari dipilih otomatis: ' + T.fmtTanggal(day.tanggal, { short: true }) + ' · ' + day.bacaan +
        (replace ? '. Renungan lama di hari itu akan diganti saat disimpan.' : ''), { ms: 5000 });
      return;
    }
    syncRn();
  }

  function rnMove(h) {
    const ta = document.getElementById('rn-text');
    const v = ta ? ta.value : rnValue(RSEL);
    delete RN_DRAFT[RSEL];                   // hari asal kembali seperti semula
    RN_DRAFT[h] = v; RSEL = h; RN_DEL = false;
    renderView(); window.scrollTo(0, 0);
  }

  async function rnFetchText(h) {
    RN_LOADING.add(h);
    if (h === RSEL) renderView();
    try {
      const r = await T.apiPost({ action: 'rnGet', pin: PIN, hari: h });
      RN_TEXT[h] = r.item ? r.item.teks : '';
    } catch (e) {
      T.toast('Gagal memuat renungan: ' + (loginError(e) || e.message), { ms: 5000 });
    }
    RN_LOADING.delete(h);
    if (h === RSEL && VIEW === 'renungan') renderView();
  }

  async function rnSave() {
    const ta = document.getElementById('rn-text'); if (!ta || RN_SAVING) return;   // satu simpan pada satu waktu
    const h = RSEL; const teks = ta.value.trim(); if (!teks) return;
    RN_SAVING = h; RN_DRAFT[h] = ta.value; syncRn();
    try {
      const r = await T.apiPost({ action: 'rnSave', pin: PIN, hari: h, teks });
      RN_TEXT[h] = r.item.teks; delete RN_DRAFT[h];
      D.rnMeta = r.rnMeta; saveCache();
      const cur = D.currentDay || 1;
      T.toast(h <= cur ? 'Renungan tersimpan ✓ Langsung tampil di aplikasi anggota' : 'Renungan tersimpan ✓ Tampil pada ' + fmtY(BY[h].tanggal, { short: true }), { ms: 4000 });
    } catch (e) {
      T.toast('Gagal menyimpan: ' + (loginError(e) || e.message), { ms: 6000 });
    }
    RN_SAVING = 0;
    if (VIEW === 'renungan') renderView();
  }

  async function rnDelete() {
    const h = RSEL;
    try {
      const r = await T.apiPost({ action: 'rnDelete', pin: PIN, hari: h });
      D.rnMeta = r.rnMeta; delete RN_TEXT[h]; delete RN_DRAFT[h]; saveCache();
      T.toast('Renungan dihapus');
    } catch (e) { T.toast('Gagal menghapus: ' + (loginError(e) || e.message), { ms: 6000 }); }
    RN_DEL = false;
    if (VIEW === 'renungan') renderView();
  }

  function rnSelect(h) {
    if (!BY[h]) return;
    const ta = document.getElementById('rn-text');
    if (ta && ta.value !== (RN_TEXT[RSEL] || '')) RN_DRAFT[RSEL] = ta.value;   // draf disimpan sementara
    RSEL = h; RN_DEL = false;
    renderView();
  }

  /* ============ 4. EMOJI & LINK ============ */
  function viewAtur() {
    return `<div class="atur-grid"><section class="card">
        <div class="card-head"><h3>Emoji rekap</h3><button class="chip-btn" data-act="emo-random">🎲 Acak</button></div>
        <p class="muted small">Ganti kapan saja supaya grup tidak bosan. Berlaku di teks rekap WA dan halaman anggota.</p>
        <div class="epreview-wrap"><p class="eyebrow">Contoh hasil</p><pre class="epreview" id="epreview"></pre></div>
        ${EMO_KEYS.map(([k, label, presets]) => `<div class="efield">
          <label for="ef-${k}">${label}</label>
          <input class="input emoji-input" id="ef-${k}" data-ef="${k}" maxlength="24" autocomplete="off" spellcheck="false">
          <div class="echips">${presets.map(e => `<button class="echip" data-emo="${k}" data-val="${e}">${e}</button>`).join('')}</div>
        </div>`).join('')}
        <p class="muted small mt-s">Tips: boleh ketik emoji sendiri di kotak, termasuk lebih dari satu (mis. 🔥🔥).</p>
        <div class="row-btns emo-save">
          <button class="btn-ghost" data-act="emo-revert" id="emo-revert">Kembalikan</button>
          <button class="btn-primary" data-act="emo-save" id="emo-save">Simpan emoji</button></div>
      </section>
      <section class="card">
        <div class="card-head"><h3>Link pribadi anggota</h3></div>
        <p class="muted small">Tiap anggota punya link sendiri berisi kode rahasia. <b>Kirim lewat chat pribadi</b>, jangan di grup.
          Kalau ada link yang bocor, buka detail anggota → <b>Ganti link</b>.</p>
        <div class="linklist">${D.members.map(m => `<div class="lrow">
            <button class="lrow-name" data-person="${T.esc(m.nama)}">${T.esc(m.nama)}</button>
            <button class="chip-btn" data-copy="${T.esc(m.nama)}">Salin</button>
            <a class="chip-btn wa" href="${waLinkFor(m)}" target="${T.waTarget}" rel="noopener">WA</a></div>`).join('')}</div>
      </section>
      <section class="card">
        <h3>Pengaturan lain</h3>
        <p class="muted small nomb">Jadwal, PIN admin, dan daftar anggota diatur langsung di Google Sheet (sheet <b>Pengaturan</b> &amp; <b>Anggota</b>).
          Anggota baru otomatis mendapat link saat halaman admin dimuat ulang.</p>
      </section></div>`;
  }
  function waLinkFor(m) {
    const text = `Shalom ${m.nama} 🙏\nIni link pribadi untuk lapor baca Alkitab ${D.settings.namaKelompok}.\n` +
      `Simpan baik-baik dan jangan dibagikan ya:\n${T.personalLink(m.kode)}`;
    return T.waUrl(text);
  }
  function syncEmoUI(skipInputs) {
    if (!document.getElementById('epreview')) return;
    if (!skipInputs) EMO_KEYS.forEach(([k]) => { document.getElementById('ef-' + k).value = EMO[k]; });
    document.querySelectorAll('.echip').forEach(b => b.classList.toggle('on', EMO[b.dataset.emo] === b.dataset.val));
    const cur = D.currentDay || 1;
    const sample = T.buildRecap(BY[cur] || D.schedule[0], D.members, n => P[n], EMO, BY).split('\n');
    const okLine = sample.find((l, i) => i && l.endsWith(' : ' + EMO.emojiSudah)) || sample[1];
    const lateLine = sample.find((l, i) => i && l.indexOf(EMO.emojiBelum) > 0) || sample[2];
    document.getElementById('epreview').textContent = [sample[0], okLine, lateLine].filter(Boolean).join('\n');
    const changed = EMO_KEYS.some(([k]) => EMO[k] !== D.settings[k]);
    const valid = EMO_KEYS.every(([k]) => String(EMO[k] || '').trim());
    const save = document.getElementById('emo-save');
    save.disabled = !changed || !valid || SAVING_EMO;
    save.textContent = SAVING_EMO ? 'Menyimpan…' : changed ? 'Simpan emoji' : 'Tersimpan ✓';
    document.getElementById('emo-revert').disabled = !changed || SAVING_EMO;
  }
  async function saveEmo() {
    SAVING_EMO = true; syncEmoUI(true);
    try {
      const r = await T.apiPost(Object.assign({ action: 'simpanEmoji', pin: PIN }, EMO));
      D.settings = r.settings; EMO = pickEmo(r.settings); saveCache();
      T.toast('Emoji disimpan 🎉 Rekap sudah memakai emoji baru');
    } catch (e) { T.toast('Gagal menyimpan: ' + e.message, { ms: 5000 }); }
    SAVING_EMO = false; syncEmoUI();
  }

  /* ============ DETAIL ANGGOTA (lembar bawah) ============ */
  function personHtml(nama) {
    const cur = D.currentDay; const set = P[nama]; const m = D.members.find(x => x.nama === nama);
    const selesai = T.countDone(set, cur), tertinggal = T.countUnread(set, cur), pasal = T.pasalDone(set, BY, cur);
    const days = []; for (let d = cur; d >= 1; d--) days.push(d);
    const shown = MODAL_ALL ? days : days.slice(0, 14);
    const link = T.personalLink(m.kode);
    const cAll = CONFIRM === 'all:' + nama, cReset = CONFIRM === 'reset:' + nama;
    return `<header class="modal-head"><div><p class="eyebrow">Detail anggota</p><h2>${T.esc(nama)}</h2>
        <p class="muted small nomb">Lapor terakhir: ${T.relTime(D.terakhir[nama])}</p></div>
        <button class="icon-btn" data-close aria-label="Tutup">×</button></header>
      <div class="stats-row">
        <div class="stat"><span class="stat-num">${selesai}/${cur}</span><span class="stat-label">bacaan</span></div>
        <div class="stat"><span class="stat-num">${pasal}</span><span class="stat-label">pasal</span></div>
        <div class="stat ${tertinggal ? 'warn' : ''}"><span class="stat-num">${tertinggal}</span><span class="stat-label">tertinggal</span></div>
      </div>
      ${tertinggal ? `<button class="btn-secondary btn-wide ${cAll ? 'confirm' : ''}" data-act="mark-all">${cAll
        ? `Ketuk lagi untuk tandai ${tertinggal} bacaan` : '✓ Tandai semua sudah sampai hari ini'}</button>` : ''}
      <h4>Checklist bacaan <span class="muted small">(terbaru di atas)</span></h4>
      <ul class="check-list">${shown.map(d => {
        const on = set.has(d); const busy = PENDING.has(nama + '|' + d);
        return `<li><button class="check ${on ? 'on' : ''} ${busy ? 'busy' : ''}" data-mtick="${d}" aria-pressed="${on}">
          <span class="box" aria-hidden="true"></span><span class="cl-main">${T.esc(BY[d].bacaan)}</span>
          <span class="cl-sub">${T.fmtTanggal(BY[d].tanggal, { short: true })}</span></button></li>`;
      }).join('')}</ul>
      ${days.length > shown.length ? `<button class="link-btn" data-act="modal-all">Tampilkan semua (${days.length})</button>` : ''}
      <h4>Link pribadi</h4>
      <input class="input mono" readonly value="${T.esc(link)}" aria-label="Link pribadi" onclick="this.select()">
      <div class="row-btns mt-s">
        <button class="btn-secondary" data-copy="${T.esc(nama)}">Salin link</button>
        <a class="btn-wa" href="${waLinkFor(m)}" target="${T.waTarget}" rel="noopener">Kirim via WA</a>
      </div>
      ${T.IS_DEMO ? `<a class="btn-ghost btn-wide" href="${T.esc(link)}">Demo: buka sebagai ${T.esc(nama)} →</a>` : ''}
      <button class="link-btn danger ${cReset ? 'confirm' : ''}" data-act="reset-kode">${cReset
        ? 'Yakin? Link lama langsung tidak berlaku, ketuk lagi' : 'Ganti link (kalau link bocor)'}</button>`;
  }

  function openPerson(nama) {
    MODAL_NAMA = nama; MODAL_ALL = false; CONFIRM = null;
    MODAL = T.openModal(personHtml(nama), { onClose: () => { MODAL = null; MODAL_NAMA = null; CONFIRM = null; } });
  }

  function askConfirm(key) {
    if (CONFIRM === key) { CONFIRM = null; clearTimeout(confirmTimer); return true; }
    CONFIRM = key; clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => { CONFIRM = null; if (MODAL) MODAL.setHtml(personHtml(MODAL_NAMA)); }, 4000);
    if (MODAL) MODAL.setHtml(personHtml(MODAL_NAMA));
    return false;
  }

  /* ============ tandai atas nama anggota (langsung tampil, simpan di belakang) ============ */
  async function adminSet(nama, days, status) {
    days = days.filter(d => !PENDING.has(nama + '|' + d) && P[nama].has(d) !== status);
    if (!days.length) return;
    days.forEach(d => { PENDING.add(nama + '|' + d); if (status) P[nama].add(d); else P[nama].delete(d); });
    T.haptic(10);
    refresh();
    try {
      await T.apiPost({ action: 'adminLapor', pin: PIN, nama, hari: days, status });
      if (status) D.terakhir[nama] = new Date().toISOString();
      saveCache();
    } catch (e) {
      days.forEach(d => { if (status) P[nama].delete(d); else P[nama].add(d); });
      T.toast(loginError(e) || `Gagal menyimpan ${nama}. Cek internet lalu coba lagi.`, { ms: 6000 });
    }
    days.forEach(d => PENDING.delete(nama + '|' + d));
    refresh();
  }
  const toggleDay = (nama, d) => adminSet(nama, [d], !P[nama].has(d));

  async function resetKode(nama) {
    try {
      const r = await T.apiPost({ action: 'resetKode', pin: PIN, nama });
      D.members.find(m => m.nama === nama).kode = r.kode; saveCache();
      if (MODAL) MODAL.setHtml(personHtml(nama));
      if (VIEW === 'atur') renderView();
      T.toast('Link baru dibuat. Kirim ulang ke ' + nama);
    } catch (e) { T.toast('Gagal: ' + e.message, { ms: 5000 }); }
  }

  /* ============ event ============ */
  function logout() {
    ss.del(PIN_KEY); if (store2) T.cacheDel(DATA_KEY, store2); PIN = null; D = null;
    RN_TEXT = {}; RN_DRAFT = {}; RN_FORCE = {}; RSEL = 0; ROLE = 'admin'; VIEWS = VIEWS_ADMIN; RECAP_EDIT = null;
    if (MODAL) MODAL.close();
    closeSheet();
    renderLogin();
  }

  document.addEventListener('click', async e => {
    let el;
    if ((el = e.target.closest('[data-act="side-toggle"]'))) {
      const mini = document.documentElement.classList.toggle('side-mini');
      T.store.set('tbf_side_mini', mini ? '1' : '0');
      return syncSideToggle();
    }
    if (e.target.closest('[data-act="logout"]')) return logout();
    if (!D) { if (e.target.closest('[data-act="reload"]')) load(); return; }
    if ((el = e.target.closest('[data-view]'))) {
      VIEW = el.dataset.view; T.store.set('tbf_admin_view', VIEW);
      renderAll(); window.scrollTo(0, 0); return;
    }
    if ((el = e.target.closest('[data-rsel]'))) return rnSelect(+el.dataset.rsel);
    if ((el = e.target.closest('[data-fmt]'))) return rnInsert(el.dataset.fmt);
    if ((el = e.target.closest('[data-tick]'))) return toggleDay(el.dataset.tick, SEL);
    if ((el = e.target.closest('[data-mtick]'))) return MODAL_NAMA && toggleDay(MODAL_NAMA, +el.dataset.mtick);
    if ((el = e.target.closest('[data-cell]'))) { const i = el.dataset.cell.lastIndexOf('|'); return toggleDay(el.dataset.cell.slice(0, i), +el.dataset.cell.slice(i + 1)); }
    if ((el = e.target.closest('[data-person]'))) return openPerson(el.dataset.person);
    if ((el = e.target.closest('[data-filter]'))) { FILTER = el.dataset.filter; renderCFilter(); renderCList(); return; }
    if ((el = e.target.closest('[data-pmode]'))) { PMODE = el.dataset.pmode; renderView(); return; }
    if ((el = e.target.closest('[data-emo]'))) { EMO[el.dataset.emo] = el.dataset.val; T.haptic(6); syncEmoUI(); return; }
    if ((el = e.target.closest('[data-copy]'))) {
      const m = D.members.find(x => x.nama === el.dataset.copy);
      return T.toast((await T.copyText(T.personalLink(m.kode))) ? `Link ${m.nama} disalin` : 'Gagal menyalin');
    }
    if (!(el = e.target.closest('[data-act]'))) return;
    switch (el.dataset.act) {
      case 'prev': SEL = Math.max(1, SEL - 1); renderDaybar(); renderView(); return;
      case 'next': SEL = Math.min(D.currentDay, SEL + 1); renderDaybar(); renderView(); return;
      case 'latest': SEL = D.currentDay; renderDaybar(); renderView(); return;
      case 'reload': return load();
      case 'copy-recap': {
        const box = el.closest('[data-rbox]'); const ta = box && box.querySelector('textarea');
        const ok = await T.copyText(ta ? ta.value : recapText());
        return T.toast(ok ? 'Disalin! Tinggal tempel di grup WA' : 'Gagal menyalin, salin manual ya');
      }
      case 'recap-sheet': return openSheet();
      case 'recap-reset': RECAP_EDIT = null; { const ta = document.getElementById('recap'); if (ta) ta.value = autoRecap(); } return renderRecap();
      case 'emo-random': {
        const rnd = a => a[Math.floor(Math.random() * a.length)];
        const sudah = rnd(T.EMOJI_SUDAH);
        EMO = { emojiJudul: Math.random() < 0.5 ? sudah : rnd(T.EMOJI_SUDAH), emojiSudah: sudah, emojiBelum: rnd(T.EMOJI_BELUM) };
        T.haptic(8); return syncEmoUI();
      }
      case 'emo-revert': EMO = pickEmo(D.settings); return syncEmoUI();
      case 'emo-save': return saveEmo();
      case 'rn-prevday': return rnSelect(RSEL - 1);
      case 'rn-nextday': return rnSelect(RSEL + 1);
      case 'rn-today': return rnSelect(D.currentDay || 1);
      case 'rn-nextempty': {
        const mm = rnMetaMap();
        const nx = D.schedule.find(x => x.hari > RSEL && !mm[x.hari]);
        if (!nx) return T.toast('Semua hari setelah ini sudah ada renungannya 🎉');
        return rnSelect(nx.hari);
      }
      case 'rn-move': return rnMove(+el.dataset.h);
      case 'wk-open': return wkOpen();
      case 'wk-preset': WK.preset = el.dataset.p; Object.assign(WK, wkRange(el.dataset.p)); return wkRefresh();
      case 'wk-pdf': return wkRun('pdf');
      case 'wk-copy': return wkRun('copy');
      case 'rn-guide': T.openModal(rnGuideHtml()); return;
      case 'rn-copywa': {
        const ta = document.getElementById('rn-text'); if (!ta || !ta.value.trim()) return T.toast('Belum ada teks');
        return T.toast((await T.copyText(T.rn.toWa(ta.value))) ? 'Versi WhatsApp disalin. Tinggal tempel di grup' : 'Gagal menyalin');
      }
      case 'rn-force': RN_FORCE[RSEL] = true; return syncRn();
      case 'rn-save': return rnSave();
      case 'rn-preview': RN_PREVIEW = !RN_PREVIEW; {
        const card = document.getElementById('rn-prev-card'); card.classList.toggle('show', RN_PREVIEW);
        el.textContent = RN_PREVIEW ? 'Tutup pratinjau' : 'Pratinjau'; el.setAttribute('aria-pressed', String(RN_PREVIEW)); syncRn();
        if (RN_PREVIEW) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } return;
      case 'rn-del':
        if (!RN_DEL) { RN_DEL = true; renderView(); setTimeout(() => { if (RN_DEL) { RN_DEL = false; if (VIEW === 'renungan') renderView(); } }, 4000); return; }
        return rnDelete();
      case 'modal-all': MODAL_ALL = true; return MODAL && MODAL.setHtml(personHtml(MODAL_NAMA));
      case 'mark-all': {
        if (!askConfirm('all:' + MODAL_NAMA)) return;
        const nama = MODAL_NAMA; const ds = [];
        for (let d = 1; d <= D.currentDay; d++) if (!P[nama].has(d)) ds.push(d);
        return adminSet(nama, ds, true);
      }
      case 'reset-kode': if (askConfirm('reset:' + MODAL_NAMA)) return resetKode(MODAL_NAMA); return;
    }
  });
  // tombol desain tidak mengambil fokus dari kotak teks (pilihan teks tetap)
  document.addEventListener('mousedown', e => { if (e.target.closest('[data-fmt]')) e.preventDefault(); });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'rn-text') { RN_DRAFT[RSEL] = t.value; syncRn(); }
    else if (t.id === 'wk-title' && WK) { WK.title = t.value; WK.titleEdited = true; }
    else if (t.id === 'recap' || t.id === 'recap-s') {
      RECAP_EDIT = t.value === autoRecap() ? null : { hari: SEL, text: t.value };
      syncWaLinks();
      if (t.id === 'recap-s') { const a = document.getElementById('recap'); if (a) a.value = t.value; }
      const note = document.getElementById('recap-note'); if (note && t.id === 'recap') renderRecap();
    }
    else if (t.id === 'cq') { CQ = t.value; renderCList(); }
    else if (t.id === 'pq') { PQ = t.value; renderPBody(); }
    else if (t.dataset && t.dataset.ef) { EMO[t.dataset.ef] = t.value; syncEmoUI(true); }
  });
  document.addEventListener('change', e => {
    const id = e.target.id;
    if (WK && (id === 'wk-from' || id === 'wk-to')) {
      const v = +e.target.value; WK.preset = '';
      if (id === 'wk-from') { WK.from = v; if (WK.to < v) WK.to = v; } else { WK.to = v; if (WK.from > v) WK.from = v; }
      if (WK.to - WK.from > 30) { if (id === 'wk-from') WK.to = WK.from + 30; else WK.from = WK.to - 30; }   // maks. 31 hari sekali cetak
      return wkRefresh();
    }
    if (WK && id === 'wk-page') { WK.newPage = e.target.checked; return; }
    if (e.target.id === 'rn-date' && e.target.value) {
      const d = D.schedule.find(x => x.tanggal >= e.target.value);   // hari libur → bacaan berikutnya
      if (d) rnSelect(d.hari);
      return;
    } if (e.target.id === 'psort') { SORT = e.target.value; renderPBody(); } });
  document.getElementById('btn-refresh').addEventListener('click', () => load(true));
  boot();
})();
