-- Seed Tahap 1 — semua nama santri, orang tua, dan guru adalah REKAAN.
-- 1 tahun ajaran, kelas KA2A & KA2B, 1 guru Iman, 1 guru Qur'an, 1 admin,
-- 4 santri, 3 akun orang tua, serta Lembar 11 & 12 (Tema 7. Tata Surya, Bulan)
-- yang sudah diubah menjadi kartu Inti / Pengayaan / Untuk Ayah Bunda (PRD bagian 4).
--
-- Login memakai username + kata sandi (seperti IXL). Username = bagian depan email
-- internal <username>@bbo-kuttab.invalid. Seed TIDAK berisi kata sandi; atur setelah seed:
--   update auth.users set encrypted_password = extensions.crypt('<sandi>', extensions.gen_salt('bf'))
--   where email = 'ayah.zaid@bbo-kuttab.invalid';

-- ---------------------------------------------------------------------------
-- Akun (auth.users + identities). Profil dibuat otomatis oleh trigger.
-- ---------------------------------------------------------------------------
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin.kuttab@bbo-kuttab.invalid',          'Admin Kuttab'),
      ('a0000000-0000-4000-8000-000000000002'::uuid, 'ust.rahma@bbo-kuttab.invalid', 'Ustadzah Rahma Fadhilah'),
      ('a0000000-0000-4000-8000-000000000003'::uuid, 'ust.hamzah@bbo-kuttab.invalid',  'Ustadz Hamzah Ibrahim'),
      ('a0000000-0000-4000-8000-00000000000a'::uuid, 'bunda.hafsah@bbo-kuttab.invalid','Siti Aminah (Bunda Hafsah & Umar)'),
      ('a0000000-0000-4000-8000-00000000000b'::uuid, 'ayah.zaid@bbo-kuttab.invalid',      'Ahmad Rasyid (Ayah Zaid)'),
      ('a0000000-0000-4000-8000-00000000000c'::uuid, 'bunda.maryam@bbo-kuttab.invalid',   'Fatimah Zahra (Bunda Maryam)')
    ) as t(id, email, full_name)
  loop
    insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, now(),
            '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name),
            now(), now(), '', '', '', '')
    on conflict (id) do nothing;

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now())
    on conflict (provider_id, provider) do nothing;
  end loop;
end $$;

update public.profiles set role = 'admin'   where id = 'a0000000-0000-4000-8000-000000000001';
update public.profiles set role = 'teacher' where id in ('a0000000-0000-4000-8000-000000000002',
                                                          'a0000000-0000-4000-8000-000000000003');

-- ---------------------------------------------------------------------------
-- Tahun ajaran, kelas, penugasan guru
-- ---------------------------------------------------------------------------
insert into public.academic_years (id, label, start_date, end_date, is_active) values
  ('10000000-0000-4000-8000-000000000001', '2026/2027', '2026-07-13', '2027-06-25', true);

insert into public.classes (id, academic_year_id, level, section, name) values
  ('20000000-0000-4000-8000-00000000002a', '10000000-0000-4000-8000-000000000001', 'KA2', 'A', 'Kuttab Awal 2A'),
  ('20000000-0000-4000-8000-00000000002b', '10000000-0000-4000-8000-000000000001', 'KA2', 'B', 'Kuttab Awal 2B');

insert into public.class_teachers (class_id, teacher_id, subject, is_homeroom) values
  ('20000000-0000-4000-8000-00000000002a', 'a0000000-0000-4000-8000-000000000002', 'iman',  true),
  ('20000000-0000-4000-8000-00000000002b', 'a0000000-0000-4000-8000-000000000002', 'iman',  true),
  ('20000000-0000-4000-8000-00000000002a', 'a0000000-0000-4000-8000-000000000003', 'quran', false),
  ('20000000-0000-4000-8000-00000000002b', 'a0000000-0000-4000-8000-000000000003', 'quran', false);

-- ---------------------------------------------------------------------------
-- Santri rekaan & orang tua
--   Ortu A (Bunda) : Hafsah (KA2A) dan Umar (KA2B) — kakak-adik
--   Ortu B (Ayah)  : Zaid (KA2B)
--   Ortu C (Bunda) : Maryam (KA2A)
-- ---------------------------------------------------------------------------
insert into public.students (id, full_name, nickname, class_id, birth_year, research_consent, consent_signed_at) values
  ('30000000-0000-4000-8000-000000000001', 'Hafsah Nur Azizah',          'Hafsah', '20000000-0000-4000-8000-00000000002a', 2019, true,  now()),
  ('30000000-0000-4000-8000-000000000002', 'Umar Faruq Azzam',           'Umar',   '20000000-0000-4000-8000-00000000002b', 2019, true,  now()),
  ('30000000-0000-4000-8000-000000000003', 'Zaid Abdullah Rasyid',       'Zaid',   '20000000-0000-4000-8000-00000000002b', 2019, true,  now()),
  ('30000000-0000-4000-8000-000000000004', 'Maryam Khadijah Salsabila',  'Maryam', '20000000-0000-4000-8000-00000000002a', 2019, false, null);

insert into public.guardians (profile_id, student_id, relation) values
  ('a0000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-000000000001', 'ibu'),
  ('a0000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-000000000002', 'ibu'),
  ('a0000000-0000-4000-8000-00000000000b', '30000000-0000-4000-8000-000000000003', 'ayah'),
  ('a0000000-0000-4000-8000-00000000000c', '30000000-0000-4000-8000-000000000004', 'ibu');

-- ---------------------------------------------------------------------------
-- Konten BBO KA2B: Lembar 11 & 12, lalu disalin ke KA2A (GU-2).
-- Tanggal disesuaikan ke tahun ajaran rekaan 2026/2027 agar bisa dicoba sekarang.
-- ---------------------------------------------------------------------------
do $$
declare
  v_opening text := 'Barakallahu fiikum Ayah Bunda yang sudah berjuang hingga saat ini. Allah sebaik-baik pemberi balasan atas semua perjuangan Ayah Bunda. Dialog BBO boleh dicicil sedikit-sedikit setiap hari, di waktu dan tempat yang nyaman.';
  v_ustadzah uuid := 'a0000000-0000-4000-8000-000000000002';
  v_ka2b uuid := '20000000-0000-4000-8000-00000000002b';
  v_ka2a uuid := '20000000-0000-4000-8000-00000000002a';
  s11 uuid := '40000000-0000-4000-8000-000000001101';
  s12 uuid := '40000000-0000-4000-8000-000000001201';
  sec uuid;
  v_copy uuid;
begin
  -- ===================== LEMBAR 11 =====================
  insert into public.bbo_sheets (id, class_id, sheet_no, title, start_date, end_date, hijri_range, kbm_weeks,
                                 theme, subtheme, core_topic, opening_note, status, created_by)
  values (s11, v_ka2b, 11, 'Bulan: Cahaya Sempurna', '2026-10-19', '2026-10-23',
          '8–12 Jumadil Awal 1448 H', 'Pekan 10 KBM', '7. Tata Surya', '7.2 Bulan',
          '7.2.1 Cahaya Sempurna; Hubungan Bulan dan Matahari', v_opening, 'published', v_ustadzah);

  insert into public.bbo_sections (sheet_id, kind, title, position) values (s11, 'adab', 'Adab Bermajelis', 1);

  insert into public.bbo_sections (sheet_id, kind, title, position) values (s11, 'iman', 'Cahaya Sempurna', 2)
  returning id into sec;
  insert into public.bbo_cards (section_id, position, tier, dimension, prompt, expected_answer, parent_note,
                                ayah_arabic, ayah_translation, ayah_ref) values
  (sec, 1, 'inti', 'iman',
   'Allah bercerita tentang bulan purnama di Al-Qur''an. Surat apa?',
   'Surat Al-Insyiqaq. "Wal qamari idzat tasaq."',
   'Ayat 16–19 adalah sumpah Allah demi syafaq (cahaya merah senja), malam, dan bulan purnama, lalu: "sungguh, kamu akan menjalani tingkat demi tingkat". Ibnu Katsir menjelaskan manusia mengalami fase demi fase: disusui lalu disapih, muda lalu tua, sulit lalu ringan, sehat lalu sakit. (Terjemah Tafsir Ibnu Katsir, hlm. 92–93)',
   'وَٱلْقَمَرِ إِذَا ٱتَّسَقَ', 'Dan demi bulan apabila jadi purnama.', 'QS. Al-Insyiqaq: 18'),
  (sec, 2, 'inti', 'ilmu',
   'Kapan bulan bulat penuh?',
   'Tanggal 13, 14, 15 Hijriah.',
   'Purnama terjadi sekitar tanggal 13, 14, dan 15 bulan Hijriah. Bisa ditunjukkan langsung di langit malam bila cuaca cerah.',
   null, null, null),
  (sec, 3, 'pengayaan', 'ilmu',
   'Bentuk bulan berubah-ubah setiap malam. Bentuk apa saja yang Ananda tahu?',
   'Sabit, separuh, bulat penuh.',
   'Fase bulan: hilal/sabit muda, separuh (kuartal awal), purnama, separuh (kuartal akhir), sabit tua. Seperti manusia yang punya fase kehidupan, malam pun bertahap mulai dari syafaq.',
   null, null, null),
  (sec, 4, 'pengayaan', 'ilmu',
   'Apa yang terjadi pada air laut saat bulan purnama?',
   'Air laut naik, namanya pasang.',
   'Gravitasi bulan menyebabkan pasang surut air laut; saat purnama dan bulan baru pasang lebih tinggi.',
   null, null, null),
  (sec, 5, 'inti', 'amal',
   'Saat bulan purnama, puasa sunnah apa yang bisa kita kerjakan?',
   'Puasa Ayyamul Bidh.',
   'Keutamaan puasa Ayyamul Bidh (13, 14, 15 Hijriah): menghidupkan sunnah; puasa 3 hari setiap bulan seperti puasa sepanjang tahun (HR. Bukhari no. 1979); memberi istirahat bagi anggota badan. Bagi Ananda cukup dikenalkan atau dicoba setengah hari.',
   null, null, null);

  insert into public.bbo_sections (sheet_id, kind, title, position) values (s11, 'iman', 'Hubungan Bulan dan Matahari', 3)
  returning id into sec;
  insert into public.bbo_cards (section_id, position, tier, dimension, prompt, expected_answer, parent_note,
                                ayah_arabic, ayah_translation, ayah_ref) values
  (sec, 1, 'inti', 'iman',
   'Bulan bersinar sendiri, atau cahayanya dari mana?',
   'Dari matahari.',
   'Tafsir QS. Asy-Syams: 2 (mengambil pendapat Al-Farra''): bulan bersinar karena memantulkan cahaya matahari. (Terjemah Tafsir At-Thabari, QS. Asy-Syams: 2, hlm. 434)',
   'وَٱلْقَمَرِ إِذَا تَلَىٰهَا', 'Dan demi bulan apabila mengiringinya.', 'QS. Asy-Syams: 2'),
  (sec, 2, 'inti', 'ilmu',
   'Bulan terbit dari mana?',
   'Dari timur, sama seperti matahari.',
   null, null, null, null),
  (sec, 3, 'pengayaan', 'ilmu',
   'Saat gerhana bulan, bumi ada di mana?',
   'Di tengah, di antara matahari dan bulan.',
   'Gerhana bulan: bumi di antara matahari dan bulan, bulan masuk bayang-bayang bumi. Gerhana matahari: bulan di antara bumi dan matahari sehingga menghalangi cahaya matahari, kadang total. Bisa diperagakan dengan senter (matahari), bola (bumi), dan jeruk (bulan).',
   null, null, null),
  (sec, 4, 'inti', 'ilmu',
   'Bolehkah melihat matahari langsung saat gerhana?',
   'Tidak boleh, harus pakai kacamata khusus.',
   'Biasanya mata silau sehingga pupil mengecil. Saat gerhana suasana redup, pupil tidak mengecil, padahal radiasi ultraviolet tetap tinggi dan bisa merusak retina tanpa terasa.',
   null, null, null),
  (sec, 5, 'inti', 'amal',
   'Kalau ada gerhana, apa yang kita lakukan?',
   'Berdoa, bertakbir, shalat gerhana, dan bersedekah.',
   '"Sesungguhnya matahari dan bulan adalah dua tanda dari tanda-tanda keagungan Allah. Keduanya tidak mengalami gerhana karena kematian atau kehidupan seseorang. Jika kalian melihatnya, berdoalah, bertakbirlah, shalatlah, dan bersedekahlah." (HR. Bukhari no. 1044). Shalat khusuf untuk gerhana bulan, shalat kusuf untuk gerhana matahari.',
   null, null, null),
  (sec, 6, 'pengayaan', 'iman',
   'Apakah gerhana terjadi karena ada orang yang meninggal?',
   'Tidak. Gerhana tanda kebesaran Allah.',
   'Gerhana matahari pernah bertepatan dengan wafatnya Ibrahim, putra Rasulullah ﷺ. Orang-orang mengira keduanya berkaitan, lalu Rasulullah ﷺ menegaskan bahwa gerhana tidak terjadi karena kematian atau kelahiran seseorang (HR. Bukhari).',
   null, null, null);

  insert into public.bbo_sections (sheet_id, kind, title, position) values
    (s11, 'murafaqat', 'Murafaqat', 4),
    (s11, 'quran', 'Qur''an', 5),
    (s11, 'amanah', 'Amanah Orang Tua', 6),
    (s11, 'catatan', 'Catatan Orang Tua', 7);

  insert into public.murafaqat_items (sheet_id, subject, learned, home_practice, position) values
  (s11, 'ipa', 'Fase bulan, serta terjadinya gerhana bulan dan gerhana matahari.',
   'Malam ini lihat bulan bersama Ananda dan tanyakan bentuknya. Peragakan gerhana dengan senter, bola, dan jeruk.', 1),
  (s11, 'ips', 'Adab saat gerhana (berdoa, bertakbir, shalat, sedekah, dan memakai kacamata khusus saat gerhana matahari). Sunnah puasa Ayyamul Bidh. Kisah wafatnya Ibrahim putra Rasulullah ﷺ yang tidak berkaitan dengan gerhana.',
   'Minta Ananda menceritakan kembali apa yang dilakukan saat gerhana.', 2),
  (s11, 'berhitung', 'Lebih besar, lebih kecil, paling besar, paling kecil pada angka 1–20.',
   'Bandingkan dua tumpukan benda di rumah (kancing, sendok): mana yang lebih banyak?', 3),
  (s11, 'bahasa', 'Menulis di buku coklat; membaca di lembar latihan dan buku merah.',
   'Dampingi Ananda membaca satu halaman buku merah.', 4);

  insert into public.amanah_items (sheet_id, text, needs_photo, position) values
  (s11, 'Melakukan dialog BBO bersama Ananda sesuai panduan.', false, 1),
  (s11, 'Lampiran 1: Lembar amanah mewarnai bulan.', true, 2),
  (s11, 'Lampiran 2: Lembar amanah berhitung.', true, 3);

  insert into public.quran_targets (sheet_id, kind, description) values
  (s11, 'tilawah', 'Tilawah sesuai jilid masing-masing, 1 halaman setiap hari'),
  (s11, 'murajaah', 'Murajaah An-Naba 1–20');

  -- ===================== LEMBAR 12 =====================
  insert into public.bbo_sheets (id, class_id, sheet_no, title, start_date, end_date, hijri_range, kbm_weeks,
                                 theme, subtheme, core_topic, opening_note, status, created_by)
  values (s12, v_ka2b, 12, 'Bulan: Hitungan Waktu', '2026-10-26', '2026-10-30',
          '15–19 Jumadil Awal 1448 H', 'Pekan 11 KBM', '7. Tata Surya', '7.2 Bulan',
          '7.2.3 Bulan Hitungan Waktu', v_opening, 'published', v_ustadzah);

  insert into public.bbo_sections (sheet_id, kind, title, position) values (s12, 'adab', 'Adab Bermajelis', 1);

  insert into public.bbo_sections (sheet_id, kind, title, position) values (s12, 'iman', 'Bulan Hitungan Waktu', 2)
  returning id into sec;
  insert into public.bbo_cards (section_id, position, tier, dimension, prompt, expected_answer, parent_note,
                                ayah_arabic, ayah_translation, ayah_ref) values
  (sec, 1, 'inti', 'iman',
   'Malam Lailatul Qadar lebih baik dari berapa bulan?',
   'Seribu bulan.',
   'Kata "syahr" di ujung QS. Al-Qadr: 3 adalah bulan dalam arti hitungan waktu. Batas satu bulan Qomariyah ditentukan oleh perjalanan bulan mengelilingi bumi, 29 sampai 30 hari.',
   'لَيْلَةُ ٱلْقَدْرِ خَيْرٌ مِّنْ أَلْفِ شَهْرٍ', 'Malam kemuliaan itu lebih baik daripada seribu bulan.', 'QS. Al-Qadr: 3'),
  (sec, 2, 'inti', 'ilmu',
   'Bulan di langit namanya qamar. Kalau bulan di kalender, namanya apa?',
   'Syahr.',
   'شَهْر (syahr): bulan sebagai hitungan waktu, misalnya Muharram, Safar, Rabiul Awal. ٱلْقَمَر (qamar): bulan sebagai benda langit, misalnya bulan purnama.',
   null, null, null),
  (sec, 3, 'pengayaan', 'ilmu',
   'Ada dua kalender yang kita pakai. Apa namanya?',
   'Kalender Hijriah dan kalender Masehi.',
   'Qomariyah (Hijriah) dihitung dari peredaran bulan mengelilingi bumi. Syamsiyah (Masehi) dihitung dari peredaran bumi mengelilingi matahari.',
   null, null, null),
  (sec, 4, 'inti', 'ilmu',
   'Bagaimana kita tahu bulan Hijriah yang baru sudah mulai?',
   'Melihat hilal, bulan sabit.',
   'Islam memilih penanggalan Qomariyah karena Islam agama yang mudah: cukup dengan melihat hilal, bisa diketahui oleh orang ummi maupun orang terpelajar. Penanggalan matahari membutuhkan perhitungan benda langit yang rumit.',
   null, null, null),
  (sec, 5, 'inti', 'amal',
   'Ibadah apa yang waktunya kita ketahui dari hilal?',
   'Puasa Ramadhan, hari raya, dan haji.',
   'Hilal menjadi tanda waktu ibadah: haji, puasa Ramadhan, zakat yang sudah satu tahun, bulan-bulan haram; juga untuk mengetahui lama kehamilan dan mencatat peristiwa penting. (QS. Yunus: 5; QS. Al-Baqarah: 189)',
   null, null, null),
  (sec, 6, 'pengayaan', 'ilmu',
   'Berapa hari bulan mengelilingi bumi?',
   '29 atau 30 hari.',
   null, null, null, null),
  (sec, 7, 'inti', 'ilmu',
   'Di bulan Hijriah apa Ananda berpuasa sebulan penuh?',
   'Bulan Ramadhan.',
   'Bila Ananda senang, ajak menyebut 12 bulan Hijriah dengan lagu: Muharram, Safar, Rabiul Awal, Rabiul Akhir, Jumadil Awal, Jumadil Akhir, Rajab, Sya''ban, Ramadhan, Syawal, Dzulqa''dah, Dzulhijjah.',
   null, null, null),
  (sec, 8, 'pengayaan', 'ilmu',
   'Sebutkan nama-nama bulan Hijriah yang Ananda ingat.',
   'Muharram, Safar, Rabiul Awal, ... Ramadhan, Syawal, Dzulqa''dah, Dzulhijjah.',
   'Boleh dengan lagu atau audio. Tidak harus hafal semua.',
   null, null, null),
  (sec, 9, 'pengayaan', 'ilmu',
   'Sebutkan nama-nama bulan Masehi yang Ananda ingat.',
   'Januari, Februari, Maret, ... Desember.',
   null, null, null, null),
  (sec, 10, 'inti', 'iman',
   'Berapa lama Ashabul Kahfi tertidur di gua?',
   '300 tahun, ditambah 9 tahun.',
   'Hitungan untuk Ayah Bunda: tahun Masehi 365–366 hari, tahun Hijriah 354–355 hari (selisih sekitar 11 hari), sehingga selisihnya sekitar 3 tahun setiap 100 tahun. 100 × 365 = 36.500 hari; 36.500 ÷ 354 ≈ 103 tahun Hijriah. Maka 300 tahun Masehi ≈ 309 tahun Hijriah — salah satu mukjizat Al-Qur''an di bidang astronomi.',
   'وَلَبِثُوا فِي كَهْفِهِمْ ثَلَاثَ مِائَةٍ سِنِينَ وَازْدَادُوا تِسْعًا', 'Dan mereka tinggal dalam gua selama tiga ratus tahun dan ditambah sembilan tahun.', 'QS. Al-Kahfi: 25'),
  (sec, 11, 'inti', 'amal',
   'Pemuda Ashabul Kahfi menjaga imannya. Apa yang Ananda lakukan untuk menjaga iman?',
   'Shalat, berdoa, dan berteman dengan anak yang shalih.',
   'Kartu Amal ini usulan penyesuaian untuk KA2 (pola Iman → Ilmu → Amal). Jawaban Ananda boleh berbeda selama berupa amal nyata.',
   null, null, null);

  insert into public.bbo_sections (sheet_id, kind, title, position) values
    (s12, 'murafaqat', 'Murafaqat', 3),
    (s12, 'quran', 'Qur''an', 4),
    (s12, 'amanah', 'Amanah Orang Tua', 5),
    (s12, 'catatan', 'Catatan Orang Tua', 6);

  insert into public.murafaqat_items (sheet_id, subject, learned, home_practice, position) values
  (s12, 'ipa', 'Peredaran bumi, bulan, dan matahari yang berkaitan dengan waktu.',
   'Tandai tanggal Hijriah di kalender rumah, lalu lihat bentuk bulan beberapa malam berturut-turut.', 1),
  (s12, 'ips', 'Kisah Ashabul Kahfi, para pemuda yang mempertahankan keimanannya.',
   'Bacakan kisah Ashabul Kahfi sebelum tidur, lalu minta Ananda menceritakan kembali.', 2),
  (s12, 'berhitung', 'Membandingkan dan mengurutkan bilangan 1–20. 1 tahun = 12 bulan; 1 bulan Hijriah = 29–30 hari; 1 bulan Masehi = 30–31 hari.',
   'Hitung bersama jumlah bulan di kalender dinding; urutkan kartu angka 1–20.', 3),
  (s12, 'bahasa', 'Menulis di buku coklat, membaca di buku merah.',
   'Dampingi Ananda membaca satu halaman buku merah.', 4);

  insert into public.amanah_items (sheet_id, text, needs_photo, position) values
  (s12, 'Melakukan dialog BBO bersama Ananda sesuai panduan.', false, 1),
  (s12, 'Lampiran 1: Lembar amanah berhitung 4.', true, 2);

  insert into public.quran_targets (sheet_id, kind, description) values
  (s12, 'tilawah', 'Tilawah sesuai jilid masing-masing, 1 halaman setiap hari'),
  (s12, 'murajaah', 'Murajaah An-Naba 21–40');

  -- Salin ke KA2A lalu terbitkan
  v_copy := public.copy_bbo_sheet(s11, v_ka2a);
  update public.bbo_sheets set status = 'published' where id = v_copy;
  v_copy := public.copy_bbo_sheet(s12, v_ka2a);
  update public.bbo_sheets set status = 'published' where id = v_copy;
end $$;

-- ---------------------------------------------------------------------------
-- Contoh laporan (untuk uji RLS)
--   Umar (Ortu A) Lembar 11: sedang dikerjakan, 2 kartu dijawab.
--   Zaid (Ortu B) Lembar 11: sudah dikirim, dengan catatan orang tua.
-- ---------------------------------------------------------------------------
do $$
declare
  v_umar_sub uuid := '50000000-0000-4000-8000-000000000001';
  v_zaid_sub uuid := '50000000-0000-4000-8000-000000000002';
  s11 uuid := '40000000-0000-4000-8000-000000001101';
  c1 uuid; c2 uuid;
begin
  select c.id into c1 from public.bbo_cards c join public.bbo_sections s on s.id = c.section_id
   where s.sheet_id = s11 and s.position = 2 and c.position = 1;
  select c.id into c2 from public.bbo_cards c join public.bbo_sections s on s.id = c.section_id
   where s.sheet_id = s11 and s.position = 2 and c.position = 2;

  insert into public.submissions (id, sheet_id, student_id, status, last_card_id, started_at) values
    (v_umar_sub, s11, '30000000-0000-4000-8000-000000000002', 'in_progress', c2, now() - interval '2 days');
  insert into public.submissions (id, sheet_id, student_id, status, last_card_id, started_at, submitted_at) values
    (v_zaid_sub, s11, '30000000-0000-4000-8000-000000000003', 'submitted', c2, now() - interval '4 days', now() - interval '1 day');

  insert into public.card_responses (submission_id, card_id, result, answered_by) values
    (v_umar_sub, c1, 'bisa', 'a0000000-0000-4000-8000-00000000000a'),
    (v_umar_sub, c2, 'belum_dijelaskan', 'a0000000-0000-4000-8000-00000000000a'),
    (v_zaid_sub, c1, 'bisa', 'a0000000-0000-4000-8000-00000000000b'),
    (v_zaid_sub, c2, 'perlu_bantuan', 'a0000000-0000-4000-8000-00000000000b');

  insert into public.adab_logs (submission_id, session_date, niat, wudhu, pakaian, duduk, doa_awal, doa_akhir) values
    (v_umar_sub, current_date - 2, true, true, true, true, true, true),
    (v_zaid_sub, current_date - 4, true, true, false, true, true, true);

  insert into public.parent_notes (submission_id, obstacle, action) values
    (v_zaid_sub, 'Zaid mengantuk setelah Maghrib sehingga dialog hanya 3 kartu per hari.',
                 'Dialog dipindah ke pagi sebelum berangkat, 10 menit.');

  insert into public.reading_logs (student_id, book, page, read_on, logged_by) values
    ('30000000-0000-4000-8000-000000000002', 'bacalah_2', 14, current_date - 1, 'a0000000-0000-4000-8000-00000000000a'),
    ('30000000-0000-4000-8000-000000000003', 'bacalah_2', 9,  current_date - 1, 'a0000000-0000-4000-8000-00000000000b');
end $$;

-- ---------------------------------------------------------------------------
-- Contoh laporan Metiq (PR matematika). Zaid (rekaan) diberi NISN uji;
-- satu laporan sengaja memakai NISN yang belum terdaftar (muncul di admin).
-- ---------------------------------------------------------------------------
update public.students set nisn = '9990000003' where id = '30000000-0000-4000-8000-000000000003';

insert into public.metiq_reports (metiq_id, nisn, student_id, report, completed_at) values
  ('contoh-1:zaid', '9990000003', '30000000-0000-4000-8000-000000000003', jsonb_build_object(
     'id', 'contoh-1:zaid', 'source', 'metiq', 'nisn', '9990000003', 'student_name', 'Zaid', 'class_name', 'Kelas 2B',
     'teacher_name', 'Bu Diana',
     'assignment', jsonb_build_object('note', 'Latihan membaca jam', 'due', '2026-11-05', 'created_at', '2026-10-26T01:00:00Z', 'targeted', false),
     'completed_at', '2026-10-27T11:20:00Z', 'done_by', 'siswa',
     'skills', jsonb_build_array(
       jsonb_build_object('id', 'K1', 'code', 'K.1', 'name', 'Membaca jam (tepat)', 'grade', 1, 'score', 85, 'attempts', 14, 'correct', 12),
       jsonb_build_object('id', 'K2', 'code', 'K.2', 'name', 'Membaca jam (setengah)', 'grade', 1, 'score', 81, 'attempts', 18, 'correct', 14)),
     'link', 'https://metiq-math.vercel.app/'), '2026-10-27T11:20:00Z'),
  ('contoh-2:zaid', '9990000003', '30000000-0000-4000-8000-000000000003', jsonb_build_object(
     'id', 'contoh-2:zaid', 'source', 'metiq', 'nisn', '9990000003', 'student_name', 'Zaid', 'class_name', 'Kelas 2B',
     'teacher_name', 'Bu Diana',
     'assignment', jsonb_build_object('note', 'Penjumlahan sampai 20', 'due', '2026-10-30', 'created_at', '2026-10-23T01:00:00Z', 'targeted', true),
     'completed_at', '2026-10-25T09:05:00Z', 'done_by', 'ortu',
     'skills', '[]'::jsonb,
     'link', 'https://metiq-math.vercel.app/'), '2026-10-25T09:05:00Z'),
  ('contoh-3:belum', '9990000099', null, jsonb_build_object(
     'id', 'contoh-3:belum', 'source', 'metiq', 'nisn', '9990000099', 'student_name', 'Alya (contoh)', 'class_name', 'Kelas 1A',
     'teacher_name', 'Bu Diana',
     'assignment', jsonb_build_object('note', 'Mengenal bilangan 1–10', 'due', '2026-10-31', 'created_at', '2026-10-24T01:00:00Z', 'targeted', false),
     'completed_at', '2026-10-27T08:00:00Z', 'done_by', 'siswa',
     'skills', jsonb_build_array(jsonb_build_object('id', 'A1', 'code', 'A.1', 'name', 'Membilang benda', 'grade', 1, 'score', 90, 'attempts', 10, 'correct', 10)),
     'link', 'https://metiq-math.vercel.app/'), '2026-10-27T08:00:00Z')
on conflict (metiq_id) do nothing;
