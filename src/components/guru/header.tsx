import Link from "next/link";
import { Button } from "@/components/ui/button";

export function GuruHeader({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
      <div className="min-w-0">
        <Link href={backHref} className="text-sm text-primary">
          ← {backLabel}
        </Link>
        <p className="truncate font-semibold">{title}</p>
      </div>
      <form action="/auth/keluar" method="post">
        <Button variant="outline" className="h-10">
          Keluar
        </Button>
      </form>
    </header>
  );
}
