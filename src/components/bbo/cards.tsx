"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { rentangTanggal } from "@/lib/format";
import {
  RESULT_LABEL,
  SUBJECT_LABEL,
  type AdabState,
  type Answer,
  type BboCard,
  type CardResult,
  type MurafaqatItem,
  type SheetInfo,
} from "@/lib/bbo/types";

/** Tombol centang besar (≥ 48 px) untuk daftar adab. */
function CheckRow({
  checked,
  label,
  disabled,
  onToggle,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 text-left text-base transition-colors disabled:opacity-60",
        checked ? "border-primary bg-gold-soft" : "bg-background hover:bg-muted",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md border-2 text-sm font-bold",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50",
        )}
      >
        {checked && "✓"}
      </span>
      {label}
    </button>
  );
}

const ADAB_ITEMS: { key: keyof AdabState; label: string }[] = [
  { key: "niat", label: "Niat ikhlas karena Allah" },
  { key: "wudhu", label: "Berwudhu" },
  { key: "pakaian", label: "Pakaian bersih dan rapi" },
  { key: "duduk", label: "Duduk dengan baik" },
  { key: "doa_awal", label: "Membaca doa sebelum belajar" },
];

export function AdabSlide({
  adab,
  readOnly,
  onChange,
}: {
  adab: AdabState;
  readOnly: boolean;
  onChange: (next: AdabState) => void;
}) {
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Adab Bermajelis</h2>
        <p className="leading-relaxed text-muted-foreground">
          Sebelum mulai, mari siapkan majelis bersama Ananda. Ini pengingat, boleh dicentang atau dilewati.
        </p>
      </header>
      <div className="space-y-3">
        {ADAB_ITEMS.map((item) => (
          <CheckRow
            key={item.key}
            label={item.label}
            checked={adab[item.key]}
            disabled={readOnly}
            onToggle={() => onChange({ ...adab, [item.key]: !adab[item.key] })}
          />
        ))}
      </div>
    </div>
  );
}

export function OpeningSlide({ sheet, showGuide }: { sheet: SheetInfo; showGuide: boolean }) {
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p className="text-sm font-medium text-gold-ink">Pekan ini Ananda belajar</p>
        <h2 className="text-2xl font-semibold">{sheet.title}</h2>
        <p className="text-muted-foreground">
          {rentangTanggal(sheet.start_date, sheet.end_date)}
          {sheet.hijri_range && <> · {sheet.hijri_range}</>}
        </p>
      </header>

      <dl className="space-y-2 rounded-xl border bg-background p-4 text-base">
        {sheet.theme && (
          <div>
            <dt className="text-sm text-muted-foreground">Tema</dt>
            <dd>{sheet.theme}</dd>
          </div>
        )}
        {sheet.subtheme && (
          <div>
            <dt className="text-sm text-muted-foreground">Sub tema</dt>
            <dd>{sheet.subtheme}</dd>
          </div>
        )}
        {sheet.core_topic && (
          <div>
            <dt className="text-sm text-muted-foreground">Inti pembahasan</dt>
            <dd>{sheet.core_topic}</dd>
          </div>
        )}
      </dl>

      {sheet.opening_note && <p className="leading-relaxed">{sheet.opening_note}</p>}

      <details open={showGuide} className="group rounded-xl border bg-background">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-medium">
          Cara mengerjakan
          <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <ol className="list-decimal space-y-2 px-4 pb-4 pl-9 leading-relaxed">
          <li>Ayah/Bunda membacakan pertanyaan di setiap kartu kepada Ananda.</li>
          <li>
            Ketuk <span className="font-medium text-expected">Lihat jawaban yang diharapkan</span> bila perlu. Warna ungu
            adalah jawaban yang diharapkan keluar dari lisan Ananda.
          </li>
          <li>Pilih hasilnya. Bila belum bisa, jelaskan kembali dengan tenang.</li>
          <li>Kartu Inti wajib, kartu Pengayaan boleh dilewati. Semua jawaban tersimpan otomatis.</li>
          <li>Boleh dicicil sedikit-sedikit setiap hari. Besok bisa dilanjutkan dari kartu terakhir.</li>
        </ol>
      </details>
    </div>
  );
}

const TIER_LABEL: Record<BboCard["tier"], string> = {
  inti: "Inti",
  pengayaan: "Pengayaan · boleh dilewati",
  ortu: "Untuk Ayah Bunda",
};

const DIMENSION_LABEL: Record<BboCard["dimension"], string> = {
  iman: "Iman",
  ilmu: "Ilmu",
  amal: "Amal",
};

export function DialogCardSlide({
  card,
  sectionTitle,
  answer,
  readOnly,
  onAnswer,
}: {
  card: BboCard;
  sectionTitle: string;
  answer: Answer | undefined;
  readOnly: boolean;
  onAnswer: (result: CardResult, note: string | null) => void;
}) {
  const [showExpected, setShowExpected] = useState(false);
  const [noteOpen, setNoteOpen] = useState(Boolean(answer?.note));
  const [note, setNote] = useState(answer?.note ?? "");
  const isParentOnly = card.tier === "ortu";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={card.tier === "inti" ? "default" : "secondary"} className="h-6 px-2.5 text-sm">
          {TIER_LABEL[card.tier]}
        </Badge>
        <Badge variant="outline" className="h-6 px-2.5 text-sm">
          {DIMENSION_LABEL[card.dimension]}
        </Badge>
        <span className="text-sm text-muted-foreground">{sectionTitle}</span>
      </div>

      <h2 className="text-2xl leading-snug font-semibold">{card.prompt}</h2>

      {card.ayah_arabic && (
        <figure className="space-y-2 rounded-xl border bg-background p-4">
          <p dir="rtl" lang="ar" className="font-arabic text-3xl leading-[2.2]">
            {card.ayah_arabic}
          </p>
          {card.ayah_translation && <p className="leading-relaxed italic">“{card.ayah_translation}”</p>}
          {card.ayah_ref && <figcaption className="text-sm text-muted-foreground">{card.ayah_ref}</figcaption>}
        </figure>
      )}

      {card.expected_answer &&
        (showExpected ? (
          <div className="rounded-xl border-l-4 border-expected bg-expected-soft p-4">
            <p className="text-sm font-medium text-expected">Jawaban yang diharapkan</p>
            <p className="mt-1 text-lg font-medium text-expected">{card.expected_answer}</p>
          </div>
        ) : (
          <Button
            variant="outline"
            size="xl"
            className="w-full border-expected/40 text-expected hover:bg-expected-soft hover:text-expected"
            onClick={() => setShowExpected(true)}
          >
            Lihat jawaban yang diharapkan
          </Button>
        ))}

      {card.parent_note && (
        <details open={isParentOnly} className="group rounded-xl border bg-background">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-medium">
            Untuk Ayah Bunda
            <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <p className="px-4 pb-4 leading-relaxed whitespace-pre-line">{card.parent_note}</p>
        </details>
      )}

      {isParentOnly ? (
        <p className="text-sm text-muted-foreground">Bekal untuk Ayah Bunda. Kartu ini tidak ditanyakan kepada Ananda.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Hasil dialog</p>
          {(Object.keys(RESULT_LABEL) as CardResult[]).map((r) => {
            const selected = answer?.result === r;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={selected}
                disabled={readOnly}
                onClick={() => onAnswer(r, note.trim() || null)}
                className={cn(
                  "flex min-h-14 w-full items-center rounded-xl border px-4 text-left text-base font-medium transition-colors disabled:opacity-60",
                  selected
                    ? r === "bisa"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-foreground/40 bg-muted"
                    : "bg-background hover:bg-muted",
                )}
              >
                {RESULT_LABEL[r]}
              </button>
            );
          })}

          {noteOpen ? (
            <div className="space-y-2">
              <label htmlFor={`note-${card.id}`} className="text-sm font-medium">
                Catatan singkat (opsional)
              </label>
              <textarea
                id={`note-${card.id}`}
                rows={2}
                value={note}
                disabled={readOnly}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => {
                  if (answer && (note.trim() || null) !== answer.note) onAnswer(answer.result, note.trim() || null);
                }}
                placeholder="Mis. Ananda menjawab dengan menunjuk gambar"
                className="w-full rounded-xl border bg-background p-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              {!answer && <p className="text-sm text-muted-foreground">Catatan tersimpan setelah hasil dipilih.</p>}
            </div>
          ) : (
            !readOnly && (
              <Button variant="link" className="h-10 px-0 text-base" onClick={() => setNoteOpen(true)}>
                + Tambah catatan singkat
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export function MurafaqatSlide({ item, index, total }: { item: MurafaqatItem; index: number; total: number }) {
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">
          Murafaqat · {index + 1} dari {total}
        </p>
        <h2 className="text-2xl font-semibold">{SUBJECT_LABEL[item.subject]}</h2>
      </header>
      <section className="space-y-1 rounded-xl border bg-background p-4">
        <h3 className="text-sm font-medium text-muted-foreground">Yang dipelajari di kuttab</h3>
        <p className="leading-relaxed">{item.learned}</p>
      </section>
      {item.home_practice && (
        <section className="space-y-1 rounded-xl border border-gold/60 bg-gold-soft p-4">
          <h3 className="text-sm font-medium text-gold-ink">Yang bisa dilatih di rumah</h3>
          <p className="leading-relaxed">{item.home_practice}</p>
        </section>
      )}
    </div>
  );
}

export function ClosingSlide({
  nickname,
  intiDone,
  intiTotal,
  intiBisa,
  doaAkhir,
  readOnly,
  onToggleDoa,
  onFinish,
}: {
  nickname: string;
  intiDone: number;
  intiTotal: number;
  intiBisa: number;
  doaAkhir: boolean;
  readOnly: boolean;
  onToggleDoa: () => void;
  onFinish: () => void;
}) {
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">Penutup majelis</h2>
        <p className="leading-relaxed text-muted-foreground">
          Barakallahu fiikum. Tutup sesi hari ini dengan doa bersama {nickname}.
        </p>
      </header>

      <CheckRow checked={doaAkhir} label="Membaca doa penutup majelis" disabled={readOnly} onToggle={onToggleDoa} />

      <div className="space-y-1 rounded-xl border bg-background p-4">
        <p className="text-base">
          <span className="font-semibold">{intiDone}</span> dari <span className="font-semibold">{intiTotal}</span> kartu
          Inti sudah dikerjakan, <span className="font-semibold">{intiBisa}</span> sudah bisa.
        </p>
        {intiDone < intiTotal && (
          <p className="text-sm text-muted-foreground">Sisanya boleh dilanjutkan besok. Semua jawaban sudah tersimpan.</p>
        )}
      </div>

      <Button size="xl" className="w-full" onClick={onFinish}>
        Selesai untuk hari ini
      </Button>
    </div>
  );
}
