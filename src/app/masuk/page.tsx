"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { normalizeUsername, usernameToEmail } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function MasukPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function masuk(e: React.FormEvent) {
    e.preventDefault();
    if (!normalizeUsername(username) || !password) return;
    setBusy(true);
    const { error } = await createClient().auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    setBusy(false);
    if (error) {
      toast.error(
        error.status === 429
          ? "Terlalu banyak percobaan. Tunggu beberapa menit, lalu coba lagi."
          : "Username atau kata sandi belum cocok. Periksa kembali, ya.",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-5 py-10">
      <header className="space-y-2 text-center">
        <p className="text-sm font-medium tracking-wide text-gold-ink">Kuttab Imam Al-Ghazali</p>
        <h1 className="text-2xl font-semibold">Belajar Bersama Orang Tua</h1>
        <p className="text-muted-foreground">Masuk dengan username dan kata sandi dari ustadz/ustadzah.</p>
      </header>

      <form onSubmit={masuk} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username" className="text-base">
            Username
          </Label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            placeholder="mis. ayah.hafsah"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-base">
            Kata sandi
          </Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 pr-24 text-base"
            />
            <Button
              type="button"
              variant="ghost"
              className="absolute top-1 right-1 h-10 px-3"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
            >
              {showPassword ? "Sembunyi" : "Lihat"}
            </Button>
          </div>
        </div>
        <Button type="submit" size="xl" className="w-full" disabled={busy}>
          {busy ? "Memeriksa…" : "Masuk"}
        </Button>
      </form>

      <p className="text-center text-sm leading-relaxed text-muted-foreground">
        Lupa username atau kata sandi? Hubungi ustadz/ustadzah atau admin kuttab.
      </p>
    </main>
  );
}
