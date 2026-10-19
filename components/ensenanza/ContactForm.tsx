"use client";

import { useState, useTransition } from "react";
import type { ContactResult } from "@/lib/contact-requests";

export type ContactLocalityOption = { id: string; name: string; kind: string };

/**
 * "Quiero contactarme": nombre, teléfono, correo y mensaje. Lo usan el
 * folleto público (la persona elige su comunidad, o viene prefijada por
 * el link) y el segmento Contacto del hub (la comunidad es la de la
 * sesión y no se elige). El action lo pone quien monta, porque uno es
 * público y el otro exige sesión.
 */
export function ContactForm({
  action,
  localities,
  defaultLocalityId,
  lockedLocalityName,
  compact = false,
}: {
  action: (formData: FormData) => Promise<ContactResult>;
  /** Comunidades a elegir; vacío si la comunidad está fija. */
  localities?: ContactLocalityOption[];
  defaultLocalityId?: string | null;
  /** Nombre de la comunidad cuando viene fija (hub con sesión). */
  lockedLocalityName?: string;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ContactResult | null>(null);

  const ael = (localities ?? []).filter((l) => l.kind !== "nacional");
  const national = (localities ?? []).find((l) => l.kind === "nacional");

  if (result?.ok) {
    return (
      <div className="rounded-2xl bg-green/10 px-4 py-5 text-center">
        <div className="font-display text-[18px] font-semibold text-dark">¡Gracias!</div>
        <p className="mt-1 font-body text-[13px] leading-relaxed text-dark/80">
          Recibimos tus datos. Alguien de la comunidad se va a poner en contacto
          con vos en los próximos días.
        </p>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="tap mt-3 text-[12px] font-semibold text-terra"
        >
          Enviar otro
        </button>
      </div>
    );
  }

  const err = result && !result.ok ? result : null;

  return (
    <form
      action={(fd) => start(async () => setResult(await action(fd)))}
      className="space-y-3"
    >
      {!compact && (
        <p className="font-body text-[13px] leading-relaxed text-dark/80">
          Si querés conversar con alguien de la comunidad, conocer una actividad
          cerca tuyo o simplemente hacer una pregunta, dejanos tus datos. No es
          ningún compromiso.
        </p>
      )}

      {/* Trampa para bots: campo invisible que una persona no completa. */}
      <div className="hidden" aria-hidden="true">
        <label>
          Sitio web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {lockedLocalityName ? (
        <p className="text-[12px] text-muted">
          Comunidad: <span className="font-semibold text-dark">{lockedLocalityName}</span>
        </p>
      ) : (
        <Field label="Comunidad más cercana" error={err?.field === "locality" ? err.error : null}>
          <select
            name="locality_id"
            defaultValue={defaultLocalityId ?? ""}
            required
            className={inputCls}
          >
            <option value="" disabled>
              Elegí una…
            </option>
            {ael.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
            {national && (
              <option value={national.id}>Otra ciudad del Uruguay</option>
            )}
          </select>
        </Field>
      )}

      <Field label="Tu nombre" error={err?.field === "name" ? err.error : null}>
        <input name="name" required maxLength={120} autoComplete="name" className={inputCls} />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Teléfono" error={err?.field === "phone" ? err.error : null}>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            maxLength={40}
            autoComplete="tel"
            placeholder="099 123 456"
            className={inputCls}
          />
        </Field>
        <Field label="Correo" error={err?.field === "email" ? err.error : null}>
          <input
            name="email"
            type="email"
            inputMode="email"
            maxLength={160}
            autoComplete="email"
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="Mensaje (opcional)">
        <textarea
          name="message"
          rows={3}
          maxLength={2000}
          placeholder="¿Qué te gustaría saber? ¿Preferís que te llamen o que te escriban?"
          className={`${inputCls} resize-none`}
        />
      </Field>

      {err && !err.field && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{err.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="tap w-full rounded-2xl bg-terra px-4 py-3 text-[14px] font-semibold text-white shadow-card disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Quiero que me contacten"}
      </button>
      <p className="text-center text-[11px] leading-relaxed text-muted">
        Tus datos los ve solo quien atiende los contactos de esa comunidad y se
        usan únicamente para responderte.
      </p>
    </form>
  );
}

const inputCls =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 font-body text-[14px] text-dark outline-none focus:border-terra";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-dark">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[12px] text-rose-700">{error}</span>}
    </label>
  );
}
