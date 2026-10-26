import { Button } from "@/components/ui/button";

export function AppHeader({ name, subtitle }: { name: string; subtitle?: string }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-primary">BBO Kuttab Imam Al-Ghazali</p>
        <p className="truncate font-semibold">{name}</p>
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <form action="/auth/keluar" method="post">
        <Button variant="outline" className="h-10">
          Keluar
        </Button>
      </form>
    </header>
  );
}
