"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type AdminData = {
  me: string;
  profiles: { id: string; full_name: string; username: string | null; role: "parent" | "teacher" | "admin" }[];
  guardians: { id: string; profile_id: string; student_id: string; relation: "ayah" | "ibu" | "wali" }[];
  students: {
    id: string;
    full_name: string;
    nickname: string | null;
    class_id: string | null;
    birth_year: number | null;
    research_consent: boolean;
    consent_signed_at: string | null;
  }[];
  classes: { id: string; name: string; level: string; section: string; academic_year_id: string }[];
  years: { id: string; label: string; start_date: string; end_date: string; is_active: boolean }[];
  classTeachers: { id: string; class_id: string; teacher_id: string; subject: "iman" | "quran"; is_homeroom: boolean }[];
};

const field =
  "h-12 w-full rounded-xl border bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const ROLE_LABEL = { parent: "Orang tua", teacher: "Guru", admin: "Admin" } as const;
const RELATION_LABEL = { ayah: "Ayah", ibu: "Ibu", wali: "Wali" } as const;

const WORDS = ["bulan", "bintang", "hilal", "fajar", "kurma", "zaitun", "mentari", "embun", "pelangi", "samudra", "cahaya", "pena", "kitab", "subuh"];
function generatePassword() {
  const r = new Uint32Array(2);
  crypto.getRandomValues(r);
  return `${WORDS[r[0] % WORDS.length]}-${1000 + (r[1] % 9000)}`;
}
function suggestUsername(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(".");
}

function useMutation() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState<string | null>(null);
  async function run(key: string, label: string, fn: () => PromiseLike<{ error: { message: string; code?: string } | null }>) {
    setBusy(key);
    const { error } = await fn();
    setBusy(null);
    if (error) {
      toast.error(`${label} gagal: ${error.code === "23505" ? "data yang sama sudah ada" : error.message}`);
      return false;
    }
    router.refresh();
    return true;
  }
  return { supabase, busy, run };
}

function Credential({ username, password, name, onClose }: { username: string; password: string; name: string; onClose: () => void }) {
  const text = `Akun BBO Digital Kuttab Imam Al-Ghazali untuk ${name}\nAlamat: https://bbodigital.vercel.app\nUsername: ${username}\nKata sandi: ${password}`;
  return (
    <div className="space-y-3 rounded-xl border-2 border-gold bg-gold-soft p-4">
      <p className="font-semibold">Catat dan berikan kepada {name}:</p>
      <dl className="grid grid-cols-[7rem_1fr] gap-1 text-base">
        <dt className="text-muted-foreground">Username</dt>
        <dd className="font-mono font-semibold">{username}</dd>
        <dt className="text-muted-foreground">Kata sandi</dt>
        <dd className="font-mono font-semibold">{password}</dd>
      </dl>
      <p className="text-sm text-muted-foreground">Kata sandi hanya tampil sekali. Bila lupa, buat yang baru dengan &quot;Atur ulang sandi&quot;.</p>
      <div className="flex gap-2">
        <Button
          className="h-11 flex-1"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              toast.success("Tersalin. Tempel di WhatsApp untuk dikirim ke orang tua/guru.");
            } catch {
              toast.error("Tidak bisa menyalin otomatis; catat secara manual.");
            }
          }}
        >
          Salin untuk dikirim
        </Button>
        <Button variant="outline" className="h-11" onClick={onClose}>
          Selesai
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Akun (pengganti undangan email): username + kata sandi dari admin
// ---------------------------------------------------------------------------
export function AccountsPanel({ data }: { data: AdminData }) {
  const { supabase, busy, run } = useMutation();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [role, setRole] = useState<"parent" | "teacher" | "admin">("parent");
  const [password, setPassword] = useState(generatePassword);
  const [studentId, setStudentId] = useState("");
  const [relation, setRelation] = useState<"ayah" | "ibu" | "wali">("ibu");
  const [shown, setShown] = useState<{ username: string; password: string; name: string } | null>(null);
  const [filter, setFilter] = useState("");

  const studentName = (id: string) => data.students.find((s) => s.id === id)?.full_name ?? "?";
  const className = (id: string | null) => data.classes.find((c) => c.id === id)?.name ?? "tanpa kelas";

  async function create(e: React.FormEvent) {
    e.preventDefault();
    let newId: string | null = null;
    const ok = await run("create", "Membuat akun", async () => {
      const res = await supabase.rpc("admin_create_account", {
        p_username: username,
        p_full_name: name,
        p_role: role,
        p_password: password,
      });
      newId = res.data as string | null;
      if (!res.error && role === "parent" && studentId && newId) {
        return supabase.from("guardians").insert({ profile_id: newId, student_id: studentId, relation });
      }
      return res;
    });
    if (ok) {
      setShown({ username: username.toLowerCase().trim(), password, name });
      setName("");
      setUsername("");
      setUsernameTouched(false);
      setPassword(generatePassword());
      setStudentId("");
    }
  }

  const list = data.profiles.filter(
    (p) =>
      !filter ||
      p.full_name.toLowerCase().includes(filter.toLowerCase()) ||
      (p.username ?? "").includes(filter.toLowerCase()) ||
      data.guardians.some((g) => g.profile_id === p.id && studentName(g.student_id).toLowerCase().includes(filter.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      {shown && <Credential {...shown} onClose={() => setShown(null)} />}

      <form onSubmit={create} className="space-y-3 rounded-xl border bg-background p-4">
        <h2 className="text-lg font-semibold">Buat akun</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={cn("h-11 rounded-xl border px-4 font-medium", role === r ? "border-primary bg-primary text-primary-foreground" : "bg-background")}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Nama lengkap</span>
          <input
            className={field}
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!usernameTouched) setUsername(suggestUsername(e.target.value));
            }}
            placeholder={role === "parent" ? "mis. Bunda Hafsah" : "mis. Ustadzah Rahma"}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Username</span>
            <input
              className={cn(field, "font-mono")}
              required
              autoCapitalize="none"
              value={username}
              onChange={(e) => {
                setUsernameTouched(true);
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""));
              }}
            />
            <span className="block text-xs text-muted-foreground">Huruf kecil, angka, titik, garis bawah; 3–30 karakter.</span>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Kata sandi awal</span>
            <div className="flex gap-2">
              <input className={cn(field, "font-mono")} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button type="button" variant="outline" className="h-12" onClick={() => setPassword(generatePassword())}>
                Acak
              </Button>
            </div>
          </label>
        </div>
        {role === "parent" && (
          <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
            <label className="block space-y-1">
              <span className="text-sm font-medium">Tautkan ke santri</span>
              <select className={field} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">Pilih santri (bisa nanti)…</option>
                {data.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} · {className(s.class_id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Hubungan</span>
              <select className={field} value={relation} onChange={(e) => setRelation(e.target.value as typeof relation)}>
                {(Object.keys(RELATION_LABEL) as (keyof typeof RELATION_LABEL)[]).map((r) => (
                  <option key={r} value={r}>
                    {RELATION_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <Button type="submit" size="xl" className="w-full" disabled={busy === "create" || !name.trim() || username.length < 3 || password.length < 6}>
          {busy === "create" ? "Membuat…" : "Buat akun"}
        </Button>
      </form>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Daftar akun</h2>
          <input className={cn(field, "ml-auto h-10 max-w-60")} placeholder="Cari nama/username/santri" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <ul className="divide-y overflow-hidden rounded-xl border bg-background">
          {list.map((p) => (
            <AccountRow key={p.id} p={p} data={data} onReset={(pw) => setShown({ username: p.username ?? "?", password: pw, name: p.full_name })} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function AccountRow({ p, data, onReset }: { p: AdminData["profiles"][number]; data: AdminData; onReset: (pw: string) => void }) {
  const { supabase, busy, run } = useMutation();
  const [linking, setLinking] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [relation, setRelation] = useState<"ayah" | "ibu" | "wali">("ibu");
  const links = data.guardians.filter((g) => g.profile_id === p.id);

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{p.full_name}</p>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{p.username ?? "—"}</span> · {ROLE_LABEL[p.role]}
          </p>
        </div>
        {p.username && (
          <Button
            variant="outline"
            className="h-10"
            disabled={busy === "reset"}
            onClick={async () => {
              if (!window.confirm(`Atur ulang kata sandi ${p.full_name}?`)) return;
              const pw = generatePassword();
              if (await run("reset", "Atur ulang sandi", () => supabase.rpc("admin_reset_password", { p_user: p.id, p_password: pw }))) onReset(pw);
            }}
          >
            Atur ulang sandi
          </Button>
        )}
        {p.role === "parent" && (
          <Button variant="outline" className="h-10" onClick={() => setLinking((v) => !v)}>
            Tautkan santri
          </Button>
        )}
      </div>
      {links.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {links.map((g) => (
            <li key={g.id} className="flex items-center gap-1 rounded-full bg-gold-soft px-3 py-1 text-sm">
              {RELATION_LABEL[g.relation]} dari {data.students.find((s) => s.id === g.student_id)?.full_name ?? "?"}
              <button
                type="button"
                aria-label="Lepas tautan"
                className="ml-1 text-muted-foreground hover:text-destructive"
                onClick={async () => {
                  if (window.confirm("Lepas tautan orang tua dari santri ini?")) await run("unlink", "Lepas tautan", () => supabase.from("guardians").delete().eq("id", g.id));
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {linking && (
        <div className="flex flex-wrap gap-2">
          <select className={cn(field, "h-10 min-w-52 flex-1")} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Pilih santri…</option>
            {data.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
          <select className={cn(field, "h-10 w-28")} value={relation} onChange={(e) => setRelation(e.target.value as typeof relation)}>
            {(Object.keys(RELATION_LABEL) as (keyof typeof RELATION_LABEL)[]).map((r) => (
              <option key={r} value={r}>
                {RELATION_LABEL[r]}
              </option>
            ))}
          </select>
          <Button
            className="h-10"
            disabled={!studentId || busy === "link"}
            onClick={async () => {
              if (await run("link", "Menautkan", () => supabase.from("guardians").insert({ profile_id: p.id, student_id: studentId, relation }))) setLinking(false);
            }}
          >
            Simpan
          </Button>
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Santri & persetujuan penelitian (AD-1, AD-4)
// ---------------------------------------------------------------------------
export function StudentsPanel({ data }: { data: AdminData }) {
  const { supabase, busy, run } = useMutation();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [classId, setClassId] = useState(data.classes[0]?.id ?? "");
  const [birthYear, setBirthYear] = useState("");

  const byClass = [...data.classes.map((c) => ({ id: c.id as string | null, name: c.name })), { id: null, name: "Tanpa kelas" }];

  return (
    <div className="space-y-6">
      <form
        className="space-y-3 rounded-xl border bg-background p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run("add", "Menambah santri", () =>
            supabase.from("students").insert({
              full_name: name.trim(),
              nickname: nickname.trim() || null,
              class_id: classId || null,
              birth_year: birthYear ? Number(birthYear) : null,
            }),
          );
          if (ok) {
            setName("");
            setNickname("");
            setBirthYear("");
          }
        }}
      >
        <h2 className="text-lg font-semibold">Tambah santri</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <input className={field} required placeholder="Nama lengkap" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={field} placeholder="Panggilan" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <select className={field} value={classId} onChange={(e) => setClassId(e.target.value)}>
            {data.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="">Tanpa kelas</option>
          </select>
          <input className={field} inputMode="numeric" placeholder="Tahun lahir" value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </div>
        <Button type="submit" size="xl" className="w-full" disabled={!name.trim() || busy === "add"}>
          {busy === "add" ? "Menyimpan…" : "Tambah santri"}
        </Button>
      </form>

      {byClass.map((c) => {
        const list = data.students.filter((s) => s.class_id === c.id);
        if (list.length === 0) return null;
        return (
          <section key={c.id ?? "none"} className="space-y-2">
            <h2 className="text-lg font-semibold">
              {c.name} <span className="text-sm font-normal text-muted-foreground">· {list.length} santri</span>
            </h2>
            <ul className="divide-y overflow-hidden rounded-xl border bg-background">
              {list.map((s) => {
                const parents = data.guardians
                  .filter((g) => g.student_id === s.id)
                  .map((g) => data.profiles.find((p) => p.id === g.profile_id)?.username ?? "?");
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {s.full_name}
                        {s.nickname && <span className="font-normal text-muted-foreground"> ({s.nickname})</span>}
                      </p>
                      <p className="text-sm text-muted-foreground">Akun orang tua: {parents.length ? parents.join(", ") : "belum ada"}</p>
                    </div>
                    <select
                      className={cn(field, "h-10 w-auto")}
                      value={s.class_id ?? ""}
                      onChange={(e) => run(`class-${s.id}`, "Pindah kelas", () => supabase.from("students").update({ class_id: e.target.value || null }).eq("id", s.id))}
                    >
                      {data.classes.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name}
                        </option>
                      ))}
                      <option value="">Tanpa kelas</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-5"
                        checked={s.research_consent}
                        disabled={busy === `consent-${s.id}`}
                        onChange={(e) =>
                          run(`consent-${s.id}`, "Persetujuan penelitian", () =>
                            supabase
                              .from("students")
                              .update({ research_consent: e.target.checked, consent_signed_at: e.target.checked ? new Date().toISOString() : null })
                              .eq("id", s.id),
                          )
                        }
                      />
                      Setuju data penelitian
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kelas & penugasan guru (AD-1)
// ---------------------------------------------------------------------------
export function ClassesPanel({ data }: { data: AdminData }) {
  const { supabase, busy, run } = useMutation();
  const active = data.years.find((y) => y.is_active) ?? data.years[0];
  const [yearId, setYearId] = useState(active?.id ?? "");
  const [level, setLevel] = useState("KA1");
  const [section, setSection] = useState("A");
  const teachers = data.profiles.filter((p) => p.role !== "parent");

  return (
    <div className="space-y-6">
      <form
        className="space-y-3 rounded-xl border bg-background p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const num = level.replace(/\D/g, "");
          await run("add", "Menambah kelas", () =>
            supabase.from("classes").insert({ academic_year_id: yearId, level, section: section.toUpperCase(), name: `Kuttab Awal ${num}${section.toUpperCase()}` }),
          );
        }}
      >
        <h2 className="text-lg font-semibold">Tambah kelas</h2>
        <div className="grid grid-cols-3 gap-3">
          <select className={field} value={yearId} onChange={(e) => setYearId(e.target.value)}>
            {data.years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
              </option>
            ))}
          </select>
          <select className={field} value={level} onChange={(e) => setLevel(e.target.value)}>
            {["KA1", "KA2", "KA3", "KA4", "KA5"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <input className={field} maxLength={2} value={section} onChange={(e) => setSection(e.target.value.toUpperCase())} placeholder="Rombel (A/B)" />
        </div>
        <Button type="submit" size="xl" className="w-full" disabled={!yearId || !section || busy === "add"}>
          Tambah kelas
        </Button>
      </form>

      {data.classes.map((c) => (
        <ClassTeachers key={c.id} cls={c} data={data} teachers={teachers} />
      ))}
    </div>
  );
}

function ClassTeachers({ cls, data, teachers }: { cls: AdminData["classes"][number]; data: AdminData; teachers: AdminData["profiles"] }) {
  const { supabase, busy, run } = useMutation();
  const [teacherId, setTeacherId] = useState("");
  const [subject, setSubject] = useState<"iman" | "quran">("iman");
  const assigned = data.classTeachers.filter((t) => t.class_id === cls.id);
  const year = data.years.find((y) => y.id === cls.academic_year_id)?.label;
  const count = data.students.filter((s) => s.class_id === cls.id).length;

  return (
    <section className="space-y-3 rounded-xl border bg-background p-4">
      <h2 className="text-lg font-semibold">
        {cls.name} <span className="text-sm font-normal text-muted-foreground">· {year} · {count} santri</span>
      </h2>
      <ul className="space-y-1">
        {assigned.length === 0 && <li className="text-sm text-muted-foreground">Belum ada guru.</li>}
        {assigned.map((t) => (
          <li key={t.id} className="flex items-center gap-2">
            <span className="flex-1">
              {data.profiles.find((p) => p.id === t.teacher_id)?.full_name ?? "?"} · Guru {t.subject === "iman" ? "Iman" : "Qur'an"}
              {t.is_homeroom && " · wali kelas"}
            </span>
            <Button
              variant="ghost"
              className="h-9 text-destructive"
              onClick={() => run(`del-${t.id}`, "Melepas guru", () => supabase.from("class_teachers").delete().eq("id", t.id))}
            >
              Lepas
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <select className={cn(field, "h-10 min-w-52 flex-1")} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          <option value="">Pilih guru…</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </select>
        <select className={cn(field, "h-10 w-32")} value={subject} onChange={(e) => setSubject(e.target.value as "iman" | "quran")}>
          <option value="iman">Iman</option>
          <option value="quran">Qur&apos;an</option>
        </select>
        <Button
          className="h-10"
          disabled={!teacherId || busy === "assign"}
          onClick={() =>
            run("assign", "Menugaskan guru", () =>
              supabase.from("class_teachers").insert({ class_id: cls.id, teacher_id: teacherId, subject, is_homeroom: subject === "iman" }),
            )
          }
        >
          Tugaskan
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Guru Iman otomatis menjadi wali kelas. Akun guru dibuat di tab Akun dengan peran Guru.</p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tahun ajaran (AD-1)
// ---------------------------------------------------------------------------
export function YearsPanel({ data }: { data: AdminData }) {
  const { supabase, busy, run } = useMutation();
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  return (
    <div className="space-y-6">
      <ul className="divide-y overflow-hidden rounded-xl border bg-background">
        {data.years.map((y) => (
          <li key={y.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1">
              <p className="font-medium">{y.label}</p>
              <p className="text-sm text-muted-foreground">
                {y.start_date} s.d. {y.end_date}
              </p>
            </div>
            {y.is_active ? (
              <span className="rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground">Aktif</span>
            ) : (
              <Button
                variant="outline"
                className="h-10"
                disabled={busy === "activate"}
                onClick={async () => {
                  // Hanya satu tahun ajaran aktif: matikan yang lain dulu.
                  const ok = await run("activate", "Menonaktifkan", () => supabase.from("academic_years").update({ is_active: false }).eq("is_active", true));
                  if (ok) await run("activate", "Mengaktifkan", () => supabase.from("academic_years").update({ is_active: true }).eq("id", y.id));
                }}
              >
                Jadikan aktif
              </Button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="space-y-3 rounded-xl border bg-background p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run("add", "Menambah tahun ajaran", () => supabase.from("academic_years").insert({ label: label.trim(), start_date: start, end_date: end }))) {
            setLabel("");
          }
        }}
      >
        <h2 className="text-lg font-semibold">Tambah tahun ajaran</h2>
        <input className={field} required placeholder="mis. 2027/2028" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <input type="date" className={field} required value={start} onChange={(e) => setStart(e.target.value)} />
          <input type="date" className={field} required value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <Button type="submit" size="xl" className="w-full" disabled={busy === "add"}>
          Tambah tahun ajaran
        </Button>
      </form>
    </div>
  );
}
