"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Subject } from "@/lib/guru/load";

type Feedback = { id: string; subject: Subject; body: string; created_at: string; teacher_id: string };
type Paraf = { role: string; signed_at: string };

const SUBJECT_LABEL: Record<Subject, string> = { iman: "Iman", quran: "Qur'an" };

/** Kalimat pembuka siap pakai agar menanggapi cepat; tetap bisa diubah. */
const TEMPLATES: Record<Subject, string[]> = {
  iman: [
    "Barakallahu fiikum, Ayah Bunda. Masya Allah, Ananda sudah memahami inti pembahasan pekan ini.",
    "Jazakumullahu khairan atas pendampingannya. Kartu yang belum bisa akan kami kuatkan lagi di kelas.",
    "Terima kasih atas catatan kendalanya. Solusi yang Ayah Bunda tempuh sudah tepat, mari kita lanjutkan.",
  ],
  quran: [
    "Masya Allah, bacaan Ananda sudah lancar. Pertahankan murajaah setiap hari.",
    "Bacaan sudah baik. Mohon diulang lagi pada ayat yang masih terbata, pelan-pelan saja.",
    "Mohon perhatikan panjang pendek bacaan. Insya Allah kita latih bersama di kelas.",
  ],
};

/** Paraf digital: penanda tanpa gambar, cukup nama & waktu guru yang tercatat (GU-6). */
const PARAF_PATH = "paraf-digital";

export function FeedbackPanel({
  submissionId,
  status,
  studentName,
  mySubjects,
  feedback,
  parafs,
  userId,
  nextId,
  backHref,
}: {
  submissionId: string;
  status: string;
  studentName: string;
  mySubjects: Subject[];
  feedback: Feedback[];
  parafs: Paraf[];
  userId: string;
  nextId: string | null;
  backHref: string;
}) {
  const sent = status === "submitted" || status === "reviewed";
  const subjects: Subject[] = (["iman", "quran"] as Subject[]).filter((s) => mySubjects.includes(s));

  return (
    <section className="space-y-4 rounded-xl border-2 border-gold/60 bg-gold-soft p-4">
      <h2 className="text-lg font-semibold">Tanggapan &amp; paraf</h2>

      {/* Tanggapan yang sudah ada, dari semua guru */}
      {feedback.length > 0 && (
        <ul className="space-y-2">
          {[...feedback]
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((f) => (
              <li key={f.id} className="rounded-lg border bg-background p-3">
                <p className="text-sm font-medium text-primary">Guru {SUBJECT_LABEL[f.subject]}</p>
                <p className="leading-relaxed whitespace-pre-line">{f.body}</p>
              </li>
            ))}
        </ul>
      )}

      {!sent ? (
        <p className="text-sm text-muted-foreground">
          Laporan {studentName} belum dikirim orang tua. Tanggapan bisa ditulis setelah BBO dikirim.
        </p>
      ) : subjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">Anda tidak ditugaskan sebagai guru Iman atau Qur&apos;an di kelas ini.</p>
      ) : (
        subjects.map((subject) => (
          <SubjectForm
            key={subject}
            subject={subject}
            submissionId={submissionId}
            mine={feedback.find((f) => f.subject === subject && f.teacher_id === userId) ?? null}
            paraf={parafs.find((p) => p.role === `guru_${subject}`) ?? null}
            nextId={nextId}
            backHref={backHref}
          />
        ))
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button asChild variant="outline" className="h-11">
          <Link href={backHref}>Kembali ke status kelas</Link>
        </Button>
        {nextId && (
          <Button asChild variant="outline" className="h-11">
            <Link href={`/guru/laporan/${nextId}`}>Laporan berikutnya →</Link>
          </Button>
        )}
      </div>
    </section>
  );
}

function SubjectForm({
  subject,
  submissionId,
  mine,
  paraf,
  nextId,
  backHref,
}: {
  subject: Subject;
  submissionId: string;
  mine: Feedback | null;
  paraf: Paraf | null;
  nextId: string | null;
  backHref: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState(mine?.body ?? "");
  const [busy, setBusy] = useState(false);
  const openedAt = useRef(0);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  async function save(goNext: boolean) {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    const supabase = createClient();
    try {
      if (mine) {
        const { error } = await supabase.from("teacher_feedback").update({ body: text }).eq("id", mine.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("teacher_feedback").insert({ submission_id: submissionId, subject, body: text });
        if (error) throw error;
      }
      const { data: auth } = await supabase.auth.getUser();
      const { error: parafError } = await supabase.from("signatures").upsert(
        {
          submission_id: submissionId,
          role: `guru_${subject}`,
          image_path: PARAF_PATH,
          signer_id: auth.user?.id,
          signed_at: new Date().toISOString(),
        },
        { onConflict: "submission_id,role" },
      );
      if (parafError) throw parafError;
      // Tanggapan guru Iman (wali kelas) menutup laporan: orang tua tidak bisa membuka kembali (GU-6).
      if (subject === "iman") {
        const { error } = await supabase
          .from("submissions")
          .update({ status: "reviewed", reviewed_at: new Date().toISOString() })
          .eq("id", submissionId);
        if (error) throw error;
      }
      // Metrik tesis: menit per laporan.
      await supabase.from("event_log").insert({
        submission_id: submissionId,
        event: "review",
        meta: { subject, seconds: Math.round((Date.now() - openedAt.current) / 1000), edited: Boolean(mine) },
      });
      toast.success(`Tanggapan ${SUBJECT_LABEL[subject]} tersimpan dan diparaf.`);
      if (goNext) router.push(nextId ? `/guru/laporan/${nextId}` : backHref);
      router.refresh();
    } catch {
      toast.error("Tanggapan belum tersimpan. Periksa sinyal, lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Tanggapan {SUBJECT_LABEL[subject]}</h3>
        {paraf && (
          <span className="text-sm text-primary">
            Diparaf{" "}
            {new Date(paraf.signed_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {TEMPLATES[subject].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setBody((b) => (b.trim() ? `${b.trim()} ${t}` : t))}
            className="rounded-full border bg-muted/50 px-3 py-1.5 text-left text-sm hover:bg-muted"
          >
            {t.length > 48 ? `${t.slice(0, 48)}…` : t}
          </button>
        ))}
      </div>
      <textarea
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={`Tulis tanggapan ${SUBJECT_LABEL[subject]} untuk Ayah Bunda…`}
        className="w-full rounded-xl border bg-background p-3 text-base leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="h-12 flex-1 text-base" disabled={!body.trim() || busy} onClick={() => save(true)}>
          {busy ? "Menyimpan…" : nextId ? "Simpan, paraf & laporan berikutnya" : "Simpan, paraf & kembali"}
        </Button>
        <Button variant="outline" className="h-12 text-base" disabled={!body.trim() || busy} onClick={() => save(false)}>
          Simpan saja
        </Button>
      </div>
      {subject === "iman" && (
        <p className="text-sm text-muted-foreground">
          Setelah tanggapan Iman disimpan, laporan terkunci dan orang tua tidak bisa membukanya kembali.
        </p>
      )}
    </div>
  );
}
