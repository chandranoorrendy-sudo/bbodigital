"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { memoryStore, supabaseStore, type SessionStore } from "@/lib/bbo/store";
import {
  EMPTY_ADAB,
  SUBJECT_ORDER,
  type AdabState,
  type Answer,
  type BboCard,
  type CardResult,
  type MurafaqatItem,
  type SessionData,
} from "@/lib/bbo/types";
import { AdabSlide, ClosingSlide, DialogCardSlide, MurafaqatSlide, OpeningSlide } from "./cards";

type Group = "adab" | "iman" | "murafaqat" | "quran" | "amanah" | "catatan" | "kirim";

type Slide =
  | { key: "adab"; kind: "adab"; group: Group }
  | { key: "pembuka"; kind: "pembuka"; group: Group }
  | { key: string; kind: "card"; group: Group; card: BboCard; sectionTitle: string }
  | { key: string; kind: "murafaqat"; group: Group; item: MurafaqatItem; index: number; total: number }
  | { key: "penutup"; kind: "penutup"; group: Group };

/** Penanda bagian di atas layar (PRD bagian 6). Qur'an–Kirim menyusul di Tahap 3. */
const GROUPS: { id: Group; label: string; ready: boolean }[] = [
  { id: "adab", label: "Adab", ready: true },
  { id: "iman", label: "Iman", ready: true },
  { id: "murafaqat", label: "Murafaqat", ready: true },
  { id: "quran", label: "Qur'an", ready: false },
  { id: "amanah", label: "Amanah", ready: false },
  { id: "catatan", label: "Catatan", ready: false },
  { id: "kirim", label: "Kirim", ready: false },
];

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
  slides.push({ key: "penutup", kind: "penutup", group: "murafaqat" });
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
  const readOnly = data.submission?.status === "submitted" || data.submission?.status === "reviewed";

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
    if ((e.target as HTMLElement).closest("textarea, input, button, summary")) return;
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
      <header className="sticky top-0 z-10 space-y-3 border-b bg-background/95 px-4 pt-3 pb-3 backdrop-blur">
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
        <nav aria-label="Bagian BBO" className="-mx-1 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {GROUPS.map((g) => {
            const active = slide?.group === g.id;
            const first = slides.findIndex((s) => s.group === g.id);
            return (
              <button
                key={g.id}
                type="button"
                disabled={!g.ready || first < 0}
                onClick={() => go(first)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "h-9 shrink-0 rounded-full px-3 text-sm font-medium",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  !g.ready && "text-muted-foreground/60",
                )}
              >
                {g.label}
              </button>
            );
          })}
        </nav>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full bg-primary transition-all" style={{ width: `${((index + 1) / slides.length) * 100}%` }} />
        </div>
      </header>

      {readOnly && (
        <p className="mx-4 mt-4 rounded-xl border bg-muted p-3 text-sm">
          BBO ini sudah dikirim, jadi jawaban tidak bisa diubah lagi.
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
          <MurafaqatSlide item={slide.item} index={slide.index} total={slide.total} />
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
