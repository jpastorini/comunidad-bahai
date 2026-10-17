"use client";

import { useState, useTransition } from "react";
import { startAporteAction } from "./actions";

type Fund = { id: string; name: string };

/** Montos sugeridos: atajos, no una escala. El campo acepta cualquiera. */
const QUICK = [500, 1000, 2000, 5000];

function fmt(n: number): string {
  return n.toLocaleString("es-UY", { maximumFractionDigits: 0 });
}

export function AporteForm({
  funds,
  commitmentAmount,
  minAmount,
}: {
  funds: Fund[];
  commitmentAmount: number | null;
  minAmount: number;
}) {
  const [amount, setAmount] = useState(commitmentAmount ? String(commitmentAmount) : "");
  const [fundId, setFundId] = useState(funds[0]?.id ?? "");
  const [showAlias, setShowAlias] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [leaving, setLeaving] = useState(false);

  // Sin puntos: en es-UY el punto separa miles, y "1.500" del lado del
  // servidor (parseMoney) sería 1,50. El campo solo deja dígitos y coma.
  const numeric = Number(amount.replace(",", "."));
  const valid = Number.isFinite(numeric) && numeric >= minAmount;

  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await startAporteAction(formData);
      if (res.url) {
        setLeaving(true);
        window.location.href = res.url;
      } else {
        setError(res.error ?? "No se pudo iniciar el pago.");
      }
    });
  }

  const busy = pending || leaving;

  return (
    <form action={submit} className="flex flex-col gap-3.5 pb-8">
      <section className="rounded-[20px] bg-card p-4 shadow-card-elevated">
        <label htmlFor="amount" className="text-[12px] font-semibold uppercase tracking-wide text-muted">
          Monto en pesos
        </label>
        <div className="mt-1.5 flex items-baseline gap-2 border-b-2 border-gold/40 pb-1 focus-within:border-gold">
          <span className="font-display text-[26px] font-bold text-muted">$</span>
          <input
            id="amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ""))}
            className="w-full bg-transparent font-display text-[34px] font-bold leading-none text-dark outline-none placeholder:text-muted/40"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {commitmentAmount && (
            <button
              type="button"
              onClick={() => setAmount(String(commitmentAmount))}
              className="tap rounded-full bg-amber/15 px-3 py-1.5 text-[12px] font-semibold text-amber"
            >
              Mi compromiso · $ {fmt(commitmentAmount)}
            </button>
          )}
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setAmount(String(q))}
              className="tap rounded-full bg-gold/10 px-3 py-1.5 text-[12px] font-semibold text-gold-dark"
            >
              $ {fmt(q)}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          El monto lo decidís vos. Mínimo $ {fmt(minAmount)}.
        </p>
      </section>

      {funds.length > 1 ? (
        <section className="rounded-[20px] bg-card p-4 shadow-card-soft">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">Fondo</div>
          <div className="mt-2 flex flex-col gap-1.5">
            {funds.map((f) => (
              <label
                key={f.id}
                className={`tap flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-[13px] ${
                  fundId === f.id ? "border-gold bg-gold/[0.07] font-semibold text-dark" : "border-dark/10 text-dark"
                }`}
              >
                <input
                  type="radio"
                  name="fund_id"
                  value={f.id}
                  checked={fundId === f.id}
                  onChange={() => setFundId(f.id)}
                  className="accent-[#C4A235]"
                />
                {f.name}
              </label>
            ))}
          </div>
        </section>
      ) : (
        <input type="hidden" name="fund_id" value={fundId} />
      )}

      <section className="rounded-[20px] bg-card p-4 shadow-card-soft">
        {showAlias ? (
          <>
            <label htmlFor="receipt_name" className="text-[12px] font-semibold uppercase tracking-wide text-muted">
              Nombre en el recibo
            </label>
            <input
              id="receipt_name"
              name="receipt_name"
              maxLength={120}
              placeholder="Ej.: Familia Pérez"
              className="mt-1.5 w-full rounded-xl border border-dark/10 bg-transparent px-3.5 py-2.5 text-[13px] text-dark outline-none focus:border-gold"
            />
            <p className="mt-1.5 text-[11px] text-muted">
              El tesorero sigue sabiendo que el aporte es tuyo; el recibo sale con este nombre.
            </p>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowAlias(true)}
            className="text-[12.5px] font-semibold text-gold-dark"
          >
            Que el recibo salga con otro nombre (ej. tu familia)
          </button>
        )}
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-3 text-[12.5px] text-rose-800">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!valid || !fundId || busy}
        className="tap rounded-2xl bg-[#009EE3] px-4 py-3.5 text-[15px] font-semibold text-white shadow-card-soft disabled:opacity-40"
      >
        {busy ? "Abriendo Mercado Pago…" : valid ? `Aportar $ ${fmt(numeric)} con Mercado Pago` : "Aportar con Mercado Pago"}
      </button>

      <p className="px-1 text-center text-[11px] leading-snug text-muted">
        Se paga en Mercado Pago, con tarjeta, saldo o en efectivo en Abitab o RedPagos. Cuando el
        pago se acredita, el aporte se registra solo en el libro de la Tesorería y te llega el
        recibo. Tu aporte es confidencial: solo lo ve el tesorero.
      </p>
    </form>
  );
}
