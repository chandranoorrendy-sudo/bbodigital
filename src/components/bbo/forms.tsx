"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { surahLabel } from "@/lib/bbo/surah";
import {
  ADAB_FREQUENCY_LABEL,
  MUTABAAH_ERROR_LABEL,
  type AdabFrequency,
  type AdabItem,
  type MutabaahCheck,
  type MutabaahError,
  type MutabaahItem,
} from "@/lib/bbo/types";

const ERRORS = Object.keys(MUTABAAH_ERROR_LABEL) as MutabaahError[];
const FREQUENCIES = Object.keys(ADAB_FREQUENCY_LABEL) as AdabFrequency[];

/** Lembar Mutaba'ah Al-Qur'an: per surat, centang jenis kesalahan yang masih ada. */
export function MutabaahPanel({
  items,
  checks,
  readOnly,
  onSave,
}: {
  items: MutabaahItem[];
  checks: Record<string, MutabaahCheck>;
  readOnly: boolean;
  onSave: (itemId: string, check: MutabaahCheck) => void;
}) {
  if (items.length === 0) return null;
  const done = items.filter((i) => checks[i.id]).length;
  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold">Lembar Mutaba&apos;ah Al-Qur&apos;an</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Simak hafalan Ananda per surat. Ketuk jenis kesalahan yang masih ada; bila sudah baik, ketuk &quot;Tidak ada
          kesalahan&quot;. {done} dari {items.length} surat sudah dicek.
        </p>
      </header>
      <ol className="space-y-3">
        {items.map((item) => (
          <MutabaahRow key={item.id} item={item} check={checks[item.id]} readOnly={readOnly} onSave={(c) => onSave(item.id, c)} />
        ))}
      </ol>
    </section>
  );
}

function MutabaahRow({
  item,
  check,
  readOnly,
  onSave,
}: {
  item: MutabaahItem;
  check: MutabaahCheck | undefined;
  readOnly: boolean;
  onSave: (check: MutabaahCheck) => void;
}) {
  const [note, setNote] = useState(check?.note ?? "");
  const errors = check?.errors ?? [];
  const toggle = (e: MutabaahError) =>
    onSave({ errors: errors.includes(e) ? errors.filter((x) => x !== e) : [...errors, e], note: note.trim() || null });

  return (
    <li className="space-y-3 rounded-xl border bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{surahLabel(item)}</p>
        {check && (
          <span className={cn("shrink-0 text-sm font-medium", errors.length ? "text-destructive" : "text-gold-ink")}>
            {errors.length ? `${errors.length} catatan` : "✓ Baik"}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {ERRORS.map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={errors.includes(e)}
            disabled={readOnly}
            onClick={() => toggle(e)}
            className={cn(
              "min-h-11 rounded-lg border px-3 text-sm font-medium disabled:opacity-60",
              errors.includes(e) ? "border-destructive bg-destructive/10 text-destructive" : "bg-background",
            )}
          >
            {MUTABAAH_ERROR_LABEL[e]}
          </button>
        ))}
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={() => onSave({ errors: [], note: note.trim() || null })}
          className={cn(
            "min-h-11 w-full rounded-lg border px-3 text-sm font-medium",
            check && errors.length === 0 ? "border-primary bg-primary text-primary-foreground" : "bg-background",
          )}
        >
          Tidak ada kesalahan
        </button>
      )}
      <input
        value={note}
        disabled={readOnly}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => {
          if ((note.trim() || null) !== (check?.note ?? null)) onSave({ errors, note: note.trim() || null });
        }}
        placeholder="Catatan (opsional), mis. ayat 4 masih tertukar"
        className="h-11 w-full rounded-lg border bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </li>
  );
}

/** Riaayah Adab: seberapa sering Ayah/Bunda membimbing adab di rumah (bukan penilaian Ananda). */
export function RiaayahAdabPanel({
  items,
  ratings,
  readOnly,
  onRate,
}: {
  items: AdabItem[];
  ratings: Record<string, AdabFrequency>;
  readOnly: boolean;
  onRate: (itemId: string, rating: AdabFrequency) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold">Riaayah adab di rumah</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Pilih seberapa sering Ayah/Bunda membimbing dan mengingatkan Ananda pekan ini. Ini catatan pendampingan orang tua,
          bukan nilai Ananda.
        </p>
      </header>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="space-y-2 rounded-xl border bg-background p-4">
            <p className="font-medium">{item.text}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FREQUENCIES.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={ratings[item.id] === f}
                  disabled={readOnly}
                  onClick={() => onRate(item.id, f)}
                  className={cn(
                    "min-h-11 rounded-lg border px-2 text-sm font-medium disabled:opacity-60",
                    ratings[item.id] === f ? "border-primary bg-primary text-primary-foreground" : "bg-background",
                  )}
                >
                  {ADAB_FREQUENCY_LABEL[f]}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
