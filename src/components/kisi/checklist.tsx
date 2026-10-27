"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { groupKisi, type KisiItem } from "@/lib/kisi";
import { cn } from "@/lib/utils";

/** Kisi-kisi ujian untuk orang tua: centang poin yang sudah dilatih di rumah (hanya dibandingkan dengan diri sendiri). */
export function KisiChecklist({
  studentId,
  studentName,
  items,
  checked,
}: {
  studentId: string;
  studentName: string;
  items: KisiItem[];
  checked: string[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [done, setDone] = useState(() => new Set(checked));
  const groups = groupKisi(items);

  async function toggle(id: string) {
    const was = done.has(id);
    setDone((prev) => {
      const next = new Set(prev);
      if (was) next.delete(id);
      else next.add(id);
      return next;
    });
    const { error } = was
      ? await supabase.from("kisi_checks").delete().eq("kisi_id", id).eq("student_id", studentId)
      : await supabase.from("kisi_checks").insert({ kisi_id: id, student_id: studentId });
    if (error) {
      toast.error("Belum tersimpan. Periksa sinyal, lalu coba lagi.");
      setDone((prev) => {
        const next = new Set(prev);
        if (was) next.add(id);
        else next.delete(id);
        return next;
      });
    }
  }

  if (items.length === 0) {
    return <p className="text-muted-foreground">Belum ada kisi-kisi ujian dari ustadz/ustadzah.</p>;
  }

  return (
    <div className="space-y-6">
      <p className="leading-relaxed text-muted-foreground">
        Bahan yang akan ditanyakan saat ujian semester. Centang poin yang sudah Ayah/Bunda latih bersama {studentName} di rumah.
      </p>
      {groups.map((g) => (
        <section key={g.title} className="space-y-4">
          <h1 className="text-xl font-semibold">{g.title}</h1>
          {g.subjects.map((s) => {
            const count = s.items.filter((k) => done.has(k.id)).length;
            return (
              <div key={s.subject} className="space-y-2 rounded-xl border bg-background p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-gold-ink">{s.subject}</h2>
                  <span className="text-sm text-muted-foreground">
                    {count}/{s.items.length} sudah dilatih
                  </span>
                </div>
                <ul className="space-y-2">
                  {s.items.map((k) => (
                    <li key={k.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={done.has(k.id)}
                        onClick={() => toggle(k.id)}
                        className={cn(
                          "flex min-h-12 w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left",
                          done.has(k.id) ? "border-primary bg-gold-soft" : "bg-background",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 text-sm font-bold",
                            done.has(k.id) ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50",
                          )}
                        >
                          {done.has(k.id) && "✓"}
                        </span>
                        <span className="leading-relaxed">{k.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      ))}
      <Button asChild variant="outline" size="xl" className="w-full">
        <Link href={`/beranda?anak=${studentId}`}>Kembali ke beranda</Link>
      </Button>
    </div>
  );
}
