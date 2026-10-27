import { createClient } from "@/lib/supabase/client";
import type { AdabState, CardResult } from "./types";

/** Penyimpanan sesi BBO. Versi Supabase dipakai aplikasi; versi memori untuk pratinjau pengembangan. */
export interface SessionStore {
  /** Mengembalikan id laporan, membuatnya bila belum ada, dan menandai "sedang dikerjakan". */
  ensureSubmission(): Promise<string>;
  saveAnswer(submissionId: string, cardId: string, result: CardResult, note: string | null): Promise<void>;
  saveAdab(submissionId: string, sessionDate: string, adab: AdabState): Promise<void>;
  saveLastCard(submissionId: string, cardId: string): Promise<void>;
  logEvent(submissionId: string, event: string, meta?: Record<string, unknown>): Promise<void>;
}

export function supabaseStore(opts: {
  sheetId: string;
  studentId: string;
  submission: { id: string; status: string } | null;
}): SessionStore {
  const supabase = createClient();
  let submissionId = opts.submission?.id ?? null;
  let status = opts.submission?.status ?? null;

  return {
    async ensureSubmission() {
      if (!submissionId) {
        const { data, error } = await supabase
          .from("submissions")
          .insert({
            sheet_id: opts.sheetId,
            student_id: opts.studentId,
            status: "in_progress",
            started_at: new Date().toISOString(),
          })
          .select("id, status")
          .single();
        if (error) {
          // Dibuat bersamaan dari tab/HP lain: ambil yang sudah ada.
          if (error.code !== "23505") throw error;
          const existing = await supabase
            .from("submissions")
            .select("id, status")
            .eq("sheet_id", opts.sheetId)
            .eq("student_id", opts.studentId)
            .single();
          if (existing.error) throw existing.error;
          submissionId = existing.data.id;
          status = existing.data.status;
        } else {
          submissionId = data.id;
          status = data.status;
        }
      }
      if (status === "not_started") {
        const { error } = await supabase
          .from("submissions")
          .update({ status: "in_progress", started_at: new Date().toISOString() })
          .eq("id", submissionId);
        if (error) throw error;
        status = "in_progress";
      }
      return submissionId!;
    },

    async saveAnswer(subId, cardId, result, note) {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("card_responses").upsert(
        {
          submission_id: subId,
          card_id: cardId,
          result,
          note,
          answered_by: auth.user?.id,
          answered_at: new Date().toISOString(),
        },
        { onConflict: "submission_id,card_id" },
      );
      if (error) throw error;
    },

    async saveAdab(subId, sessionDate, adab) {
      const { error } = await supabase
        .from("adab_logs")
        .upsert({ submission_id: subId, session_date: sessionDate, ...adab }, { onConflict: "submission_id,session_date" });
      if (error) throw error;
    },

    async saveLastCard(subId, cardId) {
      const { error } = await supabase.from("submissions").update({ last_card_id: cardId }).eq("id", subId);
      if (error) throw error;
    },

    async logEvent(subId, event, meta = {}) {
      // Metrik tesis; kegagalan mencatat tidak boleh mengganggu orang tua.
      await supabase.from("event_log").insert({ submission_id: subId, event, meta });
    },
  };
}

export function memoryStore(): SessionStore {
  const delay = () => new Promise((r) => setTimeout(r, 150));
  return {
    async ensureSubmission() {
      await delay();
      return "demo-submission";
    },
    async saveAnswer() {
      await delay();
    },
    async saveAdab() {
      await delay();
    },
    async saveLastCard() {
      await delay();
    },
    async logEvent() {},
  };
}
