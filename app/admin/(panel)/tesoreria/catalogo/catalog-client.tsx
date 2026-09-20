"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Card } from "@/components/admin/ui";
import {
  CATALOG_LABEL,
  canDelete,
  usageLabel,
  type CatalogKind,
  type CatalogUsage,
  type TreasuryCatalog,
} from "@/lib/treasury-catalog";
import type {
  TreasuryAccount,
  TreasuryCategory,
  TreasuryFund,
  TreasurySubcategory,
} from "@/lib/treasury-ledger";
import {
  addCatalogItemAction,
  deleteCatalogItemAction,
  moveCatalogItemAction,
  setCatalogItemActiveAction,
  updateCatalogItemAction,
} from "./actions";

/**
 * Las cuatro listas del catálogo, cada una en su tarjeta, con el mismo
 * renglón: nombre, cuánto se usa, flechas para ordenar, Editar y la
 * acción de quitar que corresponda (Eliminar si nunca se usó, Desactivar
 * si sí, Reactivar si está inactivo). Eliminar pide confirmación en el
 * mismo renglón —un roce no puede borrar nada— y Desactivar no, porque
 * se deshace con un toque.
 *
 * El estado es de servidor: cada action revalida la página y las listas
 * llegan de nuevo por props. Acá solo vive qué renglón está en edición.
 */

type Result = { ok: boolean; error: string | null };
type Named = { id: string; name: string; is_active: boolean; sort_order: number };

const inputClass =
  "w-full rounded-xl border border-black/10 bg-bg/40 px-3 py-2 text-[13.5px] text-dark outline-none focus:border-terra";

const smallBtn =
  "rounded-lg border border-black/10 bg-card px-2.5 py-1.5 text-[12px] font-semibold text-dark transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40";
const dangerBtn =
  "rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[12px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40";
const primaryBtn =
  "rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white shadow-card-soft transition hover:bg-terra-light disabled:cursor-not-allowed disabled:opacity-50";

export function CatalogClient({ catalog }: { catalog: TreasuryCatalog }) {
  return (
    <div className="space-y-5">
      <SimpleSection
        kind="account"
        title="Cuentas"
        description="Dónde está la plata: cuentas bancarias y cajas. No llevan moneda; la moneda es de cada movimiento, así una misma caja tiene pesos y dólares."
        items={catalog.accounts}
        usage={catalog.usage}
        placeholder="Cuenta BROU Pesos, Caja Chica…"
      />
      <SimpleSection
        kind="fund"
        title="Fondos"
        description="Para qué está destinada la plata. Dos movimientos de la misma cuenta pueden ser de fondos distintos y no se suman entre sí."
        items={catalog.funds}
        usage={catalog.usage}
        placeholder="Fondo Local, Fondo de Enseñanza…"
      />
      <SimpleSection
        kind="category"
        title="Categorías"
        description="El agrupador grueso de los informes. Al cargar un movimiento se elige la subcategoría, que arrastra su categoría. Desactivar una categoría desactiva sus subcategorías."
        items={catalog.categories}
        usage={catalog.usage}
        placeholder="Gastos Operativos, Enseñanza…"
      />
      <SubcategorySection catalog={catalog} />
    </div>
  );
}

// ─── Sección simple: cuentas, fondos, categorías ─────────────────

function SimpleSection({
  kind,
  title,
  description,
  items,
  usage,
  placeholder,
}: {
  kind: Exclude<CatalogKind, "subcategory">;
  title: string;
  description: string;
  items: (TreasuryAccount | TreasuryFund | TreasuryCategory)[];
  usage: Record<string, CatalogUsage>;
  placeholder: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);

  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error);
      else after?.();
    });

  return (
    <Card>
      <SectionHeader title={title} description={description} count={items.length} />
      {error && <ErrorLine message={error} />}

      {items.length === 0 ? (
        <EmptyLine text={`Todavía no hay ${CATALOG_LABEL[kind].many}.`} />
      ) : (
        <ul className="divide-y divide-black/[0.06]">
          {items.map((item, i) =>
            editing === item.id ? (
              <li key={item.id} className="py-3">
                <NameEditor
                  kind={kind}
                  item={item}
                  pending={pending}
                  onCancel={() => setEditing(null)}
                  onSave={(fd) => run(() => updateCatalogItemAction(fd), () => setEditing(null))}
                />
              </li>
            ) : (
              <Row
                key={item.id}
                kind={kind}
                item={item}
                usage={usage[item.id]}
                isFirst={i === 0}
                isLast={i === items.length - 1}
                pending={pending}
                onEdit={() => setEditing(item.id)}
                onMove={(dir) =>
                  run(() => moveCatalogItemAction(fd({ kind, id: item.id, dir })))
                }
                onToggle={(active) =>
                  run(() =>
                    setCatalogItemActiveAction(
                      fd({ kind, id: item.id, active: active ? "1" : "0" })
                    )
                  )
                }
                onDelete={() => run(() => deleteCatalogItemAction(fd({ kind, id: item.id })))}
              />
            )
          )}
        </ul>
      )}

      <AddForm
        kind={kind}
        pending={pending}
        placeholder={placeholder}
        onAdd={(formData, reset) => run(() => addCatalogItemAction(formData), reset)}
      />
    </Card>
  );
}

// ─── Subcategorías, agrupadas por categoría ──────────────────────

function SubcategorySection({ catalog }: { catalog: TreasuryCatalog }) {
  const kind: CatalogKind = "subcategory";
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);

  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error);
      else after?.();
    });

  const fundName = new Map(catalog.funds.map((f) => [f.id, f.name]));
  const groups = catalog.categories
    .map((c) => ({
      category: c,
      items: catalog.subcategories.filter((s) => s.category_id === c.id),
    }))
    .filter((g) => g.items.length > 0);
  const orphans = catalog.subcategories.filter(
    (s) => !catalog.categories.some((c) => c.id === s.category_id)
  );

  return (
    <Card>
      <SectionHeader
        title="Subcategorías"
        description="Lo que se elige al cargar un movimiento: el rubro. Cada una pertenece a una categoría y puede sugerir un fondo, que el formulario propone y el tesorero puede cambiar."
        count={catalog.subcategories.length}
      />
      {error && <ErrorLine message={error} />}

      {catalog.subcategories.length === 0 && (
        <EmptyLine text="Todavía no hay subcategorías." />
      )}

      {[...groups, ...(orphans.length ? [{ category: null, items: orphans }] : [])].map(
        (g) => (
          <div key={g.category?.id ?? "orphans"} className="mt-3 first:mt-0">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {g.category?.name ?? "Sin categoría"}
              {g.category && !g.category.is_active && <Chip>Categoría inactiva</Chip>}
            </div>
            <ul className="divide-y divide-black/[0.06] rounded-xl border border-black/[0.06] px-3">
              {g.items.map((item, i) =>
                editing === item.id ? (
                  <li key={item.id} className="py-3">
                    <SubcategoryEditor
                      item={item}
                      catalog={catalog}
                      hasEntries={(catalog.usage[item.id]?.entries ?? 0) > 0}
                      pending={pending}
                      onCancel={() => setEditing(null)}
                      onSave={(formData) =>
                        run(() => updateCatalogItemAction(formData), () => setEditing(null))
                      }
                    />
                  </li>
                ) : (
                  <Row
                    key={item.id}
                    kind={kind}
                    item={item}
                    usage={catalog.usage[item.id]}
                    detail={
                      item.default_fund_id
                        ? `Sugiere ${fundName.get(item.default_fund_id) ?? "un fondo"}`
                        : "Sin fondo sugerido"
                    }
                    isFirst={i === 0}
                    isLast={i === g.items.length - 1}
                    pending={pending}
                    onEdit={() => setEditing(item.id)}
                    onMove={(dir) =>
                      run(() => moveCatalogItemAction(fd({ kind, id: item.id, dir })))
                    }
                    onToggle={(active) =>
                      run(() =>
                        setCatalogItemActiveAction(
                          fd({ kind, id: item.id, active: active ? "1" : "0" })
                        )
                      )
                    }
                    onDelete={() =>
                      run(() => deleteCatalogItemAction(fd({ kind, id: item.id })))
                    }
                  />
                )
              )}
            </ul>
          </div>
        )
      )}

      <AddSubcategoryForm
        catalog={catalog}
        pending={pending}
        onAdd={(formData, reset) => run(() => addCatalogItemAction(formData), reset)}
      />
    </Card>
  );
}

// ─── Piezas ──────────────────────────────────────────────────────

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

function SectionHeader({
  title,
  description,
  count,
}: {
  title: string;
  description: string;
  count: number;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[20px] font-semibold text-dark">{title}</h2>
        <span className="text-[12px] text-muted">{count}</span>
      </div>
      <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{description}</p>
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
      {message}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="py-3 text-[13px] text-muted">{text}</p>;
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
      {children}
    </span>
  );
}

function Row({
  kind,
  item,
  usage,
  detail,
  isFirst,
  isLast,
  pending,
  onEdit,
  onMove,
  onToggle,
  onDelete,
}: {
  kind: CatalogKind;
  item: Named;
  usage: CatalogUsage | undefined;
  detail?: string;
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
  onEdit: () => void;
  onMove: (dir: "up" | "down") => void;
  onToggle: (active: boolean) => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const deletable = canDelete(usage);

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
      <div className="min-w-[150px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-[14px] font-semibold ${
              item.is_active ? "text-dark" : "text-muted line-through"
            }`}
          >
            {item.name}
          </span>
          {!item.is_active && <Chip>{CATALOG_LABEL[kind].inactive}</Chip>}
        </div>
        <div className="text-[11.5px] text-muted">
          {detail ? `${detail} · ` : ""}
          {usageLabel(usage, kind)}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className={smallBtn}
          disabled={pending || isFirst}
          onClick={() => onMove("up")}
          aria-label="Subir"
          title="Subir"
        >
          ↑
        </button>
        <button
          type="button"
          className={smallBtn}
          disabled={pending || isLast}
          onClick={() => onMove("down")}
          aria-label="Bajar"
          title="Bajar"
        >
          ↓
        </button>
        <button type="button" className={smallBtn} disabled={pending} onClick={onEdit}>
          Editar
        </button>

        {deletable ? (
          confirming ? (
            <>
              <button
                type="button"
                className={dangerBtn}
                disabled={pending}
                onClick={() => {
                  setConfirming(false);
                  onDelete();
                }}
              >
                Sí, eliminar
              </button>
              <button
                type="button"
                className={smallBtn}
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                No
              </button>
            </>
          ) : (
            <button
              type="button"
              className={dangerBtn}
              disabled={pending}
              onClick={() => setConfirming(true)}
              title="Nunca se usó: se puede eliminar"
            >
              Eliminar
            </button>
          )
        ) : item.is_active ? (
          <button
            type="button"
            className={smallBtn}
            disabled={pending}
            onClick={() => onToggle(false)}
            title="Ya se usó: se desactiva y queda en el historial"
          >
            Desactivar
          </button>
        ) : (
          <button
            type="button"
            className={smallBtn}
            disabled={pending}
            onClick={() => onToggle(true)}
          >
            Reactivar
          </button>
        )}
      </div>
    </li>
  );
}

function NameEditor({
  kind,
  item,
  pending,
  onCancel,
  onSave,
}: {
  kind: CatalogKind;
  item: Named;
  pending: boolean;
  onCancel: () => void;
  onSave: (formData: FormData) => void;
}) {
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(new FormData(e.currentTarget));
      }}
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={item.id} />
      <input
        name="name"
        defaultValue={item.name}
        required
        maxLength={80}
        autoFocus
        className={`${inputClass} min-w-[180px] flex-1`}
      />
      <button type="submit" className={primaryBtn} disabled={pending}>
        Guardar
      </button>
      <button type="button" className={smallBtn} disabled={pending} onClick={onCancel}>
        Cancelar
      </button>
    </form>
  );
}

function SubcategoryEditor({
  item,
  catalog,
  hasEntries,
  pending,
  onCancel,
  onSave,
}: {
  item: TreasurySubcategory;
  catalog: TreasuryCatalog;
  hasEntries: boolean;
  pending: boolean;
  onCancel: () => void;
  onSave: (formData: FormData) => void;
}) {
  return (
    <form
      className="grid gap-2 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        // Un <select> disabled no viaja (ver CLAUDE.md): la categoría
        // congelada no va en el payload y el action no la toca.
        onSave(formData);
      }}
    >
      <input type="hidden" name="kind" value="subcategory" />
      <input type="hidden" name="id" value={item.id} />
      <label className="block sm:col-span-3">
        <span className="mb-1 block text-[10.5px] uppercase tracking-wide text-muted">Nombre</span>
        <input
          name="name"
          defaultValue={item.name}
          required
          maxLength={80}
          autoFocus
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10.5px] uppercase tracking-wide text-muted">
          Categoría
        </span>
        <select
          name="category_id"
          defaultValue={item.category_id}
          disabled={hasEntries}
          className={inputClass}
        >
          {catalog.categories
            .filter((c) => c.is_active || c.id === item.category_id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
        {hasEntries && (
          <span className="mt-1 block text-[11px] text-muted">
            Tiene movimientos: la categoría no se cambia.
          </span>
        )}
      </label>
      <label className="block">
        <span className="mb-1 block text-[10.5px] uppercase tracking-wide text-muted">
          Fondo sugerido
        </span>
        <select
          name="default_fund_id"
          defaultValue={item.default_fund_id ?? ""}
          className={inputClass}
        >
          <option value="">Sin fondo sugerido</option>
          {catalog.funds
            .filter((f) => f.is_active || f.id === item.default_fund_id)
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
        </select>
      </label>
      <div className="flex items-end gap-2">
        <button type="submit" className={primaryBtn} disabled={pending}>
          Guardar
        </button>
        <button type="button" className={smallBtn} disabled={pending} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function AddForm({
  kind,
  pending,
  placeholder,
  onAdd,
}: {
  kind: CatalogKind;
  pending: boolean;
  placeholder: string;
  onAdd: (formData: FormData, reset: () => void) => void;
}) {
  return (
    <form
      className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/[0.06] pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        onAdd(new FormData(form), () => form.reset());
      }}
    >
      <input type="hidden" name="kind" value={kind} />
      <input
        name="name"
        required
        maxLength={80}
        placeholder={placeholder}
        className={`${inputClass} min-w-[200px] flex-1`}
      />
      <button type="submit" className={primaryBtn} disabled={pending}>
        Agregar
      </button>
    </form>
  );
}

function AddSubcategoryForm({
  catalog,
  pending,
  onAdd,
}: {
  catalog: TreasuryCatalog;
  pending: boolean;
  onAdd: (formData: FormData, reset: () => void) => void;
}) {
  const categories = catalog.categories.filter((c) => c.is_active);
  const funds = catalog.funds.filter((f) => f.is_active);

  if (categories.length === 0) {
    return (
      <p className="mt-4 border-t border-black/[0.06] pt-4 text-[12.5px] text-muted">
        Para agregar una subcategoría, primero creá una categoría.
      </p>
    );
  }

  return (
    <form
      className="mt-4 grid gap-2 border-t border-black/[0.06] pt-4 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        onAdd(new FormData(form), () => form.reset());
      }}
    >
      <input type="hidden" name="kind" value="subcategory" />
      <label className="block sm:col-span-3">
        <span className="mb-1 block text-[10.5px] uppercase tracking-wide text-muted">
          Nueva subcategoría
        </span>
        <input
          name="name"
          required
          maxLength={80}
          placeholder="Gastos Secretaría, Materiales de Enseñanza…"
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10.5px] uppercase tracking-wide text-muted">
          Categoría
        </span>
        <select name="category_id" required defaultValue="" className={inputClass}>
          <option value="">Elegir…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[10.5px] uppercase tracking-wide text-muted">
          Fondo sugerido
        </span>
        <select name="default_fund_id" defaultValue="" className={inputClass}>
          <option value="">Sin fondo sugerido</option>
          {funds.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end">
        <button type="submit" className={primaryBtn} disabled={pending}>
          Agregar
        </button>
      </div>
    </form>
  );
}
