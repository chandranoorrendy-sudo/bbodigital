"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const field =
  "h-12 w-full rounded-xl border bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** GU-2: salin BBO dari kelas lain atau tahun lalu menjadi draf yang bisa diubah. */
export function CopySheetForm({
  sources,
  targets,
}: {
  sources: { id: string; label: string }[];
  targets: { id: string; label: string; nextNo: number }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState(targets[0]?.id ?? "");
  const [sheetNo, setSheetNo] = useState(String(targets[0]?.nextNo ?? 1));
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" size="xl" onClick={() => setOpen(true)} disabled={sources.length === 0}>
        Salin BBO dari kelas lain / tahun lalu
      </Button>
    );
  }

  async function copy() {
    setBusy(true);
    const { data, error } = await createClient().rpc("copy_bbo_sheet", {
      p_sheet: source,
      p_target_class: target,
      p_sheet_no: Number(sheetNo),
    });
    setBusy(false);
    if (error) {
      toast.error(error.code === "23505" ? `Lembar ${sheetNo} sudah ada di kelas tujuan. Pakai nomor lain.` : `Gagal menyalin: ${error.message}`);
      return;
    }
    toast.success("BBO disalin sebagai draf.");
    router.push(`/guru/bbo/${data}`);
  }

  return (
    <section className="space-y-3 rounded-xl border bg-background p-4">
      <h2 className="font-semibold">Salin BBO</h2>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Dari lembar</span>
        <select className={field} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Pilih lembar sumber…</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Ke kelas</span>
          <select
            className={field}
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setSheetNo(String(targets.find((t) => t.id === e.target.value)?.nextNo ?? 1));
            }}
          >
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Nomor lembar</span>
          <input className={field} inputMode="numeric" value={sheetNo} onChange={(e) => setSheetNo(e.target.value.replace(/\D/g, ""))} />
        </label>
      </div>
      <p className="text-sm text-muted-foreground">Hasil salinan berupa draf; tanggal dan isinya bisa diubah sebelum diterbitkan.</p>
      <div className="flex gap-2">
        <Button variant="outline" className="h-12" onClick={() => setOpen(false)}>
          Batal
        </Button>
        <Button className="h-12 flex-1" disabled={!source || !target || !sheetNo || busy} onClick={copy}>
          {busy ? "Menyalin…" : "Salin sebagai draf"}
        </Button>
      </div>
    </section>
  );
}
