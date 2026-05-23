"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EventPhoto } from "@/lib/types";
import { deleteEventPhotoAction } from "./photo-actions";

type Props = {
  photos: EventPhoto[];
  currentUserId: string | null;
  isAdmin: boolean;
  adminLocalityId: string | null;
  /** Compacto = preview embebido en detalle del evento (más chico). */
  variant?: "compact" | "full";
};

/**
 * Client component que muestra fotos en grid + lightbox con
 * navegación entre fotos (teclado, flechas en pantalla, swipe).
 *
 * Sin librerías externas — touch handlers nativos.
 */
export function PhotoGrid({
  photos,
  currentUserId,
  isAdmin,
  adminLocalityId,
  variant = "full",
}: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const next = useCallback(
    () =>
      setOpenIndex((i) =>
        i === null ? null : Math.min(photos.length - 1, i + 1)
      ),
    [photos.length]
  );
  const prev = useCallback(
    () => setOpenIndex((i) => (i === null ? null : Math.max(0, i - 1))),
    []
  );

  // Teclado: flechas + escape
  useEffect(() => {
    if (openIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, close, next, prev]);

  // Bloquear scroll cuando lightbox abierto
  useEffect(() => {
    if (openIndex === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openIndex]);

  const canDelete = (photo: EventPhoto): boolean => {
    if (!currentUserId) return false;
    if (photo.uploader_user_id === currentUserId) return true;
    if (isAdmin && photo.locality_id === adminLocalityId) return true;
    return false;
  };

  async function handleDelete(photo: EventPhoto) {
    if (deleting) return;
    if (!window.confirm("¿Borrar esta foto? Esta acción no se puede deshacer.")) {
      return;
    }
    setDeleting(photo.id);
    setDeleteError(null);
    const res = await deleteEventPhotoAction(photo.id);
    if (!res.ok) {
      setDeleteError(res.error || "No se pudo borrar.");
      setDeleting(null);
    } else {
      // El revalidate del action refresca el feed cuando re-cargue.
      // Cerramos el lightbox si la foto borrada estaba abierta.
      if (openIndex !== null && photos[openIndex]?.id === photo.id) close();
      setDeleting(null);
    }
  }

  const gridCols =
    variant === "compact"
      ? "grid-cols-2 sm:grid-cols-3"
      : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5";

  const current = openIndex !== null ? photos[openIndex] : null;

  return (
    <>
      <div className={`grid gap-1.5 ${gridCols}`}>
        {photos.map((p, idx) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpenIndex(idx)}
            className="group relative aspect-square overflow-hidden rounded-lg bg-bg/40 shadow-card-soft"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.public_url}
              alt={p.caption ?? "Foto del evento"}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {deleteError && (
        <div className="mt-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-[11.5px] text-rose-700">
          {deleteError}
        </div>
      )}

      {current && (
        <Lightbox
          photo={current}
          index={openIndex!}
          total={photos.length}
          canDelete={canDelete(current)}
          deleting={deleting === current.id}
          onClose={close}
          onNext={next}
          onPrev={prev}
          onDelete={() => handleDelete(current)}
        />
      )}
    </>
  );
}

type LightboxProps = {
  photo: EventPhoto;
  index: number;
  total: number;
  canDelete: boolean;
  deleting: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onDelete: () => void;
};

function Lightbox({
  photo,
  index,
  total,
  canDelete,
  deleting,
  onClose,
  onNext,
  onPrev,
  onDelete,
}: LightboxProps) {
  const touchStartX = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    const threshold = 50;
    if (dx > threshold) onPrev();
    else if (dx < -threshold) onNext();
  };

  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  return (
    <div
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="fixed inset-0 z-50 flex flex-col items-stretch bg-black"
    >
      {/* Top bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex shrink-0 items-center justify-between px-4 py-3 text-white"
      >
        <div className="text-[12px] opacity-80">
          {index + 1} / {total}
        </div>
        <div className="flex items-center gap-2">
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold hover:bg-rose-600 disabled:opacity-50"
            >
              {deleting ? "Borrando…" : "Borrar"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full bg-white/15 px-3 py-1.5 text-[14px] hover:bg-white/30"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Image */}
      <div
        onClick={onClose}
        className="relative flex flex-1 items-center justify-center overflow-hidden px-4"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.public_url}
          alt={photo.caption ?? "Foto del evento"}
          className="max-h-full max-w-full select-none object-contain"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />

        {hasPrev && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            aria-label="Anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white backdrop-blur-sm hover:bg-white/30"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            aria-label="Siguiente"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white backdrop-blur-sm hover:bg-white/30"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Caption / author */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 bg-black/40 px-4 py-3 text-white"
      >
        {photo.caption && (
          <p className="mb-1 text-[13px] leading-snug">{photo.caption}</p>
        )}
        <p className="text-[10.5px] uppercase tracking-wide opacity-80">
          {photo.uploader_name} ·{" "}
          {new Date(photo.created_at).toLocaleDateString("es-MX", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>
    </div>
  );
}
