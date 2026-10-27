import { notFound } from "next/navigation";
import { BboSession } from "@/components/bbo/session";
import { FIXTURE } from "@/lib/dev/fixture";

// Pratinjau tampilan sesi tanpa login, hanya di `npm run dev`. Jawaban disimpan di memori saja.
export default function DevSessionPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <BboSession data={FIXTURE} demo />;
}
