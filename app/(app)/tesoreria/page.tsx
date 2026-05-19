import { GoldHeader } from "@/components/GoldHeader";
import { requireMember } from "@/lib/auth";
import { getTreasury } from "@/lib/data";

// La Tesorería contiene información reservada — solo miembros autenticados.
export const dynamic = "force-dynamic";

export default async function TesoreriaPage() {
  await requireMember("/tesoreria");
  const t = await getTreasury();
  const pct = Math.max(0, Math.min(1, t.current_amount / t.goal_amount));
  const r = 56;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - pct);

  const fmt = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <>
      <GoldHeader title="Tesorería" backHref="/" />
      <main className="scroll-area flex-1 px-4 pt-4">
        {/* Progress ring */}
        <div className="mb-3.5 flex flex-col items-center rounded-[20px] bg-card p-5 shadow-card-elevated">
          <div className="relative mb-3.5 h-32 w-32">
            <svg
              width="128"
              height="128"
              viewBox="0 0 128 128"
              style={{ transform: "rotate(-90deg)" }}
            >
              <circle
                cx="64"
                cy="64"
                r={r}
                fill="none"
                stroke="#7E44B818"
                strokeWidth="9"
              />
              <circle
                cx="64"
                cy="64"
                r={r}
                fill="none"
                stroke="#7E44B8"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-display text-[30px] font-bold text-dark">
                {Math.round(pct * 100)}%
              </div>
              <div className="font-body text-[10px] text-muted">de la meta</div>
            </div>
          </div>
          <div className="text-[15px] font-semibold text-dark">
            {fmt(t.current_amount)} de {fmt(t.goal_amount)}
          </div>
          <div className="mt-0.5 font-body text-[11px] text-muted">
            Meta anual del Fondo
          </div>
        </div>

        {/* Contribution methods */}
        <div className="mb-3.5">
          <h2 className="mb-2.5 text-[14px] font-semibold text-dark">
            Cómo aportar
          </h2>
          <div className="flex gap-2.5">
            {t.methods.map((m) => (
              <div
                key={m.type}
                className="flex-1 rounded-2xl bg-card p-3.5 shadow-card-soft"
              >
                <div
                  className="mb-2 flex h-[34px] w-[34px] items-center justify-center rounded-[11px] font-display text-base font-bold text-terra"
                  style={{ background: "#2A3F8F10" }}
                >
                  {m.letter}
                </div>
                <div className="text-[12.5px] font-semibold text-dark">
                  {m.type}
                </div>
                <div className="mt-0.5 font-body text-[10.5px] text-muted">
                  {m.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly report */}
        <div className="mb-3.5 rounded-2xl bg-card p-4 shadow-card-soft">
          <h3 className="mb-2.5 text-[13px] font-semibold text-dark">
            Informe mensual
          </h3>
          {t.contributions.map((row, i, arr) => (
            <div
              key={row.label}
              className={`flex items-center justify-between py-2 ${
                i < arr.length - 1
                  ? "border-b border-[rgba(42,63,143,0.06)]"
                  : ""
              }`}
            >
              <span className="font-body text-[12px] text-muted">{row.label}</span>
              <span className="text-[12px] font-semibold text-dark">
                {fmt(row.amount)}
              </span>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
