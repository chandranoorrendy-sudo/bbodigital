"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const OTP_LENGTH = 6;

export default function MasukPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<"email" | "kode">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);

  async function kirimKode(e?: React.FormEvent) {
    e?.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) {
      toast.error(
        error.status === 429
          ? "Terlalu sering meminta email masuk. Tunggu beberapa menit, lalu coba lagi."
          : `Email masuk belum bisa dikirim: ${error.message}`,
      );
      return;
    }
    setEmail(clean);
    setStep("kode");
    toast.success("Email masuk sudah dikirim. Silakan cek kotak masuk Ayah/Bunda.");
  }

  async function cekKode(value: string) {
    if (value.length !== OTP_LENGTH) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: value, type: "email" });
    setBusy(false);
    if (error) {
      setCode("");
      toast.error("Kode tidak cocok atau sudah kedaluwarsa. Silakan coba lagi.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-5 py-10">
      <header className="space-y-2 text-center">
        <p className="text-sm font-medium tracking-wide text-primary">Kuttab Imam Al-Ghazali</p>
        <h1 className="text-2xl font-semibold">Belajar Bersama Orang Tua</h1>
        <p className="text-muted-foreground">
          {step === "email"
            ? "Masuk dengan email yang didaftarkan di kuttab. Kami kirimkan tautan masuk ke email itu."
            : `Kami sudah mengirim email ke ${email}. Buka email itu di HP ini, lalu ketuk tautan "Log In".`}
        </p>
      </header>

      {step === "email" ? (
        <form onSubmit={kirimKode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-base">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          <Button type="submit" size="xl" className="w-full" disabled={busy}>
            {busy ? "Mengirim…" : "Kirim email masuk"}
          </Button>
        </form>
      ) : (
        <div className="space-y-6">
          <ol className="list-decimal space-y-1 rounded-xl border bg-background p-4 pl-9 text-base leading-relaxed">
            <li>Buka aplikasi email di HP ini.</li>
            <li>Cari email &quot;Your sign-in link&quot; (cek juga folder Spam).</li>
            <li>Ketuk tautan &quot;Log In&quot;. Halaman BBO akan terbuka sendiri.</li>
          </ol>

          {/* Kode 6 angka baru ada di email setelah kuttab memasang SMTP sendiri. */}
          {showCode ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={OTP_LENGTH}
                  value={code}
                  onChange={setCode}
                  onComplete={cekKode}
                  disabled={busy}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                >
                  <InputOTPGroup>
                    {Array.from({ length: OTP_LENGTH }, (_, i) => (
                      <InputOTPSlot key={i} index={i} className="size-12 text-xl" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button size="xl" className="w-full" disabled={busy || code.length !== OTP_LENGTH} onClick={() => cekKode(code)}>
                {busy ? "Memeriksa…" : "Masuk dengan kode"}
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="xl" className="w-full" onClick={() => setShowCode(true)}>
              Email saya berisi kode 6 angka
            </Button>
          )}

          <div className="flex justify-between text-sm">
            <Button variant="link" className="px-0" onClick={() => { setStep("email"); setCode(""); setShowCode(false); }}>
              Ganti email
            </Button>
            <Button variant="link" className="px-0" disabled={busy} onClick={() => kirimKode()}>
              Kirim ulang email
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
