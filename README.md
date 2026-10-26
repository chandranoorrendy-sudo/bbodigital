# BBO Digital — Kuttab Imam Al-Ghazali

Aplikasi web (PWA) pengganti lembar **Belajar Bersama Orang Tua (BBO)** cetak untuk Kuttab Awal 1–2.
Stack: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui, Supabase (Auth OTP email, Postgres + RLS, Storage privat).

## Status: Tahap 1 — Fondasi

- [x] Project Supabase `bbo-kuttab` (Singapore, `ap-southeast-1`)
- [x] Migrasi seluruh tabel PRD bagian 7 (`supabase/migrations`)
- [x] Kebijakan RLS PRD bagian 8 + uji dua akun orang tua (`supabase/tests/rls_test.sql`)
- [x] Bucket privat `bbo-content` dan `submissions` beserta kebijakannya
- [x] Seed: 1 tahun ajaran, KA2A & KA2B, 1 guru Iman, 1 guru Qur'an, 1 admin, 4 santri rekaan, 3 akun orang tua,
      Lembar 11 & 12 versi kartu Inti / Pengayaan / Untuk Ayah Bunda (`supabase/seed.sql`)
- [x] Login OTP email 6 angka, sesi 30 hari, beranda orang tua (tab kakak-adik), halaman "Kelas saya" guru

## Menjalankan di komputer

```bash
cp .env.example .env.local
npm install
npm run dev
```

Buka http://localhost:3000. Untuk mencoba dari HP di Wi-Fi yang sama: `npm run dev -- -H 0.0.0.0`,
lalu buka `http://<IP-laptop>:3000` (catatan: kamera/mikrofon di tahap berikutnya butuh HTTPS, jadi gunakan URL Vercel).

## Data contoh (semua nama rekaan)

| Akun | Peran | Santri |
| --- | --- | --- |
| Ortu A — Siti Aminah | orang tua (ibu) | Hafsah (KA2A), Umar (KA2B) |
| Ortu B — Ahmad Rasyid | orang tua (ayah) | Zaid (KA2B) |
| Ortu C — Fatimah Zahra | orang tua (ibu) | Maryam (KA2A) |
| Ustadzah Rahma Fadhilah | guru Iman, wali kelas KA2A & KA2B | — |
| Ustadz Hamzah Ibrahim | guru Qur'an KA2A & KA2B | — |
| Admin Kuttab | admin | — |

Email seed memakai domain `.test` (tidak bisa menerima surat). Mailer bawaan Supabase hanya mengirim ke email
anggota tim project, jadi untuk mencoba login ganti email salah satu akun ke email Anda:

```sql
update auth.users set email = 'anda@contoh.com' where id = 'a0000000-0000-4000-8000-00000000000a'; -- Ortu A
```

Untuk banyak orang tua sungguhan, pasang SMTP sendiri (Auth → SMTP Settings).

## Pengaturan Supabase Auth

- **URL Configuration** (sudah diatur): Site URL `https://bbo-kuttab-xzcy.vercel.app`, Redirect URLs
  `https://bbo-kuttab-xzcy.vercel.app/auth/callback` dan `http://localhost:3000/auth/callback`.
- **Kode 6 angka**: mailer bawaan Supabase memakai template tetap yang hanya berisi *tautan* masuk
  (aplikasi menanganinya di `/auth/callback`; buka tautan di HP yang sama dengan tempat meminta kode).
  Agar email berisi kode 6 angka, pasang SMTP sendiri (Auth → Emails → SMTP Settings, mis. Resend/Brevo gratis),
  lalu ubah template **Magic link or OTP** menjadi misalnya
  `<h2>Kode masuk BBO</h2><p>Kode Anda: <strong>{{ .Token }}</strong></p>`.

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
