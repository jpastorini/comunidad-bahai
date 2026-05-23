"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import {
  removeAvatarAction,
  uploadAvatarAction,
  useGoogleAvatarAction,
} from "./actions";

type Props = {
  currentUrl: string | null;
  name: string | null;
  hasGoogleAvatar: boolean;
};

export function AvatarEditor({ currentUrl, name, hasGoogleAvatar }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement | null>(null);

  async function handleUpload(file: File) {
    setError(null);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.set("file", compressed, compressed.name);
      startTransition(async () => {
        const res = await uploadAvatarAction(fd);
        if (!res.ok) setError(res.error);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar.");
    }
  }

  function useGoogle() {
    setError(null);
    startTransition(async () => {
      const res = await useGoogleAvatarAction();
      if (!res.ok) setError(res.error);
    });
  }

  function removeAvatar() {
    if (!confirm("¿Quitar la foto de perfil?")) return;
    setError(null);
    startTransition(async () => {
      const res = await removeAvatarAction();
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Avatar url={currentUrl} name={name} size={120} className="border-2 border-white shadow-card-elevated" />

      <div className="flex flex-wrap items-center justify-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            if (fileInput.current) fileInput.current.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={pending}
          className="tap rounded-xl bg-terra px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-card-soft disabled:opacity-50"
        >
          Subir foto
        </button>
        {hasGoogleAvatar && (
          <button
            type="button"
            onClick={useGoogle}
            disabled={pending}
            className="tap rounded-xl border border-black/10 bg-card px-3.5 py-2 text-[12.5px] font-semibold text-dark shadow-card-soft disabled:opacity-50"
          >
            Usar foto de Google
          </button>
        )}
        {currentUrl && (
          <button
            type="button"
            onClick={removeAvatar}
            disabled={pending}
            className="tap rounded-xl px-3.5 py-2 text-[12.5px] font-semibold text-rose-600 disabled:opacity-50"
          >
            Quitar
          </button>
        )}
      </div>

      {pending && (
        <p className="text-[11.5px] text-muted">Actualizando…</p>
      )}
      {error && (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-[11.5px] text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

async function compressImage(
  file: File,
  maxDim = 512,
  quality = 0.9
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        const maxSide = Math.max(width, height);
        if (maxSide > maxDim) {
          const scale = maxDim / maxSide;
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas no soportado"));
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("No se pudo comprimir"));
            const baseName = file.name.replace(/\.[^.]+$/, "");
            resolve(new File([blob], `${baseName}.jpg`, { type: "image/jpeg" }));
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => reject(new Error("No se pudo leer la imagen"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}
