import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { METIQ_SELECT, MetiqReportSummary, type MetiqRow } from "@/components/metiq/reports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/supabase/server";
import { STATUS_LAPORAN, hariIniJakarta, rentangTanggal } from "@/lib/format";
import { cn } from "@/lib/utils";

type Student = {
  id: string;
  full_name: string;
  nickname: string | null;
  class_id: string | null;
  classes: { name: string } | null;
};

export default async function BerandaPage({
  searchParams,
}: {
  searchParams: Promise<{ anak?: string }>;
}) {
  const { supabase, user, profile } = await getCurrentProfile();
  if (!user) redirect("/masuk");
  if (profile && profile.role !== "parent") redirect("/guru");

  // RLS: hanya santri yang terhubung dengan akun ini lewat guardians.
  const { data: studentsData } = await supabase
    .from("students")
    .select("id, full_name, nickname, class_id, classes(name)")
    .order("full_name");
  const students = (studentsData ?? []) as unknown as Student[];

  const { anak } = await searchParams;
  const active = students.find((s) => s.id === anak) ?? students[0];

  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <AppHeader name={profile?.full_name || user.email || "Ayah Bunda"} />

      <main className="space-y-5 px-4 py-5">
        {students.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Akun belum terhubung dengan Ananda</CardTitle>
              <CardDescription className="text-base">
                Silakan hubungi admin kuttab agar email ini ditautkan ke data santri.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            {students.length > 1 && (
              <nav className="flex gap-2 overflow-x-auto" aria-label="Pilih Ananda">
                {students.map((s) => (
                  <Link
                    key={s.id}
                    href={`/beranda?anak=${s.id}`}
                    className={cn(
                      "flex h-12 min-w-24 items-center justify-center rounded-xl border px-4 text-base font-medium",
                      s.id === active.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted",
                    )}
                    aria-current={s.id === active.id ? "page" : undefined}
                  >
                    {s.nickname ?? s.full_name}
                  </Link>
                ))}
              </nav>
            )}
            <StudentHome student={active} />
          </>
        )}
      </main>
    </div>
  );
}

async function StudentHome({ student }: { student: Student }) {
  const { supabase } = await getCurrentProfile();
  const today = hariIniJakarta();

  const [{ data: sheet }, { data: teachers }] = await Promise.all([
    supabase
      .from("bbo_sheets")
      .select("id, sheet_no, title, theme, subtheme, start_date, end_date, hijri_range, kbm_weeks, opening_note")
      .eq("class_id", student.class_id ?? "")
      .in("status", ["published", "closed"])
      .lte("start_date", today)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    student.class_id
      ? supabase.rpc("get_class_teachers", { p_class: student.class_id })
      : Promise.resolve({ data: [] as { full_name: string; subject: string }[] }),
  ]);

  let totalInti = 0;
  let answeredInti = 0;
  let status = "not_started";
  if (sheet) {
    const [{ count }, { data: submission }] = await Promise.all([
      supabase
        .from("bbo_cards")
        .select("id, bbo_sections!inner(sheet_id)", { count: "exact", head: true })
        .eq("bbo_sections.sheet_id", sheet.id)
        .eq("tier", "inti"),
      supabase
        .from("submissions")
        .select("id, status, card_responses(id, bbo_cards!inner(tier))")
        .eq("sheet_id", sheet.id)
        .eq("student_id", student.id)
        .eq("card_responses.bbo_cards.tier", "inti")
        .maybeSingle(),
    ]);
    totalInti = count ?? 0;
    answeredInti = submission?.card_responses?.length ?? 0;
    status = submission?.status ?? "not_started";
  }

  // Kisi-kisi ujian kelas ini dan berapa yang sudah dilatih (dibandingkan dengan diri sendiri saja).
  const [{ count: kisiTotal }, { count: kisiDone }] = await Promise.all([
    supabase.from("kisi_kisi").select("id", { count: "exact", head: true }).eq("class_id", student.class_id ?? ""),
    supabase.from("kisi_checks").select("id", { count: "exact", head: true }).eq("student_id", student.id),
  ]);

  // Tanggapan terbaru: semua tanggapan (Iman & Qur'an) dari laporan yang terakhir ditanggapi (OT-13).
  const { data: feedbackRows } = await supabase
    .from("teacher_feedback")
    .select("id, body, subject, created_at, submission_id, submissions!inner(student_id, bbo_sheets(sheet_no, title))")
    .eq("submissions.student_id", student.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const { data: metiqRows } = await supabase
    .from("metiq_reports")
    .select(METIQ_SELECT)
    .eq("student_id", student.id)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(3);
  const metiq = (metiqRows ?? []) as MetiqRow[];

  const latestSubmission = feedbackRows?.[0]?.submission_id;
  const feedback = (feedbackRows ?? [])
    .filter((f) => f.submission_id === latestSubmission)
    .sort((a, b) => (a.subject === b.subject ? 0 : a.subject === "iman" ? -1 : 1));

  const teacherList = (teachers ?? []) as { full_name: string; subject: string }[];
  const guruIman = teacherList.find((t) => t.subject === "iman")?.full_name;
  const guruQuran = teacherList.find((t) => t.subject === "quran")?.full_name;
  const fbSheet = feedbackRows?.[0]?.submissions as unknown as { bbo_sheets: { sheet_no: number; title: string } | null } | undefined;

  return (
    <div className="space-y-5">
      <section className="space-y-1">
        <h1 className="text-xl font-semibold">{student.full_name}</h1>
        <p className="text-muted-foreground">{student.classes?.name}</p>
        {(guruIman || guruQuran) && (
          <p className="text-sm text-muted-foreground">
            {guruIman && <>Guru Iman: {guruIman}</>}
            {guruIman && guruQuran && " · "}
            {guruQuran && <>Guru Qur&apos;an: {guruQuran}</>}
          </p>
        )}
      </section>

      {sheet ? (
        <Card className="border-gold/60">
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Lembar {sheet.sheet_no}</Badge>
              <Badge variant="outline">{STATUS_LAPORAN[status]}</Badge>
            </div>
            <CardTitle className="text-xl">{sheet.title}</CardTitle>
            <CardDescription className="text-base">
              {rentangTanggal(sheet.start_date, sheet.end_date)}
              {sheet.hijri_range && <> · {sheet.hijri_range}</>}
              {sheet.kbm_weeks && <> · {sheet.kbm_weeks}</>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sheet.opening_note && <p className="leading-relaxed">{sheet.opening_note}</p>}
            <div className="space-y-2">
              <p className="text-base">
                <span className="font-semibold">{answeredInti}</span> dari{" "}
                <span className="font-semibold">{totalInti}</span> kartu Inti sudah dikerjakan
              </p>
              <div className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className="h-full rounded-full bg-gold"
                  style={{ width: `${totalInti ? Math.round((answeredInti / totalInti) * 100) : 0}%` }}
                />
              </div>
            </div>
            <Button asChild size="xl" className="w-full">
              <Link href={`/bbo/${sheet.id}?anak=${student.id}`}>
                {status === "not_started"
                  ? "Mulai BBO"
                  : status === "in_progress"
                    ? "Lanjutkan BBO"
                    : "Lihat BBO"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Belum ada BBO pekan ini</CardTitle>
            <CardDescription className="text-base">
              BBO akan muncul di sini setelah ustadzah menerbitkannya.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {(kisiTotal ?? 0) > 0 && (
        <Link
          href={`/kisi?anak=${student.id}`}
          className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-gold/60 bg-gold-soft px-4 py-3"
        >
          <span>
            <span className="block font-semibold">Kisi-kisi ujian semester</span>
            <span className="text-sm text-muted-foreground">
              {kisiDone ?? 0} dari {kisiTotal} poin sudah dilatih di rumah
            </span>
          </span>
          <span aria-hidden className="text-gold-ink">
            →
          </span>
        </Link>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tanggapan guru terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {feedback.length > 0 ? (
            <div className="space-y-4">
              {fbSheet?.bbo_sheets && (
                <p className="text-sm text-muted-foreground">
                  Lembar {fbSheet.bbo_sheets.sheet_no}: {fbSheet.bbo_sheets.title}
                </p>
              )}
              {feedback.map((f) => (
                <div key={f.id} className="space-y-1 border-l-4 border-gold pl-3">
                  <p className="text-sm font-medium text-primary">
                    {f.subject === "iman" ? `Guru Iman${guruIman ? ` · ${guruIman}` : ""}` : `Guru Qur'an${guruQuran ? ` · ${guruQuran}` : ""}`}
                  </p>
                  <p className="leading-relaxed whitespace-pre-line">{f.body}</p>
                  <p className="text-xs text-muted-foreground">
                    Diparaf{" "}
                    {new Date(f.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", timeZone: "Asia/Jakarta" })}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Belum ada tanggapan.</p>
          )}
        </CardContent>
      </Card>

      {metiq.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📐 PR matematika (Metiq)</CardTitle>
          </CardHeader>
          <CardContent>
            <MetiqReportSummary rows={metiq} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
