import type { SupabaseClient } from "@supabase/supabase-js";
import { hariIniJakarta } from "@/lib/format";
import type { BboCard, CardResult, SubmissionStatus } from "@/lib/bbo/types";

export type Subject = "iman" | "quran";

export type ClassRow = {
  student: { id: string; full_name: string; nickname: string | null };
  submission: { id: string; status: SubmissionStatus; submitted_at: string | null; reviewed_at: string | null } | null;
  feedback: Record<Subject, boolean>;
  results: Record<string, CardResult>;
};

export type ClassOverview = {
  classInfo: { id: string; name: string };
  mySubjects: Subject[];
  sheets: { id: string; sheet_no: number; title: string; start_date: string; end_date: string; status: string }[];
  sheet: { id: string; sheet_no: number; title: string; start_date: string; end_date: string } | null;
  cards: (BboCard & { sectionTitle: string })[];
  rows: ClassRow[];
};

/** Data status kelas & rekap per pertanyaan untuk satu lembar. Semua lewat RLS guru. */
export async function loadClassOverview(
  supabase: SupabaseClient,
  userId: string,
  classId: string,
  sheetId: string | undefined,
): Promise<ClassOverview | null> {
  const [{ data: classInfo }, { data: mine }, { data: sheets }, { data: students }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("id", classId).maybeSingle(),
    supabase.from("class_teachers").select("subject").eq("class_id", classId).eq("teacher_id", userId),
    supabase
      .from("bbo_sheets")
      .select("id, sheet_no, title, start_date, end_date, status")
      .eq("class_id", classId)
      .in("status", ["published", "closed"])
      .order("start_date", { ascending: false }),
    supabase.from("students").select("id, full_name, nickname").eq("class_id", classId).order("full_name"),
  ]);
  if (!classInfo) return null;

  const today = hariIniJakarta();
  const sheet =
    sheets?.find((s) => s.id === sheetId) ?? sheets?.find((s) => s.start_date <= today) ?? sheets?.[0] ?? null;

  let cards: ClassOverview["cards"] = [];
  const subsByStudent = new Map<string, ClassRow>();
  if (sheet) {
    const [{ data: sections }, { data: subs }] = await Promise.all([
      supabase
        .from("bbo_sections")
        .select("title, position, kind, cards:bbo_cards(id, position, tier, dimension, prompt, expected_answer, parent_note, ayah_arabic, ayah_translation, ayah_ref)")
        .eq("sheet_id", sheet.id)
        .eq("kind", "iman")
        .order("position")
        .order("position", { referencedTable: "bbo_cards" }),
      supabase
        .from("submissions")
        .select("id, student_id, status, submitted_at, reviewed_at, teacher_feedback(subject), card_responses(card_id, result)")
        .eq("sheet_id", sheet.id),
    ]);
    cards = (sections ?? []).flatMap((s) =>
      (s.cards as BboCard[]).map((c) => ({ ...c, sectionTitle: s.title as string })),
    );
    for (const s of subs ?? []) {
      const fb = (s.teacher_feedback ?? []) as { subject: Subject }[];
      subsByStudent.set(s.student_id, {
        student: { id: s.student_id, full_name: "", nickname: null },
        submission: { id: s.id, status: s.status, submitted_at: s.submitted_at, reviewed_at: s.reviewed_at },
        feedback: { iman: fb.some((f) => f.subject === "iman"), quran: fb.some((f) => f.subject === "quran") },
        results: Object.fromEntries(
          ((s.card_responses ?? []) as { card_id: string; result: CardResult }[]).map((r) => [r.card_id, r.result]),
        ),
      });
    }
  }

  const rows: ClassRow[] = (students ?? []).map((st) => {
    const row = subsByStudent.get(st.id);
    return row
      ? { ...row, student: st }
      : { student: st, submission: null, feedback: { iman: false, quran: false }, results: {} };
  });

  return {
    classInfo,
    mySubjects: (mine ?? []).map((m) => m.subject as Subject),
    sheets: sheets ?? [],
    sheet,
    cards,
    rows,
  };
}

export const STATUS_ORDER: Record<string, number> = {
  submitted: 0, // perlu ditanggapi dulu
  in_progress: 1,
  not_started: 2,
  reviewed: 3,
};
