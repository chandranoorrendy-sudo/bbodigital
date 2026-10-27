// Laporan PR matematika dari Metiq (tabel metiq_reports, diisi lewat RPC metiq_ingest).

export type MetiqSkill = {
  id?: string;
  code?: string;
  name?: string;
  grade?: number;
  score?: number;
  attempts?: number;
  correct?: number;
};

export type MetiqReport = {
  id?: string;
  student_name?: string;
  class_name?: string;
  teacher_name?: string;
  assignment?: { note?: string | null; due?: string | null; created_at?: string; targeted?: boolean };
  completed_at?: string;
  done_by?: "siswa" | "ortu" | string;
  skills?: MetiqSkill[];
  link?: string;
};

export type MetiqRow = { id: string; nisn: string; completed_at: string | null; received_at: string; report: MetiqReport };

export const METIQ_SELECT = "id, nisn, completed_at, received_at, report";

export function metiqDate(ts: string | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
}

export function doneByLabel(v: string | undefined) {
  return v === "ortu" ? "ditandai orang tua" : v === "siswa" ? "dikerjakan siswa" : "selesai";
}

function title(r: MetiqReport) {
  return r.assignment?.note?.trim() || "Tugas matematika";
}

/** Daftar lengkap untuk guru: catatan tugas, tanggal selesai, oleh siapa, dan tiap keterampilan. */
export function MetiqReportList({ rows }: { rows: MetiqRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Belum ada laporan dari Metiq.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const r = row.report;
        const skills = Array.isArray(r.skills) ? r.skills : [];
        return (
          <li key={row.id} className="space-y-2 rounded-lg border p-3">
            <div>
              <p className="font-medium">{title(r)}</p>
              <p className="text-sm text-muted-foreground">
                Selesai {metiqDate(row.completed_at ?? r.completed_at)} · {doneByLabel(r.done_by)}
                {r.teacher_name && <> · dari {r.teacher_name}</>}
              </p>
            </div>
            {skills.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tanpa rincian keterampilan.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-2 font-normal">Keterampilan</th>
                    <th className="px-2 py-1 text-right font-normal">SmartScore</th>
                    <th className="py-1 pl-2 text-right font-normal">Percobaan</th>
                  </tr>
                </thead>
                <tbody>
                  {skills.map((s, i) => (
                    <tr key={s.id ?? i} className="border-t">
                      <td className="py-1 pr-2">
                        {s.code && <span className="font-mono text-muted-foreground">{s.code} </span>}
                        {s.name ?? "—"}
                      </td>
                      <td className="px-2 py-1 text-right font-semibold tabular-nums">{s.score ?? "—"}</td>
                      <td className="py-1 pl-2 text-right tabular-nums">{s.attempts ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Ringkas untuk orang tua di beranda. */
export function MetiqReportSummary({ rows }: { rows: MetiqRow[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const r = row.report;
        const skills = Array.isArray(r.skills) ? r.skills : [];
        return (
          <li key={row.id} className="space-y-1 border-l-4 border-gold pl-3">
            <p className="font-medium">{title(r)}</p>
            <p className="text-sm text-muted-foreground">
              Tuntas {metiqDate(row.completed_at ?? r.completed_at)} · {doneByLabel(r.done_by)}
            </p>
            {skills.length > 0 && (
              <p className="text-sm">
                {skills.map((s) => `${s.name ?? s.code ?? "?"}: ${s.score ?? "—"}`).join(" · ")}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
