"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export const DEFAULT_OPENING =
  "Barakallahu fiikum Ayah Bunda yang sudah berjuang hingga saat ini. Allah sebaik-baik pemberi balasan atas semua perjuangan Ayah Bunda. Dialog BBO boleh dicicil sedikit-sedikit setiap hari, di waktu dan tempat yang nyaman.";

/** Bagian standar setiap lembar, urut sesuai nilai kuttab: adab → iman → ilmu → Qur'an → amal. */
const DEFAULT_SECTIONS = [
  { kind: "adab", title: "Adab Bermajelis" },
  { kind: "iman", title: "Dialog Iman" },
  { kind: "murafaqat", title: "Murafaqat" },
  { kind: "quran", title: "Qur'an" },
  { kind: "amanah", title: "Amanah Orang Tua" },
  { kind: "catatan", title: "Catatan Orang Tua" },
];

const field =
  "h-12 w-full rounded-xl border bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function nextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d;
}
const iso = (d: Date) => d.toLocaleDateString("en-CA");

export function NewSheetForm({ classes }: { classes: { id: string; label: string; nextNo: number }[] }) {
  const router = useRouter();
  const monday = nextMonday();
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const [classId, setClassId] = useState(classes[0].id);
  const [sheetNo, setSheetNo] = useState(String(classes[0].nextNo));
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(iso(monday));
  const [end, setEnd] = useState(iso(friday));
  const [hijri, setHijri] = useState("");
  const [kbm, setKbm] = useState("");
  const [theme, setTheme] = useState("");
  const [subtheme, setSubtheme] = useState("");
  const [core, setCore] = useState("");
  const [opening, setOpening] = useState(DEFAULT_OPENING);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const { data: sheet, error } = await supabase
      .from("bbo_sheets")
      .insert({
        class_id: classId,
        sheet_no: Number(sheetNo),
        title: title.trim(),
        start_date: start,
        end_date: end,
        hijri_range: hijri.trim() || null,
        kbm_weeks: kbm.trim() || null,
        theme: theme.trim() || null,
        subtheme: subtheme.trim() || null,
        core_topic: core.trim() || null,
        opening_note: opening.trim() || null,
        status: "draft",
        created_by: auth.user?.id,
      })
      .select("id")
      .single();
    if (error || !sheet) {
      setBusy(false);
      toast.error(
        error?.code === "23505"
          ? `Lembar ${sheetNo} sudah ada di kelas ini. Pakai nomor lain.`
          : error?.code === "23514"
            ? "Tanggal selesai tidak boleh sebelum tanggal mulai."
            : `BBO belum tersimpan: ${error?.message}`,
      );
      return;
    }
    const { error: secError } = await supabase
      .from("bbo_sections")
      .insert(DEFAULT_SECTIONS.map((s, i) => ({ sheet_id: sheet.id, kind: s.kind, title: s.title, position: i + 1 })));
    if (secError) toast.error("Bagian standar belum lengkap; bisa ditambah di editor.");
    router.push(`/guru/bbo/${sheet.id}`);
  }

  return (
    <form onSubmit={create} className="space-y-4">
      <p className="leading-relaxed text-muted-foreground">
        Isi kop dan ringkasan materi. Kartu dialog, murafaqat, dan amanah ditambahkan di langkah berikutnya.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Kelas</span>
          <select
            className={field}
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSheetNo(String(classes.find((c) => c.id === e.target.value)?.nextNo ?? 1));
            }}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Lembar ke-</span>
          <input className={field} required inputMode="numeric" value={sheetNo} onChange={(e) => setSheetNo(e.target.value.replace(/\D/g, ""))} />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Judul BBO</span>
        <input className={field} required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Bulan: Hitungan Waktu" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Tanggal mulai</span>
          <input type="date" className={field} required value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Tanggal selesai</span>
          <input type="date" className={field} required value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Tanggal Hijriah (opsional)</span>
          <input className={field} value={hijri} onChange={(e) => setHijri(e.target.value)} placeholder="mis. 15–19 Jumadil Awal 1448 H" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Pekan KBM (opsional)</span>
          <input className={field} value={kbm} onChange={(e) => setKbm(e.target.value)} placeholder="mis. Pekan 11 KBM" />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Tema</span>
        <input className={field} value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="mis. 7. Tata Surya" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Sub tema</span>
          <input className={field} value={subtheme} onChange={(e) => setSubtheme(e.target.value)} placeholder="mis. 7.2 Bulan" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Inti pembahasan</span>
          <input className={field} value={core} onChange={(e) => setCore(e.target.value)} placeholder="mis. 7.2.3 Bulan Hitungan Waktu" />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Kalimat pembuka untuk Ayah Bunda</span>
        <textarea
          rows={3}
          value={opening}
          onChange={(e) => setOpening(e.target.value)}
          className="w-full rounded-xl border bg-background p-3 text-base leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>
      <Button type="submit" size="xl" className="w-full" disabled={busy || !title.trim() || !sheetNo}>
        {busy ? "Membuat…" : "Buat draf & lanjut menyusun kartu"}
      </Button>
    </form>
  );
}
