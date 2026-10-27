import { Button } from "@/components/ui/button";

export function AppHeader({ name, subtitle }: { name: string; subtitle?: string }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b-2 border-gold bg-primary px-4 py-3 text-primary-foreground">
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-gold">BBO Kuttab Imam Al-Ghazali</p>
        <p className="truncate font-semibold text-white">{name}</p>
        {subtitle && <p className="truncate text-sm text-white/70">{subtitle}</p>}
      </div>
      <form action="/auth/keluar" method="post">
        <Button variant="outline" className="h-10 border-gold/60 bg-transparent text-gold hover:bg-white/10 hover:text-gold">
          Keluar
        </Button>
      </form>
    </header>
  );
}
