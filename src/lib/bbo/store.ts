import { createClient } from "@/lib/supabase/client";
import type { AdabState, CardResult, MediaItem, ParentNote, QuranReport, ReadingLog, SignerRole } from "./types";

export type NewQuranReport = Omit<QuranReport, "id" | "audio_path" | "duration_sec" | "recorded_at">;

/** Penyimpanan sesi BBO. Versi Supabase dipakai aplikasi; versi memori untuk pratinjau pengembangan. */
export interface SessionStore {
  /** Mengembalikan id laporan, membuatnya bila belum ada, dan menandai "sedang dikerjakan". */
  ensureSubmission(): Promise<string>;
  saveAnswer(submissionId: string, cardId: string, result: CardResult, note: string | null): Promise<void>;
  saveAdab(submissionId: string, sessionDate: string, adab: AdabState): Promise<void>;
  saveLastCard(submissionId: string, cardId: string): Promise<void>;
  logEvent(submissionId: string, event: string, meta?: Record<string, unknown>): Promise<void>;

  /** Unggah ke bucket privat `submissions/{student}/{submission}/{folder}/...`, kembalikan path. */
  upload(submissionId: string, folder: string, file: Blob, ext: string): Promise<string>;
  removeFile(path: string): Promise<void>;
  /** Signed URL berlaku 1 jam (PRD bagian 7). */
  signedUrls(paths: string[]): Promise<Record<string, string>>;

  addQuranReport(
    submissionId: string,
    report: NewQuranReport,
    audio: { path: string; bytes: number; durationSec: number } | null,
  ): Promise<QuranReport>;
  deleteQuranReport(report: QuranReport): Promise<void>;
  setAmanahDone(submissionId: string, itemId: string, done: boolean): Promise<void>;
  addMedia(submissionId: string, media: Omit<MediaItem, "id">): Promise<MediaItem>;
  deleteMedia(media: MediaItem): Promise<void>;
  saveParentNote(submissionId: string, note: ParentNote): Promise<void>;
  addReadingLog(studentId: string, log: Omit<ReadingLog, "id">): Promise<ReadingLog>;
  deleteReadingLog(id: string): Promise<void>;
  saveSignature(submissionId: string, role: SignerRole, path: string): Promise<string>;
  deleteSignature(submissionId: string, role: SignerRole, path: string): Promise<void>;
  submit(submissionId: string): Promise<string>;
  reopen(submissionId: string): Promise<void>;
}

const BUCKET = "submissions";

function contentTypeFor(file: Blob, ext: string) {
  // Bucket menolak tipe dengan parameter codec (mis. "audio/webm;codecs=opus").
  const base = file.type.split(";")[0];
  if (base) return base;
  return ext === "png" ? "image/png" : ext === "jpg" ? "image/jpeg" : ext === "m4a" ? "audio/mp4" : "audio/webm";
}

export function supabaseStore(opts: {
  sheetId: string;
  studentId: string;
  submission: { id: string; status: string } | null;
}): SessionStore {
  const supabase = createClient();
  let submissionId = opts.submission?.id ?? null;
  let status = opts.submission?.status ?? null;

  const must = <T>(res: { data: T; error: unknown }) => {
    if (res.error) throw res.error;
    return res.data;
  };

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
          const existing = must(
            await supabase
              .from("submissions")
              .select("id, status")
              .eq("sheet_id", opts.sheetId)
              .eq("student_id", opts.studentId)
              .single(),
          );
          submissionId = existing!.id;
          status = existing!.status;
        } else {
          submissionId = data.id;
          status = data.status;
        }
      }
      if (status === "not_started") {
        must(
          await supabase
            .from("submissions")
            .update({ status: "in_progress", started_at: new Date().toISOString() })
            .eq("id", submissionId),
        );
        status = "in_progress";
      }
      return submissionId!;
    },

    async saveAnswer(subId, cardId, result, note) {
      const { data: auth } = await supabase.auth.getUser();
      must(
        await supabase.from("card_responses").upsert(
          {
            submission_id: subId,
            card_id: cardId,
            result,
            note,
            answered_by: auth.user?.id,
            answered_at: new Date().toISOString(),
          },
          { onConflict: "submission_id,card_id" },
        ),
      );
    },

    async saveAdab(subId, sessionDate, adab) {
      must(
        await supabase
          .from("adab_logs")
          .upsert({ submission_id: subId, session_date: sessionDate, ...adab }, { onConflict: "submission_id,session_date" }),
      );
    },

    async saveLastCard(subId, cardId) {
      must(await supabase.from("submissions").update({ last_card_id: cardId }).eq("id", subId));
    },

    async logEvent(subId, event, meta = {}) {
      // Metrik tesis; kegagalan mencatat tidak boleh mengganggu orang tua.
      await supabase.from("event_log").insert({ submission_id: subId, event, meta });
    },

    async upload(subId, folder, file, ext) {
      const path = `${opts.studentId}/${subId}/${folder}/${crypto.randomUUID()}.${ext}`;
      must(
        await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: contentTypeFor(file, ext),
          upsert: false,
        }),
      );
      return path;
    },

    async removeFile(path) {
      must(await supabase.storage.from(BUCKET).remove([path]));
    },

    async signedUrls(paths) {
      if (paths.length === 0) return {};
      const data = must(await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600));
      const out: Record<string, string> = {};
      for (const item of data ?? []) if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
      return out;
    },

    async addQuranReport(subId, report, audio) {
      const row = must(
        await supabase
          .from("quran_reports")
          .insert({
            submission_id: subId,
            ...report,
            audio_path: audio?.path ?? null,
            duration_sec: audio ? Math.round(audio.durationSec) : null,
            recorded_at: new Date().toISOString(),
          })
          .select("id, kind, surah_no, ayah_from, ayah_to, tilawah_book, tilawah_page, fluency, note, audio_path, duration_sec, recorded_at")
          .single(),
      ) as QuranReport;
      if (audio) {
        must(
          await supabase.from("media").insert({
            submission_id: subId,
            kind: "audio",
            path: audio.path,
            bytes: audio.bytes,
            ref_table: "quran_reports",
            ref_id: row.id,
          }),
        );
      }
      return row;
    },

    async deleteQuranReport(report) {
      must(await supabase.from("quran_reports").delete().eq("id", report.id));
      if (report.audio_path) {
        must(await supabase.from("media").delete().eq("path", report.audio_path));
        await supabase.storage.from(BUCKET).remove([report.audio_path]);
      }
    },

    async setAmanahDone(subId, itemId, done) {
      must(
        await supabase.from("amanah_checks").upsert(
          { submission_id: subId, amanah_item_id: itemId, done, done_at: done ? new Date().toISOString() : null },
          { onConflict: "submission_id,amanah_item_id" },
        ),
      );
    },

    async addMedia(subId, media) {
      return must(
        await supabase
          .from("media")
          .insert({ submission_id: subId, ...media })
          .select("id, kind, path, bytes, ref_table, ref_id")
          .single(),
      ) as MediaItem;
    },

    async deleteMedia(media) {
      must(await supabase.from("media").delete().eq("id", media.id));
      await supabase.storage.from(BUCKET).remove([media.path]);
    },

    async saveParentNote(subId, note) {
      must(
        await supabase
          .from("parent_notes")
          .upsert({ submission_id: subId, obstacle: note.obstacle, action: note.action }, { onConflict: "submission_id" }),
      );
    },

    async addReadingLog(studentId, log) {
      return must(
        await supabase
          .from("reading_logs")
          .insert({ student_id: studentId, ...log })
          .select("id, book, book_title, page, read_on")
          .single(),
      ) as ReadingLog;
    },

    async deleteReadingLog(id) {
      must(await supabase.from("reading_logs").delete().eq("id", id));
    },

    async saveSignature(subId, role, path) {
      const signedAt = new Date().toISOString();
      const { data: auth } = await supabase.auth.getUser();
      // Tanda tangan lama (bila ada) diganti; file lamanya dihapus.
      const old = await supabase.from("signatures").select("image_path").eq("submission_id", subId).eq("role", role).maybeSingle();
      must(
        await supabase
          .from("signatures")
          .upsert(
            { submission_id: subId, role, image_path: path, signer_id: auth.user?.id, signed_at: signedAt },
            { onConflict: "submission_id,role" },
          ),
      );
      if (old.data?.image_path && old.data.image_path !== path) {
        await supabase.storage.from(BUCKET).remove([old.data.image_path]);
      }
      return signedAt;
    },

    async deleteSignature(subId, role, path) {
      must(await supabase.from("signatures").delete().eq("submission_id", subId).eq("role", role));
      await supabase.storage.from(BUCKET).remove([path]);
    },

    async submit(subId) {
      const at = new Date().toISOString();
      must(await supabase.from("submissions").update({ status: "submitted", submitted_at: at }).eq("id", subId));
      status = "submitted";
      return at;
    },

    async reopen(subId) {
      must(await supabase.from("submissions").update({ status: "in_progress", submitted_at: null }).eq("id", subId));
      status = "in_progress";
    },
  };
}

export function memoryStore(): SessionStore {
  const delay = () => new Promise((r) => setTimeout(r, 150));
  const files = new Map<string, string>();
  let n = 0;
  const id = () => `demo-${++n}`;
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
    async upload(_subId, folder, file, ext) {
      await delay();
      const path = `demo/${folder}/${id()}.${ext}`;
      files.set(path, URL.createObjectURL(file));
      return path;
    },
    async removeFile(path) {
      files.delete(path);
    },
    async signedUrls(paths) {
      return Object.fromEntries(paths.filter((p) => files.has(p)).map((p) => [p, files.get(p)!]));
    },
    async addQuranReport(_subId, report, audio) {
      await delay();
      return {
        id: id(),
        ...report,
        audio_path: audio?.path ?? null,
        duration_sec: audio ? Math.round(audio.durationSec) : null,
        recorded_at: new Date().toISOString(),
      };
    },
    async deleteQuranReport() {
      await delay();
    },
    async setAmanahDone() {
      await delay();
    },
    async addMedia(_subId, media) {
      await delay();
      return { id: id(), ...media };
    },
    async deleteMedia() {
      await delay();
    },
    async saveParentNote() {
      await delay();
    },
    async addReadingLog(_studentId, log) {
      await delay();
      return { id: id(), ...log };
    },
    async deleteReadingLog() {
      await delay();
    },
    async saveSignature() {
      await delay();
      return new Date().toISOString();
    },
    async deleteSignature() {
      await delay();
    },
    async submit() {
      await delay();
      return new Date().toISOString();
    },
    async reopen() {
      await delay();
    },
  };
}
