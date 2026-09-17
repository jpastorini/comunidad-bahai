"use client";

import { useRef } from "react";
import { switchLocalityAction } from "@/app/(app)/perfil/actions";
import type { Membership } from "@/lib/memberships";

type Props = {
  /** Comunidades entre las que se puede cambiar, la activa incluida. */
  memberships: Membership[];
  /** A dónde volver después de cambiar (el panel o la app). */
  redirectTo: string;
  /** Clases del texto: el selector se disfraza del título que reemplaza. */
  className?: string;
  /** El nombre que se muestra cuando hay una sola comunidad. */
  fallback: string;
};

/**
 * El selector de comunidad activa (058-b).
 *
 * Vive donde antes había un título fijo —el encabezado dorado del panel
 * y el del Inicio— porque ese nombre NO era una etiqueta: es el control
 * más importante de la pantalla. Decide qué Asamblea estás
 * administrando, qué comunicados ves, qué Tesorería, y qué significan
 * los permisos que marcás en la ficha de un creyente. Estaba dicho en el
 * lugar correcto y con la forma equivocada.
 *
 * Con una sola comunidad —el caso de casi toda la comunidad— no hay
 * selector: se imprime el nombre y listo.
 *
 * Es un <select> nativo a propósito: en el celular abre la rueda del
 * sistema, que es más cómoda que cualquier menú propio, y no hay que
 * resolver el foco ni el tap-afuera.
 */
export function CommunitySwitcher({
  memberships,
  redirectTo,
  className = "",
  fallback,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const active = memberships.find((m) => m.isActive);

  if (memberships.length < 2) {
    return <span className={className}>{active?.name ?? fallback}</span>;
  }

  return (
    <form action={switchLocalityAction} ref={formRef} className="relative">
      <input type="hidden" name="redirect_to" value={redirectTo} />
      <select
        name="locality_id"
        defaultValue={active?.localityId ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        aria-label="Cambiar de comunidad"
        className={`w-full cursor-pointer appearance-none bg-transparent pr-6 outline-none ${className}`}
      >
        {memberships.map((m) => (
          <option key={m.localityId} value={m.localityId} className="text-dark">
            {m.name}
          </option>
        ))}
      </select>
      {/* El chevron va aparte: un <select> con appearance-none pierde el
          suyo, y sin ninguna pista visual el título no se lee como algo
          que se puede tocar. */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-70"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </form>
  );
}
