"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { memoryStore, supabaseStore, type NewQuranReport, type SessionStore } from "@/lib/bbo/store";
import {
  EMPTY_ADAB,
  MAX_PHOTOS,
  SUBJECT_ORDER,
  type AdabFrequency,
  type MutabaahCheck,
  type AdabState,
  type AmanahItem,
  type Answer,
  type BboCard,
  type CardResult,
  type MediaItem,
  type MurafaqatItem,
  type ParentNote,
  type QuranReport,
  type ReadingLog,
  type SessionData,
  type Signature,
  type SignerRole,
  type SubmissionStatus,
} from "@/lib/bbo/types";
import { AdabSlide, ClosingSlide, DialogCardSlide, MurafaqatSlide, OpeningSlide } from "./cards";
import { MutabaahPanel, RiaayahAdabPanel } from "./forms";
import { PhotoGrid, type Recording } from "./media";
import { AmanahSlide, CatatanSlide, KirimSlide, QuranSlide } from "./report-cards";

type Group = "adab" | "iman" | "murafaqat" | "quran" | "amanah" | "catatan" | "kirim";

type Slide =
  | { key: "adab"; kind: "adab"; group: Group }
  | { key: "pembuka"; kind: "pembuka"; group: Group }
  | { key: string; kind: "card"; group: Group; card: BboCard; sectionTitle: string }
  | { key: string; kind: "murafaqat"; group: Group; item: MurafaqatItem; index: number; total: number }
  | { key: "quran" | "amanah" | "catatan" | "kirim" | "penutup"; kind: "quran" | "amanah" | "catatan" | "kirim" | "penutup"; group: Group };

/** Penanda bagian di atas layar (PRD bagian 6). */
const GROUPS: { id: Group; label: string }[] = [
  { id: "adab", label: "Adab" },
  { id: "iman", label: "Iman" },
  { id: "murafaqat", label: "Murafaqat" },
  { id: "quran", label: "Qur'an" },
  { id: "amanah", label: "Amanah" },
  { id: "catatan", label: "Catatan" },
  { id: "kirim", label: "Kirim" },
];

/** Foto dikecilkan di HP sebelum diunggah: sisi panjang 1600 px, ±300 KB (OT-9). */
async function compressPhoto(file: File) {
  const { default: imageCompression } = await import("browser-image-compression");
  return imageCompression(file, {
    maxWidthOrHeight: 1600,
    maxSizeMB: 0.3,
    fileType: "image/jpeg",
    initialQuality: 0.8,
    useWebWorker: true,
  });
}

function buildSlides(data: SessionData): Slide[] {
  const slides: Slide[] = [{ key: "adab", kind: "adab", group: "adab" }, { key: "pembuka", kind: "pembuka", group: "iman" }];
  for (const section of data.sections) {
    if (section.kind !== "iman") continue;
    for (const card of section.cards) {
      slides.push({ key: `card:${card.id}`, kind: "card", group: "iman", card, sectionTitle: section.title });
    }
  }
  const murafaqat = [...data.murafaqat].sort(
    (a, b) => SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject) || a.position - b.position,
  );
  murafaqat.forEach((item, index) =>
    slides.push({ key: `murafaqat:${item.id}`, kind: "murafaqat", group: "murafaqat", item, index, total: murafaqat.length }),
  );
  slides.push(
    { key: "quran", kind: "quran", group: "quran" },
    { key: "amanah", kind: "amanah", group: "amanah" },
    { key: "catatan", kind: "catatan", group: "catatan" },
    { key: "kirim", kind: "kirim", group: "kirim" },
    { key: "penutup", kind: "penutup", group: "kirim" },
  );
  return slides;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const posKey = (sheetId: string, studentId: string) => `bbo:pos:${sheetId}:${studentId}`;
const GUIDE_KEY = "bbo:panduan-dilihat";

function readLocal(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Mode privat / penyimpanan penuh: posisi tetap diingat lewat last_card_id.
  }
}

export function BboSession({ data, demo = false }: { data: SessionData; demo?: boolean }) {
  const router = useRouter();
  const slides = useMemo(() => buildSlides(data), [data]);
  const [status, setStatus] = useState<SubmissionStatus>(data.submission?.status ?? "not_started");
  const [submittedAt, setSubmittedAt] = useState<string | null>(data.submission?.submitted_at ?? null);
  // Setelah dikirim jawaban terkunci; "Buka kembali" mungkin selama guru belum menanggapi (OT-12).
  const readOnly = status === "submitted" || status === "reviewed";

  const store = useMemo<SessionStore>(
    () =>
      demo
        ? memoryStore()
        : supabaseStore({ sheetId: data.sheet.id, studentId: data.student.id, submission: data.submission }),
    [demo, data.sheet.id, data.student.id, data.submission],
  );

  const [answers, setAnswers] = useState<Record<string, Answer>>(data.answers);
  const [adab, setAdab] = useState<AdabState>(data.adabToday ?? EMPTY_ADAB);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [save, setSave] = useState<SaveState>("idle");

  const [quranReports, setQuranReports] = useState<QuranReport[]>(data.quranReports);
  const [amanahDone, setAmanahDone] = useState<Record<string, boolean>>(data.amanahDone);
  const [media, setMedia] = useState<MediaItem[]>(data.media);
  const [parentNote, setParentNote] = useState<ParentNote>(data.parentNote);
  const [signatures, setSignatures] = useState<Signature[]>(data.signatures);
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>(data.readingLogs);
  const [mutabaah, setMutabaah] = useState<Record<string, MutabaahCheck>>(data.mutabaahChecks);
  const [adabRatings, setAdabRatings] = useState<Record<string, AdabFrequency>>(data.adabRatings);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Signed URL (berlaku 1 jam) untuk rekaman, foto, dan tanda tangan yang sudah tersimpan.
  useEffect(() => {
    const paths = [
      ...data.media.map((m) => m.path),
      ...data.quranReports.map((r) => r.audio_path).filter((p): p is string => Boolean(p)),
      ...data.signatures.map((s) => s.image_path),
    ];
    if (paths.length === 0) return;
    store
      .signedUrls([...new Set(paths)])
      .then((signed) => setUrls((prev) => ({ ...signed, ...prev })))
      .catch(() => toast.error("Sebagian foto atau rekaman belum bisa dimuat. Periksa sinyal, lalu buka ulang."));
  }, [data.media, data.quranReports, data.signatures, store]);

  // ---- Posisi awal: dari HP ini (localStorage), atau last_card_id di server (OT-6) ----
  useEffect(() => {
    const local = readLocal(posKey(data.sheet.id, data.student.id));
    const fromServer = data.submission?.last_card_id ? `card:${data.submission.last_card_id}` : null;
    const start = [local, fromServer].map((k) => slides.findIndex((s) => s.key === k)).find((i) => i >= 0) ?? 0;
    setIndex(start);
    setShowGuide(readLocal(GUIDE_KEY) !== "1");
    writeLocal(GUIDE_KEY, "1");
    setReady(true);
  }, [data, slides]);

  // ---- Antrean simpan: satu operasi terakhir per kunci, dikirim berurutan, diulang bila gagal ----
  const pending = useRef(new Map<string, (submissionId: string) => Promise<void>>());
  const flushing = useRef(false);
  const submissionId = useRef<string | null>(data.submission?.id ?? null);

  const flush = useCallback(async (): Promise<void> => {
    if (flushing.current) return;
    flushing.current = true;
    setSave("saving");
    let failed = false;
    try {
      submissionId.current = await store.ensureSubmission();
      while (pending.current.size > 0) {
        const [key, op] = pending.current.entries().next().value!;
        await op(submissionId.current);
        // Bila operasi yang sama diganti selama dikirim, yang baru tetap di antrean.
        if (pending.current.get(key) === op) pending.current.delete(key);
      }
      setSave("saved");
    } catch {
      failed = true;
      setSave("error");
    } finally {
      flushing.current = false;
    }
    if (!failed && pending.current.size > 0) await flush();
  }, [store]);

  const enqueue = useCallback(
    (key: string, op: (submissionId: string) => Promise<void>) => {
      if (readOnly) return;
      pending.current.set(key, op);
      void flush();
    },
    [flush, readOnly],
  );

  // Membuka sesi = mulai mengerjakan (dan dicatat untuk metrik tesis).
  useEffect(() => {
    if (readOnly) return;
    enqueue("open", (id) => store.logEvent(id, "session_open", { sheet_id: data.sheet.id }));
  }, [enqueue, readOnly, store, data.sheet.id]);

  // Coba kirim ulang saat sinyal kembali; ingatkan bila menutup halaman saat belum tersimpan.
  useEffect(() => {
    const online = () => pending.current.size > 0 && void flush();
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.current.size > 0) e.preventDefault();
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [flush]);

  // ---- Navigasi ----
  const slide = slides[index];
  const navRef = useRef<HTMLElement>(null);
  // Tab bagian yang aktif selalu terlihat di layar sempit.
  useEffect(() => {
    const nav = navRef.current;
    const chip = nav?.querySelector<HTMLElement>('[aria-current="step"]');
    if (nav && chip) {
      nav.scrollLeft = chip.offsetLeft - nav.offsetLeft - (nav.clientWidth - chip.offsetWidth) / 2;
    }
  }, [slide?.group]);
  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, next));
      setIndex(clamped);
      const target = slides[clamped];
      writeLocal(posKey(data.sheet.id, data.student.id), target.key);
      if (target.kind === "card") {
        enqueue("last_card", (id) => store.saveLastCard(id, target.card.id));
      }
      window.scrollTo({ top: 0 });
    },
    [slides, data.sheet.id, data.student.id, enqueue, store],
  );

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    // Jangan anggap geseran sebagai pindah kartu saat menulis tanda tangan, menggeser pemutar audio, dsb.
    if ((e.target as HTMLElement).closest("textarea, input, button, summary, select, canvas, audio, [data-no-swipe]")) return;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1));
  }

  // ---- Simpan jawaban & adab ----
  function answer(card: BboCard, result: CardResult, note: string | null) {
    setAnswers((prev) => ({ ...prev, [card.id]: { result, note } }));
    enqueue(`answer:${card.id}`, async (id) => {
      await store.saveAnswer(id, card.id, result, note);
      await store.logEvent(id, "answer", { card_id: card.id, result });
    });
  }

  function updateAdab(next: AdabState) {
    setAdab(next);
    enqueue("adab", (id) => store.saveAdab(id, data.today, next));
  }

  // ---- Operasi yang ditunggu (unggah, kirim): tampilkan proses dan pesan bila gagal ----
  async function run<T>(key: string, failMessage: string, fn: (submissionId: string) => Promise<T>): Promise<T | null> {
    setBusyKey(key);
    try {
      const id = await store.ensureSubmission();
      submissionId.current = id;
      return await fn(id);
    } catch {
      toast.error(failMessage);
      return null;
    } finally {
      setBusyKey(null);
    }
  }

  async function addQuranReport(report: NewQuranReport, rec: Recording | null) {
    const saved = await run("quran", "Laporan belum tersimpan. Periksa sinyal, lalu coba lagi.", async (id) => {
      const audio = rec ? { path: await store.upload(id, "quran", rec.blob, rec.ext), bytes: rec.blob.size, durationSec: rec.durationSec } : null;
      const row = await store.addQuranReport(id, report, audio);
      void store.logEvent(id, "record", { quran_report_id: row.id, kind: row.kind, bytes: rec?.blob.size, duration_sec: row.duration_sec });
      return { row, url: rec?.url };
    });
    if (!saved) return false;
    setQuranReports((prev) => [...prev, saved.row]);
    if (saved.row.audio_path && saved.url) setUrls((prev) => ({ ...prev, [saved.row.audio_path!]: saved.url! }));
    toast.success("Laporan Qur'an tersimpan.");
    return true;
  }

  async function deleteQuranReport(report: QuranReport) {
    if (!window.confirm("Hapus laporan ini beserta rekamannya?")) return;
    const ok = await run("quran", "Laporan belum terhapus. Coba lagi.", async () => {
      await store.deleteQuranReport(report);
      return true;
    });
    if (ok) {
      setQuranReports((prev) => prev.filter((r) => r.id !== report.id));
      setMedia((prev) => prev.filter((m) => m.path !== report.audio_path));
    }
  }

  function toggleAmanah(item: AmanahItem) {
    const done = !amanahDone[item.id];
    setAmanahDone((prev) => ({ ...prev, [item.id]: done }));
    enqueue(`amanah:${item.id}`, (id) => store.setAmanahDone(id, item.id, done));
  }

  function saveMutabaah(itemId: string, check: MutabaahCheck) {
    setMutabaah((prev) => ({ ...prev, [itemId]: check }));
    enqueue(`mutabaah:${itemId}`, (id) => store.saveMutabaah(id, itemId, check.errors, check.note));
  }

  function rateAdab(itemId: string, rating: AdabFrequency) {
    setAdabRatings((prev) => ({ ...prev, [itemId]: rating }));
    enqueue(`adab_rating:${itemId}`, (id) => store.saveAdabRating(id, itemId, rating));
  }

  async function addPhotos(key: string, folder: string, refTable: string, refId: string | null, files: File[]) {
    const existing = media.filter((m) => m.ref_table === refTable && m.ref_id === refId).length;
    const room = Math.max(0, MAX_PHOTOS - existing);
    if (room === 0) return;
    const added = await run(key, "Foto belum terunggah. Periksa sinyal, lalu coba lagi.", async (id) => {
      const out: { item: MediaItem; url: string }[] = [];
      for (const file of files.slice(0, room)) {
        const small = await compressPhoto(file);
        const path = await store.upload(id, folder, small, "jpg");
        const item = await store.addMedia(id, { kind: "photo", path, bytes: small.size, ref_table: refTable, ref_id: refId });
        out.push({ item, url: URL.createObjectURL(small) });
      }
      void store.logEvent(id, "photo", { ref_table: refTable, ref_id: refId, count: out.length });
      return out;
    });
    if (!added) return;
    setMedia((prev) => [...prev, ...added.map((a) => a.item)]);
    setUrls((prev) => ({ ...prev, ...Object.fromEntries(added.map((a) => [a.item.path, a.url])) }));
  }

  async function deletePhoto(photo: MediaItem) {
    const key = photo.ref_table === "parent_notes" ? "photo:catatan" : `photo:${photo.ref_id}`;
    const ok = await run(key, "Foto belum terhapus. Coba lagi.", async () => {
      await store.deleteMedia(photo);
      return true;
    });
    if (ok) setMedia((prev) => prev.filter((m) => m.id !== photo.id));
  }

  function updateParentNote(next: ParentNote) {
    setParentNote(next);
    enqueue("parent_note", (id) => store.saveParentNote(id, next));
  }

  async function addReading(log: Omit<ReadingLog, "id">) {
    const row = await run("reading", "Log baca belum tersimpan. Coba lagi.", () => store.addReadingLog(data.student.id, log));
    if (!row) return false;
    setReadingLogs((prev) => [row, ...prev].sort((a, b) => b.read_on.localeCompare(a.read_on)).slice(0, 5));
    return true;
  }

  async function deleteReading(logId: string) {
    const ok = await run("reading", "Log baca belum terhapus. Coba lagi.", async () => {
      await store.deleteReadingLog(logId);
      return true;
    });
    if (ok) setReadingLogs((prev) => prev.filter((l) => l.id !== logId));
  }

  async function sign(role: SignerRole, png: Blob) {
    const saved = await run(`sign:${role}`, "Tanda tangan belum tersimpan. Coba lagi.", async (id) => {
      const path = await store.upload(id, "ttd", png, "png");
      const signedAt = await store.saveSignature(id, role, path);
      return { path, signedAt };
    });
    if (!saved) return;
    setSignatures((prev) => [...prev.filter((s) => s.role !== role), { role, image_path: saved.path, signed_at: saved.signedAt }]);
    setUrls((prev) => ({ ...prev, [saved.path]: URL.createObjectURL(png) }));
  }

  async function unsign(sig: Signature) {
    const ok = await run(`sign:${sig.role}`, "Tanda tangan belum terhapus. Coba lagi.", async (id) => {
      await store.deleteSignature(id, sig.role, sig.image_path);
      return true;
    });
    if (ok) setSignatures((prev) => prev.filter((s) => s.role !== sig.role));
  }

  async function submit() {
    if (pending.current.size > 0) await flush();
    if (pending.current.size > 0) {
      toast.error("Masih ada jawaban yang belum tersimpan. Periksa sinyal, lalu coba lagi.");
      return;
    }
    const at = await run("submit", "BBO belum terkirim. Periksa sinyal, lalu coba lagi.", async (id) => {
      const when = await store.submit(id);
      void store.logEvent(id, "submit");
      return when;
    });
    if (!at) return;
    setStatus("submitted");
    setSubmittedAt(at);
    toast.success("Alhamdulillah, BBO sudah terkirim kepada ustadzah.");
  }

  async function reopen() {
    const ok = await run("reopen", "BBO belum bisa dibuka kembali. Mungkin ustadzah sudah menanggapi.", async (id) => {
      await store.reopen(id);
      void store.logEvent(id, "reopen");
      return true;
    });
    if (!ok) return;
    setStatus("in_progress");
    setSubmittedAt(null);
  }

  // ---- Ringkasan kartu Inti ----
  const intiCards = data.sections.filter((s) => s.kind === "iman").flatMap((s) => s.cards.filter((c) => c.tier === "inti"));
  const intiDone = intiCards.filter((c) => answers[c.id]).length;
  const intiBisa = intiCards.filter((c) => answers[c.id]?.result === "bisa").length;

  const backHref = demo ? "/dev/sesi" : `/beranda?anak=${data.student.id}`;
  function finish() {
    router.push(backHref);
    router.refresh();
  }

  const name = data.student.nickname ?? data.student.full_name;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="sticky top-0 z-10 space-y-3 border-b-2 border-gold bg-background/95 px-4 pt-3 pb-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {name} · Lembar {data.sheet.sheet_no}
            </p>
            <SaveIndicator state={save} onRetry={() => void flush()} readOnly={readOnly} />
          </div>
          <Button asChild variant="outline" className="h-10 shrink-0">
            <Link href={backHref} onClick={() => router.refresh()}>
              Tutup
            </Link>
          </Button>
        </div>
        <nav ref={navRef} aria-label="Bagian BBO" className="-mx-1 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {GROUPS.map((g) => {
            const active = slide?.group === g.id;
            const first = slides.findIndex((s) => s.group === g.id);
            return (
              <button
                key={g.id}
                type="button"
                disabled={first < 0}
                onClick={() => go(first)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "h-9 shrink-0 rounded-full px-3 text-sm font-medium",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
              >
                {g.label}
              </button>
            );
          })}
        </nav>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full bg-gold transition-all" style={{ width: `${((index + 1) / slides.length) * 100}%` }} />
        </div>
      </header>

      {readOnly && slide?.kind !== "kirim" && (
        <p className="mx-4 mt-4 rounded-xl border bg-muted p-3 text-sm">
          {status === "reviewed"
            ? "BBO ini sudah ditanggapi ustadzah, jadi jawaban tidak bisa diubah lagi."
            : "BBO ini sudah dikirim. Untuk mengubah, buka bagian Kirim lalu ketuk “Buka kembali”."}
        </p>
      )}

      <main className="flex-1 px-4 py-5" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {!ready ? null : slide.kind === "adab" ? (
          <AdabSlide adab={adab} readOnly={readOnly} onChange={updateAdab} />
        ) : slide.kind === "pembuka" ? (
          <OpeningSlide sheet={data.sheet} showGuide={showGuide} />
        ) : slide.kind === "card" ? (
          <DialogCardSlide
            key={slide.card.id}
            card={slide.card}
            sectionTitle={slide.sectionTitle}
            answer={answers[slide.card.id]}
            readOnly={readOnly}
            onAnswer={(r, n) => answer(slide.card, r, n)}
          />
        ) : slide.kind === "murafaqat" ? (
          <div className="space-y-5">
            <MurafaqatSlide item={slide.item} index={slide.index} total={slide.total} />
            {slide.item.needs_photo && (
              <section className="space-y-2">
                <h3 className="font-semibold">{slide.item.photo_prompt || "Foto hasil kerja Ananda"}</h3>
                <PhotoGrid
                  photos={media.filter((m) => m.ref_table === "murafaqat_items" && m.ref_id === slide.item.id)}
                  urls={urls}
                  max={MAX_PHOTOS}
                  busy={busyKey === `photo:${slide.item.id}`}
                  disabled={readOnly}
                  label="Potret hasil kerja"
                  onAdd={(files) => addPhotos(`photo:${slide.item.id}`, `murafaqat/${slide.item.id}`, "murafaqat_items", slide.item.id, files)}
                  onDelete={deletePhoto}
                />
              </section>
            )}
          </div>
        ) : slide.kind === "quran" ? (
          <div className="space-y-8">
            <QuranSlide
              targets={data.quranTargets}
              reports={quranReports}
              urls={urls}
              readOnly={readOnly}
              busy={busyKey === "quran"}
              onAdd={addQuranReport}
              onDelete={deleteQuranReport}
            />
            <MutabaahPanel items={data.mutabaahItems} checks={mutabaah} readOnly={readOnly} onSave={saveMutabaah} />
          </div>
        ) : slide.kind === "amanah" ? (
          <div className="space-y-8">
          <RiaayahAdabPanel items={data.adabItems} ratings={adabRatings} readOnly={readOnly} onRate={rateAdab} />
          <AmanahSlide
            items={data.amanah}
            done={amanahDone}
            photos={media}
            urls={urls}
            readingLogs={readingLogs}
            today={data.today}
            readOnly={readOnly}
            busyKey={busyKey}
            onToggle={toggleAmanah}
            onAddPhotos={(item, files) => addPhotos(`photo:${item.id}`, `amanah/${item.id}`, "amanah_items", item.id, files)}
            onDeletePhoto={deletePhoto}
            onAddReading={addReading}
            onDeleteReading={deleteReading}
          />
          </div>
        ) : slide.kind === "catatan" ? (
          <CatatanSlide
            note={parentNote}
            photos={media.filter((m) => m.ref_table === "parent_notes")}
            urls={urls}
            readOnly={readOnly}
            busy={busyKey === "photo:catatan"}
            onChange={updateParentNote}
            onAddPhotos={(files) => addPhotos("photo:catatan", "catatan", "parent_notes", null, files)}
            onDeletePhoto={deletePhoto}
          />
        ) : slide.kind === "kirim" ? (
          <KirimSlide
            intiTotal={intiCards.length}
            intiBisa={intiBisa}
            recordings={quranReports.filter((r) => r.audio_path).length}
            photoCount={media.filter((m) => m.kind === "photo").length}
            signatures={signatures}
            urls={urls}
            firstRole={data.relation === "ibu" ? "ibu" : "ayah"}
            status={status}
            submittedAt={submittedAt}
            busyKey={busyKey}
            onSign={sign}
            onUnsign={unsign}
            onSubmit={submit}
            onReopen={reopen}
          />
        ) : (
          <ClosingSlide
            nickname={name}
            intiDone={intiDone}
            intiTotal={intiCards.length}
            intiBisa={intiBisa}
            doaAkhir={adab.doa_akhir}
            readOnly={readOnly}
            onToggleDoa={() => updateAdab({ ...adab, doa_akhir: !adab.doa_akhir })}
            onFinish={finish}
          />
        )}
      </main>

      <footer className="sticky bottom-0 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="xl" className="flex-1" disabled={index === 0} onClick={() => go(index - 1)}>
            Sebelumnya
          </Button>
          {index < slides.length - 1 && (
            <Button size="xl" className="flex-1" onClick={() => go(index + 1)}>
              Berikutnya
            </Button>
          )}
        </div>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {index + 1} dari {slides.length}
        </p>
      </footer>
    </div>
  );
}

function SaveIndicator({ state, onRetry, readOnly }: { state: SaveState; onRetry: () => void; readOnly: boolean }) {
  if (readOnly) return <p className="text-sm text-muted-foreground">Hanya baca</p>;
  if (state === "error")
    return (
      <button type="button" onClick={onRetry} className="text-sm font-medium text-destructive underline">
        Belum tersimpan. Ketuk untuk coba lagi
      </button>
    );
  return (
    <p className="text-sm text-muted-foreground" aria-live="polite">
      {state === "saving" ? "Menyimpan…" : state === "saved" ? "Tersimpan" : "Jawaban tersimpan otomatis"}
    </p>
  );
}
