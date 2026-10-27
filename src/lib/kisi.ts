export type KisiItem = { id: string; class_id: string; title: string; subject: string; text: string; position: number };

/** Kelompokkan kisi-kisi per judul (mis. "PAS Semester 1"), lalu per mapel, sesuai urutan. */
export function groupKisi(items: KisiItem[]) {
  const byTitle = new Map<string, Map<string, KisiItem[]>>();
  for (const k of [...items].sort((a, b) => a.position - b.position)) {
    const subjects = byTitle.get(k.title) ?? new Map<string, KisiItem[]>();
    subjects.set(k.subject, [...(subjects.get(k.subject) ?? []), k]);
    byTitle.set(k.title, subjects);
  }
  return [...byTitle.entries()].map(([title, subjects]) => ({
    title,
    subjects: [...subjects.entries()].map(([subject, list]) => ({ subject, items: list })),
  }));
}

export const DEFAULT_KISI_TITLE = "Kisi-kisi ujian semester";
