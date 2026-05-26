"use client";

import { useCallback, useState } from "react";
import { Button, Card, Field, Select, TextArea, TextInput } from "@/components/admin/ui";
import { categoryMeta, fmtUYU } from "./category-meta";

export type EditorItem = {
  id: string;
  category: string;
  icon: string;
  planned: number;
  spent: number;
  position: number;
};

type Props = {
  budgetId: string;
  period: string;
  status: "draft" | "active" | "closed";
  notes: string | null;
  items: EditorItem[];
  saveAction: (formData: FormData) => void;
  addCategoryAction: (formData: FormData) => void;
};

const DARK = "#2A2833";

export function BudgetEditor({
  budgetId,
  period,
  status: initialStatus,
  notes: initialNotes,
  items: initialItems,
  saveAction,
  addCategoryAction,
}: Props) {
  const [items, setItems] = useState<EditorItem[]>(initialItems);
  const [status, setStatus] = useState(initialStatus);
  const [notes, setNotes] = useState(initialNotes ?? "");

  const update = useCallback(
    (id: string, field: "planned" | "spent", value: number) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
      );
    },
    []
  );

  const activeItems = items.filter((i) => i.planned > 0);
  const totalPlanned = activeItems.reduce((s, i) => s + i.planned, 0);
  const totalSpent = activeItems.reduce((s, i) => s + i.spent, 0);
  const overallPct = totalPlanned > 0 ? (totalSpent / totalPlanned) * 100 : 0;
  const omitted = items.length - activeItems.length;

  return (
    <>
      <form action={saveAction}>
        <input type="hidden" name="budget_id" value={budgetId} />

        {/* Período + estado */}
        <Card className="mb-4">
          <div className="grid gap-4 md:grid-cols-[1fr,180px]">
            <div>
              <span className="mb-1 block text-[12px] font-semibold text-dark">
                Período
              </span>
              <div className="rounded-xl border border-black/10 bg-bg px-3.5 py-2.5 text-[13px] text-muted">
                {period}
              </div>
            </div>
            <Field label="Estado" name="status">
              <Select
                id="status"
                name="status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as Props["status"])
                }
              >
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="closed">Cerrado</option>
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Notas" name="notes" hint="opcional">
              <TextArea
                id="notes"
                name="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Comentarios de la Asamblea sobre este presupuesto…"
              />
            </Field>
          </div>
        </Card>

        {/* Resumen en vivo */}
        {activeItems.length > 0 && (
          <div className="mb-5 flex items-center gap-5 rounded-2xl bg-terra-grad p-5 text-white">
            <OverallRing pct={overallPct} />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] opacity-80">
                Ejecución total del presupuesto
              </div>
              <div className="font-display text-[26px] font-bold leading-tight">
                {fmtUYU(totalSpent)}{" "}
                <span className="text-[14px] font-normal opacity-70">
                  de {fmtUYU(totalPlanned)}
                </span>
              </div>
              <div className="text-[11px] opacity-65">
                {activeItems.length}{" "}
                {activeItems.length === 1
                  ? "categoría presupuestada"
                  : "categorías presupuestadas"}
                {omitted > 0 && (
                  <>
                    {" "}
                    · {omitted} {omitted === 1 ? "omitida" : "omitidas"}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Ítems */}
        <div className="flex flex-col gap-2.5">
          {items.map((item) => (
            <BudgetItemRow key={item.id} item={item} onUpdate={update} />
          ))}
        </div>

        {/* Barra de acciones */}
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="secondary" href="/admin/tesoreria/presupuesto">
            Cancelar
          </Button>
          <Button type="submit">Guardar presupuesto</Button>
        </div>
      </form>

      {/* Agregar categoría (form separado: navega y recarga) */}
      <Card className="mt-5 border-dashed">
        <h2 className="mb-1 font-display text-[16px] font-semibold text-dark">
          Agregar categoría
        </h2>
        <p className="mb-3 text-[12px] text-muted">
          Para gastos especiales de tu Asamblea. Guardá los cambios de arriba
          antes de agregar una categoría nueva.
        </p>
        <form action={addCategoryAction} className="flex gap-2">
          <input type="hidden" name="budget_id" value={budgetId} />
          <TextInput
            name="category"
            placeholder="Nombre de la categoría…"
            className="flex-1"
            required
          />
          <Button type="submit" variant="secondary">
            + Agregar
          </Button>
        </form>
      </Card>

      {/* Ayuda */}
      <Card className="mt-5">
        <div className="mb-2 text-[12px] font-semibold text-dark">
          ¿Cómo funciona?
        </div>
        <ul className="flex list-none flex-col gap-1.5 p-0 text-[12px] leading-relaxed text-muted">
          <li>
            → Poné la <strong className="text-dark">Meta ($)</strong> de cada
            categoría para definir cuánto se planea gastar.
          </li>
          <li>
            → Las categorías con meta en{" "}
            <strong className="text-dark">$0</strong> se atenúan y no se
            cuentan en el presupuesto total.
          </li>
          <li>
            → Actualizá el <strong className="text-dark">Gastado ($)</strong>{" "}
            periódicamente para ver el progreso vs. plan.
          </li>
          <li>
            → El estado <strong className="text-dark">Activo</strong> indica
            que el presupuesto está vigente para el período.
          </li>
        </ul>
      </Card>
    </>
  );
}

function BudgetItemRow({
  item,
  onUpdate,
}: {
  item: EditorItem;
  onUpdate: (id: string, field: "planned" | "spent", value: number) => void;
}) {
  const meta = categoryMeta(item.icon);
  const pct = item.planned > 0 ? (item.spent / item.planned) * 100 : 0;
  const isZero = item.planned === 0;
  const over = pct > 100;

  return (
    <div
      className="rounded-2xl border border-black/[0.04] bg-card p-4 shadow-card-soft transition"
      style={{
        opacity: isZero ? 0.55 : 1,
        borderLeft: `3px solid ${isZero ? "#7A7670" : meta.color}`,
      }}
    >
      {/* hidden + numeric fields serializados al form padre */}
      <input type="hidden" name="item_id[]" value={item.id} />

      <div className="flex items-start gap-3.5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[20px]"
          style={{ background: `${meta.color}12` }}
        >
          {meta.emoji}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[14px] font-semibold text-dark">
              {item.category}
            </span>
            {!isZero && (
              <span
                className={`text-[11px] ${
                  over ? "font-bold text-rose-600" : "text-muted"
                }`}
              >
                {fmtUYU(item.spent)} / {fmtUYU(item.planned)}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted">{meta.hint}</p>

          {!isZero ? (
            <div
              className="mt-2.5 h-1.5 overflow-hidden rounded-full"
              style={{ background: `${meta.color}15` }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${Math.min(pct, 100)}%`,
                  background: over
                    ? "linear-gradient(90deg,#C2185B,#E91E63)"
                    : `linear-gradient(90deg,${meta.color},${meta.color}CC)`,
                }}
              />
            </div>
          ) : (
            <div className="mt-1.5 text-[11px] italic text-muted">
              No presupuestado — se omite de las metas
            </div>
          )}
        </div>

        {!isZero && <ItemRing pct={pct} color={meta.color} />}
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2.5 border-t border-black/[0.06] pt-3.5">
        <Field label="Meta ($)" name={`planned_${item.id}`}>
          <TextInput
            name="planned_amount[]"
            type="number"
            min="0"
            step="100"
            value={item.planned || ""}
            onChange={(e) =>
              onUpdate(item.id, "planned", parseFloat(e.target.value) || 0)
            }
            placeholder="0 = no presupuestado"
          />
        </Field>
        <Field label="Gastado ($)" name={`spent_${item.id}`}>
          <TextInput
            name="spent_amount[]"
            type="number"
            min="0"
            step="100"
            value={item.spent || ""}
            onChange={(e) =>
              onUpdate(item.id, "spent", parseFloat(e.target.value) || 0)
            }
            placeholder="0"
          />
        </Field>
      </div>
    </div>
  );
}

function ItemRing({ pct, color }: { pct: number; color: string }) {
  const size = 56;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}18`} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dy="0.35em" fill={DARK} fontSize="11" fontWeight="700">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

function OverallRing({ pct }: { pct: number }) {
  const size = 72;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#fff"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dy="0.35em" fill="#fff" fontSize="14" fontWeight="800">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}
