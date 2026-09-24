import Link from "next/link";
import { GoldHeader } from "@/components/GoldHeader";
import { IconChat, IconChevronRight } from "@/components/Icons";
import { AEL_SEGMENTS, SegmentedNav } from "@/components/SegmentedNav";
import { PublishedTreasury } from "@/components/treasury/PublishedTreasury";
import { ScrollToHash } from "@/components/comunicados/ScrollToHash";
import { requireBahai } from "@/lib/auth";
import { getTreasury } from "@/lib/data";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentPublication } from "@/lib/treasury-publications";
import type { TreasuryCommitment } from "@/lib/types";
import { CommitmentSection } from "./commitment-section";

// La Tesorería contiene información reservada — solo miembros autenticados.
export const revalidate = 60;

export default async function TesoreriaPage() {
  const session = await requireBahai("/tesoreria");
  const supabase = createSupabaseServer();

  const [t, publication, { data: commitment }] = await Promise.all([
    getTreasury(),
    // El estado del Fondo es lo que el tesorero CALCULÓ Y COMPARTIÓ en
    // Tesorería → Publicar (066), con su fecha. No se recalcula acá: si
    // cada pantalla sumara por su cuenta, la app volvería a decir cosas
    // distintas en lugares distintos.
    getCurrentPublication(supabase, session.locality.id),
    // El compromiso es con el Fondo de LA comunidad que se tiene puesta
    // (063): quien pertenece a su AEL y a la Comunidad Nacional sostiene
    // uno con cada una, y acá se edita el de esta.
    supabase
      .from("treasury_commitments")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("locality_id", session.locality.id)
      .maybeSingle(),
  ]);

  return (
    <>
      <GoldHeader title="Institucional" subtitle={session.locality.name} backHref="/" />
      <SegmentedNav items={AEL_SEGMENTS} />
      <main className="scroll-area flex-1 px-4 pt-4">
        {/* "Mis aportes" enlaza a #compromiso, al pie de la pantalla. */}
        <ScrollToHash />
        {publication ? (
          <div className="mb-3.5">
            <PublishedTreasury publication={publication} />
          </div>
        ) : (
          <div className="mb-3.5 rounded-[20px] bg-card p-5 text-center text-[12.5px] text-muted shadow-card-elevated">
            La Tesorería todavía no compartió el estado del Fondo.
          </div>
        )}

        {/* Contribution methods */}
        <div className="mb-3.5">
          <h2 className="mb-2.5 text-[14px] font-semibold text-dark">
            Cómo aportar
          </h2>
          {/* Los medios de pago salen de la ficha vieja (`treasury`); si la
              comunidad no la cargó, no se muestra nada en vez de un ejemplo.
              Es un dato fijo, no un cálculo: por eso no va en la foto. */}
          {t && t.methods.length > 0 && (
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
          )}

          {/* Un giro a la cuenta no le dice al tesorero de quién es ni a qué
              fondo va. Este es el atajo para avisarle, acá donde la persona
              se acuerda. */}
          <Link
            href="/chat/tesoreria"
            className="tap mt-2.5 flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-card-soft"
          >
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] bg-terra/10 text-terra">
              <IconChat size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-dark">
                ¿Hiciste un giro a la cuenta?
              </div>
              <div className="mt-0.5 font-body text-[10.5px] text-muted">
                Avisale al tesorero en privado: fecha, monto y destino.
              </div>
            </div>
            <IconChevronRight size={14} className="shrink-0 text-muted" />
          </Link>
        </div>

        {/* Compromiso mensual del miembro logueado */}
        <CommitmentSection
          defaultName={session.profile.full_name ?? ""}
          localityName={session.locality.name}
          commitment={(commitment as TreasuryCommitment | null) ?? null}
        />
      </main>
    </>
  );
}
