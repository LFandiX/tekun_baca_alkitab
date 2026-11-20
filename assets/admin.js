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
    rekap: '<svg viewBox="0 0 24 24"><path d="M8 4h8M8 4a2 2 0 0 0-2 2v0H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1a2 2 0 0 0-2-2M8 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2M8 11h8M8 15h5"/></svg>',
    checklist: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12.5 2.8 2.8L16.5 9"/></svg>',
    progres: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    renungan: '<svg viewBox="0 0 24 24"><path d="M12 6.5C10.4 5 8.2 4.3 4 4.3v14c4.2 0 6.4.7 8 2.2 1.6-1.5 3.8-2.2 8-2.2v-14c-4.2 0-6.4.7-8 2.2zM12 6.5v14"/></svg>',
    atur: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8M9 9.5h.01M15 9.5h.01" stroke-width="2.4"/></svg>',
  };
  const VIEWS_ADMIN = [['rekap', 'Rekap'], ['checklist', 'Checklist'], ['progres', 'Progres'], ['renungan', 'Renungan'], ['atur', 'Emoji/Link']];
  const VIEWS_PENDETA = [['renungan', 'Renungan']];
  let VIEWS = VIEWS_ADMIN;
  let ROLE = 'admin';
  const EMO_KEYS = [['emojiJudul', 'Emoji judul', T.EMOJI_SUDAH], ['emojiSudah', 'Emoji sudah', T.EMOJI_SUDAH], ['emojiBelum', 'Emoji belum / tertinggal', T.EMOJI_BELUM]];

  let D = null, BY = {}, P = {}, PIN = null, SEL = 0;
  let VIEW = T.store.get('tbf_admin_view') || 'rekap';
  let FILTER = 'semua', CQ = '', PQ = '', SORT = 'tertinggal', PMODE = 'daftar';
  let PENDING = new Set(), EMO = null, MODAL = null, MODAL_NAMA = null, MODAL_ALL = false;
  let CONFIRM = null, confirmTimer = null, SAVING_EMO = false;
  let RN_FORCE = {};                          // "tetap simpan di hari ini" walau tanggal di teks berbeda
  let RSEL = 0, RN_TEXT = {}, RN_DRAFT = {}, RN_LOADING = new Set(), RN_SAVING = 0, RN_PREVIEW = false, RN_DEL = false;
  if (!VIEWS.some(v => v[0] === VIEW)) VIEW = 'rekap';

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
    if (!emoDirty) EMO = pickEmo(D.settings);
    document.getElementById('group-name').textContent = D.settings.namaKelompok;
    document.title = (ROLE === 'pendeta' ? 'Renungan · ' : 'Admin · ') + D.settings.namaKelompok;
    if (!SEL || SEL > D.currentDay) SEL = D.currentDay;
    $tools.hidden = false;
    renderAll();
    if (MODAL && keepModal && P[keepModal]) MODAL.setHtml(personHtml(keepModal));
    if (store2) saveCache();
  }

  const pickEmo = s => ({ emojiJudul: s.emojiJudul, emojiSudah: s.emojiSudah, emojiBelum: s.emojiBelum });

  function renderLogin(err) {
    $tools.hidden = true; $day.hidden = true; $nav.hidden = true;
    document.body.classList.remove('has-nav');
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

  /* ============ kerangka: bilah tanggal + navigasi bawah ============ */
  function renderAll() { renderDaybar(); renderNav(); renderView(); }

  function renderDaybar() {
    const cur = D.currentDay;
    if (!cur || VIEW === 'atur' || VIEW === 'renungan') { $day.hidden = true; return; }
    const r = BY[SEL];
    $day.hidden = false;
    $day.innerHTML = `<div class="wrap daybar-in">
      <button class="icon-btn" data-act="prev" ${SEL <= 1 ? 'disabled' : ''} aria-label="Bacaan sebelumnya">‹</button>
      <div class="daybar-mid">
        <span class="daybar-date">${T.fmtTanggal(r.tanggal, { short: true })} · hari ke-${SEL}
          ${SEL !== cur ? '<button class="mini-pill" data-act="latest">Terbaru ›</button>' : '<span class="mini-pill on">Terbaru</span>'}</span>
        <strong class="daybar-read">${T.esc(r.bacaan)}</strong>
      </div>
      <button class="icon-btn" data-act="next" ${SEL >= cur ? 'disabled' : ''} aria-label="Bacaan berikutnya">›</button></div>`;
  }

  function renderNav() {
    if (VIEWS.length < 2) { $nav.hidden = true; document.body.classList.remove('has-nav'); return; }
    $nav.hidden = false;
    document.body.classList.add('has-nav');
    $nav.innerHTML = `<div class="bottomnav-in">${VIEWS.map(([k, l]) => `
      <button class="nav-btn ${VIEW === k ? 'on' : ''}" data-view="${k}" aria-current="${VIEW === k ? 'page' : 'false'}">
        ${ICON[k]}<span>${l}</span></button>`).join('')}</div>`;
  }

  function renderView() {
    if (!D.currentDay && VIEW !== 'atur' && VIEW !== 'renungan') {
      const f = D.schedule[0];
      $app.innerHTML = `<section class="card center-card"><div class="big-icon">📅</div><h2>Pembacaan belum dimulai</h2>
        <p class="muted">${f ? 'Mulai ' + T.fmtTanggal(f.tanggal) + ': ' + T.esc(f.bacaan) : 'Jadwal kosong. Jalankan setupAwal di Apps Script.'}</p></section>`;
      return;
    }
    if (VIEW === 'rekap') { $app.innerHTML = viewRekap(); bindRekap(); }
    else if (VIEW === 'checklist') { $app.innerHTML = viewChecklist(); renderCFilter(); renderCList(); }
    else if (VIEW === 'progres') { $app.innerHTML = viewProgres(); renderPBody(); }
    else if (VIEW === 'renungan') { $app.innerHTML = viewRenungan(); bindRenungan(); }
    else { $app.innerHTML = viewAtur(); syncEmoUI(); }
  }

  /** setelah data berubah: gambar ulang bagian yang terlihat saja (input pencarian tetap fokus) */
  function refresh() {
    if (VIEW === 'checklist') { renderCFilter(); renderCList(); }
    else if (VIEW === 'progres') renderPBody();
    else if (VIEW === 'rekap') { $app.innerHTML = viewRekap(); bindRekap(); }
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

  /* ============ 1. REKAP ============ */
  function viewRekap() {
    const rows = computeRows(SEL);
    const nOk = rows.filter(x => !x.belum).length;
    const nFar = rows.filter(x => x.tertinggal > 3).length;
    const recap = T.buildRecap(BY[SEL], D.members, n => P[n], D.settings, BY);
    const s = D.settings;
    return `
      <section class="kpis">
        <div class="kpi ok"><span class="kpi-num">${nOk}<small>/${rows.length}</small></span><span class="kpi-label">Lengkap</span></div>
        <div class="kpi warn"><span class="kpi-num">${rows.length - nOk}</span><span class="kpi-label">Tertinggal</span></div>
        <div class="kpi danger"><span class="kpi-num">${nFar}</span><span class="kpi-label">&gt; 3 bacaan</span></div>
      </section>
      <section class="card">
        <div class="card-head"><h3>Teks rekap WhatsApp</h3>
          <button class="chip-btn" data-view="atur">${T.esc(s.emojiJudul)} ${T.esc(s.emojiSudah)} ${T.esc(s.emojiBelum)} · Ubah</button></div>
        <div class="row-btns mb">
          <button class="btn-primary" data-act="copy-recap">Salin teks</button>
          <a class="btn-wa" id="wa-link" href="#" target="${T.waTarget}" rel="noopener">Kirim ke WA</a>
        </div>
        <textarea class="recap-text" id="recap" rows="12" aria-label="Teks rekap">${T.esc(recap)}</textarea>
        <p class="muted small">Teks boleh diedit dulu sebelum disalin.</p>
      </section>`;
  }
  function bindRekap() {
    const ta = document.getElementById('recap'); const wa = document.getElementById('wa-link');
    const upd = () => { wa.href = T.waUrl(ta.value); };
    ta.addEventListener('input', upd); upd();
  }

  /* ============ 2. CHECKLIST ============ */
  function viewChecklist() {
    return `<section class="card">
      <div class="card-head"><div><h3>Checklist ${T.esc(BY[SEL].singkat)}</h3>
        <p class="muted small nomb">Ketuk lingkaran untuk menandai sudah / belum. Ketuk nama untuk detail.</p></div></div>
      <input class="input" id="cq" type="search" placeholder="Cari nama…" value="${T.esc(CQ)}" autocomplete="off" aria-label="Cari nama">
      <div class="seg" id="cfilter" role="tablist"></div>
      <div class="clist" id="clist"></div></section>`;
  }
  function renderCFilter() {
    const el = document.getElementById('cfilter'); if (!el) return;
    const sudah = D.members.filter(m => P[m.nama].has(SEL)).length;
    const opts = [['semua', 'Semua', D.members.length], ['belum', 'Belum', D.members.length - sudah], ['sudah', 'Sudah', sudah]];
    el.innerHTML = opts.map(([k, l, n]) => `<button class="seg-btn ${FILTER === k ? 'on' : ''}" data-filter="${k}">${l} <b>${n}</b></button>`).join('');
  }
  function renderCList() {
    const el = document.getElementById('clist'); if (!el) return;
    const q = CQ.trim().toLowerCase();
    const list = D.members.filter(m => {
      const on = P[m.nama].has(SEL);
      return (!q || m.nama.toLowerCase().includes(q)) && (FILTER === 'semua' || (FILTER === 'sudah') === on);
    });
    el.innerHTML = list.map(m => {
      const set = P[m.nama]; const on = set.has(SEL); const fu = T.firstUnread(set, SEL); const n = T.countUnread(set, SEL);
      const sub = on ? (fu ? `Bacaan ini sudah · masih ${T.esc(BY[fu].singkat)}` : 'Lengkap')
        : fu < SEL ? `Tertinggal ${n} · masih ${T.esc(BY[fu].singkat)}` : 'Belum lapor';
      const busy = PENDING.has(m.nama + '|' + SEL);
      return `<div class="crow ${on ? 'on' : ''}">
        <button class="crow-main" data-person="${T.esc(m.nama)}"><span class="p-name">${T.esc(m.nama)}</span>
          <span class="p-sub ${!on && fu < SEL ? 'warn' : ''}">${sub}</span></button>
        <button class="tick-btn ${on ? 'on' : ''} ${busy ? 'busy' : ''}" data-tick="${T.esc(m.nama)}" aria-pressed="${on}"
          aria-label="${T.esc(BY[SEL].bacaan)} untuk ${T.esc(m.nama)}">✓</button></div>`;
    }).join('') || '<p class="muted center">Tidak ada nama di daftar ini.</p>';
  }

  /* ============ 3. PROGRES ============ */
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
    const cur = D.currentDay || 1; const s = BY[RSEL]; const meta = rnMetaMap()[RSEL];
    const loading = RN_LOADING.has(RSEL);
    const when = RSEL === cur ? 'hari ini' : RSEL === cur + 1 ? 'besok' : RSEL < cur ? 'sudah lewat' : 'akan datang';
    const from = Math.max(1, cur - 6), to = Math.min(rnMaxDay(), cur + 7);
    const mm = rnMetaMap(); let rows = '';
    for (let h = to; h >= from; h--) {
      const x = BY[h]; if (!x) continue;
      rows += `<button class="rn-srow ${h === RSEL ? 'on' : ''}" data-rsel="${h}">
        <span class="rn-s-date">${T.fmtTanggal(x.tanggal, { short: true })}${h === cur ? ' <span class="mini-pill on">Hari ini</span>' : ''}</span>
        <span class="rn-s-read">${T.esc(x.bacaan)}</span>
        <span class="rn-s-st ${mm[h] ? 'ok' : ''}">${rnDirty(h) ? '✎ draf' : mm[h] ? '✓' : '–'}</span></button>`;
    }
    return `
      <section class="card rn-adm-day">
        <div class="rn-dnav">
          <button class="icon-btn" data-act="rn-prevday" ${RSEL <= 1 ? 'disabled' : ''} aria-label="Hari sebelumnya">‹</button>
          <div class="rn-dmid">
            <span class="daybar-date">${fmtY(s.tanggal)} · ${when}</span>
            <strong class="daybar-read">${T.esc(s.bacaan)}</strong>
            <span class="rn-chip ${meta ? 'ok' : ''}">${meta ? '✓ Renungan sudah ada' : 'Belum ada renungan'}</span>
          </div>
          <button class="icon-btn" data-act="rn-nextday" ${RSEL >= rnMaxDay() ? 'disabled' : ''} aria-label="Hari berikutnya">›</button>
        </div>
        <div class="rn-jump">
          <label class="rn-jump-date"><span>Pilih tanggal</span>
            <input class="input" type="date" id="rn-date" value="${s.tanggal}" min="${D.schedule[0].tanggal}" max="${D.schedule[D.schedule.length - 1].tanggal}"></label>
          <button class="chip-btn" data-act="rn-nextempty">Hari kosong berikutnya ›</button>
        </div>
        ${RSEL !== cur ? '<button class="link-btn rn-today" data-act="rn-today">Kembali ke hari ini</button>' : ''}
      </section>
      <section class="card">
        <div class="card-head"><h3>Teks renungan</h3><span class="muted small" id="rn-count"></span></div>
        <div class="rn-hint" id="rn-hint" hidden></div>
        <textarea class="recap-text rn-input" id="rn-text" placeholder="${loading ? 'Memuat renungan…' : 'Tempel renungan dari WhatsApp di sini. Tanggal di baris pertama akan dikenali otomatis.'}" ${loading ? 'disabled' : ''} aria-label="Teks renungan"></textarea>
        <div class="row-btns mt-s">
          <button class="btn-secondary" data-act="rn-preview" aria-pressed="${RN_PREVIEW}">${RN_PREVIEW ? 'Tutup pratinjau' : 'Pratinjau'}</button>
          <button class="btn-primary" data-act="rn-save" id="rn-save">Simpan</button>
        </div>
        <p class="muted small rn-status" id="rn-status">${meta ? `Tersimpan ${T.relTime(meta.t)} oleh ${T.esc(meta.oleh || '-')}.` : ''}
          ${RSEL > cur ? ` Akan tampil di aplikasi anggota pada ${T.fmtTanggal(s.tanggal, { short: true })}.` : ''}</p>
        ${meta ? `<button class="link-btn danger ${RN_DEL ? 'confirm' : ''}" data-act="rn-del">${RN_DEL ? 'Yakin hapus? Ketuk lagi' : 'Hapus renungan ini'}</button>` : ''}
      </section>
      <section class="card" id="rn-prev-card" ${RN_PREVIEW ? '' : 'hidden'}>
        <p class="eyebrow">Pratinjau · seperti yang dilihat anggota</p>
        <article class="rn rn-preview" id="rn-prev"></article>
      </section>
      <section class="card">
        <div class="card-head"><h3>Status renungan</h3><span class="muted small">${(D.rnMeta || []).length} dari ${D.schedule.length} hari sudah ada</span></div>
        <div class="rn-slist">${rows}</div>
      </section>`;
  }

  function bindRenungan() {
    const ta = document.getElementById('rn-text'); if (!ta) return;
    ta.value = rnValue(RSEL);
    ta.addEventListener('paste', () => { const wasEmpty = !ta.value.trim(); setTimeout(() => rnDetect(wasEmpty), 0); });
    syncRn();
    if (rnMetaMap()[RSEL] && !(RSEL in RN_TEXT) && !RN_LOADING.has(RSEL)) rnFetchText(RSEL);
  }

  const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  /** "Jumat, 30 Jun" (+ tahun kalau bukan tahun ini, karena jadwal s/d Wahyu melewati beberapa tahun) */
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
    if (RN_PREVIEW) document.getElementById('rn-prev').innerHTML = v.trim() ? T.rn.format(v) : '<p class="muted">Belum ada teks.</p>';
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
    return `<section class="card">
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
      </section>`;
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
  document.addEventListener('click', async e => {
    if (!D) { if (e.target.closest('[data-act="reload"]')) load(); return; }
    let el;
    if ((el = e.target.closest('[data-view]'))) {
      VIEW = el.dataset.view; T.store.set('tbf_admin_view', VIEW);
      renderAll(); window.scrollTo(0, 0); return;
    }
    if ((el = e.target.closest('[data-rsel]'))) return rnSelect(+el.dataset.rsel);
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
        const ok = await T.copyText(document.getElementById('recap').value);
        return T.toast(ok ? 'Disalin! Tinggal tempel di grup WA' : 'Gagal menyalin, salin manual ya');
      }
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
      case 'rn-force': RN_FORCE[RSEL] = true; return syncRn();
      case 'rn-save': return rnSave();
      case 'rn-preview': RN_PREVIEW = !RN_PREVIEW; {
        const card = document.getElementById('rn-prev-card'); card.hidden = !RN_PREVIEW;
        el.textContent = RN_PREVIEW ? 'Tutup pratinjau' : 'Pratinjau'; syncRn();
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
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'rn-text') { RN_DRAFT[RSEL] = t.value; syncRn(); }
    else if (t.id === 'cq') { CQ = t.value; renderCList(); }
    else if (t.id === 'pq') { PQ = t.value; renderPBody(); }
    else if (t.dataset && t.dataset.ef) { EMO[t.dataset.ef] = t.value; syncEmoUI(true); }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'rn-date' && e.target.value) {
      const d = D.schedule.find(x => x.tanggal >= e.target.value);   // hari libur → bacaan berikutnya
      if (d) rnSelect(d.hari);
      return;
    } if (e.target.id === 'psort') { SORT = e.target.value; renderPBody(); } });
  document.getElementById('btn-refresh').addEventListener('click', () => load(true));
  document.getElementById('btn-logout').addEventListener('click', () => {
    ss.del(PIN_KEY); if (store2) T.cacheDel(DATA_KEY, store2); PIN = null; D = null;
    RN_TEXT = {}; RN_DRAFT = {}; RN_FORCE = {}; RSEL = 0; ROLE = 'admin'; VIEWS = VIEWS_ADMIN;
    if (MODAL) MODAL.close();
    renderLogin();
  });

  boot();
})();
