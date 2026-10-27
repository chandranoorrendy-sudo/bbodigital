import Link from "next/link";
import { Button } from "@/components/ui/button";

export function GuruHeader({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b-2 border-gold bg-primary px-4 py-3">
      <div className="min-w-0">
        <Link href={backHref} className="text-sm text-gold">
          ← {backLabel}
        </Link>
        <p className="truncate font-semibold text-white">{title}</p>
      </div>
      <form action="/auth/keluar" method="post">
        <Button variant="outline" className="h-10 border-gold/60 bg-transparent text-gold hover:bg-white/10 hover:text-gold">
          Keluar
        </Button>
      </form>
    </header>
  );
}
