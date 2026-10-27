import JSZip from "jszip";

/**
 * Ambil teks DOCX per paragraf. Teks berwarna ungu (konvensi BBO: "jawaban yang diharapkan")
 * ditandai ⟦ungu⟧…⟦/ungu⟧ agar AI bisa memisahkan pertanyaan dan jawaban.
 */
export async function docxToMarkedText(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("File DOCX tidak berisi dokumen.");

  const paragraphs: string[] = [];
  for (const p of xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []) {
    let line = "";
    let inPurple = false;
    for (const r of p.match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? []) {
      const text = [...r.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>/g)]
        .map((m) => (m[0] === "<w:tab/>" ? "\t" : decode(m[1] ?? "")))
        .join("");
      if (!text) continue;
      const purple = isPurple(r.match(/<w:color w:val="([0-9A-Fa-f]{6})"/)?.[1]);
      if (purple && !inPurple) line += "⟦ungu⟧";
      if (!purple && inPurple) line += "⟦/ungu⟧";
      inPurple = purple;
      line += text;
    }
    if (inPurple) line += "⟦/ungu⟧";
    if (line.trim()) paragraphs.push(line);
  }
  return paragraphs.join("\n");
}

function isPurple(hex: string | undefined) {
  if (!hex) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return b > 90 && r > g + 30 && b > g + 40;
}

function decode(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
