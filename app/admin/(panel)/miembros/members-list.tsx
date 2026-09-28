"use client";

import { useMemo, useState, type ReactNode } from "react";
import { IconSearch } from "@/components/Icons";
import { Select } from "@/components/admin/ui";

/** Una persona del padrón, con lo que hace falta para buscar, filtrar y
 *  ordenar, y su tarjeta ya armada en el servidor. */
export type MemberListItem = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isBahai: boolean;
  chat: boolean;
  treasury: boolean;
  bulletin: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  card: ReactNode;
};

const MEMBER_FILTERS = {
  todos: "Todos",
  nuevos: "Nuevos (últimos 30 días)",
  asamblea: "Miembros de la Asamblea",
  bahai: "Bahá'ís",
  amigos: "Amigos de la Fe",
  chat: "Atienden el chat",
  tesoreria: "Editan Tesorería",
  boletin: "Editan el Boletín",
  ausentes: "No entran hace un mes o más",
} as const;
type MemberFilter = keyof typeof MEMBER_FILTERS;

const SORTS = {
  asamblea: "Asamblea primero",
  nombre: "Nombre (A–Z)",
  recientes: "Más nuevos primero",
  antiguos: "Más antiguos primero",
  actividad: "Última vez en la app",
} as const;
type Sort = keyof typeof SORTS;

const DAY = 24 * 60 * 60 * 1000;
const NEW_MEMBER_DAYS = 30;

/**
 * Buscar, filtrar y ordenar la lista de Creyentes, en el navegador y
 * sobre lo que ya llegó: una comunidad son decenas de personas, no miles.
 *
 * Las tarjetas que no coinciden se ESCONDEN (`hidden`), no se desmontan:
 * cada una es un formulario con campos no controlados, y desmontarla
 * tiraría lo que alguien estaba escribiendo al cambiar el filtro. Ordenar
 * las reubica con la misma `key`, así que React las mueve sin perderlo.
 */
export function MembersList({
  items,
  initialFilter,
}: {
  items: MemberListItem[];
  /** `?filtro=` de la URL; el push de alguien nuevo llega con "nuevos". */
  initialFilter?: string;
}) {
  const start: MemberFilter =
    initialFilter && initialFilter in MEMBER_FILTERS
      ? (initialFilter as MemberFilter)
      : "todos";
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemberFilter>(start);
  const [sort, setSort] = useState<Sort>(
    start === "nuevos" ? "recientes" : "asamblea"
  );

  const words = normalize(query).split(/\s+/).filter(Boolean);
  // `Date.now()` una vez por render: alcanza para "últimos 30 días".
  const now = Date.now();

  const visible = new Set(
    items
      .filter((it) => matchesFilter(it, filter, now))
      .filter((it) => {
        if (words.length === 0) return true;
        const text = normalize(`${it.name} ${it.email}`);
        return words.every((w) => text.includes(w));
      })
      .map((it) => it.id)
  );

  const sorted = useMemo(() => [...items].sort(comparator(sort)), [items, sort]);

  return (
    <>
      <div className="mb-3 grid gap-2 md:grid-cols-[1fr,230px,200px]">
        <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-card px-3.5 py-2 focus-within:border-gold/60">
          <IconSearch size={15} className="shrink-0 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            placeholder="Buscar por nombre o correo…"
            aria-label="Buscar creyente"
            enterKeyHint="search"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent py-0.5 text-[13.5px] text-dark outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Borrar la búsqueda"
              className="tap -mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[13px] leading-none text-muted"
            >
              ×
            </button>
          )}
        </label>
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as MemberFilter)}
          aria-label="Filtrar"
        >
          {Object.entries(MEMBER_FILTERS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Ordenar"
        >
          {Object.entries(SORTS).map(([k, label]) => (
            <option key={k} value={k}>
              Ordenar: {label}
            </option>
          ))}
        </Select>
      </div>

      <p className="mb-3 text-[12px] text-muted">
        {visible.size === items.length
          ? `${items.length} ${items.length === 1 ? "persona" : "personas"}`
          : `${visible.size} de ${items.length}`}
        {(query || filter !== "todos") && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("todos");
            }}
            className="ml-2 font-semibold text-terra hover:underline"
          >
            Ver todos
          </button>
        )}
      </p>

      <div className="grid gap-3">
        {sorted.map((it) => (
          <div
            key={it.id}
            id={`m-${it.id}`}
            hidden={!visible.has(it.id)}
            className="scroll-mt-4"
          >
            {it.card}
          </div>
        ))}
      </div>

      {visible.size === 0 && (
        <p className="rounded-2xl border border-dashed border-black/10 px-4 py-6 text-center text-[13px] text-muted">
          {filter === "nuevos" && !query
            ? `Nadie se sumó en los últimos ${NEW_MEMBER_DAYS} días.`
            : "Nadie coincide con la búsqueda."}
        </p>
      )}
    </>
  );
}

function isNewMember(createdAt: string, now: number): boolean {
  return now - new Date(createdAt).getTime() <= NEW_MEMBER_DAYS * DAY;
}

function matchesFilter(it: MemberListItem, f: MemberFilter, now: number): boolean {
  switch (f) {
    case "todos":
      return true;
    case "nuevos":
      return isNewMember(it.createdAt, now);
    case "asamblea":
      return it.isAdmin;
    case "bahai":
      return it.isBahai;
    case "amigos":
      return !it.isBahai;
    case "chat":
      return it.chat;
    case "tesoreria":
      return it.treasury;
    case "boletin":
      return it.bulletin;
    case "ausentes":
      return !it.lastSeenAt || now - new Date(it.lastSeenAt).getTime() > 30 * DAY;
  }
}

const byName = (a: MemberListItem, b: MemberListItem) =>
  a.name.localeCompare(b.name, "es", { sensitivity: "base" }) || a.id.localeCompare(b.id);

function comparator(sort: Sort) {
  return (a: MemberListItem, b: MemberListItem): number => {
    switch (sort) {
      case "asamblea":
        return Number(b.isAdmin) - Number(a.isAdmin) || byName(a, b);
      case "nombre":
        return byName(a, b);
      case "recientes":
        return b.createdAt.localeCompare(a.createdAt) || byName(a, b);
      case "antiguos":
        return a.createdAt.localeCompare(b.createdAt) || byName(a, b);
      case "actividad":
        // Quien nunca entró va al final.
        return (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? "") || byName(a, b);
    }
  };
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
