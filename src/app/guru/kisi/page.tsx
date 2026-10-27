import Link from "next/link";
import { redirect } from "next/navigation";
import { ImportFileForm } from "@/components/editor/import-form";
import { GuruHeader } from "@/components/guru/header";
import { KisiManager } from "@/components/kisi/manager";
import { getCurrentProfile } from "@/lib/supabase/server";
import type { KisiItem } from "@/lib/kisi";
import { cn } from "@/lib/utils";

export default async function GuruKisiPage({ searchParams }: { searchParams: Promise<{ kelas?: string }> }) {
  const { supabase, user, profile } = await getCurrentProfile();
  if (!user) redirect("/masuk");
  if (!profile || profile.role === "parent") redirect("/beranda");

  // Kelas yang diajar (mapel apa pun), atau semua kelas bagi admin.
  let classes: { id: string; name: string }[];
  if (profile.role === "admin") {
    const { data } = await supabase.from("classes").select("id, name").order("name");
    classes = data ?? [];
  } else {
    const { data } = await supabase.from("class_teachers").select("classes(id, name)").eq("teacher_id", user.id);
    const map = new Map<string, { id: string; name: string }>();
    for (const r of data ?? []) {
      const c = r.classes as unknown as { id: string; name: string } | null;
      if (c) map.set(c.id, c);
    }
    classes = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  const { kelas } = await searchParams;
  const current = classes.find((c) => c.id === kelas) ?? classes[0];
  const { data: items } = current
    ? await supabase.from("kisi_kisi").select("id, class_id, title, subject, text, position").eq("class_id", current.id).order("position")
    : { data: [] };

  return (
    <div className="mx-auto min-h-dvh max-w-3xl">
      <GuruHeader title="Kisi-kisi ujian" backHref="/guru" backLabel="Kelas saya" />
      <main className="space-y-5 px-4 py-5">
        {!current ? (
          <p className="text-muted-foreground">Belum ada kelas yang ditugaskan kepada Anda.</p>
        ) : (
          <>
            <nav className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
              {classes.map((c) => (
                <Link
                  key={c.id}
                  href={`/guru/kisi?kelas=${c.id}`}
                  className={cn(
                    "flex h-11 shrink-0 items-center rounded-xl border px-4 text-sm font-medium",
                    c.id === current.id ? "border-primary bg-primary text-primary-foreground" : "bg-background",
                  )}
                >
                  {c.name}
                </Link>
              ))}
            </nav>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Kisi-kisi tampil di HP orang tua. Orang tua bisa mencentang poin yang sudah dilatih di rumah; centang itu tidak
              dibandingkan antarsantri.
            </p>
            <ImportFileForm kind="kisi" classId={current.id} />
            <KisiManager classId={current.id} items={(items ?? []) as KisiItem[]} />
          </>
        )}
      </main>
    </div>
  );
}
