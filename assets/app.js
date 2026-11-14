/* Tekun Baca Firman — halaman anggota (hanya lewat link pribadi) */
(function () {
  'use strict';
  const T = window.TBF;
  const $app = document.getElementById('app');
  const $bar = document.getElementById('actionbar');
  const LATE_LIMIT = 10;

  let KODE = null, D = null, BY = {}, DONE = new Set(), PICK = new Set(), PENDING = new Set();
  let SHOW_BOARD = false, SHOW_ALL_LATE = false, LOADED_AT = 0, LAST_JSON = '';

  async function boot() {
    T.demoBanner('<a class="demo-admin" href="admin.html">Coba halaman admin →</a>');
    const tok = T.getToken();
    if (!tok) return renderNoAccess(false);
    if (KODE !== tok.kode) { D = null; PICK.clear(); }
    KODE = tok.kode;
    const CKEY = 'tbf_c_' + KODE;
    // 1) tampilkan data terakhir yang tersimpan di HP → langsung muncul tanpa menunggu
    if (!D) {
      const cached = T.cacheGet(CKEY);
      if (cached) { LAST_JSON = JSON.stringify(cached); apply(cached); } else $app.innerHTML = '<div class="loading">Memuat…</div>';
    }
    // 2) ambil data terbaru dari server di belakang layar
    T.syncing(true);
    let fresh;
    try {
      fresh = await T.apiGet({ action: 'init', k: KODE });
    } catch (e) {
      T.syncing(false);
      if (e.message === 'LINK_TIDAK_VALID') { T.cacheDel(CKEY); T.store.del('tbf_kode'); return renderNoAccess(true); }
      if (D) return T.toast('Belum bisa terhubung. Menampilkan data terakhir.', { ms: 4000 });
      return fatal(e);
    }
    T.syncing(false);
    T.store.set('tbf_kode', KODE);
    LOADED_AT = Date.now();
    if (PENDING.size) return; // ada laporan yang sedang dikirim → jangan timpa tampilan
    const json = JSON.stringify(fresh);
    if (D && json === LAST_JSON) return; // sama persis dengan yang sudah tampil
    LAST_JSON = json;
    apply(fresh);
    saveCache();
  }

  function apply(data) {
    D = data;
    BY = T.indexSchedule(D.schedule);
    DONE = new Set(D.done);
    PICK.forEach(d => { if (DONE.has(d)) PICK.delete(d); });
    document.getElementById('group-name').textContent = D.settings.namaKelompok;
    document.title = D.me.nama + ' · ' + D.settings.namaKelompok;
    render();
  }

  function saveCache() {
    if (!D || !KODE) return;
    const snap = Object.assign({}, D, { ok: true, done: Array.from(DONE).sort((a, b) => a - b) });
    T.cacheSet('tbf_c_' + KODE, snap);
  }

  function fatal(e) {
    $app.innerHTML = `<section class="card center-card"><div class="big-icon">⚠️</div><h2>Gagal memuat</h2>
      <p class="muted">${T.esc(e.message)}</p><button class="btn-primary btn-wide" data-act="reload">Coba lagi</button></section>`;
  }

  function renderNoAccess(invalid) {
    D = null; renderBar();
    let demo = '';
    if (T.IS_DEMO) {
      const s = T.demo.sample(['Andre', 'Dimas', 'Clara', 'Agustina']);
      demo = `<section class="card demo-card"><p class="eyebrow">Khusus mode demo</p>
        <p class="small">Di web asli, bagian ini tidak ada. Coba buka link pribadi contoh:</p>
        <div class="demo-links">${s.map(x => `<a class="btn-secondary" href="#${x.kode}">${T.esc(x.nama)}</a>`).join('')}</div>
        <p class="small">Atau coba sisi admin:</p>
        <a class="btn-primary btn-wide" href="admin.html">Buka halaman admin (PIN 1234)</a></section>`;
    }
    $app.innerHTML = `<section class="card center-card">
        <div class="big-icon">🔒</div>
        <h2>${invalid ? 'Link sudah tidak berlaku' : 'Buka lewat link pribadi'}</h2>
        <p class="muted">${invalid
          ? 'Link ini sudah diganti atau salah ketik. Minta link pribadi yang baru ke admin grup.'
          : 'Halaman ini hanya bisa dibuka dengan link pribadi dari admin grup. Simpan link itu baik-baik dan jangan dibagikan ke orang lain ya.'}</p>
      </section>${demo}`;
  }

  /* ---------- halaman utama ---------- */
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
    $app.innerHTML = todayCard(cur) + lateCard(cur) + progressCard(cur) + boardCard(cur) + installCard();
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
           <button class="link-btn" data-act="undo" data-day="${cur}" ${saving ? 'disabled' : ''}>Batalkan laporan</button>`
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
        <h3>Teman-teman</h3><span class="muted small">${n}/${b.length} sudah ${T.esc(BY[cur].singkat)}</span>
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

  /* ---------- bilah aksi bawah (saat ada yang dicentang) ---------- */
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

  /* ---------- kirim laporan (langsung tampil, simpan di belakang) ---------- */
  async function lapor(days, status, isUndo) {
    days = days.filter(d => !PENDING.has(d));
    if (!days.length) return;
    const before = new Set(DONE);
    days.forEach(d => { if (status) DONE.add(d); else DONE.delete(d); PENDING.add(d); PICK.delete(d); });
    updateBoardSelf(); render();
    if (status) T.haptic(15);
    try {
      const r = await T.apiPost({ action: 'lapor', k: KODE, hari: days, status });
      days.forEach(d => PENDING.delete(d));
      if (!PENDING.size && r.done) DONE = new Set(r.done);
      updateBoardSelf(); render(); saveCache();
      if (isUndo) T.toast('Sudah diurungkan');
      else T.toast(status ? (days.length > 1 ? `${days.length} bacaan dilaporkan 🎉` : 'Laporan tersimpan 🎉') : 'Laporan dibatalkan',
        { action: 'Urungkan', onAction: () => lapor(days, !status, true) });
    } catch (e) {
      days.forEach(d => { PENDING.delete(d); if (before.has(d)) DONE.add(d); else DONE.delete(d); });
      updateBoardSelf(); render();
      if (e.message === 'LINK_TIDAK_VALID') { T.cacheDel('tbf_c_' + KODE); return renderNoAccess(true); }
      T.toast('Gagal menyimpan. Cek internet lalu coba lagi.', { ms: 5000 });
    }
  }

  /* ---------- event ---------- */
  function onClick(e) {
    const pk = e.target.closest('[data-pick]');
    if (pk) {
      const d = +pk.dataset.pick;
      if (PICK.has(d)) PICK.delete(d); else PICK.add(d);
      T.haptic(8);
      return render();
    }
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
    }
  }
  $app.addEventListener('click', onClick);
  $bar.addEventListener('click', onClick);
  window.addEventListener('hashchange', () => { PENDING.clear(); boot(); });
  // kembali ke aplikasi setelah lama ditinggal → ambil data terbaru
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && D && !PENDING.size && Date.now() - LOADED_AT > 3 * 60 * 1000) boot();
  });

  boot();
})();
