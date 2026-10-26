const tanggal = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", timeZone: "Asia/Jakarta" });
const tanggalTahun = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

/** "19–23 Oktober 2026" dari dua tanggal ISO (yyyy-mm-dd). */
export function rentangTanggal(start: string, end: string) {
  const a = new Date(`${start}T00:00:00+07:00`);
  const b = new Date(`${end}T00:00:00+07:00`);
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()}–${tanggalTahun.format(b)}`;
  }
  return `${tanggal.format(a)} – ${tanggalTahun.format(b)}`;
}

export function hariIniJakarta() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

export const STATUS_LAPORAN: Record<string, string> = {
  not_started: "Belum mulai",
  in_progress: "Sedang dikerjakan",
  submitted: "Sudah dikirim",
  reviewed: "Sudah ditanggapi",
};
