"use client";

import { useEffect, useState } from "react";

/**
 * Aside reactivo: muestra su contenido solo cuando el evento es una
 * "Reunión AEL". Escucha el <select id="kind"> del formulario (que vive en
 * un Server Component hermano) para reaccionar al instante cuando se elige
 * el tipo, sin recargar. Pensado para PC (el padre lo oculta en mobile).
 */
export function EventAvailabilityAside({
  initialKind,
  className,
  children,
}: {
  initialKind: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [kind, setKind] = useState(initialKind);

  useEffect(() => {
    const select = document.getElementById("kind") as HTMLSelectElement | null;
    if (!select) return;
    setKind(select.value);
    const onChange = () => setKind(select.value);
    select.addEventListener("change", onChange);
    return () => select.removeEventListener("change", onChange);
  }, []);

  if (kind !== "reunion_ael") return null;
  return <aside className={className}>{children}</aside>;
}
