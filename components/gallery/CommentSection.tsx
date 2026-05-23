"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { PhotoComment } from "@/lib/types";
import { addCommentAction, deleteCommentAction } from "./interaction-actions";

type Props = {
  photoId: string;
  initial: PhotoComment[];
  currentUserId: string | null;
  currentUserName: string | null;
  isAdmin: boolean;
  dark?: boolean;
};

/** Lista de comentarios + input. Optimistic append; rollback en error. */
export function CommentSection({
  photoId,
  initial,
  currentUserId,
  currentUserName,
  isAdmin,
  dark = false,
}: Props) {
  const [comments, setComments] = useState(initial);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setComments(initial);
  }, [initial, photoId]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || !currentUserId || pending) return;
    setError(null);

    const optimistic: PhotoComment = {
      id: `__optimistic_${Date.now()}`,
      photo_id: photoId,
      user_id: currentUserId,
      author_name: currentUserName ?? "Tú",
      body: trimmed,
      locality_id: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const prev = comments;
    setComments([...comments, optimistic]);
    setBody("");

    startTransition(async () => {
      const res = await addCommentAction(photoId, trimmed);
      if (!res.ok) {
        setComments(prev);
        setBody(trimmed);
        setError(res.error ?? "No se pudo publicar el comentario.");
      }
    });
  }

  function onDelete(commentId: string) {
    if (pending) return;
    if (!window.confirm("¿Borrar este comentario?")) return;
    const prev = comments;
    setComments(comments.filter((c) => c.id !== commentId));
    startTransition(async () => {
      const res = await deleteCommentAction(commentId);
      if (!res.ok) {
        setComments(prev);
        setError(res.error ?? "No se pudo borrar el comentario.");
      }
    });
  }

  const textColor = dark ? "text-white/85" : "text-dark";
  const mutedColor = dark ? "text-white/45" : "text-muted";
  const authorColor = dark ? "text-white" : "text-dark";
  const inputBg = dark
    ? "bg-white/10 text-white placeholder:text-white/40"
    : "bg-bg text-dark placeholder:text-muted";
  const sendBg = dark ? "bg-white text-dark" : "bg-terra text-white";
  const divider = dark ? "border-white/10" : "border-black/[0.05]";

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {comments.length === 0 ? (
          <p className={`py-4 text-center text-[12px] ${mutedColor}`}>
            Sin comentarios todavía.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {comments.map((c) => {
              const canDelete =
                currentUserId &&
                (c.user_id === currentUserId || isAdmin) &&
                !c.id.startsWith("__optimistic_");
              return (
                <li
                  key={c.id}
                  className={`border-b ${divider} pb-2 last:border-b-0 last:pb-0`}
                >
                  <div className={`text-[12.5px] leading-snug ${textColor}`}>
                    <span className={`mr-1.5 font-semibold ${authorColor}`}>
                      {c.author_name}
                    </span>
                    {c.body}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3">
                    <span className={`text-[10px] ${mutedColor}`}>
                      {formatRelative(c.created_at)}
                    </span>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(c.id)}
                        className={`text-[10px] font-semibold uppercase tracking-wide ${mutedColor} hover:text-rose-500`}
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {currentUserId ? (
        <form
          onSubmit={onSubmit}
          className={`shrink-0 border-t ${divider} px-3 py-2`}
        >
          {error && (
            <div className="mb-1.5 rounded-md bg-rose-500/15 px-2 py-1 text-[11px] text-rose-400">
              {error}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  onSubmit(e);
                }
              }}
              placeholder="Escribí un comentario…"
              maxLength={500}
              rows={1}
              className={`flex-1 resize-none rounded-2xl px-3 py-2 text-[13px] outline-none ${inputBg}`}
            />
            <button
              type="submit"
              disabled={!body.trim() || pending}
              className={`shrink-0 rounded-full px-3.5 py-2 text-[12px] font-semibold disabled:opacity-40 ${sendBg}`}
            >
              Enviar
            </button>
          </div>
        </form>
      ) : (
        <div className={`shrink-0 border-t ${divider} px-4 py-3 text-center text-[11.5px] ${mutedColor}`}>
          Iniciá sesión para comentar.
        </div>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
}
