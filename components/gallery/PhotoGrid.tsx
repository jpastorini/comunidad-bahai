"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  EventPhoto,
  PhotoComment,
  PhotoReactionSummary,
} from "@/lib/types";
import { CommentSection } from "./CommentSection";
import { ReactionBar } from "./ReactionBar";
import { deleteEventPhotoAction } from "./photo-actions";

type Props = {
  photos: EventPhoto[];
  currentUserId: string | null;
  currentUserName?: string | null;
  isAdmin: boolean;
  adminLocalityId: string | null;
  /** Compacto = preview embebido en detalle del evento (más chico). */
  variant?: "compact" | "full";
  /** Reacciones por foto (keyed by photo.id). Default vacío. */
  reactionsMap?: Record<string, PhotoReactionSummary>;
  /** Comentarios por foto (keyed by photo.id). Default vacío. */
  commentsMap?: Record<string, PhotoComment[]>;
};

const EMPTY_REACTIONS: PhotoReactionSummary = {
  counts: { heart: 0, pray: 0, star: 0, flower: 0 },
  mine: [],
};

export function PhotoGrid({
  photos,
  currentUserId,
  currentUserName = null,
  isAdmin,
  adminLocalityId,
  variant = "full",
  reactionsMap = {},
  commentsMap = {},
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
        {photos.map((p, idx) => {
          const photoReactions = reactionsMap[p.id] ?? EMPTY_REACTIONS;
          const totalReactions =
            photoReactions.counts.heart +
            photoReactions.counts.pray +
            photoReactions.counts.star +
            photoReactions.counts.flower;
          const commentCount = commentsMap[p.id]?.length ?? 0;
          const showMeta = totalReactions > 0 || commentCount > 0;
          return (
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
              {showMeta && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-gradient-to-t from-black/55 to-transparent px-1.5 pb-1 pt-3 text-[10px] font-semibold text-white">
                  {totalReactions > 0 && <span>❤ {totalReactions}</span>}
                  {commentCount > 0 && <span>💬 {commentCount}</span>}
                </div>
              )}
            </button>
          );
        })}
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
          reactions={reactionsMap[current.id] ?? EMPTY_REACTIONS}
          comments={commentsMap[current.id] ?? []}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          isAdmin={isAdmin}
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
  reactions: PhotoReactionSummary;
  comments: PhotoComment[];
  currentUserId: string | null;
  currentUserName: string | null;
  isAdmin: boolean;
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
  reactions,
  comments,
  currentUserId,
  currentUserName,
  isAdmin,
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
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between px-4 py-3 text-white">
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

      {/* Photo (swipe enabled here only) */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative shrink-0"
        style={{ height: "min(45vh, 420px)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.public_url}
          alt={photo.caption ?? "Foto del evento"}
          className="h-full w-full select-none object-contain"
          draggable={false}
        />

        {hasPrev && (
          <button
            type="button"
            onClick={onPrev}
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
            onClick={onNext}
            aria-label="Siguiente"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white backdrop-blur-sm hover:bg-white/30"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Caption + author */}
      <div className="shrink-0 px-4 pb-1 pt-2 text-white">
        {photo.caption && (
          <p className="mb-1 text-[13px] leading-snug">{photo.caption}</p>
        )}
        <p className="text-[10px] uppercase tracking-wide opacity-70">
          {photo.uploader_name} ·{" "}
          {new Date(photo.created_at).toLocaleDateString("es-MX", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Reactions */}
      <div className="shrink-0 border-t border-white/10 px-4 py-2">
        <ReactionBar
          photoId={photo.id}
          initial={reactions}
          currentUserId={currentUserId}
          dark
        />
      </div>

      {/* Comments + input (scrolls internally) */}
      <CommentSection
        photoId={photo.id}
        initial={comments}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        isAdmin={isAdmin}
        dark
      />
    </div>
  );
}
