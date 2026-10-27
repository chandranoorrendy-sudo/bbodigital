# BBO Digital — Kuttab Imam Al-Ghazali

Aplikasi web (PWA) pengganti lembar **Belajar Bersama Orang Tua (BBO)** cetak untuk Kuttab Awal 1–2.
Stack: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui, Supabase (Auth OTP email, Postgres + RLS, Storage privat).

## Status: Tahap 1 — Fondasi

- [x] Project Supabase `BBO Digital SG` (`lzceknfriyavdvvvvjgq`, Singapore `ap-southeast-1`, organisasi RQ25)
- [x] Situs: https://bbodigital.vercel.app (Vercel tim RQ25, repo `chandranoorrendy-sudo/bbodigital`)
- [x] Migrasi seluruh tabel PRD bagian 7 (`supabase/migrations`)
- [x] Kebijakan RLS PRD bagian 8 + uji dua akun orang tua (`supabase/tests/rls_test.sql`)
- [x] Bucket privat `bbo-content` dan `submissions` beserta kebijakannya
- [x] Seed: 1 tahun ajaran, KA2A & KA2B, 1 guru Iman, 1 guru Qur'an, 1 admin, 4 santri rekaan, 3 akun orang tua,
      Lembar 11 & 12 versi kartu Inti / Pengayaan / Untuk Ayah Bunda (`supabase/seed.sql`)
- [x] Login OTP email 6 angka, sesi 30 hari, beranda orang tua (tab kakak-adik), halaman "Kelas saya" guru

## Status: Tahap 2 — Alur orang tua inti

- [x] Sesi BBO `/bbo/[sheetId]?anak=<santri>`: Adab Bermajelis → Pembuka ("Pekan ini Ananda belajar") →
      kartu dialog Iman → Murafaqat (IPA → IPS → Berhitung → Bahasa) → Doa penutup
- [x] Kartu dialog: pertanyaan huruf besar, ayat Arab (Amiri), "Lihat jawaban yang diharapkan" (ungu),
      lipatan "Untuk Ayah Bunda", tiga tombol hasil, catatan singkat opsional
- [x] Simpan otomatis per jawaban (antrean, ulang otomatis saat sinyal kembali), adab per hari, `event_log`
- [x] Lanjut dari kartu terakhir: posisi di HP (localStorage) + `submissions.last_card_id` di server
- [x] Pratinjau tanpa login saat pengembangan: http://localhost:3000/dev/sesi (penyimpanan di memori)

## Status: Tahap 3 — Qur'an, amanah, catatan, tanda tangan

- [x] Laporan Qur'an (tilawah / tahfidz / murajaah, surat & ayat, kelancaran) + rekam suara di aplikasi,
      maks. 3 menit, Opus 24 kbps (±360 KB untuk 2 menit; iPhone memakai audio/mp4), putar ulang sebelum simpan
- [x] Amanah: centang, foto lembar amanah dikompres di HP (sisi panjang ≤ 1600 px, ±300 KB), maks. 5 foto
- [x] Log baca (Bacalah 1/2/3 / buku lain) berlanjut lintas pekan
- [x] Catatan orang tua: kendala & tindakan/solusi + foto
- [x] Tanda tangan Ayah/Ibu (kanvas → PNG di bucket privat), Kirim, Buka kembali selama belum ditanggapi
- [x] File dibaca lewat signed URL 1 jam; event `record`, `photo`, `submit`, `reopen` di `event_log`

## Status: Tahap 4 — Dashboard guru

- [x] Kelas saya: jumlah status per kelas + tombol "Tanggapi n laporan"
- [x] Status kelas `/guru/kelas/[id]`: pilih lembar, tabel santri & status, urut nama/status (tidak pernah capaian)
- [x] Laporan santri `/guru/laporan/[id]`: adab, jawaban kartu, Qur'an + pemutar rekaman, amanah + foto, log baca,
      kendala & solusi, tanda tangan
- [x] Tanggapan & paraf terpisah Iman / Qur'an, kalimat siap pakai, "Simpan, paraf & laporan berikutnya";
      tanggapan Iman mengunci laporan (`reviewed`); event `review` mencatat detik per laporan
- [x] Rekap per pertanyaan: ✓ / ○ / ○ bantuan per kartu; nama santri hanya tampil bila rincian dibuka
- [x] Beranda orang tua menampilkan tanggapan Iman & Qur'an terbaru

## Status: Tahap 5 — Penyusun BBO & admin

- [x] Penyusun BBO `/guru/bbo`: buat baru (kop + bagian standar), salin dari kelas lain/tahun lalu (draf)
- [x] Editor `/guru/bbo/[id]`: kartu Inti / Pengayaan / Untuk Ayah Bunda, dimensi Iman/Ilmu/Amal, ayat Arab,
      urutkan ↑↓, sub topik, murafaqat, amanah, target Qur'an (guru Qur'an); simpan otomatis; pratinjau HP;
      terbitkan / kembalikan ke draf / tutup. Kartu tidak bisa dihapus setelah ada laporan orang tua.
- [x] Admin `/admin`: akun username + kata sandi (fungsi `admin_create_account`, `admin_reset_password`, tanpa
      service key), tautan orang tua–santri, santri & persetujuan penelitian, kelas & penugasan guru, tahun ajaran
- [x] Pratinjau tanpa login saat pengembangan: `/dev/editor`

## Integrasi Metiq — laporan PR matematika

Metiq (https://metiq-math.vercel.app) mengirim laporan setiap kali santri menuntaskan tugas matematika
(semua keterampilan SmartScore ≥ 80, atau ditandai selesai oleh orang tua). Santri dicocokkan lewat **NISN**.

- `students.nisn` (10 digit, unik) diisi admin di `/admin` → Santri.
- Metiq memanggil `POST https://lzceknfriyavdvvvvjgq.supabase.co/rest/v1/rpc/metiq_ingest` dengan header
  `apikey: <publishable key BBO>` dan isi `{"p_secret": "...", "p_report": {...}}`. Fungsi ini memeriksa
  `sha256(p_secret)` terhadap `integration_secrets` (`name = 'metiq'`), menyimpan ke `metiq_reports`
  (kiriman ulang dengan `id` sama hanya memperbarui), dan membalas `{"ok": true, "matched": true|false}`.
- Laporan dengan NISN yang belum terdaftar tetap disimpan dan tampil di admin sebagai **Laporan Metiq belum cocok**;
  begitu NISN diisi, laporan tertaut otomatis.
- Tampil di laporan santri untuk guru (`/guru/laporan/[id]`, bagian 📐 Laporan Metiq) dan di beranda orang tua.
  Hanya guru kelas santri, orang tuanya, dan admin yang bisa membaca; tidak ada yang bisa menulis langsung.
- Uji: jalankan `supabase/tests/metiq_test.sql` di SQL Editor (semua baris harus `LULUS`, semua di-rollback).

### Menyambungkan (sekali saja)

1. **Di SQL Editor BBO** (project `lzceknfriyavdvvvvjgq`), buat rahasia acak dan simpan hash-nya. Rahasia asli hanya
   tampil sekali di hasil query — salin sekarang:

   ```sql
   with s as (select encode(extensions.gen_random_bytes(32), 'hex') as rahasia),
        simpan as (
          insert into public.integration_secrets (name, secret_hash)
          select 'metiq', encode(sha256(convert_to(rahasia, 'UTF8')), 'hex') from s
          on conflict (name) do update set secret_hash = excluded.secret_hash
        )
   select rahasia from s;
   ```

2. **Di SQL Editor Metiq**, tempel rahasia tadi (publishable key BBO memang boleh publik):

   ```sql
   insert into public.integrations (name, url, apikey, secret)
   values ('bbo', 'https://lzceknfriyavdvvvvjgq.supabase.co', 'sb_publishable_nl6O2vlu_hx-3EHQqSWhOw_FI-ndT5b', '<rahasia>')
   on conflict (name) do update set url = excluded.url, apikey = excluded.apikey, secret = excluded.secret, enabled = true;
   ```

3. Isi NISN santri di BBO (`/admin` → Santri) dan di Metiq. Tugas yang tuntas berikutnya akan muncul di BBO;
   di Metiq statusnya menjadi "Diterima".

Mengganti rahasia: ulangi langkah 1 dan 2. Rahasia lama langsung tidak berlaku.

## Formulir KA2A dan kisi-kisi

BBO dan kisi-kisi disusun ustadz/ustadzah langsung di editor web (tanpa impor otomatis dari PDF/foto).

- [x] Formulir: foto hasil kerja per murafaqat (mis. tulisan huruf), Lembar Mutaba'ah Al-Qur'an
      (Makharijul Huruf, Shifatul Huruf, Itmamul Harokat, Mad, Ghunnah, Kelancaran), Riaayah Adab
      (selalu/sering/jarang/tidak pernah).
- [x] Kisi-kisi ujian semester: guru `/guru/kisi`, orang tua `/kisi?anak=` (centang "sudah dilatih di rumah",
      hanya dibandingkan dengan diri sendiri).

## Menjalankan di komputer

```bash
cp .env.example .env.local
npm install
npm run dev
```

Buka http://localhost:3000. Untuk mencoba dari HP di Wi-Fi yang sama: `npm run dev -- -H 0.0.0.0`,
lalu buka `http://<IP-laptop>:3000` (catatan: kamera/mikrofon di tahap berikutnya butuh HTTPS, jadi gunakan URL Vercel).

## Data contoh (semua nama rekaan)

| Username | Peran | Santri |
| --- | --- | --- |
| `ayah.hafsah` | orang tua | Hafsah (KA2A), Umar (KA2B) |
| `ayah.zaid` | orang tua (ayah) | Zaid (KA2B) |
| `bunda.maryam` | orang tua (ibu) | Maryam (KA2A) |
| `ust.rahma` | guru Iman, wali kelas KA2A & KA2B | — |
| `ust.hamzah` | guru Qur'an KA2A & KA2B | — |
| `admin.kuttab`, `rendy`, `diana` | admin | — |

## Login: username + kata sandi (tanpa email)

Seperti IXL: username dan kata sandi diberikan guru/admin. Supabase Auth tetap butuh email, jadi username
dipetakan ke `<username>@bbo-kuttab.invalid` (domain `.invalid` tidak pernah menerima surat). Format username:
huruf kecil, angka, titik, garis bawah, 3–30 karakter.

Kata sandi uji tersimpan di `akun-uji.local.md` (tidak ikut ke Git). Membuat/mengganti kata sandi sementara lewat SQL:

```sql
update auth.users set encrypted_password = extensions.crypt('<sandi-baru>', extensions.gen_salt('bf'))
where email = '<username>@bbo-kuttab.invalid';
```

Halaman admin untuk membuat akun dan mengatur ulang kata sandi menyusul di Tahap 5.

## Pengaturan Supabase

- Project baru wajib menjalankan semua migrasi, termasuk `20261027000001_explicit_grants.sql`: project Supabase
  baru tidak lagi otomatis memberi hak tabel ke `authenticated`.

## Uji RLS

Jalankan isi `supabase/tests/rls_test.sql` di SQL Editor. Skrip berpura-pura menjadi Ortu A, Ortu B, guru, dan pengunjung
tanpa login, lalu menampilkan tabel `LULUS/GAGAL`; semua perubahan di-rollback.

## Struktur

```
src/app/masuk          login email → kode OTP
src/app/beranda        beranda orang tua (BBO aktif, progres kartu Inti, tanggapan guru)
src/app/guru           kelas saya (jumlah status, tanpa skor)
src/middleware.ts      penyegaran sesi + wajib login
supabase/migrations    skema, RLS, storage, fungsi
supabase/seed.sql      data contoh rekaan
supabase/tests         uji RLS, uji integrasi Metiq
```
