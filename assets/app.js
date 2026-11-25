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
  const APP_VERSI = '6.3';
  const RN_FONTS = [15, 16, 17, 18, 20, 22, 24];   // ukuran huruf layar baca
  const RN_KEEP = 40;                               // renungan yang disimpan di HP

  let KODE = null, D = null, BY = {}, DONE = new Set(), PICK = new Set(), PENDING = new Set();
  let SHOW_BOARD = false, SHOW_ALL_LATE = false, LOADED_AT = 0, LAST_JSON = '';
  let WA_SEL = null;                         // bacaan yang dipilih untuk dikirim ke WA
  let WA_MORE = false;                       // panel "Pilih lain" terbuka?
  let MENU = null, MENU_ADD = false, MENU_DEL = null, ADDING = false;
  let RN_MEM = {};                           // renungan yang sudah dimuat: hari → { hari, teks, v }
  let READER = null;                         // layar baca renungan yang sedang terbuka
  let MARKED_AT = 0, MARKED_DAY = 0;         // kapan tombol "Sudah saya baca" ditekan (untuk animasi pita)
  let SHOW_TIP = false;                      // petunjuk pasang di layar utama dibuka?
  /* animasi: hanya bagian yang baru berubah yang bergerak, sekali saja */
  const FX = new Set();                      // kunci animasi untuk gambar berikutnya
  const fx = (k, cls) => (FX.has(k) ? ' ' + (cls || 'fx-reveal') : '');
  const CALM = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let INTRO = true;                          // kartu muncul berurutan saat halaman pertama dibuka
  const RING_PREV = {};                      // nilai cincin sebelumnya (per kitab) → cincin bergerak dari situ

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
    if (KODE !== tok.kode && READER) rnClose();
    if (KODE !== tok.kode) { D = null; PICK.clear(); PENDING.clear(); WA_SEL = null; WA_MORE = false; SHOW_ALL_LATE = false; LAST_JSON = ''; }
    const myKode = KODE = tok.kode;
    const CKEY = 'tbf_c_' + KODE;
    renderAcct();

    // data sudah diambil (mis. saat menambah akun) → langsung pakai
    if (opts.data) {
      T.expandSch(opts.data);
      T.store.set('tbf_kode', KODE);
      upsertAccount(KODE, opts.data.me.nama);
      LAST_JSON = JSON.stringify(opts.data); LOADED_AT = Date.now();
      apply(opts.data); saveCache(); renderAcct();
      return;
    }
    // 1) tampilkan data terakhir yang tersimpan di HP → langsung muncul tanpa menunggu
    if (!D) {
      const cached = T.cacheGet(CKEY);
      if (cached) { LAST_JSON = JSON.stringify(cached); apply(advanceDay(T.expandSch(cached))); } else $app.innerHTML = '<div class="loading">Memuat…</div>';
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
      if (D) { D._rnFail = true; render(); return T.toast('Belum bisa terhubung. Menampilkan data terakhir.', { ms: 4000 }); }
      return fatal(e);
    }
    if (myKode !== KODE) return;              // sudah pindah akun
    T.expandSch(fresh);
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
      out.renungan = null;                    // renungan hari ini diambil dari server
    }
    return out;
  }

  function apply(data) {
    D = data;
    BY = T.indexSchedule(D.schedule);
    if (D.renungan) rnRemember(D.renungan);
    DONE = new Set(D.done);
    PICK.forEach(d => { if (DONE.has(d)) PICK.delete(d); });
    if (D.me && KODE) upsertAccount(KODE, D.me.nama);
    document.getElementById('hello').textContent = 'Shalom, ' + D.me.nama;
    const gn = document.getElementById('group-name'); gn.textContent = D.settings.namaKelompok; gn.hidden = false;
    document.title = D.me.nama + ' · ' + D.settings.namaKelompok;
    render();
    renderAcct();
    if (READER) rnRender();
  }

  function saveCache() {
    if (!D || !KODE) return;
    const snap = Object.assign({}, D, { ok: true, done: Array.from(DONE).sort((a, b) => a - b), _rnFail: undefined });
    if (snap.sch) delete snap.schedule;      // simpan versi ringkas saja (hemat ruang HP)
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

  const BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const fmtPanjang = ymd => { const p = ymd.split('-').map(Number); return T.dayName(ymd) + ', ' + p[2] + ' ' + BULAN_PANJANG[p[1] - 1]; };
  const dash = t => T.esc(t).replace(/(\d)-(\d)/g, '$1–$2');
  const SVG = {
    check: (s, w) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w || 2.6}" stroke-linecap="round" stroke-linejoin="round"><path d="m6 12.5 4 4 8-9"/></svg>`,
    circleCheck: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="m7.8 12.3 2.8 2.8 5.6-6"/></svg>',
    down: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    right: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
    chev: '<svg aria-hidden="true" class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    book: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5zM12 6v13"/></svg>',
    phone: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M12 8v6M9 11h6"/></svg>',
    x: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  };

  function render() {
    if (!D) return;
    const cur = D.currentDay;
    if (!cur) {
      const f = D.schedule[0];
      $app.innerHTML = `<section class="card hero"><span class="pita" aria-hidden="true"></span>
        <p class="hero-lbl">Pembacaan belum dimulai</p>
        <h2 class="hero-read">${f ? dash(f.bacaan) : 'Belum ada jadwal'}</h2>
        <p class="hero-date">${f ? 'Mulai ' + fmtPanjang(f.tanggal) : 'Admin belum membuat jadwal.'}</p></section>`;
      return renderBar();
    }
    if (!WA_SEL) WA_SEL = new Set([cur]);
    $app.innerHTML = todayCard(cur) + rnCard(cur) + lateCard(cur) + journeyCard(cur) + boardCard(cur) + installCard() + waCard(cur);
    if (INTRO && !D._stale) {
      INTRO = false;
      if (!CALM()) { $app.classList.add('fx-intro'); setTimeout(() => $app.classList.remove('fx-intro'), 900); }
    }
    FX.clear();
    syncWa();
    animateRings();
    renderBar();
  }

  /* --- 1. kartu hijau: bacaan hari ini + pita merah --- */
  const PITA_MS = 1100;
  function todayCard(cur) {
    const r = BY[cur]; const isToday = r.tanggal === D.today; const done = DONE.has(cur); const saving = PENDING.has(cur);
    // animasi pita hanya sesaat setelah tombol ditekan; kalau kartu digambar ulang di tengah animasi, animasinya dilanjutkan
    const since = Date.now() - MARKED_AT;
    const anim = done && MARKED_DAY === cur && since < PITA_MS;
    const animStyle = anim ? ` style="animation-delay:-${since}ms"` : '';
    return `<section class="card hero ${done ? 'is-done' : ''}" aria-labelledby="h-today">
      <span class="pita ${done ? 'on' : ''} ${anim ? 'anim' : ''}${fx('unmark', 'fx-up')}"${animStyle} aria-hidden="true">${SVG.check(14, 3.2)}</span>
      <p class="hero-lbl">${isToday ? 'Bacaan hari ini' : 'Bacaan terakhir'}</p>
      <h2 class="hero-read" id="h-today">${dash(r.bacaan)}</h2>
      <p class="hero-date">${fmtPanjang(r.tanggal)}</p>
      ${!isToday ? '<p class="hero-note">Hari ini tidak ada jadwal baca.</p>' : ''}
      ${done
        ? `<div class="hero-done ${anim ? 'anim' : ''}"${animStyle} role="status">
             <span class="hero-ok">${SVG.check(22)}</span>
             <span><b>${saving ? 'Menyimpan…' : 'Sudah dilaporkan'}</b><span>Terima kasih, tetap tekun!</span></span></div>
           <div class="hero-links ${anim ? 'anim' : ''}"${animStyle}>
             <button class="hero-link" data-act="undo" data-day="${cur}" ${saving ? 'disabled' : ''}>Batalkan laporan</button>
             <button class="hero-link strong" data-act="go-wa">Kirim ke WA ${SVG.down}</button></div>`
        : `<button class="hero-btn${fx('unmark')}" data-act="mark" data-day="${cur}" ${saving ? 'disabled' : ''}>${SVG.circleCheck} Sudah saya baca</button>`}
    </section>`;
  }

  /* --- 3. tertinggal: satu kolom, selalu terbuka, tombol Laporkan di dalam kartu --- */
  function lateCard(cur) {
    const late = lateDays(cur);
    if (!late.length) return '';
    const shown = SHOW_ALL_LATE ? late : late.slice(0, LATE_LIMIT);
    const allPicked = late.every(d => PICK.has(d));
    const n = late.filter(d => PICK.has(d)).length;
    return `<section class="card" aria-labelledby="h-late">
      <div class="card-top"><div>
          <h3 class="card-title" id="h-late">Tertinggal ${late.length} bacaan</h3>
          <p class="card-sub">Centang yang sudah kamu baca, lalu tekan Laporkan.</p></div>
        <button class="text-btn" data-act="pick-all">${allPicked ? 'Batal pilih' : 'Pilih semua'}</button></div>
      <ul class="late-list">${shown.map(d => `
        <li data-late="${d}"><button class="late-row ${PICK.has(d) ? 'on' : ''}${fx('pick:' + d, 'fx-pop')}" data-pick="${d}" aria-pressed="${PICK.has(d)}" ${PENDING.has(d) ? 'disabled' : ''}>
          <span class="box" aria-hidden="true">${SVG.check(16, 3)}</span>
          <span class="lr-main">${dash(BY[d].bacaan)}</span>
          <span class="lr-sub">${T.fmtTanggal(BY[d].tanggal, { short: true })}</span>
        </button></li>`).join('')}</ul>
      ${late.length > shown.length ? `<button class="text-btn mt-s" data-act="show-all-late">Tampilkan semua (${late.length})</button>` : ''}
      <button class="btn-primary btn-wide late-go${fx('pickcount', 'fx-bump')}" data-act="mark-picked" ${n ? '' : 'disabled'}>${n ? `Laporkan ${n} bacaan` : 'Centang dulu bacaannya'}</button>
    </section>`;
  }

  /* --- 4. perjalanan: cincin per kitab --- */
  function ring(read, late, total, key) {
    const S = 80, R = 36, C = 2 * Math.PI * R;
    const arcs = (r, l) => {
      const rd = C * Math.min(r, total) / total, lt = C * Math.min(l, total - r) / total;
      return { read: `${Math.max(rd - 1, 0).toFixed(1)} ${C.toFixed(1)}`, late: `${lt.toFixed(1)} ${C.toFixed(1)}`, off: (-rd).toFixed(1) };
    };
    const now = arcs(read, late);
    // pertama kali: mulai dari kosong; berikutnya: dari nilai sebelumnya → hanya yang berubah yang bergerak
    const prev = RING_PREV[key] || { read: 0, late: 0 };
    RING_PREV[key] = { read, late };
    const was = arcs(prev.read, prev.late);
    const moving = !CALM() && (prev.read !== read || prev.late !== late);
    const from = moving ? was : now;
    const dt = (a, b) => (moving ? ` data-to="${a}"` : '') + (b !== undefined && moving ? ` data-to-off="${b}"` : '');
    return `<span class="ring" aria-hidden="true"><svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
        <circle class="ring-track" cx="40" cy="40" r="${R}"/>
        <circle class="ring-late" cx="40" cy="40" r="${R}" style="stroke-dasharray:${from.late};stroke-dashoffset:${from.off}"${dt(now.late, now.off)}/>
        <circle class="ring-read" cx="40" cy="40" r="${R}" style="stroke-dasharray:${from.read}"${dt(now.read)}/>
      </svg><span class="ring-mid"><b${moving ? ` data-count="${prev.read}" data-count-to="${read}"` : ''}>${moving ? prev.read : read}</b><small>dari ${total}</small></span></span>`;
  }
  /** jalankan gerak cincin & angka setelah kartu digambar */
  function animateRings() {
    const els = $app.querySelectorAll('[data-to]');
    const nums = $app.querySelectorAll('[data-count-to]');
    if (!els.length && !nums.length) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      els.forEach(c => {
        c.style.strokeDasharray = c.dataset.to;
        if (c.dataset.toOff) c.style.strokeDashoffset = c.dataset.toOff;
      });
      nums.forEach(b => {
        const a = +b.dataset.count, z = +b.dataset.countTo, t0 = performance.now(), dur = 700;
        const step = t => {
          const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
          b.textContent = Math.round(a + (z - a) * e);
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }));
  }
  function journeyCard(cur) {
    const K = T.KITAB, idx = {};
    K.forEach((k, i) => { idx[k[0].toLowerCase()] = i; });
    const read = {}, late = {}, todayBooks = [];
    for (let h = 1; h <= cur; h++) {
      const segs = BY[h] && parseBacaan(BY[h].bacaan); if (!segs) continue;
      segs.forEach(p => {
        const b = idx[p.kitab.toLowerCase()]; if (b === undefined) return;
        const n = p.z - p.a + 1;
        if (DONE.has(h)) read[b] = (read[b] || 0) + n;
        else if (h < cur) late[b] = (late[b] || 0) + n;
        if (h === cur && todayBooks.indexOf(b) < 0) todayBooks.push(b);
      });
    }
    const lateBooks = Object.keys(late).map(Number).sort((a, b) => a - b);
    let show = Array.from(new Set(lateBooks.concat(todayBooks))).sort((a, b) => a - b);
    let hidden = 0;
    if (show.length > 3) {   // terlalu banyak: kitab tertinggal paling awal + kitab hari ini
      const keep = Array.from(new Set([lateBooks[0]].concat(todayBooks))).sort((a, b) => a - b);
      hidden = show.length - keep.length; show = keep;
    }
    const rows = show.map(b => {
      const tot = K[b][2], r = read[b] || 0, l = late[b] || 0;
      const pill = l ? `<span class="pill-late">Tertinggal ${l} pasal</span>` : '<span class="pill-ok">Tepat waktu</span>';
      return `<div class="jrow" role="img" aria-label="${T.esc(K[b][0])}: ${r} dari ${tot} pasal sudah dibaca${l ? ', tertinggal ' + l + ' pasal' : ''}">
        ${ring(r, l, tot, b)}
        <div><div class="j-name">${T.esc(K[b][0])}</div><div class="j-sub">pasal sudah dibaca</div>${pill}</div></div>`;
    }).join('');
    // kitab yang sudah selesai: satu baris ringkas
    const fin = K.map((k, i) => i).filter(i => (read[i] || 0) >= K[i][2]);
    let finTxt = '';
    if (fin.length) {
      const nt = fin.filter(i => i >= 39).length, otAll = fin.filter(i => i < 39).length === 39;
      const contiguous = fin.every((v, i) => v === fin[0] + i);
      if (fin.length === 66) finTxt = 'Seluruh Alkitab selesai!';
      else if (otAll) finTxt = 'Perjanjian Lama selesai' + (nt ? `, dan ${nt} kitab Perjanjian Baru` : ' (39 kitab)');
      else if (fin.length <= 2) finTxt = 'Kitab selesai: ' + fin.map(i => K[i][0]).join(', ');
      else finTxt = `${fin.length} kitab selesai` + (contiguous ? `, ${K[fin[0]][0]} sampai ${K[fin[fin.length - 1]][0]}` : '');
    }
    const fu = T.firstUnread(DONE, cur - 1);
    const fs = fu && BY[fu] ? parseBacaan(BY[fu].bacaan) : null;
    const n = T.countDone(DONE, cur);
    return `<section class="card" aria-labelledby="h-jalan">
      <div class="card-top"><h3 class="card-title" id="h-jalan">Perjalananmu</h3><span class="card-meta">${n} dari ${cur} bacaan</span></div>
      <div class="jlist">${rows}</div>
      ${hidden ? `<p class="j-more">+${hidden} kitab lain juga tertinggal</p>` : ''}
      ${fs ? `<p class="j-foot">Mulai lagi dari <b>${T.esc(fs[0].kitab)} ${fs[0].a}</b>.</p>` : ''}
      ${finTxt ? `<p class="j-fin">${SVG.check(18)}${T.esc(finTxt)}</p>` : ''}
    </section>`;
  }

  /* --- 5. teman-teman --- */
  function boardCard(cur) {
    const b = D.board; const sudah = b.filter(x => !x.belum); const n = sudah.length;
    const faces = sudah.slice(0, 3).map(x => avatar(x.nama, 'av-sm')).join('') + (n > 3 ? `<span class="avatar av-sm av-more" aria-hidden="true">+${n - 3}</span>` : '');
    const list = SHOW_BOARD ? `<ul class="board-list${fx('board')}">${b.map(x => `
      <li class="${x.belum ? 'late' : 'ok'} ${x.nama === D.me.nama ? 'me' : ''}">
        <span>${T.esc(x.nama)}${x.nama === D.me.nama ? ' (kamu)' : ''}</span>
        <span class="b-status">${x.belum ? T.esc(BY[x.belum].singkat) : 'Sudah ' + T.esc(D.settings.emojiSudah)}</span></li>`).join('')}</ul>` : '';
    return `<section class="card board-card">
      <button class="board-sum" data-act="board" aria-expanded="${SHOW_BOARD}">
        <span class="faces">${faces}</span>
        <span class="board-txt">${D._stale ? 'Memperbarui…' : `<b>${n} dari ${b.length}</b> sudah baca sampai hari ini`}</span>
        ${SVG.chev}</button>${list}</section>`;
  }

  /* --- 6. saran pasang di layar utama --- */
  function installCard() {
    const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    if (standalone || T.store.get('tbf_tip_off')) return '';
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    return `<section class="tip-bar">
      <div class="tip-row">${SVG.phone}
        <span class="tip-txt">Pasang di layar utama HP. <button class="text-btn inline" data-act="tip-how" aria-expanded="${SHOW_TIP}">Caranya</button></span>
        <button class="tip-x" data-act="tip-off" aria-label="Tutup saran">${SVG.x}</button></div>
      ${SHOW_TIP ? `<p class="tip-how${fx('tip')}">${ios
        ? 'Di Safari, tekan tombol <b>Bagikan</b> lalu pilih <b>Tambah ke Layar Utama</b>.'
        : 'Di Chrome, tekan menu <b>⋮</b> lalu pilih <b>Tambahkan ke layar utama</b>.'} Besok tinggal buka seperti aplikasi.</p>` : ''}
    </section>`;
  }

  /* ============ renungan harian ============ */
  function rnIdx() { const m = {}; ((D && D.rnIdx) || []).forEach(x => { m[x[0]] = x[1]; }); return m; }
  function rnDays() { return ((D && D.rnIdx) || []).map(x => x[0]).sort((a, b) => a - b); }

  function rnRemember(rec) {
    if (!rec || !rec.hari) return;
    RN_MEM[rec.hari] = rec;
    T.cacheSet('tbf_rn_' + rec.hari, rec);
    // simpan maksimal RN_KEEP renungan terakhir di HP
    let list = [];
    try { list = JSON.parse(T.store.get('tbf_rn_list') || '[]'); } catch (e) { list = []; }
    list = list.filter(h => h !== rec.hari); list.push(rec.hari);
    while (list.length > RN_KEEP) T.cacheDel('tbf_rn_' + list.shift());
    T.store.set('tbf_rn_list', JSON.stringify(list));
  }

  /** Renungan yang sudah ada di HP & masih versi terbaru (kalau diedit pendeta, versinya berubah) */
  function rnCached(h) {
    const v = rnIdx()[h];
    if (!v) return null;
    if (RN_MEM[h] && RN_MEM[h].v === v) return RN_MEM[h];
    const c = T.cacheGet('tbf_rn_' + h);
    if (c && c.v === v) { RN_MEM[h] = c; return c; }
    return null;
  }

  async function rnFetch(haris) {
    const need = haris.filter(h => rnIdx()[h] && !rnCached(h));
    if (!need.length) return;
    const myKode = KODE;
    const r = await T.apiGet({ action: 'renungan', k: myKode, hari: need.slice(0, 3).join(',') });
    if (myKode !== KODE) return;
    Object.keys(r.items || {}).forEach(h => { if (r.items[h]) rnRemember(r.items[h]); });
  }

  function rnNeighbors(h) {
    const days = rnDays(); const i = days.indexOf(h);
    if (i >= 0) return { prev: days[i - 1] || null, next: days[i + 1] || null };
    return { prev: days.filter(d => d < h).pop() || null, next: days.find(d => d > h) || null };
  }

  function rnCard(cur) {
    const rec = D.renungan && D.renungan.hari === cur ? D.renungan : null;
    const head = `<p class="rn-lbl">${SVG.book}Renungan hari ini</p>`;
    if (rec) {
      const pv = T.rn.preview(rec.teks, 150);
      return `<section class="card rn-card" data-act="rn-open" data-h="${cur}" role="button" tabindex="0" aria-label="Baca renungan hari ini">
        ${head}${pv ? `<p class="rn-prev">${T.esc(pv)}</p>` : ''}
        <span class="rn-more">Baca renungan ${SVG.right}</span></section>`;
    }
    if (D._stale && !D._rnFail) {
      return `<section class="card rn-card">${head}<p class="card-sub rn-wait">Memuat renungan…</p>
        <div class="sk-line"></div><div class="sk-line short"></div></section>`;
    }
    const prevH = rnDays().filter(h => h < cur).pop();
    return `<section class="card rn-card rn-empty">${head}<p class="card-sub">Renungan hari ini belum tersedia.</p>
      ${prevH ? `<button class="text-btn" data-act="rn-open" data-h="${prevH}">Baca renungan ${prevH === cur - 1 ? 'kemarin' : 'sebelumnya'} ›</button>` : ''}</section>`;
  }

  /* ---- layar baca (layar penuh) ---- */
  function rnFont() { const f = +T.store.get('tbf_rn_font'); return RN_FONTS.indexOf(f) >= 0 ? f : 17; }

  function rnOpen(h) {
    if (!READER) {
      const el = document.createElement('div');
      el.className = 'reader'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
      document.body.appendChild(el); document.body.classList.add('no-scroll');
      el.addEventListener('click', onReaderClick);
      READER = { el, h, list: false, err: null, pushed: false };
      try { history.pushState({ tbfReader: 1 }, ''); READER.pushed = true; } catch (e) { /* abaikan */ }
    }
    READER.h = h; READER.list = false; READER.err = null;
    rnRender();
    rnLoad(h);
  }

  function rnClose(fromPop) {
    if (!READER) return;
    const pushed = READER.pushed;
    const el = READER.el; READER = null;
    document.body.classList.remove('no-scroll');
    if (CALM()) el.remove();
    else { el.classList.add('closing'); el.addEventListener('animationend', () => el.remove(), { once: true }); setTimeout(() => el.remove(), 400); }
    if (pushed && !fromPop) { try { history.back(); } catch (e) { /* abaikan */ } }
  }

  async function rnLoad(h) {
    const nb = rnNeighbors(h);
    if (!rnCached(h)) {
      try { await rnFetch([h, nb.prev].filter(Boolean)); }
      catch (e) { if (READER && READER.h === h) { READER.err = e.message; rnRender(); } return; }
      if (READER && READER.h === h) rnRender();
    }
    // ambil renungan sebelumnya diam-diam → tombol ‹ terasa instan
    const pp = nb.prev ? rnNeighbors(nb.prev).prev : null;
    rnFetch([nb.prev, pp].filter(Boolean)).catch(() => {});
  }

  function rnRender() {
    if (!READER) return;
    const h = READER.h; const s = BY[h] || {}; const rec = rnCached(h) || (D.renungan && D.renungan.hari === h ? D.renungan : null);
    const nb = rnNeighbors(h); const f = rnFont();
    let body;
    if (READER.list) {
      const days = rnDays().slice().reverse();
      body = `<div class="rn-list"><p class="eyebrow">Semua renungan (${days.length})</p>${days.map(d => `
        <button class="rn-li ${d === h ? 'on' : ''}" data-r="go" data-h="${d}">
          <span class="rn-li-date">${BY[d] ? T.fmtTanggal(BY[d].tanggal, { short: true }) : 'Hari ke-' + d}</span>
          <span class="rn-li-read">${BY[d] ? T.esc(BY[d].bacaan) : ''}</span></button>`).join('')}</div>`;
    } else if (rec) {
      body = `<article class="rn" style="--rn-size:${f}px">${T.rn.format(rec.teks)}</article>`;
    } else if (READER.err) {
      body = `<div class="rn-msg"><p>Belum bisa memuat renungan. Cek internet lalu coba lagi.</p>
        <button class="btn-primary" data-r="retry">Coba lagi</button></div>`;
    } else {
      body = `<div class="rn-skel"><div class="sk-line"></div><div class="sk-line"></div><div class="sk-line short"></div>
        <div class="sk-line"></div><div class="sk-line"></div><div class="sk-line short"></div></div>`;
    }
    READER.el.innerHTML = `
      <header class="reader-top">
        <button class="icon-btn ghost" data-r="close" aria-label="Tutup">×</button>
        <button class="reader-title" data-r="list" aria-expanded="${READER.list}">
          <span class="rt-date">${s.tanggal ? T.fmtTanggal(s.tanggal) : ''}</span>
          <b>${T.esc(s.bacaan || 'Renungan')} <span class="rt-chev" aria-hidden="true">${READER.list ? '▴' : '▾'}</span></b></button>
        <div class="reader-font" role="group" aria-label="Ukuran huruf">
          <button data-r="smaller" aria-label="Perkecil huruf" ${f <= RN_FONTS[0] ? 'disabled' : ''}>A−</button>
          <button data-r="bigger" aria-label="Perbesar huruf" ${f >= RN_FONTS[RN_FONTS.length - 1] ? 'disabled' : ''}>A+</button></div>
      </header>
      <div class="reader-body">${body}</div>
      <footer class="reader-bottom">
        <button data-r="go" data-h="${nb.prev || ''}" ${nb.prev ? '' : 'disabled'}>‹ Sebelumnya</button>
        <button data-r="copy" ${rec ? '' : 'disabled'}>Salin</button>
        <button data-r="go" data-h="${nb.next || ''}" ${nb.next ? '' : 'disabled'}>Berikutnya ›</button>
      </footer>`;
  }

  async function onReaderClick(e) {
    const b = e.target.closest('[data-r]'); if (!b || !READER) return;
    switch (b.dataset.r) {
      case 'close': return rnClose();
      case 'list': READER.list = !READER.list; return rnRender();
      case 'go': {
        const h = +b.dataset.h; if (!h) return;
        READER.h = h; READER.list = false; READER.err = null;
        rnRender(); READER.el.querySelector('.reader-body').scrollTop = 0;
        return rnLoad(h);
      }
      case 'retry': READER.err = null; rnRender(); return rnLoad(READER.h);
      case 'smaller': case 'bigger': {
        const i = RN_FONTS.indexOf(rnFont()) + (b.dataset.r === 'bigger' ? 1 : -1);
        T.store.set('tbf_rn_font', String(RN_FONTS[Math.max(0, Math.min(RN_FONTS.length - 1, i))]));
        const art = READER.el.querySelector('.rn'); if (art) art.style.setProperty('--rn-size', rnFont() + 'px');
        READER.el.querySelector('[data-r=smaller]').disabled = rnFont() <= RN_FONTS[0];
        READER.el.querySelector('[data-r=bigger]').disabled = rnFont() >= RN_FONTS[RN_FONTS.length - 1];
        return;
      }
      case 'copy': {
        const rec = rnCached(READER.h); if (!rec) return;
        return T.toast((await T.copyText(rec.teks)) ? 'Renungan disalin' : 'Gagal menyalin');
      }
    }
  }

  /* ============ kirim ke grup WA (paling bawah) ============ */
  const WA_MARKS = ['✅', '✓'];
  function waMark() { const m = T.store.get('tbf_wa_mark'); return WA_MARKS.indexOf(m) >= 0 ? m : WA_MARKS[0]; }

  function waCard(cur) {
    const days = [];
    for (let d = cur; d >= Math.max(1, cur - WA_DAYS + 1); d--) days.push(d);
    const isDefault = WA_SEL.size === 1 && WA_SEL.has(cur);
    const more = WA_MORE ? `<div class="wa-more${fx('wa-more')}">
        <p class="card-sub">Centang bacaan yang mau dikirim. Bacaan yang berurutan otomatis digabung.</p>
        <ul class="late-list">${days.map(d => {
          const on = WA_SEL.has(d); const done = DONE.has(d);
          return `<li><button class="late-row ${on ? 'on' : ''}${fx('wa:' + d, 'fx-pop')}" data-wa="${d}" aria-pressed="${on}">
            <span class="box" aria-hidden="true">${SVG.check(16, 3)}</span>
            <span class="lr-main">${dash(BY[d].bacaan)}<small class="${done ? 'st-ok' : 'st-no'}">${d === cur ? 'Hari ini, ' : T.fmtTanggal(BY[d].tanggal, { short: true }) + ', '}${done ? 'sudah ditandai' : 'belum ditandai'}</small></span>
          </button></li>`;
        }).join('')}</ul>
        <div class="wa-opts">
          <span class="card-sub">Tanda:</span>
          <div class="seg seg-mini" role="group" aria-label="Tanda">${WA_MARKS.map(m =>
            `<button class="seg-btn ${waMark() === m ? 'on' : ''}" data-mark="${m}" aria-pressed="${waMark() === m}">${m}</button>`).join('')}</div>
          ${isDefault ? '' : '<button class="text-btn" data-act="wa-reset">Hanya hari ini</button>'}
        </div>
      </div>` : '';
    return `<section class="card wa-card" id="wa-card" aria-labelledby="h-wa">
      <div class="card-top"><h3 class="card-title" id="h-wa">Kirim ke grup WA</h3>
        <button class="chip-btn" data-act="wa-more" aria-expanded="${WA_MORE}">${WA_MORE ? 'Tutup' : 'Pilih lain'} ${SVG.chev}</button></div>
      ${more}
      <div class="wa-bubble-wrap"><pre class="wa-preview${fx('wa-text', 'fx-swap')}" id="wa-preview" aria-label="Pesan yang akan dikirim"></pre></div>
      <p class="wa-warn" id="wa-warn" hidden></p>
      <div class="row-btns">
        <button class="btn-secondary" data-act="wa-copy">Salin</button>
        <a class="btn-primary" id="wa-send" href="#" target="${T.waTarget}" rel="noopener" data-act="wa-send">Kirim ke WA</a>
      </div>
    </section>`;
  }

  /** "Kejadian 29-30" → [{ kitab: 'Kejadian', a: 29, z: 30 }]
   *  "Imamat 27 & Bilangan 1" → [{ kitab: 'Imamat', a: 27, z: 27 }, { kitab: 'Bilangan', a: 1, z: 1 }] */
  function parseBacaan(s) {
    const segs = String(s).split(/\s*&\s*/).map(x => {
      const m = x.match(/^(.*\S)\s+(\d+)(?:\s*-\s*(\d+))?$/);
      return m ? { kitab: m[1], a: +m[2], z: +(m[3] || m[2]) } : null;
    });
    return segs.every(Boolean) ? segs : null;
  }

  /** Gabung bacaan yang pasalnya menyambung: Kej 29-30 + 31-32 + 33-34 → "Kejadian 29-34".
   *  Pasal yang tidak menyambung atau kitab berbeda → baris baru. */
  function waLines(days) {
    const groups = [];
    days.slice().sort((x, y) => x - y).forEach(d => {
      if (!BY[d]) return;
      const segs = parseBacaan(BY[d].bacaan);
      if (!segs) { groups.push({ raw: BY[d].bacaan }); return; }
      segs.forEach(p => {
        const g = groups[groups.length - 1];
        if (g && g.kitab === p.kitab) {
          const last = g.ranges[g.ranges.length - 1];
          if (p.a === last[1] + 1) last[1] = p.z; else g.ranges.push([p.a, p.z]);
        } else groups.push({ kitab: p.kitab, ranges: [[p.a, p.z]] });
      });
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
    warn.hidden = !text;
    warn.classList.toggle('ok', !notYet.length);
    warn.innerHTML = notYet.length
      ? `${notYet.length === 1 ? 'Belum' : notYet.length + ' bacaan belum'} ditandai di aplikasi. <button class="text-btn inline warn" data-act="wa-mark">Tandai sudah</button>`
      : `${SVG.check(18)}Sudah ditandai di aplikasi`;
  }

  /* ============ bilah aksi bawah (saat ada yang dicentang) ============ */
  function renderBar() {
    // v6.2: tombol "Laporkan" ada di dalam kartu Tertinggal, bilah bawah tidak dipakai lagi
    $bar.classList.remove('show');
    document.body.classList.remove('has-bar');
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
      if (PICK.has(d)) PICK.delete(d); else { PICK.add(d); FX.add('pick:' + d); }
      FX.add('pickcount');
      T.haptic(8);
      return render();
    }
    const wc = e.target.closest('[data-wa]');
    if (wc) {
      const d = +wc.dataset.wa;
      if (WA_SEL.has(d)) WA_SEL.delete(d); else { WA_SEL.add(d); FX.add('wa:' + d); }
      FX.add('wa-text');
      T.haptic(6);
      return rerenderWa();
    }
    const mk = e.target.closest('[data-mark]');
    if (mk) { T.store.set('tbf_wa_mark', mk.dataset.mark); return rerenderWa(); }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    switch (a.dataset.act) {
      case 'mark': MARKED_AT = Date.now(); MARKED_DAY = +a.dataset.day; return lapor([+a.dataset.day], true);
      case 'undo': FX.add('unmark'); return lapor([+a.dataset.day], false);
      case 'mark-picked': {
        // baris yang dilaporkan menyusut & hilang dulu, baru kartu diperbarui
        const days = Array.from(PICK).sort((x, y) => x - y);
        const rows = days.map(d => $app.querySelector(`[data-late="${d}"]`)).filter(Boolean);
        if (CALM() || !rows.length) return lapor(days, true);
        rows.forEach(li => { li.style.height = li.offsetHeight + 'px'; li.classList.add('fx-leave'); });
        a.disabled = true;
        return setTimeout(() => lapor(days, true), 320);
      }
      case 'clear-pick': PICK.clear(); return render();
      case 'pick-all': {
        const late = lateDays(D.currentDay);
        PICK = late.every(d => PICK.has(d)) ? new Set() : new Set(late);
        return render();
      }
      case 'show-all-late': SHOW_ALL_LATE = true; return render();
      case 'board': SHOW_BOARD = !SHOW_BOARD; if (SHOW_BOARD) FX.add('board'); return render();
      case 'tip-off': {
        const bar = a.closest('.tip-bar');
        if (CALM() || !bar) { T.store.set('tbf_tip_off', '1'); return render(); }
        bar.style.height = bar.offsetHeight + 'px'; bar.classList.add('fx-leave');
        return setTimeout(() => { T.store.set('tbf_tip_off', '1'); render(); }, 300);
      }
      case 'tip-how': SHOW_TIP = !SHOW_TIP; if (SHOW_TIP) FX.add('tip'); return render();
      case 'reload': return boot();
      case 'rn-open': return rnOpen(+a.dataset.h);
      case 'go-wa': { const c = document.getElementById('wa-card'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      case 'wa-copy': {
        const t = waText(); if (!t) return T.toast('Pilih bacaan dulu');
        return T.toast((await T.copyText(t)) ? 'Teks disalin, tinggal tempel di grup' : 'Gagal menyalin');
      }
      case 'wa-send': if (!waText()) { e.preventDefault(); T.toast('Pilih bacaan dulu'); } return;
      case 'wa-mark': return lapor(Array.from(WA_SEL).filter(d => !DONE.has(d)), true);
      case 'wa-more': WA_MORE = !WA_MORE; if (WA_MORE) FX.add('wa-more'); return rerenderWa();
      case 'wa-reset': WA_SEL = new Set([D.currentDay]); FX.add('wa-text'); return rerenderWa();
      case 'add-open': MENU_ADD = true; MENU_DEL = null; return renderMenu({ focus: true });
      case 'add-cancel': MENU_ADD = false; return renderMenu();
    }
  }
  /** gambar ulang kartu WA saja (posisi gulir tetap) */
  function rerenderWa() {
    const old = document.getElementById('wa-card'); if (!old || !D) return;
    const tmp = document.createElement('div'); tmp.innerHTML = waCard(D.currentDay);
    old.replaceWith(tmp.firstElementChild);
    FX.clear();
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
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (READER) rnClose(); else closeMenu(); } });
  window.addEventListener('popstate', () => { if (READER) rnClose(true); });
  $app.addEventListener('keydown', e => {
    const c = e.target.closest('.rn-card[data-act]');
    if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); rnOpen(+c.dataset.h); }
  });
  window.addEventListener('resize', positionMenu);
  window.addEventListener('hashchange', () => { closeMenu(); boot(); });
  // kembali ke aplikasi setelah lama ditinggal → ambil data terbaru
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && D && !PENDING.size && Date.now() - LOADED_AT > 3 * 60 * 1000) boot();
  });

  boot();
})();
