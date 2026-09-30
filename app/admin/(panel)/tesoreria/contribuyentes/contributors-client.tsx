"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Select, TextInput } from "@/components/admin/ui";
import { HelpTip } from "@/components/HelpTip";
import { formatDate } from "@/lib/format";
import type { ContributorRow } from "@/lib/treasury-contributors";
import { normalizeContributorName } from "@/lib/treasury-contributors";
import { formatMoney } from "@/lib/treasury-format";
import { TREASURY_HELP } from "@/lib/treasury-help";
import type { LedgerMember } from "@/lib/treasury-ledger";
import {
  deleteContributorAction,
  linkContributorAction,
  mergeContributorsAction,
  renameContributorAction,
  setContributorActiveAction,
} from "./actions";

type Filter = "todos" | "sin-vincular" | "dobles" | "inactivos";

const KIND_LABEL: Record<string, string> = {
  persona: "Persona",
  familia: "Familia",
  negocio: "Negocio",
  colecta: "Colecta",
  otro: "Otro",
};

/**
 * La lista del padrón con sus acciones. Las fichas filtradas se esconden
 * con `hidden` en vez de desmontarse, para no perder lo que se estaba
 * editando (misma regla que la lista de Creyentes).
 */
export function ContributorsClient({ rows, members }: { rows: ContributorRow[]; members: LedgerMember[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>(
    rows.some((r) => r.is_active && r.lookalikes.length > 0)
      ? "dobles"
      : rows.some((r) => r.is_active && !r.profile_id && r.kind !== "colecta")
        ? "sin-vincular"
        : "todos"
  );
  const [toast, setToast] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const nq = normalizeContributorName(q);
  const visible = useMemo(() => {
    return rows.filter((r) => {
      if (nq && !normalizeContributorName(r.name).includes(nq) && !(r.profileName && normalizeContributorName(r.profileName).includes(nq))) return false;
      switch (filter) {
        case "sin-vincular":
          return r.is_active && !r.profile_id && r.kind !== "colecta";
        case "dobles":
          return r.is_active && r.lookalikes.length > 0;
        case "inactivos":
          return !r.is_active;
        default:
          return r.is_active;
      }
    });
  }, [rows, nq, filter]);
  const visibleIds = new Set(visible.map((r) => r.id));

  const counts = {
    todos: rows.filter((r) => r.is_active).length,
    "sin-vincular": rows.filter((r) => r.is_active && !r.profile_id && r.kind !== "colecta").length,
    dobles: rows.filter((r) => r.is_active && r.lookalikes.length > 0).length,
    inactivos: rows.filter((r) => !r.is_active).length,
  };

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre…"
          aria-label="Buscar contribuyente"
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["todos", "Activos"],
              ["sin-vincular", "Sin vincular"],
              ["dobles", "Posibles dobles"],
              ["inactivos", "Inactivos"],
            ] as Array<[Filter, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`tap rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                filter === key ? "bg-terra text-white" : "bg-card text-muted shadow-card-soft"
              }`}
            >
              {label} · {counts[key]}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div
          className={`mb-3 rounded-xl px-4 py-2.5 text-[13px] ${
            toast.tone === "ok" ? "bg-green/10 text-green" : "bg-rose-50 text-rose-800"
          }`}
        >
          {toast.text}
        </div>
      )}

      {visible.length === 0 && (
        <p className="rounded-2xl bg-card p-5 text-center text-[13px] text-muted shadow-card">
          {rows.length === 0 ? "Todavía no hay contribuyentes en el libro." : "Nada que mostrar con este filtro."}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} hidden={!visibleIds.has(r.id)}>
            <Row row={r} all={rows} members={members} onResult={setToast} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({
  row,
  all,
  members,
  onResult,
}: {
  row: ContributorRow;
  all: ContributorRow[];
  members: LedgerMember[];
  onResult: (t: { tone: "ok" | "error"; text: string }) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "link" | "merge" | "rename">("none");
  const [busy, setBusy] = useState(false);
  const [linkTo, setLinkTo] = useState(row.suggestedProfile?.id ?? "");
  const [mergeTo, setMergeTo] = useState(row.lookalikes[0]?.id ?? "");
  const [name, setName] = useState(row.name);
  const [kind, setKind] = useState(row.kind);

  async function run(action: (fd: FormData) => Promise<{ ok: boolean; error: string | null; message?: string }>, fd: FormData, confirmText?: string) {
    if (busy) return;
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    const res = await action(fd);
    setBusy(false);
    onResult(res.ok ? { tone: "ok", text: res.message ?? "Listo." } : { tone: "error", text: res.error ?? "Error." });
    if (res.ok) {
      setMode("none");
      router.refresh();
    }
  }

  const fd = (pairs: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(pairs)) f.set(k, v);
    return f;
  };

  const sortedMembers = [...members].sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "es"));
  const totals = row.stats.totals.map((t) => formatMoney(t.amount, t.currency)).join(" · ");

  return (
    <div className={`rounded-2xl border border-black/[0.04] bg-card p-4 shadow-card ${row.is_active ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-[17px] font-semibold text-dark">{row.name}</span>
            <span className="rounded bg-bg px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
              {KIND_LABEL[row.kind] ?? row.kind}
            </span>
            {!row.is_active && (
              <span className="rounded bg-bg px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">Inactiva</span>
            )}
          </div>
          <div className="mt-1 text-[12.5px]">
            {row.profile_id ? (
              <span className="text-green">
                Vinculada a <strong>{row.profileName ?? "un creyente"}</strong>
              </span>
            ) : row.kind === "colecta" ? (
              <span className="text-muted">Colecta: sin persona, por diseño.</span>
            ) : (
              <span className="text-amber">
                Sin vincular a un creyente
                {row.suggestedProfile && (
                  <>
                    {" "}· ¿es <strong>{row.suggestedProfile.full_name}</strong>?
                  </>
                )}
              </span>
            )}
          </div>
          <div className="mt-1 text-[12px] text-muted">
            {row.stats.count === 0
              ? "Sin aportes."
              : `${row.stats.count} ${row.stats.count === 1 ? "aporte" : "aportes"}${totals ? ` · ${totals}` : ""}${
                  row.stats.lastDate ? ` · último el ${formatDate(row.stats.lastDate)}` : ""
                }`}
          </div>
          {row.lookalikes.length > 0 && row.is_active && (
            <div className="mt-1 text-[12px] text-amber">
              Parece la misma persona que {row.lookalikes.map((l) => `«${l.name}»`).join(", ")}.
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="secondary" onClick={() => setMode(mode === "link" ? "none" : "link")}>
            {row.profile_id ? "Cambiar vínculo" : "Vincular"}
          </Button>
          {all.length > 1 && (
            <Button type="button" variant="secondary" onClick={() => setMode(mode === "merge" ? "none" : "merge")}>
              Fusionar
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => setMode(mode === "rename" ? "none" : "rename")}>
            Editar
          </Button>
        </div>
      </div>

      {mode === "link" && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-bg/60 p-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-dark">
              Creyente de la app
              <HelpTip text={TREASURY_HELP.fields.vincularContribuyente} />
            </div>
            <Select value={linkTo} onChange={(e) => setLinkTo(e.target.value)} aria-label="Creyente">
              <option value="">— Sin vínculo —</option>
              {sortedMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name ?? "Sin nombre"}
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="button"
            disabled={busy}
            onClick={() => run(linkContributorAction, fd({ contributor_id: row.id, profile_id: linkTo }))}
          >
            {linkTo ? "Vincular" : "Quitar el vínculo"}
          </Button>
        </div>
      )}

      {mode === "merge" && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-bg/60 p-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-dark">
              Fusionar «{row.name}» dentro de…
              <HelpTip text={TREASURY_HELP.fields.fusionarContribuyente} />
            </div>
            <Select value={mergeTo} onChange={(e) => setMergeTo(e.target.value)} aria-label="Ficha que queda">
              <option value="">— Elegir la ficha que queda —</option>
              {all
                .filter((o) => o.id !== row.id)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.profileName ? ` (${o.profileName})` : ""}
                    {row.lookalikes.some((l) => l.id === o.id) ? " · parecida" : ""}
                  </option>
                ))}
            </Select>
            <p className="mt-1 text-[11.5px] text-muted">
              Los {row.stats.count} aportes de «{row.name}» pasan a la ficha que elijas y esta se elimina. Los
              recibos ya emitidos no cambian.
            </p>
          </div>
          <Button
            type="button"
            variant="danger"
            disabled={busy || !mergeTo}
            onClick={() =>
              run(
                mergeContributorsAction,
                fd({ source_id: row.id, target_id: mergeTo }),
                `¿Fusionar «${row.name}» dentro de «${all.find((o) => o.id === mergeTo)?.name ?? ""}»? No se puede deshacer.`
              )
            }
          >
            Fusionar
          </Button>
        </div>
      )}

      {mode === "rename" && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-bg/60 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre" maxLength={120} />
            <Select value={kind} onChange={(e) => setKind(e.target.value as ContributorRow["kind"])} aria-label="Tipo">
              {Object.entries(KIND_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => run(renameContributorAction, fd({ contributor_id: row.id, name, kind }))}
              >
                Guardar
              </Button>
              <Button type="button" variant="secondary" onClick={() => setMode("none")}>
                Cancelar
              </Button>
            </div>
            <div className="flex gap-2">
              {row.stats.count === 0 ? (
                <Button
                  type="button"
                  variant="danger"
                  disabled={busy}
                  onClick={() =>
                    run(deleteContributorAction, fd({ contributor_id: row.id }), `¿Eliminar «${row.name}»? Nunca tuvo aportes.`)
                  }
                >
                  Eliminar
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(setContributorActiveAction, fd({ contributor_id: row.id, active: row.is_active ? "0" : "1" }))
                  }
                >
                  {row.is_active ? "Desactivar" : "Reactivar"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
