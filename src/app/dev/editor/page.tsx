import { notFound } from "next/navigation";
import { BboEditor } from "@/components/editor/editor";
import { GuruHeader } from "@/components/guru/header";
import { FIXTURE } from "@/lib/dev/fixture";

// Pratinjau tata letak editor tanpa login, hanya di `npm run dev`. Perubahan tidak tersimpan.
export default function DevEditorPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="min-h-dvh">
      <GuruHeader title="Kuttab Awal 2B · Lembar 12 (pratinjau)" backHref="/dev/sesi" backLabel="Pratinjau sesi" />
      <BboEditor
        data={{
          sheet: { ...FIXTURE.sheet, class_id: "demo-kelas", status: "draft", className: "Kuttab Awal 2B" },
          sections: FIXTURE.sections,
          murafaqat: FIXTURE.murafaqat,
          amanah: FIXTURE.amanah,
          targets: FIXTURE.quranTargets,
          canEdit: true,
          canEditQuran: true,
          submissionCount: 0,
        }}
      />
    </div>
  );
}
