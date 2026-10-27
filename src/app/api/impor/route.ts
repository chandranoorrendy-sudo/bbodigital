import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse, type NextRequest } from "next/server";
import { docxToMarkedText } from "@/lib/import/docx";
import { BBO_SYSTEM, KISI_SYSTEM } from "@/lib/import/prompts";
import { saveBboDraft, saveKisi } from "@/lib/import/save";
import { BboImportSchema, KisiImportSchema } from "@/lib/import/schema";
import { getCurrentProfile } from "@/lib/supabase/server";

// Membaca PDF beberapa halaman bisa makan waktu 1–2 menit.
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 4 * 1024 * 1024; // batas unggah Vercel ±4,5 MB
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/** Blok konten untuk Claude dari file yang diunggah: PDF sebagai dokumen, foto sebagai gambar, DOCX sebagai teks bertanda. */
async function fileToContent(file: File): Promise<Anthropic.Beta.BetaContentBlockParam> {
  const buffer = await file.arrayBuffer();
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: Buffer.from(buffer).toString("base64") },
    };
  }
  if ((IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return {
      type: "image",
      source: { type: "base64", media_type: file.type as ImageType, data: Buffer.from(buffer).toString("base64") },
    };
  }
  if (name.endsWith(".docx")) {
    const text = await docxToMarkedText(buffer);
    return { type: "text", text: `Isi file ${file.name} (teks ⟦ungu⟧…⟦/ungu⟧ berwarna ungu di dokumen):\n\n${text}` };
  }
  throw new Error("Format belum didukung. Gunakan PDF, DOCX, atau foto (JPG/PNG).");
}

export async function POST(request: NextRequest) {
  const { supabase, user, profile } = await getCurrentProfile();
  if (!user || !profile) return fail(401, "Silakan masuk terlebih dahulu.");
  if (profile.role === "parent") return fail(403, "Impor hanya untuk ustadz/ustadzah dan admin.");
  if (!process.env.ANTHROPIC_API_KEY) {
    return fail(503, "Fitur impor AI belum diaktifkan. Admin perlu menambahkan ANTHROPIC_API_KEY di pengaturan Vercel.");
  }

  const form = await request.formData();
  const file = form.get("file");
  const kind = form.get("kind") === "kisi" ? "kisi" : "bbo";
  const classId = String(form.get("class_id") ?? "");
  const sheetNo = Number(form.get("sheet_no") ?? 0);
  if (!(file instanceof File) || file.size === 0) return fail(400, "Pilih file terlebih dahulu.");
  if (file.size > MAX_BYTES) return fail(413, "File terlalu besar (maks. 4 MB). Simpan ulang PDF dengan ukuran lebih kecil.");
  if (!classId) return fail(400, "Pilih kelas.");
  if (kind === "bbo" && !(sheetNo > 0)) return fail(400, "Isi nomor lembar.");

  let content: Anthropic.Beta.BetaContentBlockParam;
  try {
    content = await fileToContent(file);
  } catch (e) {
    return fail(400, (e as Error).message);
  }

  const client = new Anthropic();
  const params = {
    model: "claude-opus-5-5",
    max_tokens: 32000,
    // Bila model menolak karena pengaman, server mencoba model cadangan secara otomatis.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default" as const,
    messages: [
      {
        role: "user" as const,
        content: [
          content,
          {
            type: "text" as const,
            text:
              kind === "bbo"
                ? "Ubah lembar BBO ini menjadi draf BBO digital sesuai aturan."
                : "Salin kisi-kisi ujian ini per mapel sesuai aturan.",
          },
        ],
      },
    ],
  };

  try {
    if (kind === "bbo") {
      const stream = client.beta.messages.stream({
        ...params,
        system: BBO_SYSTEM,
        output_config: { effort: "medium", format: betaZodOutputFormat(BboImportSchema) },
      });
      const message = await stream.finalMessage();
      if (message.stop_reason === "refusal") return fail(422, "AI tidak bisa memproses dokumen ini. Silakan susun manual di editor.");
      if (message.stop_reason === "max_tokens" || !message.parsed_output) {
        return fail(422, "Dokumen terlalu panjang untuk dibaca sekaligus. Coba pisahkan per bagian.");
      }
      const id = await saveBboDraft(supabase, user.id, classId, sheetNo, message.parsed_output);
      return NextResponse.json({ id, notes: message.parsed_output.notes });
    }

    const stream = client.beta.messages.stream({
      ...params,
      system: KISI_SYSTEM,
      output_config: { effort: "low", format: betaZodOutputFormat(KisiImportSchema) },
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") return fail(422, "AI tidak bisa memproses dokumen ini. Silakan ketik manual.");
    if (message.stop_reason === "max_tokens" || !message.parsed_output) return fail(422, "Kisi-kisi belum terbaca utuh. Coba lagi.");
    const count = await saveKisi(supabase, classId, message.parsed_output);
    return NextResponse.json({ count, notes: message.parsed_output.notes });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return fail(429, "Layanan AI sedang sibuk. Coba lagi beberapa saat lagi.");
    if (e instanceof Anthropic.AuthenticationError) return fail(503, "Kunci API AI tidak valid. Periksa ANTHROPIC_API_KEY di Vercel.");
    if (e instanceof Anthropic.APIError) return fail(502, `Layanan AI bermasalah (${e.status}). Coba lagi.`);
    const err = e as { code?: string; message?: string };
    if (err.code === "23505") return fail(409, `Lembar ${sheetNo} sudah ada di kelas ini. Pakai nomor lain.`);
    if (err.code === "42501") return fail(403, "Anda tidak berhak menyusun BBO/kisi-kisi untuk kelas ini.");
    return fail(500, `Gagal menyimpan hasil impor: ${err.message ?? "kesalahan tidak dikenal"}`);
  }
}
