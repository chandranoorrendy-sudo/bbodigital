import { notFound, redirect } from "next/navigation";
import { FeedbackPanel } from "@/components/guru/feedback-panel";
import { GuruHeader } from "@/components/guru/header";
import { METIQ_SELECT, MetiqReportList, type MetiqRow } from "@/components/metiq/reports";
import { getCurrentProfile } from "@/lib/supabase/server";
import { STATUS_LAPORAN, rentangTanggal } from "@/lib/format";
import { surahName } from "@/lib/bbo/surah";
import { surahLabel } from "@/lib/bbo/surah";
import {
  ADAB_FREQUENCY_LABEL,
  MUTABAAH_ERROR_LABEL,
  SUBJECT_LABEL,
  type AdabFrequency,
  type MutabaahError,
  FLUENCY_LABEL,
  QURAN_KIND_LABEL,
  READING_BOOKS,
  RESULT_LABEL,
  type BboCard,
  type CardResult,
  type QuranReport,
} from "@/lib/bbo/types";
import type { Subject } from "@/lib/guru/load";
import { cn } from "@/lib/utils";

type Report = {
  id: string;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  student: { id: string; full_name: string; class_id: string };
  sheet: { id: string; sheet_no: number; title: string; start_date: string; end_date: string };
  card_responses: { card_id: string; result: CardResult; note: string | null }[];
  adab_logs: { session_date: string; niat: boolean; wudhu: boolean; pakaian: boolean; duduk: boolean; doa_awal: boolean; doa_akhir: boolean }[];
  quran_reports: QuranReport[];
  amanah_checks: { amanah_item_id: string; done: boolean }[];
  media: { id: string; kind: string; path: string; ref_table: string | null; ref_id: string | null }[];
  parent_notes: { obstacle: string | null; action: string | null } | null;
  signatures: { role: string; image_path: string; signed_at: string }[];
  teacher_feedback: { id: string; subject: Subject; body: string; created_at: string; teacher_id: string }[];
  quran_mutabaah_checks: { item_id: string; errors: MutabaahError[]; note: string | null }[];
  adab_ratings: { adab_item_id: string; rating: AdabFrequency }[];
};

const ADAB_LABEL: [keyof Report["adab_logs"][number], string][] = [
  ["niat", "Niat"],
  ["wudhu", "Wudhu"],
  ["pakaian", "Pakaian"],
  ["duduk", "Duduk"],
  ["doa_awal", "Doa awal"],
  ["doa_akhir", "Doa akhir"],
];

function fmt(ts: string) {
  return new Date(ts).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}

export default async function LaporanPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { supabase, user, profile } = await getCurrentProfile();
  if (!user) redirect("/masuk");
  if (!profile || profile.role === "parent") redirect("/beranda");

  const { submissionId } = await params;
  const { data } = await supabase
    .from("submissions")
    .select(
      "id, status, submitted_at, reviewed_at, student:students(id, full_name, class_id), sheet:bbo_sheets(id, sheet_no, title, start_date, end_date), " +
        "card_responses(card_id, result, note), adab_logs(session_date, niat, wudhu, pakaian, duduk, doa_awal, doa_akhir), " +
        "quran_reports(id, kind, surah_no, ayah_from, ayah_to, tilawah_book, tilawah_page, fluency, note, audio_path, duration_sec, recorded_at), " +
        "amanah_checks(amanah_item_id, done), media(id, kind, path, ref_table, ref_id), parent_notes(obstacle, action), " +
        "signatures(role, image_path, signed_at), teacher_feedback(id, subject, body, created_at, teacher_id), " +
        "quran_mutabaah_checks(item_id, errors, note), adab_ratings(adab_item_id, rating)",
    )
    .eq("id", submissionId)
    .maybeSingle();
  const report = data as unknown as Report | null;
  if (!report) notFound();

  const [
    { data: sections },
    { data: amanah },
    { data: mine },
    { data: readingLogs },
    { data: siblings },
    { data: metiq },
    { data: murafaqat },
    { data: mutabaahItems },
    { data: adabItems },
  ] = await Promise.all([
    supabase
      .from("bbo_sections")
      .select("title, cards:bbo_cards(id, position, tier, dimension, prompt, expected_answer)")
      .eq("sheet_id", report.sheet.id)
      .eq("kind", "iman")
      .order("position")
      .order("position", { referencedTable: "bbo_cards" }),
    supabase.from("amanah_items").select("id, text, needs_photo").eq("sheet_id", report.sheet.id).order("position"),
    supabase.from("class_teachers").select("subject").eq("class_id", report.student.class_id).eq("teacher_id", user.id),
    supabase
      .from("reading_logs")
      .select("id, book, book_title, page, read_on")
      .eq("student_id", report.student.id)
      .order("read_on", { ascending: false })
      .limit(5),
    supabase
      .from("submissions")
      .select("id, status, student:students(full_name)")
      .eq("sheet_id", report.sheet.id)
      .eq("status", "submitted"),
    supabase
      .from("metiq_reports")
      .select(METIQ_SELECT)
      .eq("student_id", report.student.id)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(10),
    supabase.from("murafaqat_items").select("id, subject, learned, needs_photo, photo_prompt").eq("sheet_id", report.sheet.id).order("position"),
    supabase.from("quran_mutabaah_items").select("id, surah_no, ayah_from, ayah_to, position").eq("sheet_id", report.sheet.id).order("position"),
    supabase.from("adab_items").select("id, text, position").eq("sheet_id", report.sheet.id).order("position"),
  ]);

  // Laporan berikutnya yang menunggu tanggapan (urut nama), untuk menanggapi beruntun.
  const queue = ((siblings ?? []) as unknown as { id: string; student: { full_name: string } }[])
    .filter((s) => s.id !== report.id)
    .sort((a, b) => a.student.full_name.localeCompare(b.student.full_name));
  const nextId = queue.find((s) => s.student.full_name.localeCompare(report.student.full_name) > 0)?.id ?? queue[0]?.id ?? null;

  // Signed URL 1 jam untuk rekaman, foto, dan tanda tangan orang tua.
  const parentSigs = report.signatures.filter((s) => s.role === "ayah" || s.role === "ibu");
  const paths = [
    ...report.media.map((m) => m.path),
    ...report.quran_reports.map((q) => q.audio_path).filter((p): p is string => Boolean(p)),
    ...parentSigs.map((s) => s.image_path),
  ];
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("submissions").createSignedUrls([...new Set(paths)], 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
  }

  const answers = Object.fromEntries(report.card_responses.map((r) => [r.card_id, r]));
  const photos = report.media.filter((m) => m.kind === "photo");
  const mySubjects = (mine ?? []).map((m) => m.subject as Subject);
  const cards = (sections ?? []).flatMap((s) => (s.cards as BboCard[]).map((c) => ({ ...c, sectionTitle: s.title as string })));
  const intiCards = cards.filter((c) => c.tier === "inti");

  return (
    <div className="mx-auto min-h-dvh max-w-3xl">
      <GuruHeader
        title={report.student.full_name}
        backHref={`/guru/kelas/${report.student.class_id}?lembar=${report.sheet.id}`}
        backLabel="Status kelas"
      />
      <main className="space-y-6 px-4 py-5">
        <section className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Lembar {report.sheet.sheet_no} · {rentangTanggal(report.sheet.start_date, report.sheet.end_date)}
          </p>
          <h1 className="text-xl font-semibold">{report.sheet.title}</h1>
          <p className="text-sm">
            <span className="font-medium">{STATUS_LAPORAN[report.status]}</span>
            {report.submitted_at && <> · dikirim {fmt(report.submitted_at)}</>}
          </p>
          <p className="text-sm text-muted-foreground">
            {intiCards.filter((c) => answers[c.id]?.result === "bisa").length} dari {intiCards.length} kartu Inti sudah bisa
          </p>
        </section>

        <Block title="Adab bermajelis">
          {report.adab_logs.length === 0 ? (
            <Empty>Belum ada catatan adab.</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {[...report.adab_logs]
                .sort((a, b) => a.session_date.localeCompare(b.session_date))
                .map((l) => (
                  <li key={l.session_date}>
                    <span className="font-medium">
                      {new Date(`${l.session_date}T00:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" })}
                    </span>
                    : {ADAB_LABEL.filter(([k]) => l[k]).map(([, label]) => label).join(", ") || "—"}
                  </li>
                ))}
            </ul>
          )}
          {(adabItems ?? []).length > 0 && (
            <div className="space-y-1 pt-2 text-sm">
              <p className="font-medium">Riaayah adab di rumah (pendampingan orang tua)</p>
              {(adabItems ?? []).map((a) => {
                const r = report.adab_ratings.find((x) => x.adab_item_id === a.id)?.rating;
                return (
                  <p key={a.id}>
                    {a.text}: <span className={r ? "font-medium" : "text-muted-foreground"}>{r ? ADAB_FREQUENCY_LABEL[r] : "belum diisi"}</span>
                  </p>
                );
              })}
            </div>
          )}
        </Block>

        <Block title="Dialog Iman">
          <ol className="space-y-3">
            {cards.filter((c) => c.tier !== "ortu").map((c, i) => {
              const a = answers[c.id];
              return (
                <li key={c.id} className="space-y-1 border-b pb-3 last:border-0 last:pb-0">
                  <p className="text-sm text-muted-foreground">
                    {i + 1}. {c.tier === "inti" ? "Inti" : "Pengayaan"} · {c.sectionTitle}
                  </p>
                  <p className="font-medium">{c.prompt}</p>
                  <p
                    className={cn(
                      "text-sm font-medium",
                      !a ? "text-muted-foreground" : a.result === "bisa" ? "text-primary" : a.result === "perlu_bantuan" ? "text-destructive" : "",
                    )}
                  >
                    {a ? RESULT_LABEL[a.result] : "Belum dijawab"}
                  </p>
                  {a?.note && <p className="text-sm leading-relaxed">Catatan: {a.note}</p>}
                </li>
              );
            })}
          </ol>
        </Block>

        <Block title="Qur'an">
          {report.quran_reports.length === 0 ? (
            <Empty>Belum ada laporan Qur&apos;an.</Empty>
          ) : (
            <ul className="space-y-3">
              {report.quran_reports.map((q) => (
                <li key={q.id} className="space-y-2 rounded-lg border p-3">
                  <p className="font-medium">
                    {QURAN_KIND_LABEL[q.kind]} ·{" "}
                    {q.kind === "tilawah"
                      ? [q.tilawah_book, q.tilawah_page ? `hlm. ${q.tilawah_page}` : null].filter(Boolean).join(", ")
                      : `${surahName(q.surah_no)} ${q.ayah_from ?? ""}${q.ayah_to && q.ayah_to !== q.ayah_from ? `–${q.ayah_to}` : ""}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Menurut orang tua: {q.fluency ? FLUENCY_LABEL[q.fluency] : "—"}
                    {q.recorded_at && <> · {fmt(q.recorded_at)}</>}
                  </p>
                  {q.note && <p className="text-sm">{q.note}</p>}
                  {q.audio_path && urls[q.audio_path] && <audio controls preload="none" src={urls[q.audio_path]} className="w-full" />}
                </li>
              ))}
            </ul>
          )}
          {(mutabaahItems ?? []).length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="font-medium">Lembar Mutaba&apos;ah</p>
              <ul className="divide-y rounded-lg border text-sm">
                {(mutabaahItems ?? []).map((m) => {
                  const c = report.quran_mutabaah_checks.find((x) => x.item_id === m.id);
                  return (
                    <li key={m.id} className="space-y-1 px-3 py-2">
                      <p className="font-medium">{surahLabel(m)}</p>
                      <p className={!c ? "text-muted-foreground" : c.errors.length ? "text-destructive" : "text-gold-ink"}>
                        {!c ? "Belum dicek" : c.errors.length ? `Kesalahan: ${c.errors.map((e) => MUTABAAH_ERROR_LABEL[e]).join(", ")}` : "✓ Tidak ada kesalahan"}
                      </p>
                      {c?.note && <p>Catatan: {c.note}</p>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Block>

        {(murafaqat ?? []).some((m) => m.needs_photo) && (
          <Block title="Murafaqat · hasil kerja di rumah">
            <ul className="space-y-3">
              {(murafaqat ?? [])
                .filter((m) => m.needs_photo)
                .map((m) => {
                  const itemPhotos = photos.filter((p) => p.ref_table === "murafaqat_items" && p.ref_id === m.id);
                  return (
                    <li key={m.id} className="space-y-2">
                      <p>
                        <span className="font-medium">{SUBJECT_LABEL[m.subject as keyof typeof SUBJECT_LABEL]}:</span> {m.photo_prompt || m.learned}
                      </p>
                      {itemPhotos.length ? <Gallery photos={itemPhotos} urls={urls} /> : <Empty>Belum ada foto.</Empty>}
                    </li>
                  );
                })}
            </ul>
          </Block>
        )}

        <Block title="Amanah">
          <ul className="space-y-3">
            {(amanah ?? []).map((item) => {
              const done = report.amanah_checks.find((c) => c.amanah_item_id === item.id)?.done;
              const itemPhotos = photos.filter((p) => p.ref_table === "amanah_items" && p.ref_id === item.id);
              return (
                <li key={item.id} className="space-y-2">
                  <p>
                    <span className={done ? "text-primary" : "text-muted-foreground"}>{done ? "✓" : "○"}</span> {item.text}
                  </p>
                  <Gallery photos={itemPhotos} urls={urls} />
                </li>
              );
            })}
          </ul>
          {(readingLogs ?? []).length > 0 && (
            <div className="mt-4 space-y-1 text-sm">
              <p className="font-medium">Log baca terakhir</p>
              {(readingLogs ?? []).map((l) => (
                <p key={l.id} className="text-muted-foreground">
                  {new Date(`${l.read_on}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} ·{" "}
                  {READING_BOOKS.find((b) => b.value === l.book)?.label ?? l.book}
                  {l.book_title && ` (${l.book_title})`}
                  {l.page != null && `, hlm. ${l.page}`}
                </p>
              ))}
            </div>
          )}
        </Block>

        <Block title="📐 Laporan Metiq">
          <p className="-mt-2 text-sm text-muted-foreground">PR matematika yang sudah tuntas di Metiq (SmartScore ≥ 80 atau ditandai orang tua).</p>
          <MetiqReportList rows={(metiq ?? []) as MetiqRow[]} />
        </Block>

        <Block title="Catatan orang tua">
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-muted-foreground">Kendala di rumah</dt>
              <dd className="leading-relaxed whitespace-pre-line">{report.parent_notes?.obstacle || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Tindakan / solusi / antisipasi</dt>
              <dd className="leading-relaxed whitespace-pre-line">{report.parent_notes?.action || "—"}</dd>
            </div>
          </dl>
          <Gallery photos={photos.filter((p) => p.ref_table === "parent_notes")} urls={urls} />
        </Block>

        <Block title="Tanda tangan orang tua">
          {parentSigs.length === 0 ? (
            <Empty>Belum ditandatangani.</Empty>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {parentSigs.map((s) => (
                <figure key={s.role} className="space-y-1">
                  {urls[s.image_path] && (
                    // eslint-disable-next-line @next/next/no-img-element -- signed URL privat
                    <img src={urls[s.image_path]} alt={`Tanda tangan ${s.role}`} className="h-24 w-full rounded-lg border bg-white object-contain" />
                  )}
                  <figcaption className="text-sm text-muted-foreground">{s.role === "ayah" ? "Ayah" : "Ibu"}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </Block>

        <FeedbackPanel
          submissionId={report.id}
          status={report.status}
          studentName={report.student.full_name}
          mySubjects={mySubjects}
          feedback={report.teacher_feedback}
          parafs={report.signatures.filter((s) => s.role === "guru_iman" || s.role === "guru_quran")}
          userId={user.id}
          nextId={nextId}
          backHref={`/guru/kelas/${report.student.class_id}?lembar=${report.sheet.id}`}
        />
      </main>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border bg-background p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Gallery({ photos, urls }: { photos: { id: string; path: string }[]; urls: Record<string, string> }) {
  if (photos.length === 0) return null;
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {photos.map((p) =>
        urls[p.path] ? (
          <li key={p.id}>
            <a href={urls[p.path]} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed URL privat */}
              <img src={urls[p.path]} alt="Foto dari orang tua" className="size-full object-cover" />
            </a>
          </li>
        ) : null,
      )}
    </ul>
  );
}
