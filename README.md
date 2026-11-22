# 📖 Tekun Baca Firman

Web lapor progres baca Alkitab bersama, dibuat untuk dipakai di HP.
**Gratis**: tampilan di GitHub Pages, data di Google Sheets.

> **Sudah memakai versi sebelumnya?** Lihat bagian [Update ke versi 5](#update-ke-versi-5) di bawah.

- **Anggota** membuka **link pribadinya sendiri** (berisi kode rahasia), lalu tekan **"Sudah saya baca"**. Tidak ada daftar nama untuk dipilih, jadi orang lain tidak bisa iseng melapor atas nama orang lain.
- **Admin** buka `admin.html` (pakai PIN) dan dapat 4 menu:
  - **Rekap**: teks rekap WA siap salin, format sama seperti di grup.
  - **Checklist**: tandai sudah/belum untuk siapa saja dengan sekali ketuk.
  - **Progres**: daftar per orang dan matriks 14 hari (kotaknya juga bisa diketuk).
  - **Emoji & Link**: ganti emoji rekap kapan saja, termasuk tombol 🎲 Acak, dan kirim link pribadi tiap anggota lewat WA.

```
HP anggota / admin
      │
Web di GitHub Pages      (index.html, admin.html)
      │  fetch
Google Apps Script       (apps-script/Code.gs = "API")
      │
Google Sheets            (sheet: Pengaturan, Anggota, Jadwal, Laporan)
```

---

## Langkah 1: Siapkan Google Sheets + Apps Script (±10 menit)

1. Buka <https://sheets.new> (buat Google Sheet baru), beri nama misalnya **Tekun Baca Firman**.
2. Menu **Extensions → Apps Script** (Ekstensi → Apps Script).
3. Hapus semua isi `Code.gs`, lalu **tempel seluruh isi file `apps-script/Code.gs`**. Klik 💾 **Save**.
4. Di toolbar atas, pilih fungsi **`setupAwal`** lalu klik **▶ Run**.
   - Akan muncul permintaan izin: **Review permissions** → pilih akun Google Anda.
   - Kalau muncul *"Google hasn't verified this app"*: klik **Advanced → Go to … (unsafe)** → **Allow**.
     (Aman, karena ini script milik Anda sendiri.)
5. Kembali ke Google Sheet. Sekarang ada 4 sheet:

| Sheet | Isi | Yang perlu Anda lakukan |
|---|---|---|
| **Pengaturan** | Nama kelompok, PIN admin, jadwal, emoji | **Ganti `PIN Admin`** (minimal 8 karakter, mis. `kejadian-tekun-27`). Selama belum diganti, halaman admin tidak bisa dibuka |
| **Anggota** | Nama, Kode Link (otomatis), Aktif | Lengkapi nama anggota. Kolom Kode Link **jangan diisi manual** |
| **Jadwal** | Hari ke, tanggal, bacaan | Dibuat otomatis, cek apakah sudah sesuai |
| **Laporan** | Catatan riwayat setiap laporan (`baca` / `batal`), hanya ditambah | Jangan diubah manual kecuali perlu |
| **Ringkasan** | 1 baris per anggota: bacaan yang sudah selesai (mis. `1-15,17-18`) | Dibuat otomatis. Kalau ragu, menu **📖 Tekun Baca → Hitung ulang Ringkasan** |

> **Jadwal bawaan:** mulai **Senin, 26 Okt 2026**, **2 pasal/hari**, **Minggu libur**, dari Kejadian sampai Wahyu.
> Hasilnya Kamis 12 Nov = Kejadian 31-32 (sesuai grup). Jika aturan grup berbeda, ubah di sheet **Pengaturan**,
> lalu menu **📖 Tekun Baca → Buat ulang jadwal dari Pengaturan**.

> **Soal izin akses Google:** saat Run pertama kali, Google akan meminta izin dan mengirim email
> *"Anda mengizinkan … mengakses beberapa data Akun Google Anda"*. Ini normal untuk script buatan sendiri.
> Karena ada tanda `@OnlyCurrentDoc` di baris paling atas `Code.gs`, izin yang diminta hanya:
> - **"Melihat dan mengelola spreadsheet tempat aplikasi ini dipasang"**: hanya spreadsheet Tekun Baca ini,
>   **tidak** bisa membuka spreadsheet, dokumen, Gmail, atau file Drive lain.
> - **"Menampilkan konten di dialog/sidebar aplikasi Google"**: untuk menu 📖 Tekun Baca dan pesan pop-up di Sheet.
>
> Izin bisa dicabut kapan saja di <https://myaccount.google.com/permissions>.

## Langkah 2: Deploy Apps Script sebagai Web App

1. Di editor Apps Script, klik **Deploy → New deployment**.
2. Klik ⚙️ di samping *Select type* → pilih **Web app**.
3. Isi:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone` ← penting, supaya web bisa mengakses
4. Klik **Deploy**, lalu **salin Web app URL** (berakhiran `/exec`).
5. Tes: buka URL itu di browser. Harus muncul `{"ok":true,"pesan":"API Tekun Baca Firman aktif ✅"}`.

## Langkah 3: Upload website ke GitHub Pages

1. Buat akun di <https://github.com> (jika belum), lalu **New repository**, misal nama `tekun-baca`, pilih **Public**.
2. Klik **uploading an existing file**, lalu upload semua isi folder ini:
   `index.html`, `admin.html`, `config.js`, `manifest.webmanifest`, folder `assets/` (boleh juga `apps-script/` & `README.md`).
3. Buka file **`config.js`** di GitHub → ikon ✏️ edit → tempel URL dari Langkah 2:
   ```js
   window.TBF_CONFIG = {
     API_URL: 'https://script.google.com/macros/s/AKfy..../exec',
   };
   ```
   → **Commit changes**.
4. Masuk **Settings → Pages** → *Source*: **Deploy from a branch** → Branch: **main**, folder **/ (root)** → **Save**.
5. Tunggu 1–2 menit. Web aktif di `https://USERNAME-ANDA.github.io/tekun-baca/`.
   Kalau dibuka tanpa link pribadi, yang muncul hanya pesan 🔒 "Buka lewat link pribadi". Ini memang disengaja.

## Langkah 4: Bagikan link pribadi

1. Admin buka `https://USERNAME-ANDA.github.io/tekun-baca/admin.html` → masukkan PIN admin.
2. Menu **Emoji & Link** → di samping tiap nama ada tombol **WA**. Ketuk, lalu pilih kontak orang itu.
   Pesan berisi link pribadinya, misalnya `…/tekun-baca/?k=7mq2xk9a`.
   ⚠️ **Kirim lewat chat pribadi, jangan di grup**, karena siapa pun yang memegang link bisa melapor atas nama pemiliknya.
3. Anggota membuka link itu sekali, lalu sebaiknya **simpan di layar utama** (Chrome: menu ⋮ → *Tambahkan ke layar utama*;
   iPhone Safari: tombol Bagikan → *Tambah ke Layar Utama*). Web juga mengingat link di HP itu.

## Sehari-hari

- **Admin:** buka menu **Rekap** → **Salin teks** (atau **Kirim ke WA**) → tempel di grup. Teks boleh diedit dulu.
- **Ada yang lapor lewat chat?** Menu **Checklist** → ketuk lingkaran di samping namanya.
  Untuk bacaan hari lain, ketuk namanya → centang di daftar bacaan, atau **Tandai semua sudah sampai hari ini**.
- **Mau suasana baru?** Menu **Emoji & Link** → pilih emoji / 🎲 Acak → **Simpan emoji**.

---

## Update ke versi 6.2 (tampilan halaman anggota baru)

Hanya file website. Apps Script **tidak perlu** diubah (tetap versi 3.4).

- Bilah atas: "Shalom, Nama" + nama kelompok.
- Kartu hijau gaya lama dengan **pita merah**. Saat menekan **Sudah saya baca**, pita turun seperti pembatas
  yang diselipkan ke halaman, lalu muncul centang (HP yang mematikan animasi: langsung berubah tanpa gerak).
- **Tertinggal**: satu kolom, selalu terbuka, tombol **Laporkan** di dalam kartu.
- **Perjalananmu**: cincin per kitab (hijau sudah dibaca, oranye tertinggal); kitab yang selesai diringkas satu baris.
- Teman-teman, saran pasang di layar utama, dan **Kirim ke grup WA** (tetap paling bawah) dirapikan.
- Huruf lebih besar (minimal 15 px) supaya nyaman untuk orang tua. Mode gelap ikut disesuaikan.
- **Tombol terang/gelap** (ikon matahari/bulan) di kanan atas halaman anggota, dan di halaman admin
  (HP: bilah atas, laptop: menu samping). Pilihan disimpan di HP masing-masing; sebelum ditekan,
  tampilan mengikuti pengaturan HP.

Catatan untuk yang mengubah CSS: blok mode gelap ditulis dua kali, yaitu
`@media (prefers-color-scheme: dark) { html:not([data-theme="light"]) … }` dan `html[data-theme="dark"] …`.
Skrip `tools/tema.py` bisa membuatnya otomatis dari blok `@media` biasa.

File 6.2 (paket lengkap, aman disalin semua): `index.html`, `admin.html`, `assets/app.js`, `assets/admin.js`,
`assets/admin.css`, `assets/anggota.css` (baru), `assets/common.js`, `assets/style.css`, `apps-script/Code.gs`.

## Update ke versi 6.1 (tampilan admin baru + desain renungan)

- Checklist dan Rekap digabung jadi tab **Hari ini**. Di laptop, daftar anggota ada di kiri dan teks rekap WA di kanan; di HP, tombol **Kirim rekap** selalu ada di bawah.
- Menu di samping kiri (laptop). Bisa diciutkan dengan tombol **Ciutkan menu** di bawah, dan pilihannya diingat.
- Kotak kecil 7 bacaan terakhir di setiap nama, dan kotak "Perlu diingatkan" untuk yang tertinggal 3 bacaan atau lebih.
- Pita perjalanan Alkitab: posisi bacaan dari Kejadian sampai Wahyu.
- Renungan di laptop: daftar hari, kotak teks, dan pratinjau seperti di HP anggota. Di HP: deretan tanggal yang tinggal diketuk.

- **Desain renungan.** Tulis simbol di awal dan akhir baris (simbol di tengah kalimat tidak berpengaruh):

  | Tulis | Hasil |
  |---|---|
  | `*Kejadian 1*` | Judul pasal |
  | `%Allah setia%` | Poin bernomor (1, 2, 3 … otomatis) |
  | `$Firman-Mu pelita bagi kakiku (Mzm 119:105)$` | Kartu ayat kunci |
  | `> Jadilah terang` lalu `> — Kejadian 1:3` | Kutipan ayat + sumbernya |
  | `!Jangan lupa berdoa!` | Kotak penting |
  | `&Baca Mazmur 8&` | Daftar "Lakukan hari ini" yang bisa dicentang anggota |
  | `---` | Garis pemisah |

  Di halaman admin ada tombol untuk menyisipkan simbol ini, tombol **Panduan**, dan **Salin versi WhatsApp**
  (simbol diganti 1️⃣ 📖 📌 ☑️ supaya rapi saat dikirim ke grup).

File 6.1 (gabungan 5.2 + 6 + desain renungan): `index.html`, `admin.html`, `assets/app.js`, `assets/admin.js`,
`assets/admin.css` (baru), `assets/common.js`, `assets/style.css`, `apps-script/Code.gs`.
Kalau update 5.2 belum dipasang, tempel juga `Code.gs` ke Apps Script (versi 3.4) lalu jalankan menu **Ratakan jadwal ke depan**.

## Update ke versi 5.2 (jadwal tepat 2 pasal per hari)

Kitab yang jumlah pasalnya ganjil dulu membuat hari 3 pasal (mis. Imamat 25-27).
Sekarang jadwal ke depan bisa diratakan: setiap hari tepat 2 pasal, boleh menyambung
ke kitab berikutnya (mis. **Imamat 27 & Bilangan 1**).

1. Apps Script: tempel `Code.gs` baru → Save → Deploy → Manage deployments → ✏️ → New version → Deploy.
2. GitHub: salin `index.html`, `admin.html`, `assets/app.js`, `assets/admin.js`, `assets/common.js`, `apps-script/Code.gs` → push.
3. Buka Google Sheet, **refresh** halamannya → menu **📖 Tekun Baca → Ratakan jadwal ke depan**.
   Akan muncul ringkasan perubahan dulu; klik **Yes** untuk menerapkan.

Catatan:
- Hari yang sudah lewat, hari ini, dan hari yang sudah ada laporannya tidak diubah.
- Jadwal lama otomatis disimpan sebagai sheet "Cadangan Jadwal …".
- Renungan yang sudah diupload untuk hari ke depan ikut dipindah sesuai pasalnya.
- Total pasal Alkitab ganjil (1.189), jadi hari terakhir hanya Wahyu 22.
- Mau kembali ke cara lama? Ubah Pengaturan "Pasal Lintas Kitab" menjadi `Tidak`.

## Update ke versi 5

Versi 5 menambah **renungan harian**:
- **Anggota**: kartu ringkas "Renungan hari ini" di bawah tombol *Sudah saya baca*. Ketuk untuk membaca layar penuh
  (A−/A+ ukuran huruf, Salin, ‹ › renungan sebelumnya, ketuk judul untuk daftar semua tanggal).
  Kalau belum diupload: "Renungan hari ini belum tersedia" + tautan ke renungan kemarin.
- **Admin / Pendeta**: menu **Renungan**. Tempel teks dari WhatsApp apa adanya. Tanggal di baris pertama
  dikenali otomatis (Guidelines jadi patokan utama; salah ketik tahun ditoleransi), ada pratinjau.
  Bisa diupload untuk **semua hari di jadwal (s/d Wahyu)**, termasuk hari yang sudah lewat; renungan baru muncul
  di aplikasi anggota pada harinya. Ada *Pilih tanggal* dan *Hari kosong berikutnya* untuk upload banyak sekaligus.
- **PIN Renungan** (baris baru di sheet Pengaturan): PIN khusus pendeta yang **hanya** bisa mengelola renungan.

Langkah (urutan penting: Google Sheet dulu, baru GitHub):
1. Apps Script → ganti seluruh isi `Code.gs` dengan versi 5 → Save.
2. Jalankan **`setupAwal`** → membuat sheet **Renungan** dan baris **PIN Renungan** di Pengaturan (data lama aman).
3. Isi **PIN Renungan** di sheet Pengaturan (minimal 8 karakter, beda dengan PIN Admin) → berikan ke pendeta.
4. Deploy → Manage deployments → ✏️ → *New version* → Deploy. Cek URL `/exec` menampilkan `"versi":3.3`.
5. GitHub: timpa `index.html`, `admin.html`, `assets/app.js`, `assets/admin.js`, `assets/common.js`, `assets/style.css` → commit → push.
   Jangan ganti `config.js`.
6. Pendeta membuka `…/admin.html` dan masuk dengan **PIN Renungan** → hanya melihat menu Renungan.

Kapasitas: 1 renungan ±3 KB; seluruh program (±590 hari) ±2 MB di sheet Renungan. Satu sel muat 50.000 karakter
(aplikasi membatasi 30.000 per renungan). Anggota hanya mengunduh renungan hari ini (ikut permintaan yang sudah ada);
renungan lain diambil saat dibuka dan disimpan di HP.

---

## Update ke versi 4

Versi 4 hanya mengubah **halaman anggota** (tidak ada perubahan Google Sheet / Apps Script):
- **Kirim ke grup WA** (kartu paling bawah): bacaan hari ini langsung siap, tinggal **Kirim ke WA** atau **Salin**.
  Tombol **Pilih lain** untuk mengirim bacaan yang tertinggal; pasal yang menyambung digabung (`Kejadian 29-34 ✅`),
  yang tidak menyambung jadi baris baru. Tanda bisa ✅ atau ✓.
- **Beberapa akun di satu HP**: tombol bulat di kanan atas → daftar akun → pindah akun / **Tambah akun** dengan
  menempel link pribadi atau mengetik kodenya. Saat data sedang diperbarui, muncul cincin berputar di tombol itu.

Langkah:
1. Pastikan Apps Script sudah **versi 3** (kalau belum, kerjakan dulu langkah 1–4 di bagian *Update ke versi 3*).
2. Di GitHub: **Add file → Upload files** → seret `index.html`, `admin.html`, dan folder `assets` → **Commit changes**.
   Jangan ganti `config.js`.
3. Tunggu 2–10 menit, lalu buka link pribadi Anda. Kalau masih tampilan lama, tutup tab lalu buka lagi.

---

## Update ke versi 3

Versi 3 menambah **keamanan** (PIN admin minimal 8 karakter, kunci otomatis setelah 5x PIN salah, link lebih acak),
**kecepatan** (web langsung tampil dari data terakhir di HP, cache server, sheet Ringkasan) dan **coba ulang otomatis**
saat server sibuk. Semua data lama dan link anggota yang sudah dibagikan **tetap berlaku**.

**Urutannya penting: Google Sheet dulu, baru GitHub.**

1. **Ganti PIN admin** (kalau masih pendek): Google Sheet → sheet **Pengaturan** → baris *PIN Admin* → isi minimal 8 karakter.
2. **Ganti kode Apps Script**: Extensions → Apps Script → buka `Code.gs` → pilih semua (Ctrl+A) → hapus →
   tempel isi `apps-script/Code.gs` versi 3 → 💾 Save.
3. **Jalankan `setupAwal`** (pilih di toolbar → ▶ Run). Ini aman: tidak menghapus data. Ia membuat sheet **Ringkasan**
   dan menambah kolom **Aksi** di sheet Laporan. Kalau Google meminta izin lagi, izinkan.
4. **Deploy versi baru**: Deploy → **Manage deployments** → ✏️ (Edit) → *Version*: **New version** → **Deploy**.
   URL tetap sama, jadi `config.js` **tidak perlu diubah**.
5. **Update website di GitHub**: buka repo → **Add file → Upload files** → seret `index.html`, `admin.html`, dan folder `assets`
   dari paket update → **Commit changes**. **Jangan** upload/ganti `config.js` (isinya URL milik Anda).
6. Tunggu 2–10 menit (GitHub Pages butuh waktu memperbarui), lalu buka halaman admin dan masuk dengan PIN baru.
   Kalau masih tampilan lama, tutup tab lalu buka lagi.

---

## Pertanyaan umum

**Login admin "dikunci"?**
Setelah 5x PIN salah, login admin dikunci 15 menit (pencegahan tebak-tebakan PIN). Halaman anggota tidak terpengaruh.
Pemilik Sheet bisa membukanya langsung: menu **📖 Tekun Baca → Buka kunci login admin**.

**Data di Sheet saya ubah manual, kok web belum berubah?**
Edit sel biasa langsung terbaca. Tapi menghapus/menyisipkan baris tidak terdeteksi otomatis; tunggu maks. 10 menit atau
tekan tombol ⟳ di halaman admin. Kalau Anda mengubah sheet Laporan, jalankan **📖 Tekun Baca → Hitung ulang Ringkasan**.


**Menambah anggota?**
Tambah baris nama di sheet **Anggota**. Kode link dibuat otomatis begitu halaman admin dimuat ulang
(atau lewat menu **📖 Tekun Baca → Buat kode link untuk anggota baru**). Setelah itu kirim link-nya lewat WA dari menu Emoji & Link.

**Mengeluarkan anggota?**
Isi kolom *Aktif* dengan `Tidak`. Link-nya langsung tidak berlaku, tetapi riwayatnya tetap tersimpan.

**Link seseorang bocor / HP hilang?**
Admin → ketuk nama orang itu → **Ganti link** (ketuk dua kali untuk konfirmasi). Link lama langsung mati,
riwayat bacaannya tetap aman. Kirim link baru ke orang tersebut.

**Siapa yang bisa melihat apa?**
- Tanpa link pribadi: tidak bisa melihat apa-apa.
- Dengan link pribadi: progres sendiri + status teman-teman hari ini (sama seperti rekap di grup WA).
- Admin (PIN): semua data, checklist, emoji, dan link.
- Google Sheet-nya sendiri tetap privat milik Anda.

**Saya mengubah `Code.gs`, kok tidak berubah?**
Setiap kali kode Apps Script diubah, deploy ulang: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**.
URL tetap sama, jadi `config.js` tidak perlu diubah.

**Hati-hati mengubah jadwal setelah berjalan.**
Laporan disimpan berdasarkan nomor *Hari ke*. Mengubah **tanggal** di sheet Jadwal aman (misal ada libur Natal → geser tanggalnya).
Mengubah **urutan bacaan** setelah ada laporan bisa membuat laporan lama tidak cocok.

**Mode demo**
Selama `API_URL` di `config.js` masih kosong, web berjalan dengan data contoh (tersimpan di browser saja, PIN admin demo `1234`).

**Biaya?**
Rp0. GitHub Pages dan Google Apps Script gratis; kuotanya jauh di atas kebutuhan kelompok baca puluhan orang.
