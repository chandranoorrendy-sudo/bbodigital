"use client";

import { useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_RECORDING_SEC, type MediaItem } from "@/lib/bbo/types";

export type Recording = { blob: Blob; url: string; durationSec: number; ext: string };

/** Opus 24 kbps di Chrome/Android; iPhone Safari memakai audio/mp4 (AAC). */
function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of ["audio/webm;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export function formatDuration(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AudioRecorder({
  value,
  onChange,
  disabled,
}: {
  value: Recording | null;
  onChange: (rec: Recording | null) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<"idle" | "recording" | "error">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);
  const startedAt = useRef(0);

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function start() {
    setError(null);
    const mime = pickMime();
    if (mime === null || !navigator.mediaDevices?.getUserMedia) {
      setState("error");
      setError("Browser ini belum bisa merekam suara. Coba Chrome (Android) atau Safari (iPhone) terbaru.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setState("error");
      setError("Izin mikrofon belum diberikan. Izinkan mikrofon untuk situs ini di pengaturan browser, lalu coba lagi.");
      return;
    }
    const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 24000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) window.clearInterval(timer.current);
      const type = rec.mimeType || mime || "audio/webm";
      const blob = new Blob(chunks, { type });
      const durationSec = Math.min(MAX_RECORDING_SEC, (Date.now() - startedAt.current) / 1000);
      setState("idle");
      onChange({ blob, url: URL.createObjectURL(blob), durationSec, ext: type.includes("mp4") || type.includes("aac") ? "m4a" : "webm" });
    };
    recorder.current = rec;
    startedAt.current = Date.now();
    setElapsed(0);
    rec.start(1000);
    setState("recording");
    timer.current = window.setInterval(() => {
      const sec = (Date.now() - startedAt.current) / 1000;
      setElapsed(sec);
      if (sec >= MAX_RECORDING_SEC && rec.state === "recording") rec.stop();
    }, 250);
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  if (value) {
    return (
      <div className="space-y-3 rounded-xl border bg-background p-4">
        <p className="text-sm text-muted-foreground">
          Rekaman {formatDuration(value.durationSec)} · {formatBytes(value.blob.size)}
        </p>
        <audio controls src={value.url} className="w-full" />
        <Button variant="outline" className="h-12 w-full text-base" disabled={disabled} onClick={() => onChange(null)}>
          Hapus dan rekam ulang
        </Button>
      </div>
    );
  }

  const recording = state === "recording";
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-background p-5">
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={disabled}
        aria-label={recording ? "Berhenti merekam" : "Mulai merekam"}
        className={cn(
          "flex size-20 items-center justify-center rounded-full text-white shadow-md transition-transform active:scale-95 disabled:opacity-50",
          recording ? "bg-destructive" : "bg-primary",
        )}
      >
        {recording ? (
          <span className="size-7 rounded-md bg-white" />
        ) : (
          <span className="size-8 rounded-full bg-white" />
        )}
      </button>
      <p className="text-base font-medium" aria-live="polite">
        {recording
          ? `Merekam… ${formatDuration(elapsed)} / ${formatDuration(MAX_RECORDING_SEC)}`
          : "Ketuk untuk merekam suara Ananda"}
      </p>
      <p className="text-center text-sm text-muted-foreground">Maksimal 3 menit. Ketuk lagi untuk berhenti.</p>
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function PhotoGrid({
  photos,
  urls,
  max,
  busy,
  disabled,
  label = "Foto",
  onAdd,
  onDelete,
}: {
  photos: MediaItem[];
  urls: Record<string, string>;
  max: number;
  busy?: boolean;
  disabled?: boolean;
  label?: string;
  onAdd: (files: File[]) => void;
  onDelete: (photo: MediaItem) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const left = max - photos.length;
  return (
    <div className="space-y-2">
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <li key={p.id} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
              {urls[p.path] ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed URL privat, bukan aset statis
                <img src={urls[p.path]} alt="" className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center text-xs text-muted-foreground">Memuat…</span>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onDelete(p)}
                  className="absolute top-1 right-1 rounded-md bg-background/90 px-2 py-1 text-xs font-medium"
                >
                  Hapus
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && left > 0 && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []).slice(0, left);
              e.target.value = "";
              if (files.length) onAdd(files);
            }}
          />
          <Button variant="outline" className="h-12 w-full text-base" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Mengunggah…" : `${label} (${photos.length}/${max})`}
          </Button>
        </>
      )}
    </div>
  );
}

export function SignatureBox({
  title,
  imageUrl,
  signedAt,
  disabled,
  busy,
  onSave,
  onDelete,
}: {
  title: string;
  imageUrl: string | null;
  signedAt: string | null;
  disabled?: boolean;
  busy?: boolean;
  onSave: (png: Blob) => void;
  onDelete: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pad = useRef<SignaturePad | null>(null);
  const [editing, setEditing] = useState(!imageUrl && !signedAt);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    if (!editing || disabled || !canvas.current) return;
    const el = canvas.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    el.width = el.offsetWidth * ratio;
    el.height = el.offsetHeight * ratio;
    el.getContext("2d")!.scale(ratio, ratio);
    const p = new SignaturePad(el, { penColor: "#111827", minWidth: 1, maxWidth: 2.6 });
    p.addEventListener("endStroke", () => setEmpty(p.isEmpty()));
    pad.current = p;
    return () => p.off();
  }, [editing, disabled]);

  const signed = Boolean(signedAt);

  return (
    <div className="space-y-2 rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium">{title}</p>
        {signed && !editing && (
          <span className="text-sm text-primary">
            Sudah ditandatangani
          </span>
        )}
      </div>

      {signed && !editing ? (
        <>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL privat
            <img src={imageUrl} alt={`Tanda tangan ${title}`} className="h-28 w-full rounded-lg border bg-white object-contain" />
          )}
          {!disabled && (
            <div className="flex gap-2">
              <Button variant="outline" className="h-11 flex-1" disabled={busy} onClick={() => setEditing(true)}>
                Ganti
              </Button>
              <Button variant="ghost" className="h-11 flex-1" disabled={busy} onClick={onDelete}>
                Hapus
              </Button>
            </div>
          )}
        </>
      ) : disabled ? (
        <p className="text-sm text-muted-foreground">Belum ditandatangani.</p>
      ) : (
        <>
          <canvas
            ref={canvas}
            className="h-40 w-full touch-none rounded-lg border border-dashed bg-white"
            aria-label={`Kanvas tanda tangan ${title}`}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-11 flex-1"
              onClick={() => {
                pad.current?.clear();
                setEmpty(true);
              }}
            >
              Ulangi
            </Button>
            <Button
              className="h-11 flex-1"
              disabled={empty || busy}
              onClick={() => {
                canvas.current?.toBlob((blob) => {
                  if (blob) {
                    onSave(blob);
                    setEditing(false);
                  }
                }, "image/png");
              }}
            >
              {busy ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
          {signed && (
            <Button variant="link" className="h-9 px-0" onClick={() => setEditing(false)}>
              Batal ganti
            </Button>
          )}
        </>
      )}
    </div>
  );
}
