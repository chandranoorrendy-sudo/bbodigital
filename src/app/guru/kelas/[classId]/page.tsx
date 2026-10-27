import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GuruHeader } from "@/components/guru/header";
import { getCurrentProfile } from "@/lib/supabase/server";
import { STATUS_LAPORAN, rentangTanggal } from "@/lib/format";
import { RESULT_LABEL, type CardResult } from "@/lib/bbo/types";
import { STATUS_ORDER, loadClassOverview, type ClassRow } from "@/lib/guru/load";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-secondary text-secondary-foreground",
  submitted: "bg-primary text-primary-foreground",
  reviewed: "border border-primary/40 text-primary",
};

export default async function KelasPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ lembar?: string; tab?: string; urut?: string }>;
}) {
  const { supabase, user, profile } = await getCurrentProfile();
  if (!user) redirect("/masuk");
  if (!profile || profile.role === "parent") redirect("/beranda");

  const [{ classId }, sp] = await Promise.all([params, searchParams]);
  const data = await loadClassOverview(supabase, user.id, classId, sp.lembar);
  if (!data) notFound();

  const tab = sp.tab === "rekap" ? "rekap" : "status";
  const urut = sp.urut === "status" ? "status" : "nama";
  const q = (over: Record<string, string>) => {
    const p = new URLSearchParams({ ...(data.sheet ? { lembar: data.sheet.id } : {}), tab, urut, ...over });
    return `/guru/kelas/${classId}?${p}`;
  };

  return (
    <div className="mx-auto min-h-dvh max-w-5xl">
      <GuruHeader title={data.classInfo.name} backHref="/guru" backLabel="Kelas saya" />
      <main className="space-y-5 px-4 py-5">
        {data.sheets.length === 0 || !data.sheet ? (
          <p className="text-muted-foreground">Belum ada BBO terbit untuk kelas ini.</p>
        ) : (
          <>
            <section className="space-y-2">
              <p className="text-sm text-muted-foreground">Lembar BBO</p>
              <nav className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
                {data.sheets.map((s) => (
                  <Link
                    key={s.id}
                    href={q({ lembar: s.id })}
                    className={cn(
                      "flex h-11 shrink-0 items-center rounded-xl border px-4 text-sm font-medium",
                      s.id === data.sheet!.id ? "border-primary bg-primary text-primary-foreground" : "bg-background",
                    )}
                  >
                    Lembar {s.sheet_no}
                  </Link>
                ))}
              </nav>
              <h1 className="text-xl font-semibold">
                Lembar {data.sheet.sheet_no}: {data.sheet.title}
              </h1>
              <p className="text-muted-foreground">{rentangTanggal(data.sheet.start_date, data.sheet.end_date)}</p>
            </section>

            <div className="flex gap-2 border-b">
              {(["status", "rekap"] as const).map((t) => (
                <Link
                  key={t}
                  href={q({ tab: t })}
                  className={cn(
                    "-mb-px border-b-2 px-3 py-3 font-medium",
                    tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground",
                  )}
                >
                  {t === "status" ? "Status kelas" : "Rekap pertanyaan"}
                </Link>
              ))}
            </div>

            {tab === "status" ? (
              <StatusTable rows={data.rows} urut={urut} q={q} />
            ) : (
              <Rekap cards={data.cards} rows={data.rows} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatusTable({ rows, urut, q }: { rows: ClassRow[]; urut: "nama" | "status"; q: (o: Record<string, string>) => string }) {
  // Diurutkan berdasarkan nama atau status, tidak pernah berdasarkan capaian (PRD GU-4).
  const sorted = [...rows].sort((a, b) =>
    urut === "status"
      ? STATUS_ORDER[a.submission?.status ?? "not_started"] - STATUS_ORDER[b.submission?.status ?? "not_started"] ||
        a.student.full_name.localeCompare(b.student.full_name)
      : a.student.full_name.localeCompare(b.student.full_name),
  );
  const waiting = rows.filter((r) => r.submission?.status === "submitted");

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Urutkan:</span>
          {(["nama", "status"] as const).map((u) => (
            <Link
              key={u}
              href={q({ urut: u })}
              className={cn("rounded-full px-3 py-1.5", urut === u ? "bg-primary text-primary-foreground" : "bg-muted")}
            >
              {u === "nama" ? "Nama" : "Status"}
            </Link>
          ))}
        </div>
        {waiting[0]?.submission && (
          <Button asChild>
            <Link href={`/guru/laporan/${waiting[0].submission.id}`}>Mulai menanggapi ({waiting.length})</Link>
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-background">
        <table className="w-full text-left">
          <thead className="bg-muted/60 text-sm text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Santri</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Tanggapan</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((r) => {
              const status = r.submission?.status ?? "not_started";
              return (
                <tr key={r.student.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.student.full_name}</p>
                    {r.submission?.submitted_at && (
                      <p className="text-sm text-muted-foreground">
                        Dikirim{" "}
                        {new Date(r.submission.submitted_at).toLocaleString("id-ID", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Asia/Jakarta",
                        })}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-sm font-medium", STATUS_STYLE[status])}>
                      {STATUS_LAPORAN[status]}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-sm sm:table-cell">
                    <span className={r.feedback.iman ? "text-primary" : "text-muted-foreground"}>
                      Iman {r.feedback.iman ? "✓" : "–"}
                    </span>
                    {" · "}
                    <span className={r.feedback.quran ? "text-primary" : "text-muted-foreground"}>
                      Qur&apos;an {r.feedback.quran ? "✓" : "–"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.submission ? (
                      <Button asChild variant={status === "submitted" ? "default" : "outline"} className="h-10">
                        <Link href={`/guru/laporan/${r.submission.id}`}>{status === "submitted" ? "Tanggapi" : "Lihat"}</Link>
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Rekap({ cards, rows }: { cards: (import("@/lib/bbo/types").BboCard & { sectionTitle: string })[]; rows: ClassRow[] }) {
  const asked = cards.filter((c) => c.tier !== "ortu");
  const results: CardResult[] = ["bisa", "belum_dijelaskan", "perlu_bantuan"];
  return (
    <section className="space-y-3">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Untuk mengevaluasi KBM: berapa santri yang belum bisa pada tiap pertanyaan. Nama hanya terlihat bila rincian dibuka.
      </p>
      {asked.map((c, i) => {
        const counts = Object.fromEntries(results.map((r) => [r, rows.filter((row) => row.results[c.id] === r)])) as Record<
          CardResult,
          ClassRow[]
        >;
        const unanswered = rows.filter((row) => !row.results[c.id]).length;
        return (
          <article key={c.id} className="space-y-3 rounded-xl border bg-background p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={c.tier === "inti" ? "default" : "secondary"}>{c.tier === "inti" ? "Inti" : "Pengayaan"}</Badge>
              <span className="text-sm text-muted-foreground">
                {i + 1}. {c.sectionTitle}
              </span>
            </div>
            <p className="font-medium">{c.prompt}</p>
            <div className="flex flex-wrap gap-2 text-sm">
              {results.map((r) => (
                <span
                  key={r}
                  className={cn(
                    "rounded-full px-3 py-1 font-medium",
                    r === "bisa" ? "bg-primary/10 text-primary" : r === "perlu_bantuan" ? "bg-destructive/10 text-destructive" : "bg-muted",
                  )}
                >
                  {RESULT_LABEL[r]}: {counts[r].length}
                </span>
              ))}
              <span className="rounded-full px-3 py-1 text-muted-foreground">Belum dijawab: {unanswered}</span>
            </div>
            {(counts.belum_dijelaskan.length > 0 || counts.perlu_bantuan.length > 0) && (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-muted-foreground">Lihat nama santri</summary>
                <ul className="mt-2 space-y-1">
                  {(["perlu_bantuan", "belum_dijelaskan"] as const).map((r) =>
                    counts[r].length ? (
                      <li key={r}>
                        <span className="text-muted-foreground">{RESULT_LABEL[r]}:</span>{" "}
                        {counts[r].map((row) => row.student.nickname ?? row.student.full_name).sort().join(", ")}
                      </li>
                    ) : null,
                  )}
                </ul>
              </details>
            )}
          </article>
        );
      })}
    </section>
  );
}
