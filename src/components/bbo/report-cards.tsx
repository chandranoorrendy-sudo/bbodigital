"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SURAH_JUZ_30_FIRST, surahName } from "@/lib/bbo/surah";
import {
  FLUENCY_LABEL,
  MAX_PHOTOS,
  QURAN_KIND_LABEL,
  READING_BOOKS,
  type AmanahItem,
  type Fluency,
  type MediaItem,
  type ParentNote,
  type QuranKind,
  type QuranReport,
  type QuranTarget,
  type ReadingLog,
  type Signature,
  type SignerRole,
} from "@/lib/bbo/types";
import type { NewQuranReport } from "@/lib/bbo/store";
import { AudioRecorder, PhotoGrid, SignatureBox, formatDuration, type Recording } from "./media";

const inputClass =
  "h-12 w-full rounded-xl border bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";

function Chips<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-12 rounded-xl border px-4 text-base font-medium",
            value === o.value ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function describeReport(r: Pick<QuranReport, "kind" | "surah_no" | "ayah_from" | "ayah_to" | "tilawah_book" | "tilawah_page">) {
  if (r.kind === "tilawah") {
    return [r.tilawah_book, r.tilawah_page ? `hlm. ${r.tilawah_page}` : null].filter(Boolean).join(", ");
  }
  const range = r.ayah_from ? (r.ayah_to && r.ayah_to !== r.ayah_from ? `${r.ayah_from}–${r.ayah_to}` : `${r.ayah_from}`) : "";
  return [surahName(r.surah_no), range].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Qur'an (OT-8)
// ---------------------------------------------------------------------------
export function QuranSlide({
  targets,
  reports,
  urls,
  readOnly,
  busy,
  onAdd,
  onDelete,
}: {
  targets: QuranTarget[];
  reports: QuranReport[];
  urls: Record<string, string>;
  readOnly: boolean;
  busy: boolean;
  onAdd: (report: NewQuranReport, recording: Recording | null) => Promise<boolean>;
  onDelete: (report: QuranReport) => void;
}) {
  const [formOpen, setFormOpen] = useState(reports.length === 0);
  const [kind, setKind] = useState<QuranKind>("murajaah");
  const [surah, setSurah] = useState<number | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [book, setBook] = useState("");
  const [page, setPage] = useState("");
  const [fluency, setFluency] = useState<Fluency | null>(null);
  const [note, setNote] = useState("");
  const [recording, setRecording] = useState<Recording | null>(null);

  const valid = kind === "tilawah" ? Boolean(book.trim() || page) : Boolean(surah);

  async function save() {
    const ok = await onAdd(
      {
        kind,
        surah_no: kind === "tilawah" ? null : surah,
        ayah_from: kind === "tilawah" || !from ? null : Number(from),
        ayah_to: kind === "tilawah" || !to ? null : Number(to),
        tilawah_book: kind === "tilawah" ? book.trim() || null : null,
        tilawah_page: kind === "tilawah" && page ? Number(page) : null,
        fluency,
        note: note.trim() || null,
      },
      recording,
    );
    if (ok) {
      setFrom("");
      setTo("");
      setPage("");
      setNote("");
      setFluency(null);
      setRecording(null);
      setFormOpen(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Laporan Qur&apos;an</h2>
        <p className="leading-relaxed text-muted-foreground">
          Laporkan tilawah, tahfidz, atau murajaah Ananda. Boleh lebih dari satu laporan dalam sepekan.
        </p>
      </header>

      {targets.length > 0 && (
        <section className="space-y-1 rounded-xl border border-gold/60 bg-gold-soft p-4">
          <h3 className="text-sm font-medium text-gold-ink">Target pekan ini</h3>
          <ul className="list-disc space-y-1 pl-5">
            {targets.map((t) => (
              <li key={t.id}>
                <span className="font-medium">{QURAN_KIND_LABEL[t.kind]}:</span> {t.description}
              </li>
            ))}
          </ul>
        </section>
      )}

      {reports.length > 0 && (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="space-y-2 rounded-xl border bg-background p-4">
              <p className="font-medium">
                {QURAN_KIND_LABEL[r.kind]} · {describeReport(r) || "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                {r.fluency ? FLUENCY_LABEL[r.fluency] : "Kelancaran belum diisi"}
                {r.duration_sec != null && <> · rekaman {formatDuration(r.duration_sec)}</>}
              </p>
              {r.note && <p className="text-sm leading-relaxed">{r.note}</p>}
              {r.audio_path &&
                (urls[r.audio_path] ? (
                  <audio controls preload="none" src={urls[r.audio_path]} className="w-full" />
                ) : (
                  <p className="text-sm text-muted-foreground">Memuat rekaman…</p>
                ))}
              {!readOnly && (
                <Button variant="ghost" className="h-10 px-2 text-destructive" disabled={busy} onClick={() => onDelete(r)}>
                  Hapus laporan
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly &&
        (formOpen ? (
          <section className="space-y-4 rounded-xl border bg-muted/40 p-4">
            <h3 className="font-medium">Laporan baru</h3>
            <Chips
              options={(Object.keys(QURAN_KIND_LABEL) as QuranKind[]).map((k) => ({ value: k, label: QURAN_KIND_LABEL[k] }))}
              value={kind}
              onChange={setKind}
            />

            {kind === "tilawah" ? (
              <div className="grid grid-cols-[1fr_7rem] gap-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium">Jilid / buku</span>
                  <input className={inputClass} value={book} onChange={(e) => setBook(e.target.value)} placeholder="mis. Jilid 3" />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium">Halaman</span>
                  <input className={inputClass} inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))} />
                </label>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block space-y-1">
                  <span className="text-sm font-medium">Surat</span>
                  <select
                    className={inputClass}
                    value={surah ?? ""}
                    onChange={(e) => setSurah(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Pilih surat…</option>
                    {SURAH_JUZ_30_FIRST.map((s) => (
                      <option key={s.no} value={s.no}>
                        {s.no}. {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium">Ayat dari</span>
                    <input className={inputClass} inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ""))} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium">sampai</span>
                    <input className={inputClass} inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ""))} />
                  </label>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-sm font-medium">Kelancaran</span>
              <Chips
                options={(Object.keys(FLUENCY_LABEL) as Fluency[]).map((f) => ({ value: f, label: FLUENCY_LABEL[f] }))}
                value={fluency}
                onChange={setFluency}
              />
            </div>

            <AudioRecorder value={recording} onChange={setRecording} disabled={busy} />

            <label className="block space-y-1">
              <span className="text-sm font-medium">Catatan (opsional)</span>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl border bg-background p-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>

            <div className="flex gap-2">
              {reports.length > 0 && (
                <Button variant="outline" size="xl" className="flex-1" onClick={() => setFormOpen(false)}>
                  Batal
                </Button>
              )}
              <Button size="xl" className="flex-1" disabled={!valid || busy} onClick={save}>
                {busy ? "Menyimpan…" : "Simpan laporan"}
              </Button>
            </div>
            {!valid && (
              <p className="text-sm text-muted-foreground">
                {kind === "tilawah" ? "Isi jilid/buku atau halaman." : "Pilih surat terlebih dahulu."}
              </p>
            )}
          </section>
        ) : (
          <Button variant="outline" size="xl" className="w-full" onClick={() => setFormOpen(true)}>
            + Tambah laporan Qur&apos;an
          </Button>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Amanah (OT-9, OT-10)
// ---------------------------------------------------------------------------
export function AmanahSlide({
  items,
  done,
  photos,
  urls,
  readingLogs,
  today,
  readOnly,
  busyKey,
  onToggle,
  onAddPhotos,
  onDeletePhoto,
  onAddReading,
  onDeleteReading,
}: {
  items: AmanahItem[];
  done: Record<string, boolean>;
  photos: MediaItem[];
  urls: Record<string, string>;
  readingLogs: ReadingLog[];
  today: string;
  readOnly: boolean;
  busyKey: string | null;
  onToggle: (item: AmanahItem) => void;
  onAddPhotos: (item: AmanahItem, files: File[]) => void;
  onDeletePhoto: (photo: MediaItem) => void;
  onAddReading: (log: Omit<ReadingLog, "id">) => Promise<boolean>;
  onDeleteReading: (id: string) => void;
}) {
  const [book, setBook] = useState("bacalah_1");
  const [bookTitle, setBookTitle] = useState("");
  const [page, setPage] = useState("");
  const [readOn, setReadOn] = useState(today);

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Amanah orang tua</h2>
        <p className="leading-relaxed text-muted-foreground">
          Centang amanah yang sudah dikerjakan. Untuk lembar amanah, potret hasil kerja Ananda.
        </p>
      </header>

      <ul className="space-y-3">
        {items.map((item) => {
          const checked = Boolean(done[item.id]);
          const itemPhotos = photos.filter((p) => p.ref_table === "amanah_items" && p.ref_id === item.id);
          return (
            <li key={item.id} className="space-y-3 rounded-xl border bg-background p-4">
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                disabled={readOnly}
                onClick={() => onToggle(item)}
                className="flex w-full items-start gap-3 text-left text-base disabled:opacity-70"
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 text-sm font-bold",
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50",
                  )}
                >
                  {checked && "✓"}
                </span>
                <span className="leading-relaxed">{item.text}</span>
              </button>
              {item.needs_photo && (
                <PhotoGrid
                  photos={itemPhotos}
                  urls={urls}
                  max={MAX_PHOTOS}
                  busy={busyKey === `photo:${item.id}`}
                  disabled={readOnly}
                  label="Potret lembar amanah"
                  onAdd={(files) => onAddPhotos(item, files)}
                  onDelete={onDeletePhoto}
                />
              )}
            </li>
          );
        })}
      </ul>

      <section className="space-y-3 rounded-xl border bg-background p-4">
        <h3 className="font-medium">Log membaca buku</h3>
        <p className="text-sm text-muted-foreground">Catatan baca berlanjut dari pekan ke pekan.</p>
        {readingLogs.length > 0 && (
          <ul className="divide-y">
            {readingLogs.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {READING_BOOKS.find((b) => b.value === l.book)?.label ?? l.book}
                  {l.book_title && ` (${l.book_title})`}
                  {l.page != null && `, hlm. ${l.page}`}
                  <span className="block text-sm text-muted-foreground">
                    {new Date(`${l.read_on}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long" })}
                  </span>
                </span>
                <Button variant="ghost" className="h-10 px-2 text-destructive" onClick={() => onDeleteReading(l.id)}>
                  Hapus
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">Buku</span>
            <select className={inputClass} value={book} onChange={(e) => setBook(e.target.value)}>
              {READING_BOOKS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Halaman</span>
            <input className={inputClass} inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))} />
          </label>
          {book === "lainnya" && (
            <label className="col-span-2 space-y-1">
              <span className="text-sm font-medium">Judul buku</span>
              <input className={inputClass} value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} />
            </label>
          )}
          <label className="col-span-2 space-y-1">
            <span className="text-sm font-medium">Tanggal</span>
            <input type="date" className={inputClass} value={readOn} max={today} onChange={(e) => setReadOn(e.target.value)} />
          </label>
        </div>
        <Button
          variant="outline"
          size="xl"
          className="w-full"
          disabled={busyKey === "reading" || !readOn}
          onClick={async () => {
            const ok = await onAddReading({
              book,
              book_title: book === "lainnya" ? bookTitle.trim() || null : null,
              page: page ? Number(page) : null,
              read_on: readOn,
            });
            if (ok) {
              setPage("");
              setBookTitle("");
            }
          }}
        >
          {busyKey === "reading" ? "Menyimpan…" : "+ Catat bacaan"}
        </Button>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Catatan orang tua (OT-11)
// ---------------------------------------------------------------------------
export function CatatanSlide({
  note,
  photos,
  urls,
  readOnly,
  busy,
  onChange,
  onAddPhotos,
  onDeletePhoto,
}: {
  note: ParentNote;
  photos: MediaItem[];
  urls: Record<string, string>;
  readOnly: boolean;
  busy: boolean;
  onChange: (note: ParentNote) => void;
  onAddPhotos: (files: File[]) => void;
  onDeletePhoto: (photo: MediaItem) => void;
}) {
  const [obstacle, setObstacle] = useState(note.obstacle ?? "");
  const [action, setAction] = useState(note.action ?? "");
  const commit = () => {
    const next = { obstacle: obstacle.trim() || null, action: action.trim() || null };
    if (next.obstacle !== note.obstacle || next.action !== note.action) onChange(next);
  };
  const areaClass =
    "w-full rounded-xl border bg-background p-3 text-base leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70";

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Catatan orang tua</h2>
        <p className="leading-relaxed text-muted-foreground">
          Boleh dikosongkan. Tulis sepanjang yang diperlukan, tidak perlu kertas tambahan.
        </p>
      </header>
      <label className="block space-y-2">
        <span className="font-medium">Kendala di rumah</span>
        <span className="block text-sm text-muted-foreground">Kendala yang dihadapi Ananda atau orang tua di rumah, dan lain-lain.</span>
        <textarea rows={5} className={areaClass} value={obstacle} disabled={readOnly} onChange={(e) => setObstacle(e.target.value)} onBlur={commit} />
      </label>
      <label className="block space-y-2">
        <span className="font-medium">Tindakan, solusi, atau antisipasi</span>
        <span className="block text-sm text-muted-foreground">
          Yang sudah atau akan dilakukan orang tua terhadap kendala tersebut.
        </span>
        <textarea rows={5} className={areaClass} value={action} disabled={readOnly} onChange={(e) => setAction(e.target.value)} onBlur={commit} />
      </label>
      <PhotoGrid
        photos={photos}
        urls={urls}
        max={MAX_PHOTOS}
        busy={busy}
        disabled={readOnly}
        label="Lampirkan foto"
        onAdd={onAddPhotos}
        onDelete={onDeletePhoto}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tanda tangan & kirim (OT-12)
// ---------------------------------------------------------------------------
export function KirimSlide({
  intiTotal,
  intiBisa,
  recordings,
  photoCount,
  signatures,
  urls,
  firstRole,
  status,
  submittedAt,
  busyKey,
  onSign,
  onUnsign,
  onSubmit,
  onReopen,
}: {
  intiTotal: number;
  intiBisa: number;
  recordings: number;
  photoCount: number;
  signatures: Signature[];
  urls: Record<string, string>;
  firstRole: SignerRole;
  status: string;
  submittedAt: string | null;
  busyKey: string | null;
  onSign: (role: SignerRole, png: Blob) => void;
  onUnsign: (sig: Signature) => void;
  onSubmit: () => void;
  onReopen: () => void;
}) {
  const roles: SignerRole[] = firstRole === "ibu" ? ["ibu", "ayah"] : ["ayah", "ibu"];
  const sent = status === "submitted" || status === "reviewed";

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Tanda tangan &amp; kirim</h2>
        <p className="leading-relaxed text-muted-foreground">
          Periksa ringkasan, tanda tangani, lalu kirim BBO pekan ini kepada ustadzah.
        </p>
      </header>

      <section className="rounded-xl border bg-background p-4 text-base leading-relaxed">
        <span className="font-semibold">{intiBisa}</span> dari <span className="font-semibold">{intiTotal}</span> kartu Inti
        sudah bisa, <span className="font-semibold">{recordings}</span> rekaman,{" "}
        <span className="font-semibold">{photoCount}</span> foto.
      </section>

      {roles.map((role) => {
        const sig = signatures.find((s) => s.role === role) ?? null;
        return (
          <SignatureBox
            key={role}
            title={role === "ayah" ? "Ayah" : "Ibu"}
            imageUrl={sig ? (urls[sig.image_path] ?? null) : null}
            signedAt={sig?.signed_at ?? null}
            disabled={sent}
            busy={busyKey === `sign:${role}`}
            onSave={(png) => onSign(role, png)}
            onDelete={() => sig && onUnsign(sig)}
          />
        );
      })}
      {!sent && <p className="text-sm text-muted-foreground">Cukup salah satu, Ayah atau Ibu.</p>}

      {sent ? (
        <section className="space-y-3 rounded-xl border border-gold/60 bg-gold-soft p-4">
          <p className="font-medium text-primary">
            {status === "reviewed" ? "BBO sudah ditanggapi ustadzah." : "BBO sudah dikirim."}
          </p>
          {submittedAt && (
            <p className="text-sm text-muted-foreground">
              Dikirim{" "}
              {new Date(submittedAt).toLocaleString("id-ID", {
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Jakarta",
              })}
            </p>
          )}
          {status === "submitted" && (
            <Button variant="outline" size="xl" className="w-full" disabled={busyKey === "reopen"} onClick={onReopen}>
              {busyKey === "reopen" ? "Membuka…" : "Buka kembali untuk diubah"}
            </Button>
          )}
        </section>
      ) : (
        <Button size="xl" className="w-full" disabled={signatures.length === 0 || busyKey === "submit"} onClick={onSubmit}>
          {busyKey === "submit" ? "Mengirim…" : "Kirim BBO"}
        </Button>
      )}
    </div>
  );
}
