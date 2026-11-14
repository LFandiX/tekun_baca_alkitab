# 📖 Tekun Baca Firman

Web lapor progres baca Alkitab bersama, dibuat untuk dipakai di HP.
**Gratis**: tampilan di GitHub Pages, data di Google Sheets.

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
| **Pengaturan** | Nama kelompok, PIN admin, jadwal, emoji | **Ganti `PIN Admin`!** Cek tanggal mulai & hari libur |
| **Anggota** | Nama, Kode Link (otomatis), Aktif | Lengkapi nama anggota. Kolom Kode Link **jangan diisi manual** |
| **Jadwal** | Hari ke, tanggal, bacaan | Dibuat otomatis, cek apakah sudah sesuai |
| **Laporan** | Terisi otomatis saat ada yang lapor | Jangan diubah manual kecuali perlu |

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

## Pertanyaan umum

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
