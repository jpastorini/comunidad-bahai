"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LedgerMember, TreasuryContributor } from "@/lib/treasury-ledger";

/**
 * Lo que eligió el tesorero. Tres formas, que la action resuelve a un
 * `contributor_id` (ver resolveContributor en actions.ts):
 *  · un contribuyente que ya está en el libro,
 *  · un creyente de la app (se usa o se crea su contribuyente vinculado),
 *  · un nombre nuevo: alguien de otra comunidad, una empresa, un grupo.
 */
export type ContributorSelection =
  | { kind: "contributor"; id: string; name: string; profileId: string | null }
  | { kind: "profile"; id: string; name: string }
  | { kind: "new"; name: string };

type Props = {
  contributors: TreasuryContributor[];
  members: LedgerMember[];
  value: ContributorSelection | null;
  onChange: (sel: ContributorSelection | null) => void;
  inputClass: string;
};

type Option =
  | { key: string; group: "creyentes"; sel: ContributorSelection; label: string }
  | { key: string; group: "libro"; sel: ContributorSelection; label: string; linked: boolean };

function norm(s: string): string {
  return s
    .normalize("NFD")
    // Saca los acentos: el rango son las marcas diacríticas combinantes
    // (U+0300 a U+036F), escritas literalmente.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Buscador de contribuyentes con dos fuentes: los creyentes de la
 * localidad y los contribuyentes que ya están en el libro (los importados
 * de la planilla, las colectas, la gente de afuera). Si lo que se escribe
 * no está en ninguna de las dos, se ofrece agregarlo tal cual.
 *
 * Un creyente que ya tiene su contribuyente vinculado aparece UNA vez, en
 * el grupo del libro y marcado como creyente: elegirlo es elegir ese
 * contribuyente.
 */
export function ContributorPicker({
  contributors,
  members,
  value,
  onChange,
  inputClass,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Cerrar al tocar afuera.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const options = useMemo<Option[]>(() => {
    const q = norm(query);
    const linkedProfiles = new Set(
      contributors.filter((c) => c.profile_id).map((c) => c.profile_id as string)
    );
    const fromMembers: Option[] = members
      .filter((m) => m.full_name && !linkedProfiles.has(m.id))
      .filter((m) => !q || norm(m.full_name!).includes(q))
      .map((m) => ({
        key: `p:${m.id}`,
        group: "creyentes",
        label: m.full_name!,
        sel: { kind: "profile", id: m.id, name: m.full_name! },
      }));
    const fromLedger: Option[] = contributors
      .filter((c) => c.is_active)
      .filter((c) => !q || norm(c.name).includes(q))
      .map((c) => ({
        key: `c:${c.id}`,
        group: "libro",
        label: c.name,
        linked: Boolean(c.profile_id),
        sel: {
          kind: "contributor",
          id: c.id,
          name: c.name,
          profileId: c.profile_id,
        },
      }));
    // Con la caja vacía la lista sería toda la comunidad: se recorta.
    const limit = q ? 8 : 6;
    return [...fromLedger.slice(0, limit), ...fromMembers.slice(0, limit)];
  }, [contributors, members, query]);

  const typed = query.trim();
  const exact = options.some((o) => norm(o.label) === norm(typed));
  const canAddNew = typed.length > 0 && !exact;
  const total = options.length + (canAddNew ? 1 : 0);

  function choose(sel: ContributorSelection) {
    onChange(sel);
    setQuery("");
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setQuery("");
    // El foco vuelve a la caja para elegir otro sin un toque de más.
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter") && typed) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, total - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      // Enter elige en vez de mandar el formulario: es lo que uno espera
      // de un buscador, y el tesorero está encadenando cargas.
      e.preventDefault();
      if (active < options.length) choose(options[active].sel);
      else if (canAddNew) choose({ kind: "new", name: typed });
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  if (value) {
    return (
      <div className="flex min-h-[38px] items-center gap-2 rounded-xl border border-black/10 bg-bg/40 px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[13.5px] text-dark">
          {value.name}
          <span className="ml-1.5 text-[11px] text-muted">
            {value.kind === "profile" ||
            (value.kind === "contributor" && value.profileId)
              ? "· creyente"
              : value.kind === "new"
                ? "· nuevo"
                : ""}
          </span>
        </span>
        <button
          type="button"
          onClick={clear}
          className="tap shrink-0 rounded-full px-1.5 text-[16px] leading-none text-muted hover:text-dark"
          aria-label="Quitar contribuyente"
          title="Elegir otro"
        >
          ×
        </button>
      </div>
    );
  }

  const groups: Array<{ group: Option["group"]; title: string }> = [
    { group: "libro", title: "En el libro" },
    { group: "creyentes", title: "Creyentes de la comunidad" },
  ];

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Buscar creyente, persona o grupo… o dejar vacío"
        className={inputClass}
        autoComplete="off"
      />
      {open && total > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-black/10 bg-card py-1 shadow-card-elevated"
        >
          {groups.map(({ group, title }) => {
            const items = options.filter((o) => o.group === group);
            if (items.length === 0) return null;
            return (
              <li key={group}>
                <div className="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {title}
                </div>
                <ul>
                  {items.map((o) => {
                    const idx = options.indexOf(o);
                    return (
                      <li
                        key={o.key}
                        role="option"
                        aria-selected={idx === active}
                        onMouseEnter={() => setActive(idx)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          choose(o.sel);
                        }}
                        className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-[13px] ${
                          idx === active ? "bg-terra/[0.08] text-dark" : "text-dark"
                        }`}
                      >
                        <span className="truncate">{o.label}</span>
                        {o.group === "libro" && o.linked && (
                          <span className="shrink-0 text-[10.5px] text-muted">
                            creyente
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
          {canAddNew && (
            <li
              role="option"
              aria-selected={active === options.length}
              onMouseEnter={() => setActive(options.length)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose({ kind: "new", name: typed });
              }}
              className={`mt-1 cursor-pointer border-t border-black/[0.06] px-3 py-2 text-[13px] ${
                active === options.length ? "bg-terra/[0.08]" : ""
              }`}
            >
              <span className="text-muted">Agregar </span>
              <span className="font-semibold text-terra">«{typed}»</span>
              <span className="ml-1 text-[11px] text-muted">
                (de otra comunidad, empresa o grupo)
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
