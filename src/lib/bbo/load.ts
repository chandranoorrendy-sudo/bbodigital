import type { SupabaseClient } from "@supabase/supabase-js";
import { hariIniJakarta } from "@/lib/format";
import type {
  AdabFrequency,
  AdabItem,
  MutabaahError,
  MutabaahItem,
  AdabState,
  AmanahItem,
  Answer,
  BboSection,
  MediaItem,
  MurafaqatItem,
  QuranReport,
  QuranTarget,
  ReadingLog,
  SessionData,
  SheetInfo,
  Signature,
  SubmissionStatus,
} from "./types";

/**
 * Memuat semua yang dibutuhkan sesi BBO satu santri. Semua query lewat RLS:
 * bila santri bukan anak pengguna ini, atau lembar belum terbit, hasilnya null.
 */
export async function loadSession(
  supabase: SupabaseClient,
  sheetId: string,
  studentId: string,
): Promise<SessionData | null> {
  const today = hariIniJakarta();

  const [{ data: student }, { data: sheet }] = await Promise.all([
    supabase.from("students").select("id, full_name, nickname, class_id").eq("id", studentId).maybeSingle(),
    supabase
      .from("bbo_sheets")
      .select("id, class_id, sheet_no, title, theme, subtheme, core_topic, opening_note, start_date, end_date, hijri_range, kbm_weeks")
      .eq("id", sheetId)
      .maybeSingle(),
  ]);
  if (!student || !sheet || student.class_id !== sheet.class_id) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [
    { data: sections },
    { data: murafaqat },
    { data: submission },
    { data: amanah },
    { data: quranTargets },
    { data: guardian },
    { data: readingLogs },
    { data: mutabaahItems },
    { data: adabItems },
  ] = await Promise.all([
    supabase
      .from("bbo_sections")
      .select(
        "id, kind, title, position, cards:bbo_cards(id, position, tier, dimension, prompt, expected_answer, parent_note, ayah_arabic, ayah_translation, ayah_ref)",
      )
      .eq("sheet_id", sheetId)
      .order("position")
      .order("position", { referencedTable: "bbo_cards" }),
    supabase
      .from("murafaqat_items")
      .select("id, subject, learned, home_practice, position, needs_photo, photo_prompt")
      .eq("sheet_id", sheetId)
      .order("position"),
    supabase
      .from("submissions")
      .select(
        "id, status, last_card_id, submitted_at, card_responses(card_id, result, note), " +
          "quran_reports(id, kind, surah_no, ayah_from, ayah_to, tilawah_book, tilawah_page, fluency, note, audio_path, duration_sec, recorded_at), " +
          "amanah_checks(amanah_item_id, done), media(id, kind, path, bytes, ref_table, ref_id), " +
          "parent_notes(obstacle, action), signatures(role, image_path, signed_at), " +
          "quran_mutabaah_checks(item_id, errors, note), adab_ratings(adab_item_id, rating)",
      )
      .eq("sheet_id", sheetId)
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase.from("amanah_items").select("id, text, needs_photo, position").eq("sheet_id", sheetId).order("position"),
    supabase.from("quran_targets").select("id, kind, description").eq("sheet_id", sheetId),
    supabase.from("guardians").select("relation").eq("student_id", studentId).eq("profile_id", user.id).maybeSingle(),
    supabase
      .from("reading_logs")
      .select("id, book, book_title, page, read_on")
      .eq("student_id", studentId)
      .order("read_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("quran_mutabaah_items").select("id, surah_no, ayah_from, ayah_to, position").eq("sheet_id", sheetId).order("position"),
    supabase.from("adab_items").select("id, text, position").eq("sheet_id", sheetId).order("position"),
  ]);

  // Supabase-js tidak bisa menebak bentuk relasi dari select string panjang; tegaskan di sini.
  const sub = submission as unknown as {
    id: string;
    status: SubmissionStatus;
    last_card_id: string | null;
    submitted_at: string | null;
    card_responses: { card_id: string; result: Answer["result"]; note: string | null }[];
    quran_reports: QuranReport[];
    amanah_checks: { amanah_item_id: string; done: boolean }[];
    media: MediaItem[];
    parent_notes: { obstacle: string | null; action: string | null } | null;
    signatures: { role: string; image_path: string; signed_at: string }[];
    quran_mutabaah_checks: { item_id: string; errors: MutabaahError[]; note: string | null }[];
    adab_ratings: { adab_item_id: string; rating: AdabFrequency }[];
  } | null;

  let adabToday: AdabState | null = null;
  if (sub) {
    const { data } = await supabase
      .from("adab_logs")
      .select("niat, wudhu, pakaian, duduk, doa_awal, doa_akhir")
      .eq("submission_id", sub.id)
      .eq("session_date", today)
      .maybeSingle();
    adabToday = data;
  }

  const answers: Record<string, Answer> = {};
  for (const r of sub?.card_responses ?? []) {
    answers[r.card_id] = { result: r.result, note: r.note };
  }
  const amanahDone: Record<string, boolean> = {};
  for (const c of sub?.amanah_checks ?? []) amanahDone[c.amanah_item_id] = c.done;

  return {
    userId: user.id,
    relation: (guardian?.relation as SessionData["relation"]) ?? null,
    student: { id: student.id, full_name: student.full_name, nickname: student.nickname },
    sheet: sheet as SheetInfo,
    sections: (sections ?? []) as BboSection[],
    murafaqat: (murafaqat ?? []) as MurafaqatItem[],
    amanah: (amanah ?? []) as AmanahItem[],
    quranTargets: (quranTargets ?? []) as QuranTarget[],
    submission: sub
      ? { id: sub.id, status: sub.status, last_card_id: sub.last_card_id, submitted_at: sub.submitted_at }
      : null,
    answers,
    adabToday,
    quranReports: [...(sub?.quran_reports ?? [])].sort((a, b) => (a.recorded_at ?? "").localeCompare(b.recorded_at ?? "")),
    amanahDone,
    media: sub?.media ?? [],
    parentNote: { obstacle: sub?.parent_notes?.obstacle ?? null, action: sub?.parent_notes?.action ?? null },
    signatures: (sub?.signatures ?? []).filter((s) => s.role === "ayah" || s.role === "ibu") as Signature[],
    readingLogs: (readingLogs ?? []) as ReadingLog[],
    mutabaahItems: (mutabaahItems ?? []) as MutabaahItem[],
    mutabaahChecks: Object.fromEntries((sub?.quran_mutabaah_checks ?? []).map((c) => [c.item_id, { errors: c.errors, note: c.note }])),
    adabItems: (adabItems ?? []) as AdabItem[],
    adabRatings: Object.fromEntries((sub?.adab_ratings ?? []).map((r) => [r.adab_item_id, r.rating])),
    today,
  };
}
