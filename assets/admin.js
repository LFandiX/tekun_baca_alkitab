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
    atur: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8M9 9.5h.01M15 9.5h.01" stroke-width="2.4"/></svg>',
  };
  const VIEWS = [['rekap', 'Rekap'], ['checklist', 'Checklist'], ['progres', 'Progres'], ['atur', 'Emoji & Link']];
  const EMO_KEYS = [['emojiJudul', 'Emoji judul', T.EMOJI_SUDAH], ['emojiSudah', 'Emoji sudah', T.EMOJI_SUDAH], ['emojiBelum', 'Emoji belum / tertinggal', T.EMOJI_BELUM]];

  let D = null, BY = {}, P = {}, PIN = null, SEL = 0;
  let VIEW = T.store.get('tbf_admin_view') || 'rekap';
  let FILTER = 'semua', CQ = '', PQ = '', SORT = 'tertinggal', PMODE = 'daftar';
  let PENDING = new Set(), EMO = null, MODAL = null, MODAL_NAMA = null, MODAL_ALL = false;
  let CONFIRM = null, confirmTimer = null, SAVING_EMO = false;
  if (!VIEWS.some(v => v[0] === VIEW)) VIEW = 'rekap';

  /* ============ muat data ============ */
  async function boot() {
    T.demoBanner('PIN admin: <b>1234</b>. <a class="demo-admin" href="index.html">← Halaman anggota</a>');
    PIN = ss.get(PIN_KEY);
    if (PIN) load(); else renderLogin();
  }

  async function load() {
    if (!D) $app.innerHTML = '<div class="loading">Memuat data…</div>';
    try {
      D = await T.apiGet({ action: 'admin', pin: PIN });
    } catch (e) {
      if (e.message === 'PIN_ADMIN_SALAH') { ss.del(PIN_KEY); PIN = null; D = null; return renderLogin('PIN admin salah.'); }
      $app.innerHTML = `<section class="card center-card"><div class="big-icon">⚠️</div><h2>Gagal memuat</h2>
        <p class="muted">${T.esc(e.message)}</p><button class="btn-primary btn-wide" data-act="reload">Coba lagi</button></section>`;
      return;
    }
    ss.set(PIN_KEY, PIN);
    BY = T.indexSchedule(D.schedule);
    P = {};
    D.members.forEach(m => { P[m.nama] = new Set(D.progress[m.nama] || []); });
    EMO = pickEmo(D.settings);
    document.getElementById('group-name').textContent = D.settings.namaKelompok;
    document.title = 'Admin · ' + D.settings.namaKelompok;
    if (!SEL || SEL > D.currentDay) SEL = D.currentDay;
    $tools.hidden = false;
    renderAll();
  }

  const pickEmo = s => ({ emojiJudul: s.emojiJudul, emojiSudah: s.emojiSudah, emojiBelum: s.emojiBelum });

  function renderLogin(err) {
    $tools.hidden = true; $day.hidden = true; $nav.hidden = true;
    document.body.classList.remove('has-nav');
    $app.innerHTML = `<section class="card login">
      <div class="big-icon">🔐</div><h2>Masuk sebagai admin</h2>
      <form id="login"><input class="input pin-input" type="password" inputmode="numeric" placeholder="PIN" autocomplete="current-password" required aria-label="PIN admin">
        ${err ? `<p class="err">${T.esc(err)}</p>` : ''}
        <button class="btn-primary btn-big" type="submit">Masuk</button></form>
      <p class="muted small">PIN diatur di sheet <b>Pengaturan</b> pada Google Sheet.</p></section>`;
    const f = document.getElementById('login');
    f.querySelector('input').focus();
    f.addEventListener('submit', e => { e.preventDefault(); PIN = f.querySelector('input').value.trim(); load(); });
  }

  /* ============ kerangka: bilah tanggal + navigasi bawah ============ */
  function renderAll() { renderDaybar(); renderNav(); renderView(); }

  function renderDaybar() {
    const cur = D.currentDay;
    if (!cur || VIEW === 'atur') { $day.hidden = true; return; }
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
    $nav.hidden = false;
    document.body.classList.add('has-nav');
    $nav.innerHTML = `<div class="bottomnav-in">${VIEWS.map(([k, l]) => `
      <button class="nav-btn ${VIEW === k ? 'on' : ''}" data-view="${k}" aria-current="${VIEW === k ? 'page' : 'false'}">
        ${ICON[k]}<span>${l}</span></button>`).join('')}</div>`;
  }

  function renderView() {
    if (!D.currentDay && VIEW !== 'atur') {
      const f = D.schedule[0];
      $app.innerHTML = `<section class="card center-card"><div class="big-icon">📅</div><h2>Pembacaan belum dimulai</h2>
        <p class="muted">${f ? 'Mulai ' + T.fmtTanggal(f.tanggal) + ': ' + T.esc(f.bacaan) : 'Jadwal kosong. Jalankan setupAwal di Apps Script.'}</p></section>`;
      return;
    }
    if (VIEW === 'rekap') { $app.innerHTML = viewRekap(); bindRekap(); }
    else if (VIEW === 'checklist') { $app.innerHTML = viewChecklist(); renderCFilter(); renderCList(); }
    else if (VIEW === 'progres') { $app.innerHTML = viewProgres(); renderPBody(); }
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
          <a class="btn-wa" id="wa-link" href="#" target="_blank" rel="noopener">Kirim ke WA</a>
        </div>
        <textarea class="recap-text" id="recap" rows="12" aria-label="Teks rekap">${T.esc(recap)}</textarea>
        <p class="muted small">Teks boleh diedit dulu sebelum disalin.</p>
      </section>`;
  }
  function bindRekap() {
    const ta = document.getElementById('recap'); const wa = document.getElementById('wa-link');
    const upd = () => { wa.href = 'https://wa.me/?text=' + encodeURIComponent(ta.value); };
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
  function matrixHtml() {
    const from = Math.max(1, SEL - 13); const days = [];
    for (let d = SEL; d >= from; d--) days.push(d); // terbaru di kiri: langsung terlihat di HP
    const head = days.map(d => `<th class="${d === SEL ? 'sel' : ''}"><span>${T.fmtShort(BY[d].tanggal)}</span><small>${T.esc(BY[d].singkat.split(' ').slice(1).join(' '))}</small></th>`).join('');
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
            <a class="chip-btn wa" href="${waLinkFor(m)}" target="_blank" rel="noopener">WA</a></div>`).join('')}</div>
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
    return 'https://wa.me/?text=' + encodeURIComponent(text);
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
      D.settings = r.settings; EMO = pickEmo(r.settings);
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
        <a class="btn-wa" href="${waLinkFor(m)}" target="_blank" rel="noopener">Kirim via WA</a>
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
    } catch (e) {
      days.forEach(d => { if (status) P[nama].delete(d); else P[nama].add(d); });
      T.toast(`Gagal menyimpan ${nama}: ${e.message}`, { ms: 5000 });
    }
    days.forEach(d => PENDING.delete(nama + '|' + d));
    refresh();
  }
  const toggleDay = (nama, d) => adminSet(nama, [d], !P[nama].has(d));

  async function resetKode(nama) {
    try {
      const r = await T.apiPost({ action: 'resetKode', pin: PIN, nama });
      D.members.find(m => m.nama === nama).kode = r.kode;
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
    if (t.id === 'cq') { CQ = t.value; renderCList(); }
    else if (t.id === 'pq') { PQ = t.value; renderPBody(); }
    else if (t.dataset && t.dataset.ef) { EMO[t.dataset.ef] = t.value; syncEmoUI(true); }
  });
  document.addEventListener('change', e => { if (e.target.id === 'psort') { SORT = e.target.value; renderPBody(); } });
  document.getElementById('btn-refresh').addEventListener('click', () => { load(); T.toast('Data dimuat ulang'); });
  document.getElementById('btn-logout').addEventListener('click', () => { ss.del(PIN_KEY); PIN = null; D = null; renderLogin(); });

  boot();
})();
