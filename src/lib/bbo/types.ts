export type CardResult = "bisa" | "belum_dijelaskan" | "perlu_bantuan";
export type CardTier = "inti" | "pengayaan" | "ortu";
export type CardDimension = "iman" | "ilmu" | "amal";
export type SubmissionStatus = "not_started" | "in_progress" | "submitted" | "reviewed";

export type BboCard = {
  id: string;
  position: number;
  tier: CardTier;
  dimension: CardDimension;
  prompt: string;
  expected_answer: string | null;
  parent_note: string | null;
  ayah_arabic: string | null;
  ayah_translation: string | null;
  ayah_ref: string | null;
};

export type BboSection = {
  id: string;
  kind: "adab" | "iman" | "murafaqat" | "quran" | "amanah" | "catatan";
  title: string;
  position: number;
  cards: BboCard[];
};

export type MurafaqatItem = {
  id: string;
  subject: "ipa" | "ips" | "berhitung" | "bahasa" | "literasi" | "siroh" | "fiqih";
  learned: string;
  home_practice: string | null;
  position: number;
};

export type SheetInfo = {
  id: string;
  sheet_no: number;
  title: string;
  theme: string | null;
  subtheme: string | null;
  core_topic: string | null;
  opening_note: string | null;
  start_date: string;
  end_date: string;
  hijri_range: string | null;
  kbm_weeks: string | null;
};

export type AdabState = {
  niat: boolean;
  wudhu: boolean;
  pakaian: boolean;
  duduk: boolean;
  doa_awal: boolean;
  doa_akhir: boolean;
};

export type Answer = { result: CardResult; note: string | null };

export type QuranKind = "tilawah" | "tahfidz" | "murajaah";
export type Fluency = "lancar" | "terbata" | "ulang";

export type QuranTarget = { id: string; kind: QuranKind; description: string };

export type QuranReport = {
  id: string;
  kind: QuranKind;
  surah_no: number | null;
  ayah_from: number | null;
  ayah_to: number | null;
  tilawah_book: string | null;
  tilawah_page: number | null;
  fluency: Fluency | null;
  note: string | null;
  audio_path: string | null;
  duration_sec: number | null;
  recorded_at: string | null;
};

export type AmanahItem = { id: string; text: string; needs_photo: boolean; position: number };

export type MediaItem = {
  id: string;
  kind: "photo" | "audio";
  path: string;
  bytes: number | null;
  ref_table: string | null;
  ref_id: string | null;
};

export type ReadingLog = { id: string; book: string; book_title: string | null; page: number | null; read_on: string };

export type ParentNote = { obstacle: string | null; action: string | null };

export type SignerRole = "ayah" | "ibu";
export type Signature = { role: SignerRole; image_path: string; signed_at: string };

export type SessionData = {
  userId: string;
  /** Hubungan pengguna ini dengan santri (ayah/ibu/wali), untuk kanvas tanda tangan pertama. */
  relation: "ayah" | "ibu" | "wali" | null;
  student: { id: string; full_name: string; nickname: string | null };
  sheet: SheetInfo;
  sections: BboSection[];
  murafaqat: MurafaqatItem[];
  amanah: AmanahItem[];
  quranTargets: QuranTarget[];
  submission: {
    id: string;
    status: SubmissionStatus;
    last_card_id: string | null;
    submitted_at: string | null;
  } | null;
  answers: Record<string, Answer>;
  adabToday: AdabState | null;
  quranReports: QuranReport[];
  amanahDone: Record<string, boolean>;
  media: MediaItem[];
  parentNote: ParentNote;
  signatures: Signature[];
  readingLogs: ReadingLog[];
  today: string;
};

export const QURAN_KIND_LABEL: Record<QuranKind, string> = {
  tilawah: "Tilawah",
  tahfidz: "Tahfidz",
  murajaah: "Murajaah",
};

export const FLUENCY_LABEL: Record<Fluency, string> = {
  lancar: "Lancar",
  terbata: "Masih terbata",
  ulang: "Perlu diulang",
};

export const READING_BOOKS: { value: string; label: string }[] = [
  { value: "bacalah_1", label: "Bacalah 1" },
  { value: "bacalah_2", label: "Bacalah 2" },
  { value: "bacalah_3", label: "Bacalah 3" },
  { value: "lainnya", label: "Buku lain" },
];

/** Batas PRD: rekaman maks. 3 menit (OT-8), foto maks. 5 per amanah (OT-9). */
export const MAX_RECORDING_SEC = 180;
export const MAX_PHOTOS = 5;

export const RESULT_LABEL: Record<CardResult, string> = {
  bisa: "✓ Sudah bisa",
  belum_dijelaskan: "○ Belum, sudah dijelaskan ulang",
  perlu_bantuan: "○ Belum, perlu dibantu ustadzah",
};

export const SUBJECT_LABEL: Record<MurafaqatItem["subject"], string> = {
  ipa: "IPA",
  ips: "IPS",
  berhitung: "Berhitung",
  bahasa: "Bahasa",
  literasi: "Literasi",
  siroh: "Siroh",
  fiqih: "Fiqih",
};

/** Urutan murafaqat di layar (OT-7): IPA → IPS → Berhitung → Bahasa, lalu lainnya. */
export const SUBJECT_ORDER: MurafaqatItem["subject"][] = [
  "ipa", "ips", "berhitung", "bahasa", "literasi", "siroh", "fiqih",
];

export const EMPTY_ADAB: AdabState = {
  niat: false,
  wudhu: false,
  pakaian: false,
  duduk: false,
  doa_awal: false,
  doa_akhir: false,
};
