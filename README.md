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
supabase/tests         uji RLS
```
