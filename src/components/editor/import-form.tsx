"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const field =
  "h-12 w-full rounded-xl border bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

type Props =
  | { kind: "bbo"; classes: { id: string; label: string; nextNo: number }[] }
  | { kind: "kisi"; classId: string };

/** GU-10: unggah BBO/kisi-kisi lama (PDF, DOCX, atau foto), AI menyusun draf yang wajib diperiksa guru. */
export function ImportFileForm(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [classId, setClassId] = useState(props.kind === "bbo" ? (props.classes[0]?.id ?? "") : props.classId);
  const [sheetNo, setSheetNo] = useState(props.kind === "bbo" ? String(props.classes[0]?.nextNo ?? 1) : "");
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<{ id?: string; count?: number; notes: string[] } | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setSeconds(0);
    setResult(null);
    timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", props.kind);
    fd.set("class_id", classId);
    if (props.kind === "bbo") fd.set("sheet_no", sheetNo);
    try {
      const res = await fetch("/api/impor", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({ error: "Respons tidak terbaca." }));
      if (!res.ok) throw new Error(body.error ?? `Gagal (${res.status})`);
      setResult({ id: body.id, count: body.count, notes: body.notes ?? [] });
      if (props.kind === "kisi") {
        toast.success(`${body.count} poin kisi-kisi ditambahkan. Periksa dan rapikan bila perlu.`);
        router.refresh();
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      if (timer.current) window.clearInterval(timer.current);
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="xl" className="w-full" onClick={() => setOpen(true)}>
        {props.kind === "bbo" ? "Impor BBO dari PDF / DOCX / foto (AI)" : "Impor kisi-kisi dari PDF / DOCX / foto (AI)"}
      </Button>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border-2 border-gold/60 bg-gold-soft p-4">
      <h2 className="font-semibold">{props.kind === "bbo" ? "Impor BBO dengan AI" : "Impor kisi-kisi dengan AI"}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {props.kind === "bbo"
          ? "AI membaca file lalu menyusun draf: kartu Inti / Pengayaan / Untuk Ayah Bunda, murafaqat, amanah, target Qur'an, mutaba'ah, dan adab. Nama santri dan nomor HP tidak disalin. Hasilnya selalu draf yang wajib Anda periksa sebelum diterbitkan."
          : "AI menyalin poin kisi-kisi per mapel. Periksa hasilnya setelah selesai."}
      </p>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-base file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:text-primary-foreground"
        />
        {props.kind === "bbo" && (
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <select
              className={field}
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSheetNo(String(props.classes.find((c) => c.id === e.target.value)?.nextNo ?? 1));
              }}
            >
              {props.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <input className={field} inputMode="numeric" value={sheetNo} onChange={(e) => setSheetNo(e.target.value.replace(/\D/g, ""))} aria-label="Nomor lembar" />
          </div>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-12" disabled={busy} onClick={() => setOpen(false)}>
            Tutup
          </Button>
          <Button type="submit" className="h-12 flex-1" disabled={!file || busy || (props.kind === "bbo" && !sheetNo)}>
            {busy ? `AI sedang membaca… ${seconds} dtk` : "Mulai impor"}
          </Button>
        </div>
        {busy && <p className="text-sm text-muted-foreground">Biasanya 30 detik sampai 2 menit. Jangan tutup halaman ini.</p>}
      </form>

      {result && (
        <div className="space-y-3 rounded-lg border bg-background p-3">
          <p className="font-medium">
            {props.kind === "bbo" ? "Draf BBO sudah dibuat." : `${result.count} poin kisi-kisi ditambahkan.`} Catatan dari AI:
          </p>
          {result.notes.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
              {result.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Tidak ada catatan.</p>
          )}
          {result.id && (
            <Button asChild size="xl" className="w-full">
              <Link href={`/guru/bbo/${result.id}`}>Periksa draf di editor</Link>
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
