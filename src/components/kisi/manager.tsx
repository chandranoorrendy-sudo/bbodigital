"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_KISI_TITLE, groupKisi, type KisiItem } from "@/lib/kisi";

const field =
  "h-11 w-full rounded-lg border bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function KisiManager({ classId, items }: { classId: string; items: KisiItem[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const groups = groupKisi(items);
  const [title, setTitle] = useState(groups[0]?.title ?? DEFAULT_KISI_TITLE);
  const [subject, setSubject] = useState("IPA");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const position = Math.max(0, ...items.map((i) => i.position)) + 1;
    const { error } = await supabase
      .from("kisi_kisi")
      .insert({ class_id: classId, title: title.trim() || DEFAULT_KISI_TITLE, subject: subject.trim(), text: text.trim(), position });
    setBusy(false);
    if (error) return toast.error(`Belum tersimpan: ${error.message}`);
    setText("");
    router.refresh();
  }

  async function update(id: string, value: string) {
    const { error } = await supabase.from("kisi_kisi").update({ text: value }).eq("id", id);
    if (error) toast.error("Perubahan belum tersimpan.");
  }

  async function remove(id: string) {
    if (!window.confirm("Hapus poin kisi-kisi ini?")) return;
    const { error } = await supabase.from("kisi_kisi").delete().eq("id", id);
    if (error) return toast.error("Belum terhapus.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {groups.length === 0 && <p className="text-muted-foreground">Belum ada kisi-kisi untuk kelas ini.</p>}
      {groups.map((g) => (
        <section key={g.title} className="space-y-4 rounded-xl border bg-background p-4">
          <h2 className="text-lg font-semibold">{g.title}</h2>
          {g.subjects.map((s) => (
            <div key={s.subject} className="space-y-2">
              <h3 className="font-medium text-gold-ink">{s.subject}</h3>
              <ul className="space-y-2">
                {s.items.map((k) => (
                  <li key={k.id} className="flex items-start gap-2">
                    <textarea
                      rows={2}
                      defaultValue={k.text}
                      onBlur={(e) => e.target.value.trim() !== k.text && update(k.id, e.target.value.trim())}
                      className="min-h-11 flex-1 rounded-lg border bg-background px-3 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    <Button variant="ghost" className="h-11 text-destructive" onClick={() => remove(k.id)}>
                      Hapus
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}

      <form onSubmit={add} className="space-y-3 rounded-xl border bg-background p-4">
        <h2 className="font-semibold">Tambah poin kisi-kisi</h2>
        <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. PAS Semester 1" />
          <input className={field} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Mapel (IPA, IPS…)" list="kisi-mapel" />
          <datalist id="kisi-mapel">
            {["IPA", "IPS", "Berhitung", "Bahasa", "Iman", "Qur'an"].map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <textarea
          rows={2}
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="mis. Proses turunnya hujan"
          className="w-full rounded-lg border bg-background px-3 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" className="h-11 w-full" disabled={busy || !text.trim() || !subject.trim()}>
          Tambah
        </Button>
      </form>
    </div>
  );
}
