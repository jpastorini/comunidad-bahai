"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DateInput } from "@/components/DateInput";
import { compressImage } from "@/components/gallery/compress-image";
import { addCashLineAction, removeCashLineAction, submitCashReportAction } from "./actions";

type Rubro = { id: string; name: string; category: string };

/**
 * El formulario del gasto y el de la rendición, en el teléfono del
 * responsable. Cliente por una razón: la foto del comprobante se
 * comprime antes de viajar (una foto de celular pesa 4 MB y la función
 * de Vercel corta en 4,5), igual que en el panel.
 */
export function CashLineForm({
  boxId,
  rubros,
  today,
  currencies,
}: {
  boxId: string;
  rubros: Rubro[];
  today: string;
  currencies: string[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("line_date", date);
    const file = fd.get("file") as File | null;
    if (file && file.size > 0 && file.type.startsWith("image/")) {
      try {
        const small = await compressImage(file);
        fd.set("file", small, small.name || file.name);
      } catch {
        /* si no se pudo comprimir, va el original */
      }
    }
    const res = await addCashLineAction(fd);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    form.reset();
    setFileName(null);
    setDate(today);
    router.refresh();
  }

  const byCategory = new Map<string, Rubro[]>();
  for (const r of rubros) byCategory.set(r.category, [...(byCategory.get(r.category) ?? []), r]);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="box_id" value={boxId} />
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Fecha
          <DateInput value={date} onValueChange={setDate} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Monto
          <div className="flex gap-1.5">
            <select name="currency" className={`${INPUT} w-[76px] shrink-0`} defaultValue={currencies[0] ?? "UYU"}>
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c === "UYU" ? "$" : "US$"}
                </option>
              ))}
            </select>
            <input name="amount" inputMode="decimal" placeholder="0" required className={`${INPUT} flex-1`} />
          </div>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
        En qué se gastó
        <select name="subcategory_id" required className={INPUT} defaultValue="">
          <option value="">— Elegir —</option>
          {[...byCategory.entries()].map(([cat, list]) => (
            <optgroup key={cat} label={cat}>
              {list.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
        Detalle
        <input
          name="description"
          required
          maxLength={300}
          placeholder="Qué se compró y dónde: «Resmas y tóner, Librería X»"
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
        Comprobante (foto o PDF)
        <span className="flex items-center gap-2">
          <span className="tap inline-flex cursor-pointer items-center rounded-xl border border-black/10 bg-card px-3 py-2 text-[13px] font-semibold text-dark">
            {fileName ? "Cambiar" : "Sacar foto o elegir"}
            <input
              type="file"
              name="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </span>
          <span className="min-w-0 flex-1 truncate text-[12px] font-normal text-muted">
            {fileName ?? "Sin comprobante: la auditoría lo va a marcar."}
          </span>
        </span>
      </label>
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12.5px] text-rose-800">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="tap rounded-xl bg-terra px-4 py-2.5 text-[14px] font-semibold text-white shadow-card-soft disabled:opacity-60"
      >
        {busy ? "Guardando…" : "Agregar el gasto"}
      </button>
    </form>
  );
}

export function RemoveLineButton({ lineId }: { lineId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!confirm("¿Quitar este gasto de la rendición?")) return;
        setBusy(true);
        const fd = new FormData();
        fd.set("line_id", lineId);
        const res = await removeCashLineAction(fd);
        setBusy(false);
        if (!res.ok) alert(res.error);
        else router.refresh();
      }}
      className="text-[11.5px] font-semibold text-muted hover:text-rose-700"
    >
      Quitar
    </button>
  );
}

export function SubmitReportForm({
  reportId,
  expected,
  currencies,
}: {
  reportId: string;
  /** Lo que debería haber, por moneda, para mostrarlo al lado. */
  expected: Array<{ currency: string; label: string }>;
  currencies: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (!confirm("¿Enviar la rendición al tesorero? Después no se puede cambiar.")) return;
    setBusy(true);
    setError(null);
    const res = await submitCashReportAction(new FormData(e.currentTarget));
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="report_id" value={reportId} />
      <p className="text-[12.5px] text-muted">
        Contá la plata que te queda en la caja y anotala. La app la compara con lo que debería haber; si no
        coincide no pasa nada grave, el tesorero lo ve y lo ajusta.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {currencies.map((c) => (
          <label key={c} className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            {c === "UYU" ? "Pesos que hay" : "Dólares que hay"}
            <input name={c === "UYU" ? "counted_uyu" : "counted_usd"} inputMode="decimal" placeholder="0" className={INPUT} />
            <span className="text-[11px] font-normal">
              Debería haber {expected.find((x) => x.currency === c)?.label ?? "—"}
            </span>
          </label>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
        Nota para el tesorero (opcional)
        <textarea name="note" rows={2} maxLength={1000} className={INPUT} placeholder="Necesito reposición antes del sábado…" />
      </label>
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12.5px] text-rose-800">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="tap rounded-xl bg-gold-dark px-4 py-2.5 text-[14px] font-semibold text-white shadow-card-soft disabled:opacity-60"
      >
        {busy ? "Enviando…" : "Enviar la rendición"}
      </button>
    </form>
  );
}

const INPUT =
  "w-full rounded-xl border border-black/10 bg-card px-3 py-2 text-[14px] font-normal text-dark outline-none focus:border-terra";
