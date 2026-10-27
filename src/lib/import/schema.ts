import { z } from "zod";

/** Hasil baca AI dari file BBO (PDF/DOCX/foto) → draf lembar. Semua nilai opsional berupa null, bukan dihilangkan. */
export const BboImportSchema = z.object({
  sheet_no: z.number().int().nullable().describe("Nomor lembar bila tertulis, mis. 'Lembar 2' → 2"),
  title: z.string().describe("Judul singkat BBO untuk orang tua, mis. 'Musim: Review Tema Hujan'"),
  start_date: z.string().nullable().describe("Tanggal mulai YYYY-MM-DD bila tertulis"),
  end_date: z.string().nullable().describe("Tanggal selesai YYYY-MM-DD bila tertulis"),
  hijri_range: z.string().nullable(),
  kbm_weeks: z.string().nullable(),
  theme: z.string().nullable(),
  subtheme: z.string().nullable(),
  core_topic: z.string().nullable(),
  opening_note: z.string().nullable().describe("Kalimat pembuka untuk Ayah Bunda"),
  iman_sections: z.array(
    z.object({
      title: z.string(),
      cards: z.array(
        z.object({
          tier: z.enum(["inti", "pengayaan", "ortu"]),
          dimension: z.enum(["iman", "ilmu", "amal"]),
          prompt: z.string(),
          expected_answer: z.string().nullable(),
          parent_note: z.string().nullable(),
          ayah_arabic: z.string().nullable(),
          ayah_translation: z.string().nullable(),
          ayah_ref: z.string().nullable(),
          from_document: z.boolean().describe("true bila pertanyaan ada di dokumen, false bila usulan AI"),
        }),
      ),
    }),
  ),
  murafaqat: z.array(
    z.object({
      subject: z.enum(["ipa", "ips", "berhitung", "bahasa", "literasi", "siroh", "fiqih"]),
      learned: z.string(),
      home_practice: z.string().nullable(),
      needs_photo: z.boolean(),
      photo_prompt: z.string().nullable(),
    }),
  ),
  amanah: z.array(z.object({ text: z.string(), needs_photo: z.boolean() })),
  quran_targets: z.array(z.object({ kind: z.enum(["tilawah", "tahfidz", "murajaah"]), description: z.string() })),
  mutabaah: z.array(
    z.object({ surah_no: z.number().int(), ayah_from: z.number().int().nullable(), ayah_to: z.number().int().nullable() }),
  ),
  adab_items: z.array(z.string()),
  notes: z.array(z.string()).describe("Catatan untuk ustadzah: apa yang disesuaikan, dipindah, diusulkan, atau perlu dicek"),
});
export type BboImport = z.infer<typeof BboImportSchema>;

export const KisiImportSchema = z.object({
  title: z.string().describe("mis. 'Kisi-kisi PAS Semester 1'"),
  subjects: z.array(z.object({ subject: z.string().describe("mis. IPA, IPS, Berhitung, Bahasa"), items: z.array(z.string()) })),
  notes: z.array(z.string()),
});
export type KisiImport = z.infer<typeof KisiImportSchema>;
