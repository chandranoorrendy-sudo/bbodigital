import { notFound } from "next/navigation";
import { BboSession } from "@/components/bbo/session";
import type { SessionData } from "@/lib/bbo/types";

// Pratinjau tampilan sesi tanpa login, hanya di `npm run dev`. Jawaban disimpan di memori saja.
export default function DevSessionPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <BboSession data={FIXTURE} demo />;
}

const FIXTURE: SessionData = {
  today: "2026-10-27",
  student: { id: "demo-santri", full_name: "Umar Faruq Azzam", nickname: "Umar" },
  sheet: {
    id: "demo-lembar",
    sheet_no: 12,
    title: "Bulan: Hitungan Waktu",
    theme: "7. Tata Surya",
    subtheme: "7.2 Bulan",
    core_topic: "7.2.3 Bulan Hitungan Waktu",
    opening_note:
      "Barakallahu fiikum Ayah Bunda yang sudah berjuang hingga saat ini. Dialog BBO boleh dicicil sedikit-sedikit setiap hari.",
    start_date: "2026-10-26",
    end_date: "2026-10-30",
    hijri_range: "15–19 Jumadil Awal 1448 H",
    kbm_weeks: "Pekan 11 KBM",
  },
  sections: [
    { id: "s1", kind: "adab", title: "Adab Bermajelis", position: 1, cards: [] },
    {
      id: "s2",
      kind: "iman",
      title: "Bulan Hitungan Waktu",
      position: 2,
      cards: [
        {
          id: "c1",
          position: 1,
          tier: "inti",
          dimension: "iman",
          prompt: "Malam Lailatul Qadar lebih baik dari berapa bulan?",
          expected_answer: "Seribu bulan.",
          parent_note:
            "Kata \"syahr\" di ujung QS. Al-Qadr: 3 adalah bulan dalam arti hitungan waktu, 29 sampai 30 hari.",
          ayah_arabic: "لَيْلَةُ ٱلْقَدْرِ خَيْرٌ مِّنْ أَلْفِ شَهْرٍ",
          ayah_translation: "Malam kemuliaan itu lebih baik daripada seribu bulan.",
          ayah_ref: "QS. Al-Qadr: 3",
        },
        {
          id: "c2",
          position: 2,
          tier: "pengayaan",
          dimension: "ilmu",
          prompt: "Ada dua kalender yang kita pakai. Apa namanya?",
          expected_answer: "Kalender Hijriah dan kalender Masehi.",
          parent_note: null,
          ayah_arabic: null,
          ayah_translation: null,
          ayah_ref: null,
        },
        {
          id: "c3",
          position: 3,
          tier: "inti",
          dimension: "amal",
          prompt: "Ibadah apa yang waktunya kita ketahui dari hilal?",
          expected_answer: "Puasa Ramadhan, hari raya, dan haji.",
          parent_note: "Hilal menjadi tanda waktu ibadah. (QS. Yunus: 5; QS. Al-Baqarah: 189)",
          ayah_arabic: null,
          ayah_translation: null,
          ayah_ref: null,
        },
      ],
    },
  ],
  murafaqat: [
    { id: "m2", subject: "ips", learned: "Kisah Ashabul Kahfi.", home_practice: "Bacakan kisahnya sebelum tidur.", position: 2 },
    {
      id: "m1",
      subject: "ipa",
      learned: "Peredaran bumi, bulan, dan matahari yang berkaitan dengan waktu.",
      home_practice: "Lihat bentuk bulan beberapa malam berturut-turut.",
      position: 1,
    },
  ],
  amanah: [
    { id: "a1", text: "Melakukan dialog BBO bersama Ananda sesuai panduan.", needs_photo: false, position: 1 },
    { id: "a2", text: "Lampiran 1: Lembar amanah berhitung 4.", needs_photo: true, position: 2 },
  ],
  quranTargets: [
    { id: "q1", kind: "tilawah", description: "Tilawah sesuai jilid masing-masing, 1 halaman setiap hari" },
    { id: "q2", kind: "murajaah", description: "Murajaah An-Naba 21–40" },
  ],
  userId: "demo-ortu",
  relation: "ayah",
  submission: null,
  answers: {},
  adabToday: null,
  quranReports: [],
  amanahDone: {},
  media: [],
  parentNote: { obstacle: null, action: null },
  signatures: [],
  readingLogs: [],
};
