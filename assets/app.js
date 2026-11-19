/* Tekun Baca Firman — halaman anggota (hanya lewat link pribadi) v4
 * - Bisa menyimpan beberapa akun di satu HP (menu di kanan atas)
 * - Kartu "Kirim ke grup WA" di paling bawah
 */
(function () {
  'use strict';
  const T = window.TBF;
  const $app = document.getElementById('app');
  const $bar = document.getElementById('actionbar');
  const $acct = document.getElementById('acct-btn');
  const LATE_LIMIT = 10;
  const WA_DAYS = 14;         // jumlah bacaan terakhir yang bisa dipilih untuk dikirim ke WA
  const ACC_KEY = 'tbf_akun';
  const APP_VERSI = '4.4';

  let KODE = null, D = null, BY = {}, DONE = new Set(), PICK = new Set(), PENDING = new Set();
  let SHOW_BOARD = false, SHOW_ALL_LATE = false, LOADED_AT = 0, LAST_JSON = '';
  let WA_SEL = null;                         // bacaan yang dipilih untuk dikirim ke WA
  let WA_MORE = false;                       // panel "Pilih lain" terbuka?
  let MENU = null, MENU_ADD = false, MENU_DEL = null, ADDING = false;

  /* ============ daftar akun di HP ini ============ */
  function accounts() {
    try {
      const a = JSON.parse(T.store.get(ACC_KEY) || '[]');
      return Array.isArray(a) ? a.filter(x => x && x.kode) : [];
    } catch (e) { return []; }
  }
  function saveAccounts(a) { T.store.set(ACC_KEY, JSON.stringify(a)); }
  function upsertAccount(kode, nama) {
    const a = accounts(); const i = a.findIndex(x => x.kode === kode);
    if (i >= 0) { if (a[i].nama === nama) return; a[i].nama = nama; } else a.push({ kode, nama });
    saveAccounts(a);
  }
  function removeAccount(kode) {
    saveAccounts(accounts().filter(x => x.kode !== kode));
    T.cacheDel('tbf_c_' + kode);
  }
  function namaOf(kode) { const a = accounts().find(x => x.kode === kode); return a ? a.nama : ''; }

  /** Ambil kode dari teks yang ditempel: kode saja, atau link …?k=kode / …#kode */
  function parseKode(input) {
    const s = String(input || '').trim();
    const m = s.match(/[?&]k=([a-z0-9]{6,16})/i) || s.match(/#([a-z0-9]{6,16})\s*$/i) || s.match(/^([a-z0-9]{6,16})$/i);
    return m ? m[1].toLowerCase() : null;
  }

  /** Simpan akun yang aktif di alamat halaman, supaya muat ulang / simpan ke layar utama tetap akun yang sama */
  function setUrlKode(kode) {
    try {
      if (T.IS_DEMO) history.replaceState(null, '', location.pathname + location.search + '#' + kode);
      else history.replaceState(null, '', location.pathname + '?k=' + kode);
    } catch (e) { /* abaikan */ }
  }

  /* ============ memuat data ============ */
  async function boot(opts) {
    opts = opts || {};
    T.demoBanner('<a class="demo-admin" href="admin.html">Coba halaman admin →</a>');
    const tok = opts.kode ? { kode: opts.kode } : T.getToken();
    if (!tok) { KODE = null; D = null; renderAcct(); return renderNoAccess(false); }
    if (KODE !== tok.kode) { D = null; PICK.clear(); PENDING.clear(); WA_SEL = null; WA_MORE = false; SHOW_ALL_LATE = false; LAST_JSON = ''; }
    const myKode = KODE = tok.kode;
    const CKEY = 'tbf_c_' + KODE;
    renderAcct();

    // data sudah diambil (mis. saat menambah akun) → langsung pakai
    if (opts.data) {
      T.store.set('tbf_kode', KODE);
      upsertAccount(KODE, opts.data.me.nama);
      LAST_JSON = JSON.stringify(opts.data); LOADED_AT = Date.now();
      apply(opts.data); saveCache(); renderAcct();
      return;
    }
    // 1) tampilkan data terakhir yang tersimpan di HP → langsung muncul tanpa menunggu
    if (!D) {
      const cached = T.cacheGet(CKEY);
      if (cached) { LAST_JSON = JSON.stringify(cached); apply(advanceDay(cached)); } else $app.innerHTML = '<div class="loading">Memuat…</div>';
    } else if (D.today !== T.todayStr()) {
      // halaman dibiarkan terbuka sampai hari berganti → langsung geser ke hari ini
      apply(advanceDay(D));
    }
    // 2) ambil data terbaru dari server di belakang layar
    T.syncing(true);
    let fresh;
    try {
      fresh = await T.apiGet({ action: 'init', k: KODE });
    } catch (e) {
      if (myKode !== KODE) return;            // sudah pindah akun
      T.syncing(false);
      if (e.message === 'LINK_TIDAK_VALID') return handleInvalid();
      if (D) return T.toast('Belum bisa terhubung. Menampilkan data terakhir.', { ms: 4000 });
      return fatal(e);
    }
    if (myKode !== KODE) return;              // sudah pindah akun
    T.syncing(false);
    T.store.set('tbf_kode', KODE);
    upsertAccount(KODE, fresh.me.nama);
    renderAcct();
    LOADED_AT = Date.now();
    const json = JSON.stringify(fresh);
    if (D && !D._stale && !PENDING.size && json === LAST_JSON) return; // sama persis dengan yang sudah tampil
    LAST_JSON = json;
    // laporan yang masih dikirim tetap mengikuti tampilan di HP, sisanya pakai data server
    const localDone = new Set(DONE), pend = new Set(PENDING);
    apply(fresh);
    if (pend.size) {
      pend.forEach(d => { if (localDone.has(d)) DONE.add(d); else DONE.delete(d); });
      updateBoardSelf(); render();
    }
    saveCache();
  }

  /**
   * Data di HP bisa saja data kemarin. Hitung sendiri "bacaan hari ini" dari jadwal yang ikut
   * tersimpan (berisi s/d 7 hari ke depan), supaya halaman langsung benar tanpa menunggu server.
   * Status teman-teman ikut disesuaikan (dianggap belum lapor) sampai data server masuk.
   */
  function advanceDay(data) {
    const today = T.todayStr();
    if (!data || !data.schedule || data.today === today || data.today > today) return data;
    const sched = data.schedule;
    if (!sched.some(s => s.tanggal > today)) return data;   // jadwal tersimpan tidak cukup jauh → tunggu server
    let cur = 0;
    sched.forEach(s => { if (s.tanggal <= today && s.hari > cur) cur = s.hari; });
    const oldCur = data.currentDay || 0;
    const out = Object.assign({}, data, { today, currentDay: Math.max(cur, oldCur), _stale: true });
    const diff = out.currentDay - oldCur;
    if (diff > 0) {
      out.board = (data.board || []).map(b => ({
        nama: b.nama,
        belum: b.belum || oldCur + 1,
        tertinggal: (b.tertinggal || 0) + diff,
      }));
      if (WA_SEL && WA_SEL.size === 1 && WA_SEL.has(oldCur)) WA_SEL = null; // pilihan WA ikut ke hari ini
    }
    return out;
  }

  function apply(data) {
    D = data;
    BY = T.indexSchedule(D.schedule);
    DONE = new Set(D.done);
    PICK.forEach(d => { if (DONE.has(d)) PICK.delete(d); });
    if (D.me && KODE) upsertAccount(KODE, D.me.nama);
    document.getElementById('group-name').textContent = D.settings.namaKelompok;
    document.title = D.me.nama + ' · ' + D.settings.namaKelompok;
    render();
    renderAcct();
  }

  function saveCache() {
    if (!D || !KODE) return;
    const snap = Object.assign({}, D, { ok: true, done: Array.from(DONE).sort((a, b) => a - b) });
    T.cacheSet('tbf_c_' + KODE, snap);
  }

  /** Link akun ini sudah tidak berlaku (diganti admin / dikeluarkan) */
  function handleInvalid() {
    const dead = KODE; const nm = namaOf(dead);
    removeAccount(dead);
    T.store.del('tbf_kode');
    KODE = null; D = null;
    const rest = accounts();
    if (rest.length) {
      T.toast(`Link ${nm || 'itu'} sudah tidak berlaku, dihapus dari HP ini`, { ms: 5000 });
      return switchTo(rest[0].kode);
    }
    renderAcct();
    renderNoAccess(true);
  }

  function switchTo(kode, data) {
    closeMenu();
    if (kode === KODE && D && !data) return;
    T.store.set('tbf_kode', kode);
    setUrlKode(kode);
    window.scrollTo(0, 0);
    boot({ kode, data });
  }

  async function addAccount(input, $err, $btn) {
    const k = parseKode(input);
    const showErr = msg => { if ($err) { $err.textContent = msg; $err.hidden = false; } };
    if (!k) return showErr('Kode tidak dikenali. Tempel link pribadi atau ketik kodenya (contoh: 7mq2xk9a).');
    if (accounts().some(a => a.kode === k)) { T.toast('Akun itu sudah ada, dibuka sekarang'); return switchTo(k); }
    if (ADDING) return;
    ADDING = true;
    if ($btn) { $btn.disabled = true; $btn.textContent = 'Memeriksa…'; }
    try {
      const data = await T.apiGet({ action: 'init', k });
      upsertAccount(k, data.me.nama);
      MENU_ADD = false;
      T.toast(`Akun ${data.me.nama} ditambahkan`);
      switchTo(k, data);
    } catch (e) {
      showErr(e.message === 'LINK_TIDAK_VALID'
        ? 'Kode tidak ditemukan atau sudah tidak berlaku. Cek lagi ke admin.'
        : 'Belum bisa terhubung. Cek internet lalu coba lagi.');
    } finally {
      ADDING = false;
      if ($btn && $btn.isConnected) { $btn.disabled = false; $btn.textContent = 'Masuk'; }
    }
  }

  function fatal(e) {
    $app.innerHTML = `<section class="card center-card"><div class="big-icon">⚠️</div><h2>Gagal memuat</h2>
      <p class="muted">${T.esc(e.message)}</p><button class="btn-primary btn-wide" data-act="reload">Coba lagi</button></section>`;
  }

  function addFormHtml(id) {
    return `<form class="add-form" data-addform id="${id}">
      <input class="input" name="kode" placeholder="Tempel link pribadi atau kode" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Kode atau link pribadi">
      <p class="err" hidden></p>
      <button class="btn-primary" type="submit">Masuk</button></form>`;
  }

  function renderNoAccess(invalid) {
    D = null; renderBar();
    const saved = accounts();
    let demo = '';
    if (T.IS_DEMO) {
      const s = T.demo.sample(['Andre', 'Dimas', 'Clara', 'Agustina']);
      demo = `<section class="card demo-card"><p class="eyebrow">Khusus mode demo</p>
        <p class="small">Di web asli, bagian ini tidak ada. Coba buka link pribadi contoh, atau salin kodenya ke kotak di atas:</p>
        <div class="demo-links">${s.map(x => `<a class="btn-secondary" href="#${x.kode}">${T.esc(x.nama)}</a>`).join('')}</div>
        <p class="small mono-list">${s.map(x => `${T.esc(x.nama)}: <code>${x.kode}</code>`).join(' · ')}</p>
        <p class="small">Atau coba sisi admin:</p>
        <a class="btn-primary btn-wide" href="admin.html">Buka halaman admin (PIN 1234)</a></section>`;
    }
    $app.innerHTML = `<section class="card center-card">
        <div class="big-icon">🔒</div>
        <h2>${invalid ? 'Link sudah tidak berlaku' : 'Buka lewat link pribadi'}</h2>
        <p class="muted">${invalid
          ? 'Link ini sudah diganti atau salah ketik. Minta link pribadi yang baru ke admin grup.'
          : 'Halaman ini hanya bisa dibuka dengan link pribadi dari admin grup. Simpan link itu baik-baik dan jangan dibagikan ke orang lain ya.'}</p>
      </section>
      <section class="card">
        <h3>Punya kode pribadi?</h3>
        <p class="muted small">Tempel link pribadi dari admin, atau ketik kodenya saja.</p>
        ${addFormHtml('add-main')}
      </section>
      ${saved.length ? `<section class="card"><h3>Akun tersimpan di HP ini</h3><div class="saved-list">${saved.map(a => `
        <button class="acct-item" data-acct="${T.esc(a.kode)}">${avatar(a.nama)}<span class="acct-name">${T.esc(a.nama)}</span><span class="chev" aria-hidden="true">›</span></button>`).join('')}</div></section>` : ''}
      ${demo}`;
  }

  /* ============ tombol & menu akun (kanan atas) ============ */
  const AV_COLORS = ['#2d5a4c', '#7a4e2d', '#3d5a8a', '#7a3d5c', '#5a6b2d', '#2d6b73', '#8a5a1f', '#5c4a8a'];
  function avColor(nama) { let h = 0; for (const c of String(nama)) h = (h * 31 + c.codePointAt(0)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; }
  function initials(nama) {
    const p = String(nama || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  function avatar(nama, cls) {
    return `<span class="avatar ${cls || ''}" style="--av:${avColor(nama)}" aria-hidden="true">${T.esc(initials(nama))}</span>`;
  }

  function renderAcct() {
    const list = accounts();
    const nama = (D && D.me && D.me.nama) || namaOf(KODE);
    if (!KODE && !list.length) { $acct.hidden = true; return; }
    $acct.hidden = false;
    const syncing = $acct.classList.contains('is-syncing');
    $acct.innerHTML = KODE && nama
      ? `${avatar(nama)}${list.length > 1 ? `<span class="acct-count">${list.length}</span>` : ''}<span class="acct-chev" aria-hidden="true">▾</span>`
      : `<span class="avatar avatar-empty" aria-hidden="true">+</span><span class="acct-chev" aria-hidden="true">▾</span>`;
    $acct.classList.toggle('is-syncing', syncing);
    $acct.setAttribute('aria-label', (nama ? 'Akun: ' + nama + '. ' : '') + 'Buka menu akun');
    if (MENU) renderMenu();
  }

  function menuHtml() {
    const list = accounts();
    return `<p class="eyebrow menu-label">Akun di HP ini</p>
      ${list.length ? `<ul class="acct-list">${list.map(a => {
        const on = a.kode === KODE; const del = MENU_DEL === a.kode;
        return `<li class="acct-row">
          <button class="acct-item ${on ? 'on' : ''}" data-acct="${T.esc(a.kode)}" aria-current="${on}">
            ${avatar(a.nama)}<span class="acct-name">${T.esc(a.nama)}<span class="acct-sub">${on ? 'Sedang dibuka' : 'Ketuk untuk pindah'}</span></span>
            ${on ? '<span class="acct-check" aria-hidden="true">✓</span>' : ''}</button>
          <button class="acct-del ${del ? 'confirm' : ''}" data-del="${T.esc(a.kode)}" aria-label="Hapus ${T.esc(a.nama)} dari HP ini">${del ? 'Hapus?' : '×'}</button>
        </li>`;
      }).join('')}</ul>` : '<p class="muted small menu-empty">Belum ada akun tersimpan.</p>'}
      <div class="menu-sep"></div>
      ${MENU_ADD
        ? `<div class="menu-add"><p class="small"><b>Tambah akun</b>: tempel link pribadi atau ketik kodenya.</p>${addFormHtml('add-menu')}
            <button class="link-btn" type="button" data-act="add-cancel">Batal</button></div>`
        : `<button class="menu-add-btn" data-act="add-open"><span class="plus" aria-hidden="true">+</span>Tambah akun</button>`}
      <p class="muted menu-note">Akun hanya tersimpan di HP ini. Hapus dari daftar tidak menghapus data bacaan.
        <span class="ver">Versi ${APP_VERSI}</span></p>`;
  }

  /** Atur posisi menu saja (dipanggil saat ukuran layar berubah, mis. keyboard HP muncul).
   *  PENTING: jangan gambar ulang isi menu di sini — itu menutup keyboard dan membuatnya berkedip. */
  function positionMenu() {
    if (!MENU) return;
    const r = $acct.getBoundingClientRect();
    MENU.panel.style.top = Math.round(r.bottom + 8) + 'px';
  }

  /** Gambar ulang isi menu. Isian kotak kode & fokusnya dipertahankan. */
  function renderMenu(opts) {
    if (!MENU) return;
    opts = opts || {};
    const oldInp = MENU.panel.querySelector('input');
    const keep = oldInp ? { value: oldInp.value, focused: document.activeElement === oldInp } : null;
    positionMenu();
    MENU.panel.innerHTML = menuHtml();
    const inp = MENU.panel.querySelector('input');
    if (!inp) return;
    if (keep) inp.value = keep.value;
    if (opts.focus || (keep && keep.focused)) inp.focus({ preventScroll: true });
  }

  function openMenu() {
    if (MENU) return closeMenu();
    const backdrop = document.createElement('div'); backdrop.className = 'menu-backdrop';
    const panel = document.createElement('div'); panel.className = 'acct-menu'; panel.setAttribute('role', 'menu');
    document.body.appendChild(backdrop); document.body.appendChild(panel);
    MENU = { backdrop, panel }; MENU_ADD = !accounts().length; MENU_DEL = null;
    backdrop.addEventListener('click', closeMenu);
    panel.addEventListener('click', onClick);
    panel.addEventListener('submit', onSubmit);
    $acct.setAttribute('aria-expanded', 'true');
    renderMenu({ focus: MENU_ADD });
  }
  function closeMenu() {
    if (!MENU) return;
    MENU.backdrop.remove(); MENU.panel.remove(); MENU = null; MENU_ADD = false; MENU_DEL = null;
    $acct.setAttribute('aria-expanded', 'false');
  }

  function deleteAccount(kode) {
    const nm = namaOf(kode);
    removeAccount(kode);
    MENU_DEL = null;
    T.toast(`${nm || 'Akun'} dihapus dari HP ini`);
    if (kode !== KODE) return renderMenu();
    T.store.del('tbf_kode');
    const rest = accounts();
    if (rest.length) return switchTo(rest[0].kode);
    closeMenu(); KODE = null; D = null;
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* abaikan */ }
    renderAcct(); renderNoAccess(false);
  }

  /* ============ halaman utama ============ */
  function lateDays(cur) { const a = []; for (let d = 1; d < cur; d++) if (!DONE.has(d)) a.push(d); return a; }

  function render() {
    if (!D) return;
    const cur = D.currentDay;
    if (!cur) {
      const f = D.schedule[0];
      $app.innerHTML = `<section class="card today"><p class="eyebrow">Shalom, ${T.esc(D.me.nama)} 👋</p>
        <h2 class="reading">${f ? T.esc(f.bacaan) : 'Belum ada jadwal'}</h2>
        <p class="note">${f ? 'Pembacaan dimulai ' + T.fmtTanggal(f.tanggal) + '.' : 'Admin belum membuat jadwal.'}</p></section>`;
      return renderBar();
    }
    if (!WA_SEL) WA_SEL = new Set([cur]);
    $app.innerHTML = todayCard(cur) + lateCard(cur) + progressCard(cur) + boardCard(cur) + installCard() + waCard(cur);
    syncWa();
    renderBar();
  }

  function todayCard(cur) {
    const r = BY[cur]; const isToday = r.tanggal === D.today; const done = DONE.has(cur); const saving = PENDING.has(cur);
    return `<section class="card today ${done ? 'is-done' : ''}">
      <p class="eyebrow">Shalom, ${T.esc(D.me.nama)} 👋</p>
      <p class="today-date">${isToday ? 'Bacaan hari ini' : 'Bacaan terakhir'} · ${T.fmtTanggal(r.tanggal)}</p>
      <h2 class="reading">${T.esc(r.bacaan)}</h2>
      ${!isToday ? '<p class="note">Hari ini tidak ada jadwal baca.</p>' : ''}
      ${done
        ? `<div class="done-state"><span class="done-mark" aria-hidden="true">${T.esc(D.settings.emojiSudah)}</span>
             <div><strong>${saving ? 'Menyimpan…' : 'Sudah dilaporkan'}</strong><span>Terima kasih, tetap tekun! 🙏</span></div></div>
           <div class="today-actions">
             <button class="link-btn" data-act="undo" data-day="${cur}" ${saving ? 'disabled' : ''}>Batalkan laporan</button>
             <button class="link-btn" data-act="go-wa">Kirim ke WA ↓</button></div>`
        : `<button class="btn-big btn-light" data-act="mark" data-day="${cur}" ${saving ? 'disabled' : ''}>
             <span class="tick" aria-hidden="true">✓</span> Sudah saya baca</button>`}
    </section>`;
  }

  function lateCard(cur) {
    const late = lateDays(cur);
    if (!late.length) return '';
    const shown = SHOW_ALL_LATE ? late : late.slice(0, LATE_LIMIT);
    const allPicked = late.every(d => PICK.has(d));
    return `<section class="card">
      <div class="card-head"><h3>Masih perlu dikejar <span class="pill warn">${late.length}</span></h3>
        <button class="chip-btn" data-act="pick-all">${allPicked ? 'Batal pilih' : 'Pilih semua'}</button></div>
      <p class="muted small">Ketuk bacaan yang sudah kamu kejar, lalu tekan Laporkan di bawah.</p>
      <ul class="check-list">${shown.map(d => `
        <li><button class="check ${PICK.has(d) ? 'on' : ''}" data-pick="${d}" aria-pressed="${PICK.has(d)}" ${PENDING.has(d) ? 'disabled' : ''}>
          <span class="box" aria-hidden="true"></span>
          <span class="cl-main">${T.esc(BY[d].bacaan)}</span>
          <span class="cl-sub">${T.fmtTanggal(BY[d].tanggal, { short: true })}</span>
        </button></li>`).join('')}</ul>
      ${late.length > shown.length ? `<button class="link-btn" data-act="show-all-late">Tampilkan semua (${late.length})</button>` : ''}
    </section>`;
  }

  function progressCard(cur) {
    const n = T.countDone(DONE, cur);
    const pct = Math.round((n / cur) * 100);
    const pasal = T.pasalDone(DONE, BY, cur);
    let d = DONE.has(cur) ? cur : cur - 1, streak = 0;
    while (d >= 1 && DONE.has(d)) { streak++; d--; }
    const from = Math.max(1, cur - 13);
    let cells = '';
    for (let x = from; x <= cur; x++) {
      const s = BY[x]; const ok = DONE.has(x);
      cells += `<div class="hcell ${ok ? 'ok' : ''} ${x === cur ? 'cur' : ''}" title="${T.esc(s.bacaan)}">
        <span class="hdate">${T.fmtShort(s.tanggal)}</span><span class="hdot">${ok ? '✓' : ''}</span></div>`;
    }
    return `<section class="card">
      <div class="card-head"><h3>Progres kamu</h3><span class="muted small">${n}/${cur} bacaan</span></div>
      <div class="stats-row">
        <div class="stat"><span class="stat-num">${pct}%</span><span class="stat-label">sesuai jadwal</span></div>
        <div class="stat"><span class="stat-num">${pasal}</span><span class="stat-label">pasal dibaca</span></div>
        <div class="stat"><span class="stat-num">${streak}</span><span class="stat-label">beruntun</span></div>
      </div>
      <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
      <p class="eyebrow mt">${cur - from + 1} bacaan terakhir</p>
      <div class="hgrid">${cells}</div>
    </section>`;
  }

  function boardCard(cur) {
    const b = D.board; const n = b.filter(x => !x.belum).length;
    const list = SHOW_BOARD ? `<ul class="board-list">${b.map(x => `
      <li class="${x.belum ? 'late' : 'ok'} ${x.nama === D.me.nama ? 'me' : ''}">
        <span>${T.esc(x.nama)}${x.nama === D.me.nama ? ' (kamu)' : ''}</span>
        <span class="b-status">${x.belum ? T.esc(BY[x.belum].singkat) : 'Sudah ' + T.esc(D.settings.emojiSudah)}</span></li>`).join('')}</ul>` : '';
    return `<section class="card">
      <button class="card-head toggle" data-act="board" aria-expanded="${SHOW_BOARD}">
        <h3>Teman-teman</h3><span class="muted small">${D._stale ? 'memperbarui…' : `${n}/${b.length} sudah ${T.esc(BY[cur].singkat)}`}</span>
        <span class="chev" aria-hidden="true">${SHOW_BOARD ? '▴' : '▾'}</span></button>${list}</section>`;
  }

  function installCard() {
    const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    if (standalone || T.store.get('tbf_tip_off')) return '';
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    return `<section class="card tip">
      <div class="tip-icon" aria-hidden="true">📲</div>
      <div><h3>Simpan di layar utama</h3>
        <p class="small muted">${ios
          ? 'Di Safari, tekan tombol <b>Bagikan</b> ⬆️ lalu pilih <b>Tambah ke Layar Utama</b>.'
          : 'Di Chrome, tekan menu <b>⋮</b> lalu pilih <b>Tambahkan ke layar utama</b>.'} Besok tinggal buka seperti aplikasi.</p>
        <button class="link-btn" data-act="tip-off">Oke, mengerti</button></div>
    </section>`;
  }

  /* ============ kirim ke grup WA (paling bawah) ============ */
  const WA_MARKS = ['✅', '✓'];
  function waMark() { const m = T.store.get('tbf_wa_mark'); return WA_MARKS.indexOf(m) >= 0 ? m : WA_MARKS[0]; }

  function waCard(cur) {
    const days = [];
    for (let d = cur; d >= Math.max(1, cur - WA_DAYS + 1); d--) days.push(d);
    const isDefault = WA_SEL.size === 1 && WA_SEL.has(cur);
    const more = WA_MORE ? `<div class="wa-more">
        <p class="small muted">Ketuk bacaan yang mau dikirim. Bacaan yang berurutan otomatis digabung.</p>
        <div class="wa-chips" role="group" aria-label="Pilih bacaan">${days.map(d => {
          const on = WA_SEL.has(d); const done = DONE.has(d);
          return `<button class="wa-chip ${on ? 'on' : ''}" data-wa="${d}" aria-pressed="${on}">
            <b>${T.esc(BY[d].bacaan)}</b>
            <small>${d === cur ? 'Terbaru' : T.fmtTanggal(BY[d].tanggal, { short: true })} · <span class="${done ? 'st-ok' : 'st-no'}">${done ? '✓ sudah' : 'belum ditandai'}</span></small></button>`;
        }).join('')}</div>
        <div class="wa-opts">
          <span class="small muted">Tanda:</span>
          <div class="seg seg-mini" role="group" aria-label="Tanda">${WA_MARKS.map(m =>
            `<button class="seg-btn ${waMark() === m ? 'on' : ''}" data-mark="${m}" aria-pressed="${waMark() === m}">${m}</button>`).join('')}</div>
          ${isDefault ? '' : '<button class="link-btn" data-act="wa-reset">Hanya hari ini</button>'}
        </div>
      </div>` : '';
    return `<section class="card wa-card" id="wa-card">
      <div class="card-head"><h3>Kirim ke grup WA</h3>
        <button class="chip-btn" data-act="wa-more" aria-expanded="${WA_MORE}">${WA_MORE ? 'Tutup ▴' : 'Pilih lain ▾'}</button></div>
      <pre class="wa-preview" id="wa-preview" aria-label="Pesan yang akan dikirim"></pre>
      ${more}
      <p class="small wa-warn" id="wa-warn" hidden></p>
      <div class="row-btns">
        <button class="btn-secondary" data-act="wa-copy">Salin</button>
        <a class="btn-wa" id="wa-send" href="#" target="${T.waTarget}" rel="noopener" data-act="wa-send">Kirim ke WA</a>
      </div>
    </section>`;
  }

  /** "Kejadian 29-30" → { kitab: 'Kejadian', a: 29, z: 30 } */
  function parseBacaan(s) {
    const m = String(s).match(/^(.*\S)\s+(\d+)(?:\s*-\s*(\d+))?$/);
    return m ? { kitab: m[1], a: +m[2], z: +(m[3] || m[2]) } : null;
  }

  /** Gabung bacaan yang pasalnya menyambung: Kej 29-30 + 31-32 + 33-34 → "Kejadian 29-34".
   *  Pasal yang tidak menyambung atau kitab berbeda → baris baru. */
  function waLines(days) {
    const groups = [];
    days.slice().sort((x, y) => x - y).forEach(d => {
      if (!BY[d]) return;
      const p = parseBacaan(BY[d].bacaan);
      const g = groups[groups.length - 1];
      if (!p) { groups.push({ raw: BY[d].bacaan }); return; }
      if (g && g.kitab === p.kitab) {
        const last = g.ranges[g.ranges.length - 1];
        if (p.a === last[1] + 1) last[1] = p.z; else g.ranges.push([p.a, p.z]);
      } else groups.push({ kitab: p.kitab, ranges: [[p.a, p.z]] });
    });
    // setiap rentang pasal yang tidak menyambung → baris sendiri
    const lines = [];
    groups.forEach(g => {
      if (g.raw) return lines.push(g.raw);
      g.ranges.forEach(r => lines.push(g.kitab + ' ' + (r[0] === r[1] ? r[0] : r[0] + '-' + r[1])));
    });
    return lines;
  }

  function waText() {
    const mark = waMark();
    return waLines(Array.from(WA_SEL)).map(l => l + ' ' + mark).join('\n');
  }

  function syncWa() {
    const pre = document.getElementById('wa-preview'); if (!pre) return;
    const text = waText();
    pre.textContent = text || 'Pilih bacaan dulu';
    pre.classList.toggle('empty', !text);
    const send = document.getElementById('wa-send');
    send.href = text ? T.waUrl(text) : '#';
    send.classList.toggle('disabled', !text);
    send.setAttribute('aria-disabled', String(!text));
    const notYet = Array.from(WA_SEL).filter(d => !DONE.has(d));
    const warn = document.getElementById('wa-warn');
    warn.hidden = !notYet.length;
    if (notYet.length) {
      warn.innerHTML = `${notYet.length === 1 ? 'Belum' : notYet.length + ' bacaan belum'} ditandai di aplikasi ·
        <button class="link-btn" data-act="wa-mark">Tandai sudah</button>`;
    }
  }

  /* ============ bilah aksi bawah (saat ada yang dicentang) ============ */
  function renderBar() {
    const n = PICK.size;
    $bar.classList.toggle('show', n > 0);
    document.body.classList.toggle('has-bar', n > 0);
    if (n) {
      $bar.innerHTML = `<div class="wrap actionbar-in">
        <button class="btn-ghost" data-act="clear-pick">Batal</button>
        <button class="btn-primary" data-act="mark-picked">Laporkan ${n} bacaan</button></div>`;
    }
  }

  function updateBoardSelf() {
    const e = D.board.find(x => x.nama === D.me.nama);
    if (e) { e.belum = T.firstUnread(DONE, D.currentDay); e.tertinggal = T.countUnread(DONE, D.currentDay); }
  }

  /* ============ kirim laporan (langsung tampil, simpan di belakang) ============ */
  async function lapor(days, status, isUndo) {
    days = days.filter(d => !PENDING.has(d));
    if (!days.length) return;
    const myKode = KODE;
    const before = new Set(DONE);
    days.forEach(d => { if (status) DONE.add(d); else DONE.delete(d); PENDING.add(d); PICK.delete(d); });
    updateBoardSelf(); render();
    if (status) T.haptic(15);
    try {
      const r = await T.apiPost({ action: 'lapor', k: myKode, hari: days, status });
      if (myKode !== KODE) return;             // sudah pindah akun; laporan tetap tersimpan di server
      days.forEach(d => PENDING.delete(d));
      if (!PENDING.size && r.done) DONE = new Set(r.done);
      updateBoardSelf(); render(); saveCache();
      if (isUndo) T.toast('Sudah diurungkan');
      else T.toast(status ? (days.length > 1 ? `${days.length} bacaan dilaporkan 🎉` : 'Laporan tersimpan 🎉') : 'Laporan dibatalkan',
        { action: 'Urungkan', onAction: () => lapor(days, !status, true) });
    } catch (e) {
      if (myKode !== KODE) return T.toast('Laporan akun sebelumnya gagal disimpan. Buka lagi akun itu lalu coba lagi.', { ms: 5000 });
      days.forEach(d => { PENDING.delete(d); if (before.has(d)) DONE.add(d); else DONE.delete(d); });
      updateBoardSelf(); render();
      if (e.message === 'LINK_TIDAK_VALID') return handleInvalid();
      T.toast('Gagal menyimpan. Cek internet lalu coba lagi.', { ms: 5000 });
    }
  }

  /* ============ event ============ */
  async function onClick(e) {
    const ac = e.target.closest('[data-acct]');
    if (ac) return switchTo(ac.dataset.acct);
    const dl = e.target.closest('[data-del]');
    if (dl) {
      if (MENU_DEL === dl.dataset.del) return deleteAccount(dl.dataset.del);
      MENU_DEL = dl.dataset.del; return renderMenu();
    }
    const pk = e.target.closest('[data-pick]');
    if (pk) {
      const d = +pk.dataset.pick;
      if (PICK.has(d)) PICK.delete(d); else PICK.add(d);
      T.haptic(8);
      return render();
    }
    const wc = e.target.closest('[data-wa]');
    if (wc) {
      const d = +wc.dataset.wa;
      if (WA_SEL.has(d)) WA_SEL.delete(d); else WA_SEL.add(d);
      T.haptic(6);
      return rerenderWa();
    }
    const mk = e.target.closest('[data-mark]');
    if (mk) { T.store.set('tbf_wa_mark', mk.dataset.mark); return rerenderWa(); }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    switch (a.dataset.act) {
      case 'mark': return lapor([+a.dataset.day], true);
      case 'undo': return lapor([+a.dataset.day], false);
      case 'mark-picked': return lapor(Array.from(PICK).sort((x, y) => x - y), true);
      case 'clear-pick': PICK.clear(); return render();
      case 'pick-all': {
        const late = lateDays(D.currentDay);
        PICK = late.every(d => PICK.has(d)) ? new Set() : new Set(late);
        return render();
      }
      case 'show-all-late': SHOW_ALL_LATE = true; return render();
      case 'board': SHOW_BOARD = !SHOW_BOARD; return render();
      case 'tip-off': T.store.set('tbf_tip_off', '1'); return render();
      case 'reload': return boot();
      case 'go-wa': { const c = document.getElementById('wa-card'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      case 'wa-copy': {
        const t = waText(); if (!t) return T.toast('Pilih bacaan dulu');
        return T.toast((await T.copyText(t)) ? 'Teks disalin, tinggal tempel di grup' : 'Gagal menyalin');
      }
      case 'wa-send': if (!waText()) { e.preventDefault(); T.toast('Pilih bacaan dulu'); } return;
      case 'wa-mark': return lapor(Array.from(WA_SEL).filter(d => !DONE.has(d)), true);
      case 'wa-more': WA_MORE = !WA_MORE; return rerenderWa();
      case 'wa-reset': WA_SEL = new Set([D.currentDay]); return rerenderWa();
      case 'add-open': MENU_ADD = true; MENU_DEL = null; return renderMenu({ focus: true });
      case 'add-cancel': MENU_ADD = false; return renderMenu();
    }
  }
  /** gambar ulang kartu WA saja (posisi gulir tetap) */
  function rerenderWa() {
    const old = document.getElementById('wa-card'); if (!old || !D) return;
    const tmp = document.createElement('div'); tmp.innerHTML = waCard(D.currentDay);
    old.replaceWith(tmp.firstElementChild);
    syncWa();
  }

  function onSubmit(e) {
    const f = e.target.closest('[data-addform]');
    if (!f) return;
    e.preventDefault();
    addAccount(f.querySelector('input').value, f.querySelector('.err'), f.querySelector('button[type=submit]'));
  }
  $app.addEventListener('click', onClick);
  $app.addEventListener('submit', onSubmit);
  $bar.addEventListener('click', onClick);
  $acct.addEventListener('click', openMenu);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', positionMenu);
  window.addEventListener('hashchange', () => { closeMenu(); boot(); });
  // kembali ke aplikasi setelah lama ditinggal → ambil data terbaru
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && D && !PENDING.size && Date.now() - LOADED_AT > 3 * 60 * 1000) boot();
  });

  boot();
})();
