"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { quickAddSuggestionAction } from "../../../sugerencias/actions";

type Props = { feastId: string };

/**
 * Captura rápida durante la Fiesta. Optimizado para mobile:
 * - Detalle siempre con autofocus
 * - Botón grande
 * - Tras enviar, limpia el textarea y refresca la lista debajo
 * - Ctrl/⌘+Enter envía sin tener que apuntar al botón
 */
export function QuickForm({ feastId }: Props) {
  const router = useRouter();
  const [detail, setDetail] = useState("");
  const [author, setAuthor] = useState("");
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Mantén el foco en el detalle al cargar la página.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = detail.trim();
    if (!trimmed) return;

    const fd = new FormData();
    fd.set("feast_id", feastId);
    fd.set("detail", trimmed);
    fd.set("author_name", author.trim());

    startTransition(async () => {
      try {
        await quickAddSuggestionAction(fd);
      } catch {
        // Si el server action redirige, eso "throw"ea por diseño en Next;
        // limpiamos igual.
      }
      setDetail("");
      // Dejamos el autor: típicamente la misma persona dicta varias.
      router.refresh();
      // Devuelve el foco al textarea para la siguiente captura.
      setTimeout(() => textareaRef.current?.focus(), 50);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-terra/15 bg-card p-4 shadow-card md:p-5"
    >
      <label className="mb-1 block text-[12px] font-semibold text-dark">
        Sugerencia
      </label>
      <textarea
        ref={textareaRef}
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            handleSubmit(e);
          }
        }}
        rows={3}
        placeholder="Lo que la persona acaba de proponer..."
        className="w-full resize-none rounded-xl border border-black/10 bg-bg/40 px-3.5 py-2.5 font-body text-[14px] leading-[1.45] text-dark outline-none focus:border-terra focus:bg-card"
      />

      <label className="mt-3 block text-[12px] font-semibold text-dark">
        Autor (opcional)
      </label>
      <input
        type="text"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Familia García"
        autoComplete="off"
        className="w-full rounded-xl border border-black/10 bg-bg/40 px-3.5 py-2.5 text-[14px] text-dark outline-none focus:border-terra focus:bg-card"
      />

      <button
        type="submit"
        disabled={pending || !detail.trim()}
        className="tap mt-4 w-full rounded-xl bg-terra px-4 py-3 text-[14px] font-semibold text-white shadow-card-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Guardando..." : "+ Agregar sugerencia"}
      </button>
      <p className="mt-2 text-center text-[10.5px] text-muted">
        Atajo: Ctrl/⌘ + Enter
      </p>
    </form>
  );
}
