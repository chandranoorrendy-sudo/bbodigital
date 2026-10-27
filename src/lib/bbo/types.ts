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

export type SessionData = {
  student: { id: string; full_name: string; nickname: string | null };
  sheet: SheetInfo;
  sections: BboSection[];
  murafaqat: MurafaqatItem[];
  submission: { id: string; status: SubmissionStatus; last_card_id: string | null } | null;
  answers: Record<string, Answer>;
  adabToday: AdabState | null;
  today: string;
};

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
