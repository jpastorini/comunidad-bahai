"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { compressImage } from "@/components/gallery/compress-image";
import {
  ACCEPTED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  attachmentsSum,
  isAcceptedAttachment,
  type SignedAttachment,
} from "@/lib/treasury-attachments";
import { formatMoney, parseMoney } from "@/lib/treasury-format";
import {
  deleteAttachmentAction,
  listAttachmentsAction,
  updateAttachmentAction,
  uploadAttachmentAction,
} from "@/app/admin/(panel)/tesoreria/libro/attachment-actions";

/**
 * Comprobantes de un movimiento: las facturas del gasto.
 *
 * El caso que lo justifica: una Fiesta cuesta $ 3.500 y son tres
 * facturas —arreglos, comida, invitaciones—. El libro sigue viendo UNA
 * línea de $ 3.500; cada factura puede declarar su monto y su concepto,
 * y el panel avisa si no suman el total. Es un aviso, no un candado:
 * una factura puede traer un ítem que no corresponde, y el tesorero
 * sabe mejor que la app cuándo eso está bien.
 *
 * Dos modos, según exista o no el movimiento:
 *  · Edición (`entryId`): cada archivo se sube apenas se elige.
 *  · Alta (`entryId` null): los archivos quedan en espera y los sube el
 *    formulario con `uploadPending()` cuando el movimiento ya tiene id.
 */

export type AttachmentsHandle = {
  /** Cuántos archivos esperan a que exista el movimiento. */
  pendingCount: () => number;
  /** Sube los pendientes al movimiento recién creado. Devuelve el error
   *  del primero que falle, o null si fueron todos. */
  uploadPending: (entryId: string) => Promise<string | null>;
};

type Pending = {
  key: string;
  file: File;
  previewUrl: string | null;
  amount: string;
  label: string;
};

type Props = {
  /** null mientras el movimiento no existe todavía. */
  entryId: string | null;
  /** Monto del movimiento, para cuadrar el desglose. */
  entryAmount: number | null;
  currency: string;
};

export const AttachmentsPanel = forwardRef<AttachmentsHandle, Props>(
  function AttachmentsPanel({ entryId, entryAmount, currency }, ref) {
    const [saved, setSaved] = useState<SignedAttachment[]>([]);
    const [pending, setPending] = useState<Pending[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pickerRef = useRef<HTMLInputElement>(null);
    const cameraRef = useRef<HTMLInputElement>(null);

    const reload = useCallback(async () => {
      if (!entryId) return;
      const res = await listAttachmentsAction(entryId);
      if (res.ok) setSaved(res.attachments);
    }, [entryId]);

    useEffect(() => {
      void reload();
    }, [reload]);

    // Las previsualizaciones son object URLs: si no se revocan, los
    // archivos quedan retenidos en memoria toda la sesión de carga.
    const pendingRef = useRef<Pending[]>([]);
    pendingRef.current = pending;
    useEffect(() => {
      return () => {
        for (const p of pendingRef.current) {
          if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
        }
      };
    }, []);

    useImperativeHandle(ref, () => ({
      pendingCount: () => pending.length,
      async uploadPending(newEntryId: string) {
        for (const item of pending) {
          const fd = new FormData();
          fd.set("entry_id", newEntryId);
          fd.set("file", item.file, item.file.name);
          if (item.amount.trim()) fd.set("amount", item.amount.trim());
          if (item.label.trim()) fd.set("label", item.label.trim());
          const res = await uploadAttachmentAction(fd);
          if (!res.ok) return res.error;
        }
        for (const p of pending) {
          if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
        }
        setPending([]);
        return null;
      },
    }));

    /** Prepara un archivo: valida, comprime si es imagen, arma la vista
     *  previa. Los PDF viajan tal cual. */
    async function prepare(file: File): Promise<Pending | string> {
      if (!isAcceptedAttachment(file.type)) {
        return `"${file.name}" no es una imagen ni un PDF.`;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        return `"${file.name}" supera los ${Math.round(
          MAX_ATTACHMENT_BYTES / (1024 * 1024)
        )} MB.`;
      }
      let out = file;
      if (file.type.startsWith("image/")) {
        try {
          out = await compressImage(file);
        } catch {
          // Si el navegador no pudo comprimir, va el original.
        }
      }
      return {
        key: `${file.name}-${file.lastModified}-${Math.random()}`,
        file: out,
        previewUrl: out.type.startsWith("image/")
          ? URL.createObjectURL(out)
          : null,
        amount: "",
        label: "",
      };
    }

    async function onFilesPicked(list: FileList | null) {
      if (!list || list.length === 0) return;
      setBusy(true);
      setError(null);

      const prepared: Pending[] = [];
      for (const file of Array.from(list)) {
        const result = await prepare(file);
        if (typeof result === "string") {
          setError(result);
          continue;
        }
        prepared.push(result);
      }

      if (entryId) {
        // Movimiento existente: se suben ya. El monto y el concepto se
        // completan después, sobre la fila.
        for (const item of prepared) {
          const fd = new FormData();
          fd.set("entry_id", entryId);
          fd.set("file", item.file, item.file.name);
          const res = await uploadAttachmentAction(fd);
          if (!res.ok) setError(res.error);
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        }
        await reload();
      } else {
        setPending((prev) => [...prev, ...prepared]);
      }

      setBusy(false);
      if (pickerRef.current) pickerRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }

    async function saveMeta(id: string, amount: string, label: string) {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("amount", amount.trim());
      fd.set("label", label.trim());
      const res = await updateAttachmentAction(fd);
      if (!res.ok) setError(res.error);
      else await reload();
    }

    async function removeSaved(id: string) {
      setBusy(true);
      const fd = new FormData();
      fd.set("id", id);
      const res = await deleteAttachmentAction(fd);
      setBusy(false);
      if (!res.ok) setError(res.error);
      else await reload();
    }

    function removePending(key: string) {
      setPending((prev) => {
        const gone = prev.find((p) => p.key === key);
        if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
        return prev.filter((p) => p.key !== key);
      });
    }

    const declared = attachmentsSum([
      ...saved.map((a) => ({ amount: a.amount })),
      ...pending.map((p) => {
        const n = p.amount.trim() ? parseMoney(p.amount) : NaN;
        return { amount: Number.isFinite(n) ? n : null };
      }),
    ]);
    const total = saved.length + pending.length;
    const gap =
      declared !== null && entryAmount !== null ? declared - entryAmount : null;

    return (
      <div className="rounded-xl border border-black/[0.08] bg-bg/30 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10.5px] uppercase tracking-wide text-muted">
            Comprobantes
            {total > 0 && (
              <span className="ml-1 font-semibold text-dark">{total}</span>
            )}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => cameraRef.current?.click()}
              className="tap rounded-lg border border-black/10 bg-card px-2.5 py-1.5 text-[11.5px] font-semibold text-dark hover:bg-bg disabled:opacity-60 sm:hidden"
            >
              Sacar foto
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => pickerRef.current?.click()}
              className="tap rounded-lg border border-black/10 bg-card px-2.5 py-1.5 text-[11.5px] font-semibold text-dark hover:bg-bg disabled:opacity-60"
            >
              {busy ? "Subiendo…" : "Adjuntar factura"}
            </button>
          </div>
        </div>

        {/* Dos inputs: el de la cámara abre directo la cámara trasera en
            el teléfono; el otro deja elegir del carrete o del disco. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void onFilesPicked(e.target.files)}
        />
        <input
          ref={pickerRef}
          type="file"
          accept={ACCEPTED_ATTACHMENT_TYPES}
          multiple
          className="hidden"
          onChange={(e) => void onFilesPicked(e.target.files)}
        />

        {total === 0 ? (
          <p className="text-[11.5px] leading-snug text-muted">
            Foto o PDF de la factura. Si el gasto junta varias, adjuntá una por
            cada una y anotales el monto.
          </p>
        ) : (
          <ul className="space-y-2">
            {saved.map((a) => (
              <Row
                key={a.id}
                fileName={a.file_name}
                mime={a.mime_type}
                previewUrl={a.url}
                href={a.url}
                amount={a.amount === null ? "" : String(a.amount)}
                label={a.label ?? ""}
                currency={currency}
                onCommit={(amount, label) => void saveMeta(a.id, amount, label)}
                onRemove={() => void removeSaved(a.id)}
              />
            ))}
            {pending.map((p) => (
              <Row
                key={p.key}
                fileName={p.file.name}
                mime={p.file.type}
                previewUrl={p.previewUrl}
                href={p.previewUrl}
                amount={p.amount}
                label={p.label}
                currency={currency}
                waiting
                onCommit={(amount, label) =>
                  setPending((prev) =>
                    prev.map((x) =>
                      x.key === p.key ? { ...x, amount, label } : x
                    )
                  )
                }
                onRemove={() => removePending(p.key)}
              />
            ))}
          </ul>
        )}

        {/* Cuadre del desglose. Solo aparece cuando alguna factura declara
            monto: sin montos no hay nada que cuadrar. */}
        {gap !== null && declared !== null && entryAmount !== null && (
          <p
            className={`mt-2 text-[11.5px] ${
              Math.abs(gap) < 0.01 ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {Math.abs(gap) < 0.01 ? "✓ " : "⚠ "}
            Las facturas suman {formatMoney(declared, currency)} y el movimiento
            es de {formatMoney(entryAmount, currency)}
            {Math.abs(gap) >= 0.01 &&
              ` — ${gap > 0 ? "sobran" : "faltan"} ${formatMoney(
                Math.abs(gap),
                currency
              )}`}
            .
          </p>
        )}

        {pending.length > 0 && (
          <p className="mt-2 text-[11px] text-muted">
            {pending.length === 1
              ? "El comprobante se sube al guardar el movimiento."
              : "Los comprobantes se suben al guardar el movimiento."}
          </p>
        )}

        {error && (
          <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11.5px] text-rose-700">
            {error}
          </p>
        )}
      </div>
    );
  }
);

function Row({
  fileName,
  mime,
  previewUrl,
  href,
  amount,
  label,
  currency,
  waiting = false,
  onCommit,
  onRemove,
}: {
  fileName: string;
  mime: string;
  previewUrl: string | null;
  href: string | null;
  amount: string;
  label: string;
  currency: string;
  waiting?: boolean;
  onCommit: (amount: string, label: string) => void;
  onRemove: () => void;
}) {
  const [amountText, setAmountText] = useState(amount);
  const [labelText, setLabelText] = useState(label);

  // Si el servidor devolvió otro valor (o se recargó la lista), gana él.
  useEffect(() => setAmountText(amount), [amount]);
  useEffect(() => setLabelText(label), [label]);

  const isPdf = mime === "application/pdf";

  return (
    <li className="flex items-center gap-2 rounded-lg border border-black/[0.06] bg-card p-1.5">
      <Thumb previewUrl={previewUrl} href={href} isPdf={isPdf} name={fileName} />

      <div className="flex min-w-0 flex-1 gap-1.5">
        <input
          type="text"
          value={labelText}
          onChange={(e) => setLabelText(e.target.value)}
          onBlur={() => onCommit(amountText, labelText)}
          placeholder="Concepto"
          className="min-w-0 flex-1 rounded-lg border border-black/10 bg-bg/40 px-2 py-1.5 text-[12px] text-dark outline-none focus:border-terra"
        />
        <div className="relative w-[116px] shrink-0">
          <input
            type="text"
            inputMode="decimal"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            onBlur={() => onCommit(amountText, labelText)}
            placeholder="Monto"
            className="w-full rounded-lg border border-black/10 bg-bg/40 py-1.5 pl-2 pr-9 text-right text-[12px] tabular-nums text-dark outline-none focus:border-terra"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">
            {currency}
          </span>
        </div>
      </div>

      {waiting && (
        <span
          className="shrink-0 text-[10px] text-muted"
          title="Se sube al guardar el movimiento"
        >
          ⏳
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar ${fileName}`}
        title="Quitar"
        className="tap shrink-0 rounded-lg px-1.5 py-1 text-[15px] leading-none text-muted hover:bg-rose-50 hover:text-rose-700"
      >
        ×
      </button>
    </li>
  );
}

/** Miniatura clicleable. Los PDF no llevan vista previa; el recuadro
 *  igual abre el archivo. */
function Thumb({
  previewUrl,
  href,
  isPdf,
  name,
}: {
  previewUrl: string | null;
  href: string | null;
  isPdf: boolean;
  name: string;
}) {
  const inner =
    previewUrl && !isPdf ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={previewUrl}
        alt={name}
        className="h-11 w-11 rounded-md object-cover"
      />
    ) : (
      <span className="flex h-11 w-11 items-center justify-center rounded-md bg-bg text-[9px] font-semibold uppercase text-muted">
        {isPdf ? "PDF" : "···"}
      </span>
    );

  if (!href) return <span className="shrink-0">{inner}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Abrir ${name}`}
      className="shrink-0"
    >
      {inner}
    </a>
  );
}
