"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogCardSlide, MurafaqatSlide, OpeningSlide } from "@/components/bbo/cards";
import { surahLabel } from "@/lib/bbo/surah";
import { SURAH_JUZ_30_FIRST } from "@/lib/bbo/surah";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  QURAN_KIND_LABEL,
  SUBJECT_LABEL,
  SUBJECT_ORDER,
  type AdabItem,
  type AmanahItem,
  type BboCard,
  type MutabaahItem,
  type CardDimension,
  type CardTier,
  type MurafaqatItem,
  type QuranKind,
  type QuranTarget,
  type SheetInfo,
} from "@/lib/bbo/types";

type Section = { id: string; kind: string; title: string; position: number; cards: BboCard[] };

export type EditorData = {
  sheet: SheetInfo & { class_id: string; status: "draft" | "published" | "closed"; className: string };
  sections: Section[];
  murafaqat: MurafaqatItem[];
  amanah: AmanahItem[];
  targets: QuranTarget[];
  mutabaah: MutabaahItem[];
  adabItems: AdabItem[];
  canEdit: boolean;
  canEditQuran: boolean;
  submissionCount: number;
};

type Preview = { kind: "pembuka" } | { kind: "card"; id: string } | { kind: "murafaqat"; id: string };

const input =
  "w-full rounded-lg border bg-background px-3 py-2.5 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-muted/50";

const TIERS: { value: CardTier; label: string; hint: string }[] = [
  { value: "inti", label: "Inti", hint: "wajib ditanyakan" },
  { value: "pengayaan", label: "Pengayaan", hint: "boleh dilewati" },
  { value: "ortu", label: "Untuk Ayah Bunda", hint: "bekal orang tua, tidak ditanyakan" },
];
const DIMENSIONS: { value: CardDimension; label: string }[] = [
  { value: "iman", label: "Iman" },
  { value: "ilmu", label: "Ilmu" },
  { value: "amal", label: "Amal" },
];

/** Isian yang menyimpan sendiri saat ditinggalkan (blur), bila nilainya berubah. */
function AutoField({
  label,
  value,
  onSave,
  multiline,
  rows = 3,
  placeholder,
  disabled,
  dir,
  type = "text",
  hint,
  onFocus,
}: {
  label: string;
  value: string | null;
  onSave: (v: string | null) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  dir?: "rtl";
  type?: "text" | "date";
  hint?: string;
  onFocus?: () => void;
}) {
  const [v, setV] = useState(value ?? "");
  const commit = () => {
    const next = v.trim() || null;
    if (next !== (value ?? null)) onSave(next);
  };
  const common = {
    value: v,
    disabled,
    placeholder,
    dir,
    onFocus,
    onBlur: commit,
    className: cn(input, dir === "rtl" && "font-arabic text-2xl leading-loose"),
  };
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {multiline ? (
        <textarea rows={rows} {...common} onChange={(e) => setV(e.target.value)} />
      ) : (
        <input type={type} {...common} onChange={(e) => setV(e.target.value)} />
      )}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function BboEditor({ data }: { data: EditorData }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [sheet, setSheet] = useState(data.sheet);
  const [sections, setSections] = useState<Section[]>(data.sections);
  const [murafaqat, setMurafaqat] = useState<MurafaqatItem[]>(data.murafaqat);
  const [amanah, setAmanah] = useState<AmanahItem[]>(data.amanah);
  const [targets, setTargets] = useState<QuranTarget[]>(data.targets);
  const [mutabaah, setMutabaah] = useState<MutabaahItem[]>(data.mutabaah);
  const [adabItems, setAdabItems] = useState<AdabItem[]>(data.adabItems);
  const [newSurah, setNewSurah] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview>({ kind: "pembuka" });
  const [saving, setSaving] = useState(0);
  const [lastError, setLastError] = useState(false);
  const busy = useRef(false);

  const ro = !data.canEdit;
  // Setelah ada laporan orang tua, kartu/isian tidak dihapus agar jawaban tidak ikut terhapus.
  const locked = data.submissionCount > 0;

  async function run(label: string, fn: () => PromiseLike<{ error: unknown }>) {
    setSaving((n) => n + 1);
    try {
      const { error } = await fn();
      if (error) throw error;
      setLastError(false);
      return true;
    } catch (e) {
      setLastError(true);
      const msg = (e as { message?: string })?.message ?? "";
      toast.error(`${label} belum tersimpan${msg ? `: ${msg}` : ""}`);
      return false;
    } finally {
      setSaving((n) => n - 1);
    }
  }

  // ---- Kop lembar ----
  function saveSheet(field: keyof EditorData["sheet"], value: string | null) {
    setSheet((s) => ({ ...s, [field]: value }));
    void run("Kop BBO", () => supabase.from("bbo_sheets").update({ [field]: value }).eq("id", sheet.id));
  }

  // ---- Bagian & kartu Iman ----
  const imanSections = sections.filter((s) => s.kind === "iman");
  const allCards = imanSections.flatMap((s) => s.cards.map((c) => ({ ...c, sectionTitle: s.title })));
  const intiCount = allCards.filter((c) => c.tier === "inti").length;

  function patchCard(sectionId: string, cardId: string, patch: Partial<BboCard>) {
    setSections((prev) =>
      prev.map((s) => (s.id !== sectionId ? s : { ...s, cards: s.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)) })),
    );
    void run("Kartu", () => supabase.from("bbo_cards").update(patch).eq("id", cardId));
  }

  async function addCard(section: Section) {
    if (busy.current) return;
    busy.current = true;
    const position = Math.max(0, ...section.cards.map((c) => c.position)) + 1;
    setSaving((n) => n + 1);
    const { data: row, error } = await supabase
      .from("bbo_cards")
      .insert({ section_id: section.id, position, tier: "inti", dimension: "ilmu", prompt: "Pertanyaan baru" })
      .select("id, position, tier, dimension, prompt, expected_answer, parent_note, ayah_arabic, ayah_translation, ayah_ref")
      .single();
    setSaving((n) => n - 1);
    busy.current = false;
    if (error || !row) {
      toast.error("Kartu belum bisa ditambah.");
      return;
    }
    setSections((prev) => prev.map((s) => (s.id === section.id ? { ...s, cards: [...s.cards, row as BboCard] } : s)));
    setOpen(row.id);
    setPreview({ kind: "card", id: row.id });
  }

  async function moveCard(section: Section, index: number, dir: -1 | 1) {
    const a = section.cards[index];
    const b = section.cards[index + dir];
    if (!a || !b) return;
    const cards = [...section.cards];
    cards[index] = { ...b, position: a.position };
    cards[index + dir] = { ...a, position: b.position };
    setSections((prev) => prev.map((s) => (s.id === section.id ? { ...s, cards } : s)));
    await run("Urutan kartu", () => supabase.from("bbo_cards").update({ position: b.position }).eq("id", a.id));
    await run("Urutan kartu", () => supabase.from("bbo_cards").update({ position: a.position }).eq("id", b.id));
  }

  async function deleteCard(section: Section, card: BboCard) {
    if (!window.confirm(`Hapus kartu "${card.prompt}"?`)) return;
    const ok = await run("Hapus kartu", () => supabase.from("bbo_cards").delete().eq("id", card.id));
    if (ok) setSections((prev) => prev.map((s) => (s.id === section.id ? { ...s, cards: s.cards.filter((c) => c.id !== card.id) } : s)));
  }

  function renameSection(section: Section, title: string | null) {
    const t = title ?? "Dialog Iman";
    setSections((prev) => prev.map((s) => (s.id === section.id ? { ...s, title: t } : s)));
    void run("Judul bagian", () => supabase.from("bbo_sections").update({ title: t }).eq("id", section.id));
  }

  async function addImanSection() {
    // Sisipkan setelah bagian Iman terakhir; bagian sesudahnya digeser satu.
    const lastIman = Math.max(...imanSections.map((s) => s.position), 1);
    const after = [...sections].filter((s) => s.position > lastIman).sort((a, b) => b.position - a.position);
    for (const s of after) {
      await run("Urutan bagian", () => supabase.from("bbo_sections").update({ position: s.position + 1 }).eq("id", s.id));
    }
    setSaving((n) => n + 1);
    const { data: row, error } = await supabase
      .from("bbo_sections")
      .insert({ sheet_id: sheet.id, kind: "iman", title: "Sub topik baru", position: lastIman + 1 })
      .select("id, kind, title, position")
      .single();
    setSaving((n) => n - 1);
    if (error || !row) {
      toast.error("Bagian belum bisa ditambah.");
      return;
    }
    setSections((prev) =>
      [...prev.map((s) => (s.position > lastIman ? { ...s, position: s.position + 1 } : s)), { ...(row as Omit<Section, "cards">), cards: [] }].sort(
        (a, b) => a.position - b.position,
      ),
    );
  }

  async function deleteSection(section: Section) {
    if (!window.confirm(`Hapus bagian "${section.title}"?`)) return;
    const ok = await run("Hapus bagian", () => supabase.from("bbo_sections").delete().eq("id", section.id));
    if (ok) setSections((prev) => prev.filter((s) => s.id !== section.id));
  }

  // ---- Murafaqat, amanah, target Qur'an ----
  async function addMurafaqat() {
    const used = new Set(murafaqat.map((m) => m.subject));
    const subject = SUBJECT_ORDER.find((s) => !used.has(s)) ?? "ipa";
    const position = Math.max(0, ...murafaqat.map((m) => m.position)) + 1;
    const { data: row, error } = await supabase
      .from("murafaqat_items")
      .insert({ sheet_id: sheet.id, subject, learned: "Yang dipelajari…", position })
      .select("id, subject, learned, home_practice, position")
      .single();
    if (error || !row) return toast.error("Murafaqat belum bisa ditambah.");
    setMurafaqat((prev) => [...prev, row as MurafaqatItem]);
    setPreview({ kind: "murafaqat", id: row.id });
  }
  function patchMurafaqat(id: string, patch: Partial<MurafaqatItem>) {
    setMurafaqat((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    void run("Murafaqat", () => supabase.from("murafaqat_items").update(patch).eq("id", id));
  }
  async function deleteMurafaqat(id: string) {
    if (!window.confirm("Hapus murafaqat ini?")) return;
    if (await run("Hapus murafaqat", () => supabase.from("murafaqat_items").delete().eq("id", id)))
      setMurafaqat((prev) => prev.filter((m) => m.id !== id));
  }

  async function addAmanah() {
    const position = Math.max(0, ...amanah.map((a) => a.position)) + 1;
    const { data: row, error } = await supabase
      .from("amanah_items")
      .insert({ sheet_id: sheet.id, text: "Amanah baru", needs_photo: false, position })
      .select("id, text, needs_photo, position")
      .single();
    if (error || !row) return toast.error("Amanah belum bisa ditambah.");
    setAmanah((prev) => [...prev, row as AmanahItem]);
  }
  function patchAmanah(id: string, patch: Partial<AmanahItem>) {
    setAmanah((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    void run("Amanah", () => supabase.from("amanah_items").update(patch).eq("id", id));
  }
  async function deleteAmanah(id: string) {
    if (!window.confirm("Hapus amanah ini?")) return;
    if (await run("Hapus amanah", () => supabase.from("amanah_items").delete().eq("id", id))) setAmanah((prev) => prev.filter((a) => a.id !== id));
  }

  async function addTarget() {
    const { data: row, error } = await supabase
      .from("quran_targets")
      .insert({ sheet_id: sheet.id, kind: "murajaah", description: "Target baru" })
      .select("id, kind, description")
      .single();
    if (error || !row) return toast.error("Target belum bisa ditambah.");
    setTargets((prev) => [...prev, row as QuranTarget]);
  }
  function patchTarget(id: string, patch: Partial<QuranTarget>) {
    setTargets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    void run("Target Qur'an", () => supabase.from("quran_targets").update(patch).eq("id", id));
  }
  async function deleteTarget(id: string) {
    if (await run("Hapus target", () => supabase.from("quran_targets").delete().eq("id", id))) setTargets((prev) => prev.filter((t) => t.id !== id));
  }

  // ---- Lembar Mutaba'ah & Riaayah Adab ----
  async function addMutabaah() {
    if (!newSurah) return;
    const position = Math.max(0, ...mutabaah.map((m) => m.position)) + 1;
    const { data: row, error } = await supabase
      .from("quran_mutabaah_items")
      .insert({ sheet_id: sheet.id, surah_no: Number(newSurah), position })
      .select("id, surah_no, ayah_from, ayah_to, position")
      .single();
    if (error || !row) return toast.error("Surat belum bisa ditambah.");
    setMutabaah((prev) => [...prev, row as MutabaahItem]);
    setNewSurah("");
  }
  function patchMutabaah(id: string, patch: Partial<MutabaahItem>) {
    setMutabaah((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    void run("Mutaba'ah", () => supabase.from("quran_mutabaah_items").update(patch).eq("id", id));
  }
  async function deleteMutabaah(id: string) {
    if (await run("Hapus surat", () => supabase.from("quran_mutabaah_items").delete().eq("id", id)))
      setMutabaah((prev) => prev.filter((m) => m.id !== id));
  }

  async function addAdabItem() {
    const position = Math.max(0, ...adabItems.map((a) => a.position)) + 1;
    const { data: row, error } = await supabase
      .from("adab_items")
      .insert({ sheet_id: sheet.id, text: "Adab baru", position })
      .select("id, text, position")
      .single();
    if (error || !row) return toast.error("Adab belum bisa ditambah.");
    setAdabItems((prev) => [...prev, row as AdabItem]);
  }
  function patchAdabItem(id: string, text: string) {
    setAdabItems((prev) => prev.map((a) => (a.id === id ? { ...a, text } : a)));
    void run("Adab", () => supabase.from("adab_items").update({ text }).eq("id", id));
  }
  async function deleteAdabItem(id: string) {
    if (await run("Hapus adab", () => supabase.from("adab_items").delete().eq("id", id))) setAdabItems((prev) => prev.filter((a) => a.id !== id));
  }

  // ---- Status terbit ----
  const problems = [
    !sheet.title?.trim() && "judul belum diisi",
    intiCount === 0 && "belum ada kartu Inti",
    sheet.end_date < sheet.start_date && "tanggal selesai sebelum tanggal mulai",
  ].filter(Boolean) as string[];

  async function setStatus(status: EditorData["sheet"]["status"]) {
    const ok = await run("Status", () => supabase.from("bbo_sheets").update({ status }).eq("id", sheet.id));
    if (ok) {
      setSheet((s) => ({ ...s, status }));
      toast.success(status === "published" ? "BBO diterbitkan. Orang tua melihatnya mulai tanggal mulai." : "Status diperbarui.");
      router.refresh();
    }
  }

  // ---- Pratinjau HP ----
  const previewCard = preview.kind === "card" ? allCards.find((c) => c.id === preview.id) : null;
  const previewMur = preview.kind === "murafaqat" ? murafaqat.find((m) => m.id === preview.id) : null;
  const phone = (
    <div className="mx-auto w-[340px] max-w-full rounded-[2rem] border-[10px] border-primary bg-background shadow-lg">
      <div className="h-[600px] overflow-y-auto px-4 py-5">
        {previewCard ? (
          <DialogCardSlide key={previewCard.id} card={previewCard} sectionTitle={previewCard.sectionTitle} answer={undefined} readOnly={false} onAnswer={() => {}} />
        ) : previewMur ? (
          <MurafaqatSlide item={previewMur} index={murafaqat.indexOf(previewMur)} total={murafaqat.length} />
        ) : (
          <OpeningSlide sheet={sheet} showGuide={false} />
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_380px] [&_button]:whitespace-normal">
      <div className="space-y-6">
        {/* Status & terbitkan */}
        <section className="space-y-3 rounded-xl border-2 border-gold/60 bg-gold-soft p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="h-7 px-3 text-sm">{sheet.status === "draft" ? "Draf" : sheet.status === "published" ? "Terbit" : "Ditutup"}</Badge>
            <span className="text-sm text-muted-foreground">
              {intiCount} kartu Inti (disarankan 5–7) · {allCards.length} kartu · {murafaqat.length} murafaqat · {amanah.length} amanah
            </span>
            <span className="ml-auto text-sm text-muted-foreground" aria-live="polite">
              {saving > 0 ? "Menyimpan…" : lastError ? "Ada yang belum tersimpan" : "Tersimpan otomatis"}
            </span>
          </div>
          {ro && <p className="text-sm">Hanya guru Iman kelas ini atau admin yang bisa mengubah BBO ini.</p>}
          {!ro && sheet.status === "draft" && (
            <>
              {problems.length > 0 && <p className="text-sm text-destructive">Belum bisa terbit: {problems.join(", ")}.</p>}
              {intiCount > 7 && <p className="text-sm">Kartu Inti lebih dari 7. Pertimbangkan menjadikan sebagian Pengayaan.</p>}
              <Button size="xl" className="w-full" disabled={problems.length > 0 || saving > 0} onClick={() => setStatus("published")}>
                Terbitkan untuk {sheet.className}
              </Button>
            </>
          )}
          {!ro && sheet.status === "published" && (
            <div className="flex flex-wrap gap-2">
              {data.submissionCount === 0 && (
                <Button variant="outline" className="h-11" onClick={() => setStatus("draft")}>
                  Kembalikan ke draf
                </Button>
              )}
              <Button variant="outline" className="h-11" onClick={() => setStatus("closed")}>
                Tutup lembar (pekan selesai)
              </Button>
            </div>
          )}
          {!ro && sheet.status === "closed" && (
            <Button variant="outline" className="h-11" onClick={() => setStatus("published")}>
              Buka kembali lembar
            </Button>
          )}
          {locked && (
            <p className="text-sm text-muted-foreground">
              Sudah ada {data.submissionCount} laporan orang tua. Kartu dan isian tidak bisa dihapus agar jawaban tidak hilang; teks tetap bisa diperbaiki.
            </p>
          )}
        </section>

        {/* Kop */}
        <section className="space-y-3 rounded-xl border bg-background p-4">
          <h2 className="text-lg font-semibold">Kop &amp; ringkasan materi</h2>
          <AutoField label="Judul BBO" value={sheet.title} disabled={ro} onSave={(v) => saveSheet("title", v ?? sheet.title)} onFocus={() => setPreview({ kind: "pembuka" })} />
          <div className="grid grid-cols-2 gap-3">
            <AutoField type="date" label="Tanggal mulai" value={sheet.start_date} disabled={ro} onSave={(v) => v && saveSheet("start_date", v)} />
            <AutoField type="date" label="Tanggal selesai" value={sheet.end_date} disabled={ro} onSave={(v) => v && saveSheet("end_date", v)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <AutoField label="Tanggal Hijriah" value={sheet.hijri_range} disabled={ro} onSave={(v) => saveSheet("hijri_range", v)} />
            <AutoField label="Pekan KBM" value={sheet.kbm_weeks} disabled={ro} onSave={(v) => saveSheet("kbm_weeks", v)} />
          </div>
          <AutoField label="Tema" value={sheet.theme} disabled={ro} onSave={(v) => saveSheet("theme", v)} onFocus={() => setPreview({ kind: "pembuka" })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <AutoField label="Sub tema" value={sheet.subtheme} disabled={ro} onSave={(v) => saveSheet("subtheme", v)} />
            <AutoField label="Inti pembahasan" value={sheet.core_topic} disabled={ro} onSave={(v) => saveSheet("core_topic", v)} />
          </div>
          <AutoField multiline label="Kalimat pembuka untuk Ayah Bunda" value={sheet.opening_note} disabled={ro} onSave={(v) => saveSheet("opening_note", v)} onFocus={() => setPreview({ kind: "pembuka" })} />
        </section>

        {/* Kartu Iman */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Kartu dialog Iman</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Satu kartu, satu gagasan. Jawaban ditulis seperti Ananda mengucapkannya; tafsir, rujukan halaman, dan sains lanjut
              taruh di &quot;Untuk Ayah Bunda&quot;. Tutup setiap tema dengan kartu Amal.
            </p>
          </div>

          {imanSections.map((section) => (
            <div key={section.id} className="space-y-3 rounded-xl border bg-background p-4">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <AutoField label="Judul sub topik" value={section.title} disabled={ro} onSave={(v) => renameSection(section, v)} />
                </div>
                {!ro && !locked && imanSections.length > 1 && section.cards.length === 0 && (
                  <Button variant="ghost" className="h-11 text-destructive" onClick={() => deleteSection(section)}>
                    Hapus
                  </Button>
                )}
              </div>

              <ol className="space-y-2">
                {section.cards.map((card, i) => {
                  const expanded = open === card.id;
                  return (
                    <li key={card.id} className={cn("rounded-lg border", expanded && "border-primary")}>
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(expanded ? null : card.id);
                          setPreview({ kind: "card", id: card.id });
                        }}
                        className="flex w-full items-center gap-2 px-3 py-3 text-left"
                      >
                        <Badge variant={card.tier === "inti" ? "default" : "secondary"} className="shrink-0">
                          {TIERS.find((t) => t.value === card.tier)?.label}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate">{card.prompt}</span>
                        <span aria-hidden className="text-muted-foreground">
                          {expanded ? "▴" : "▾"}
                        </span>
                      </button>
                      {expanded && (
                        <div className="space-y-3 border-t px-3 pt-3 pb-4">
                          <div className="space-y-1">
                            <span className="text-sm font-medium">Lapis kartu</span>
                            <div className="flex flex-wrap gap-2">
                              {TIERS.map((t) => (
                                <button
                                  key={t.value}
                                  type="button"
                                  disabled={ro}
                                  onClick={() => patchCard(section.id, card.id, { tier: t.value })}
                                  className={cn(
                                    "rounded-lg border px-3 py-2 text-left text-sm",
                                    card.tier === t.value ? "border-primary bg-primary text-primary-foreground" : "bg-background",
                                  )}
                                >
                                  <span className="block font-medium">{t.label}</span>
                                  <span className={cn("block text-xs", card.tier === t.value ? "opacity-80" : "text-muted-foreground")}>{t.hint}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-sm font-medium">Dimensi</span>
                            <div className="flex gap-2">
                              {DIMENSIONS.map((d) => (
                                <button
                                  key={d.value}
                                  type="button"
                                  disabled={ro}
                                  onClick={() => patchCard(section.id, card.id, { dimension: d.value })}
                                  className={cn(
                                    "h-10 rounded-lg border px-4 text-sm font-medium",
                                    card.dimension === d.value ? "border-primary bg-primary text-primary-foreground" : "bg-background",
                                  )}
                                >
                                  {d.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <AutoField multiline rows={2} label="Pertanyaan (dibacakan ke Ananda)" value={card.prompt} disabled={ro} onSave={(v) => patchCard(section.id, card.id, { prompt: v ?? "Pertanyaan" })} />
                          <AutoField multiline rows={2} label="Jawaban yang diharapkan (bahasa anak)" value={card.expected_answer} disabled={ro} onSave={(v) => patchCard(section.id, card.id, { expected_answer: v })} hint="Tampil ungu di HP orang tua." />
                          <AutoField multiline rows={4} label="Untuk Ayah Bunda (opsional)" value={card.parent_note} disabled={ro} onSave={(v) => patchCard(section.id, card.id, { parent_note: v })} hint="Tafsir, rujukan halaman, penjelasan lanjut. Terlipat di HP." />
                          <details className="rounded-lg border bg-muted/30 px-3 py-2" open={Boolean(card.ayah_arabic)}>
                            <summary className="cursor-pointer text-sm font-medium">Ayat (opsional)</summary>
                            <div className="space-y-3 pt-3">
                              <AutoField multiline rows={2} dir="rtl" label="Teks Arab" value={card.ayah_arabic} disabled={ro} onSave={(v) => patchCard(section.id, card.id, { ayah_arabic: v })} />
                              <AutoField label="Terjemah" value={card.ayah_translation} disabled={ro} onSave={(v) => patchCard(section.id, card.id, { ayah_translation: v })} />
                              <AutoField label="Rujukan" value={card.ayah_ref} disabled={ro} placeholder="mis. QS. Al-Qadr: 3" onSave={(v) => patchCard(section.id, card.id, { ayah_ref: v })} />
                            </div>
                          </details>
                          {!ro && (
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" className="h-10" disabled={i === 0} onClick={() => moveCard(section, i, -1)}>
                                ↑ Naik
                              </Button>
                              <Button variant="outline" className="h-10" disabled={i === section.cards.length - 1} onClick={() => moveCard(section, i, 1)}>
                                ↓ Turun
                              </Button>
                              {!locked && (
                                <Button variant="ghost" className="ml-auto h-10 text-destructive" onClick={() => deleteCard(section, card)}>
                                  Hapus kartu
                                </Button>
                              )}
                            </div>
                          )}
                          <div className="lg:hidden">
                            <p className="mb-2 text-sm font-medium text-muted-foreground">Pratinjau di HP orang tua</p>
                            {phone}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
              {!ro && (
                <Button variant="outline" className="h-11 w-full" onClick={() => addCard(section)}>
                  + Kartu di &quot;{section.title}&quot;
                </Button>
              )}
            </div>
          ))}
          {!ro && (
            <Button variant="outline" className="h-11" onClick={addImanSection}>
              + Sub topik baru
            </Button>
          )}
        </section>

        {/* Murafaqat */}
        <section className="space-y-3 rounded-xl border bg-background p-4">
          <h2 className="text-lg font-semibold">Murafaqat</h2>
          <p className="text-sm text-muted-foreground">Ditampilkan berurutan IPA → IPS → Berhitung → Bahasa.</p>
          {murafaqat.map((m) => (
            <div key={m.id} className="space-y-2 rounded-lg border p-3" onFocusCapture={() => setPreview({ kind: "murafaqat", id: m.id })}>
              <div className="flex items-center gap-2">
                <select
                  className={cn(input, "w-auto")}
                  value={m.subject}
                  disabled={ro}
                  onChange={(e) => patchMurafaqat(m.id, { subject: e.target.value as MurafaqatItem["subject"] })}
                >
                  {SUBJECT_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {SUBJECT_LABEL[s]}
                    </option>
                  ))}
                </select>
                {!ro && !locked && (
                  <Button variant="ghost" className="ml-auto h-10 text-destructive" onClick={() => deleteMurafaqat(m.id)}>
                    Hapus
                  </Button>
                )}
              </div>
              <AutoField multiline rows={2} label="Yang dipelajari di kuttab" value={m.learned} disabled={ro} onSave={(v) => patchMurafaqat(m.id, { learned: v ?? "-" })} />
              <AutoField multiline rows={2} label="Yang bisa dilatih di rumah" value={m.home_practice} disabled={ro} onSave={(v) => patchMurafaqat(m.id, { home_practice: v })} />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={m.needs_photo}
                  disabled={ro}
                  onChange={(e) => patchMurafaqat(m.id, { needs_photo: e.target.checked })}
                />
                Orang tua memotret hasil kerja Ananda (mis. tulisan huruf)
              </label>
              {m.needs_photo && (
                <AutoField
                  label="Petunjuk foto"
                  value={m.photo_prompt}
                  disabled={ro}
                  placeholder="mis. Foto tulisan huruf A dan a di buku tulis"
                  onSave={(v) => patchMurafaqat(m.id, { photo_prompt: v })}
                />
              )}
            </div>
          ))}
          {!ro && (
            <Button variant="outline" className="h-11 w-full" onClick={addMurafaqat}>
              + Murafaqat
            </Button>
          )}
        </section>

        {/* Amanah */}
        <section className="space-y-3 rounded-xl border bg-background p-4">
          <h2 className="text-lg font-semibold">Amanah orang tua</h2>
          {amanah.map((a) => (
            <div key={a.id} className="space-y-2 rounded-lg border p-3">
              <AutoField label="Amanah" value={a.text} disabled={ro} onSave={(v) => patchAmanah(a.id, { text: v ?? "-" })} />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-5" checked={a.needs_photo} disabled={ro} onChange={(e) => patchAmanah(a.id, { needs_photo: e.target.checked })} />
                  Orang tua memotret lembar amanah
                </label>
                {!ro && !locked && (
                  <Button variant="ghost" className="ml-auto h-10 text-destructive" onClick={() => deleteAmanah(a.id)}>
                    Hapus
                  </Button>
                )}
              </div>
            </div>
          ))}
          {!ro && (
            <Button variant="outline" className="h-11 w-full" onClick={addAmanah}>
              + Amanah
            </Button>
          )}
        </section>

        {/* Target Qur'an */}
        <section className="space-y-3 rounded-xl border bg-background p-4">
          <h2 className="text-lg font-semibold">Target Qur&apos;an pekan ini</h2>
          {!data.canEditQuran && <p className="text-sm text-muted-foreground">Diisi oleh guru Qur&apos;an kelas ini.</p>}
          {targets.map((t) => (
            <div key={t.id} className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
              <select
                className={cn(input, "w-auto")}
                value={t.kind}
                disabled={!data.canEditQuran}
                onChange={(e) => patchTarget(t.id, { kind: e.target.value as QuranKind })}
              >
                {(Object.keys(QURAN_KIND_LABEL) as QuranKind[]).map((k) => (
                  <option key={k} value={k}>
                    {QURAN_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <div className="min-w-48 flex-1">
                <AutoField label="Target" value={t.description} disabled={!data.canEditQuran} onSave={(v) => patchTarget(t.id, { description: v ?? "-" })} />
              </div>
              {data.canEditQuran && (
                <Button variant="ghost" className="h-10 text-destructive" onClick={() => deleteTarget(t.id)}>
                  Hapus
                </Button>
              )}
            </div>
          ))}
          {data.canEditQuran && (
            <Button variant="outline" className="h-11 w-full" onClick={addTarget}>
              + Target Qur&apos;an
            </Button>
          )}
        </section>

        {/* Lembar Mutaba'ah */}
        <section className="space-y-3 rounded-xl border bg-background p-4">
          <h2 className="text-lg font-semibold">Lembar Mutaba&apos;ah Al-Qur&apos;an</h2>
          <p className="text-sm text-muted-foreground">
            Surat yang disimak orang tua. Per surat, orang tua mencentang kesalahan: Makharijul Huruf, Shifatul Huruf, Itmamul
            Harokat, Mad, Ghunnah, Kelancaran.
          </p>
          {mutabaah.map((m) => (
            <div key={m.id} className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
              <p className="min-w-40 flex-1 font-medium">{surahLabel(m)}</p>
              <label className="w-20 space-y-1">
                <span className="text-xs">Ayat dari</span>
                <input
                  className={input}
                  inputMode="numeric"
                  defaultValue={m.ayah_from ?? ""}
                  disabled={!data.canEditQuran}
                  onBlur={(e) => patchMutabaah(m.id, { ayah_from: e.target.value ? Number(e.target.value) : null })}
                />
              </label>
              <label className="w-20 space-y-1">
                <span className="text-xs">sampai</span>
                <input
                  className={input}
                  inputMode="numeric"
                  defaultValue={m.ayah_to ?? ""}
                  disabled={!data.canEditQuran}
                  onBlur={(e) => patchMutabaah(m.id, { ayah_to: e.target.value ? Number(e.target.value) : null })}
                />
              </label>
              {data.canEditQuran && !locked && (
                <Button variant="ghost" className="h-10 text-destructive" onClick={() => deleteMutabaah(m.id)}>
                  Hapus
                </Button>
              )}
            </div>
          ))}
          {data.canEditQuran && (
            <div className="flex gap-2">
              <select className={cn(input, "flex-1")} value={newSurah} onChange={(e) => setNewSurah(e.target.value)}>
                <option value="">Pilih surat…</option>
                {SURAH_JUZ_30_FIRST.map((s) => (
                  <option key={s.no} value={s.no}>
                    {s.no}. {s.name}
                  </option>
                ))}
              </select>
              <Button variant="outline" className="h-11" disabled={!newSurah} onClick={addMutabaah}>
                + Surat
              </Button>
            </div>
          )}
        </section>

        {/* Riaayah Adab */}
        <section className="space-y-3 rounded-xl border bg-background p-4">
          <h2 className="text-lg font-semibold">Riaayah adab di rumah</h2>
          <p className="text-sm text-muted-foreground">
            Adab yang sudah dipelajari di kuttab. Orang tua memilih selalu / sering / jarang / tidak pernah membimbing.
          </p>
          {adabItems.map((a) => (
            <div key={a.id} className="flex items-end gap-2">
              <div className="flex-1">
                <AutoField label="Adab" value={a.text} disabled={!data.canEditQuran} onSave={(v) => patchAdabItem(a.id, v ?? a.text)} />
              </div>
              {data.canEditQuran && !locked && (
                <Button variant="ghost" className="h-11 text-destructive" onClick={() => deleteAdabItem(a.id)}>
                  Hapus
                </Button>
              )}
            </div>
          ))}
          {data.canEditQuran && (
            <Button variant="outline" className="h-11 w-full" onClick={addAdabItem}>
              + Adab
            </Button>
          )}
        </section>
      </div>

      {/* Pratinjau HP di laptop/tablet */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-2">
          <p className="text-center text-sm font-medium text-muted-foreground">Pratinjau di HP orang tua</p>
          {phone}
        </div>
      </aside>
    </div>
  );
}
