// Pemeriksaan lokal tanpa memanggil API: pembaca DOCX & skema impor.
// Jalankan: npx tsx scripts/check-import.ts "<path ke file .docx>"
import { readFileSync } from "node:fs";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { docxToMarkedText } from "../src/lib/import/docx";
import { BboImportSchema, KisiImportSchema } from "../src/lib/import/schema";

async function main() {
const path = process.argv[2];
if (path) {
  const buf = readFileSync(path);
  const text = await docxToMarkedText(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const purple = text.match(/⟦ungu⟧[\s\S]*?⟦\/ungu⟧/g) ?? [];
  console.log(`Paragraf: ${text.split("\n").length}, potongan ungu: ${purple.length}`);
  console.log(purple.slice(0, 6).map((p) => `  ${p.slice(0, 90)}`).join("\n"));
}

for (const [name, schema] of [["BBO", BboImportSchema], ["Kisi", KisiImportSchema]] as const) {
  const format = betaZodOutputFormat(schema) as unknown as { type: string; schema: { properties: Record<string, unknown> } };
  console.log(`${name}: format ${format.type}, ${Object.keys(format.schema.properties).length} properti`);
}
}

void main();
