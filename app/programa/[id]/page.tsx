import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FeastDeck } from "@/components/feast/FeastDeck";
import { loadFeastProgram } from "@/lib/feast-program-server";

/**
 * El programa de la Fiesta como presentación, a pantalla completa. Vive
 * FUERA de los grupos (app) y (panel) a propósito: la TabBar o el
 * sidebar taparían la diapositiva. Una sola ruta para la Asamblea (que
 * proyecta) y para el creyente (que lo sigue en el celular); quién ve
 * qué lo decide loadFeastProgram().
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const res = await loadFeastProgram(params.id);
  if (res.kind !== "ok") return { title: "Fiesta de los Diecinueve Días" };
  const p = res.program;
  return {
    title: `Fiesta de ${p.monthName} · ${p.bahaiYear} E.B. — ${p.localityName}`,
  };
}

export default async function ProgramaPage({
  params,
}: {
  params: { id: string };
}) {
  const res = await loadFeastProgram(params.id);
  if (res.kind === "not-found") notFound();
  if (res.kind === "not-started") redirect(`/fiestas/${params.id}`);

  const backHref = res.isAdmin
    ? `/admin/fiestas/${params.id}`
    : `/fiestas/${params.id}`;

  return (
    <FeastDeck
      program={res.program}
      backHref={backHref}
      pdfHref={`/programa/${params.id}/pdf`}
    />
  );
}
