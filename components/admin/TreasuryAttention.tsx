import Link from "next/link";
import { IconArrowRight, IconTesoreria } from "@/components/Icons";
import type { AttentionTone, TreasuryAttention } from "@/lib/treasury-attention";
import { hideAttentionAction, showAttentionAction } from "@/app/admin/(panel)/attention-actions";

/**
 * Las tarjetas de atención de la Tesorería, arriba de todo del Inicio del
 * panel y solo para quien tiene el tag. Grandes a propósito: son lo
 * primero que el tesorero tiene que ver, no una fila más.
 *
 * Cada tarjeta se puede ocultar (072). "Ocultar" no resuelve nada —la
 * tarea sigue ahí—, solo saca la tarjeta de la vista de ESTA persona
 * hasta que el período o el objeto cambien (la clave lo lleva adentro).
 * Las ocultas se recuperan desde el pie ("N ocultas · mostrar").
 */

const TONE: Record<AttentionTone, { color: string; bg: string; border: string; label: string }> = {
  alert: { color: "#B42318", bg: "#B423180D", border: "#B4231833", label: "Urgente" },
  warn: { color: "#B7791F", bg: "#B7791F0D", border: "#B7791F33", label: "Por hacer" },
};

export function TreasuryAttentionBoard({
  attention,
  showHidden,
}: {
  attention: TreasuryAttention;
  showHidden: boolean;
}) {
  const { items, hidden, canHide } = attention;
  const visible = showHidden ? [...items, ...hidden] : items;

  return (
    <section className="mb-6 md:mb-8" aria-labelledby="tesoreria-atencion">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[2px] text-gold-dark">
            Tesorería
          </div>
          <h2
            id="tesoreria-atencion"
            className="mt-0.5 font-display text-[20px] font-semibold text-dark"
          >
            {visible.length === 0 ? "El libro está al día" : "Lo que pide atención"}
          </h2>
        </div>
        {hidden.length > 0 && (
          <div className="flex items-center gap-2 text-[12px] text-muted">
            {showHidden ? (
              <>
                <Link href="/admin" className="font-semibold text-terra hover:underline">
                  Esconder las ocultas
                </Link>
                <span aria-hidden="true">·</span>
                <form action={showAttentionAction}>
                  <button type="submit" className="font-semibold text-terra hover:underline">
                    Volver a mostrar todas
                  </button>
                </form>
              </>
            ) : (
              <Link href="/admin?ocultas=1" className="hover:text-terra">
                {hidden.length === 1 ? "1 tarjeta oculta" : `${hidden.length} tarjetas ocultas`}{" "}
                <span className="font-semibold text-terra">· mostrar</span>
              </Link>
            )}
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex items-center gap-4 rounded-2xl border border-[#6A8B5F33] bg-[#6A8B5F0D] p-5 md:p-6">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "#6A8B5F1F", color: "#6A8B5F" }}
          >
            <IconTesoreria size={24} />
          </div>
          <div>
            <div className="text-[15px] font-semibold text-dark">
              Nada pendiente en la Tesorería.
            </div>
            <div className="mt-0.5 text-[12.5px] text-muted">
              Meses cerrados, auditoría sin hallazgos graves, extracto conciliado y el
              estado del Fondo compartido.
            </div>
          </div>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:gap-4">
          {visible.map((item) => {
            const t = TONE[item.tone];
            const isHidden = hidden.some((h) => h.key === item.key);
            return (
              <li
                key={item.key}
                className={`flex flex-col gap-3 rounded-2xl border p-5 shadow-card md:p-6 ${
                  isHidden ? "opacity-70" : ""
                }`}
                style={{ background: t.bg, borderColor: t.border }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                    style={{ background: t.color }}
                  >
                    {isHidden ? "Oculta" : t.label}
                  </span>
                  {canHide && (
                    <form action={isHidden ? showAttentionAction : hideAttentionAction}>
                      <input type="hidden" name="key" value={item.key} />
                      <button
                        type="submit"
                        className="rounded-lg px-2 py-1 text-[11.5px] font-semibold text-muted transition hover:bg-black/[0.04] hover:text-dark"
                        title={
                          isHidden
                            ? "Volver a mostrar esta tarjeta"
                            : "Ocultar esta tarjeta hasta que cambie el período"
                        }
                      >
                        {isHidden ? "Mostrar" : "Ocultar"}
                      </button>
                    </form>
                  )}
                </div>
                <div>
                  <h3
                    className="font-display text-[22px] font-bold leading-tight md:text-[24px]"
                    style={{ color: t.color }}
                  >
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-dark/85">
                    {item.detail}
                  </p>
                </div>
                <Link
                  href={item.href}
                  className="tap mt-auto inline-flex w-fit items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white shadow-card-soft transition hover:gap-3"
                  style={{ background: t.color }}
                >
                  {item.cta} <IconArrowRight size={13} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
