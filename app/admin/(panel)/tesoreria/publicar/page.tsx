import { Banner, Button, Card, Checkbox, PageHeader } from "@/components/admin/ui";
import { PublishedTreasury } from "@/components/treasury/PublishedTreasury";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatReceiptDate } from "@/lib/treasury-format";
import { todayISO } from "@/lib/treasury-ledger";
import {
  formatStamp,
  publicationLabel,
} from "@/lib/treasury-publication-content";
import {
  getCurrentPublication,
  getPublicationDraft,
  lastClosedMonthEnd,
  listPublications,
} from "@/lib/treasury-publications";
import {
  calculatePublicationAction,
  discardPublicationDraftAction,
  sharePublicationAction,
} from "./actions";

export const dynamic = "force-dynamic";

/**
 * Tesorería → Publicar (066): el ÚNICO lugar donde se arma lo que la
 * comunidad ve de la Tesorería. Dos pasos: "Calcular" (borrador, solo lo
 * ve el tesorero) y "Compartir" (lo publica tal cual). /tesoreria, la
 * Fiesta, el deck y el folleto leen la última foto compartida.
 */
export default async function PublicarPage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);

  const supabase = createSupabaseServer();
  const today = todayISO();
  const closed = lastClosedMonthEnd(today);

  const [{ draft, schemaMissing }, current, history] = await Promise.all([
    getPublicationDraft(supabase, session.locality.id),
    getCurrentPublication(supabase, session.locality.id),
    listPublications(supabase, session.locality.id),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Publicar el estado del Fondo"
        description="Lo que la comunidad ve de la Tesorería —en la app y en la Fiesta— sale de acá y de ningún otro lado. Calculá, revisá y compartí: la gente lo ve con la fecha en que lo compartiste, y no cambia hasta que vuelvas a hacerlo."
      />

      {schemaMissing && (
        <div className="mb-4">
          <Banner tone="warning">
            Falta aplicar la migración <strong>066</strong> en Supabase. Hasta
            entonces no se puede calcular ni compartir.
          </Banner>
        </div>
      )}

      <Card className="mb-5">
        <h2 className="text-[15px] font-semibold text-dark">1 · Calcular</h2>
        <p className="mt-1 text-[12.5px] text-muted">
          Se arma desde el libro con los movimientos hasta la fecha que elijas.
          Todavía no lo ve nadie más que vos.
        </p>
        <form action={calculatePublicationAction} className="mt-4">
          <input type="hidden" name="preset" value="today" />
          <Button type="submit" variant={draft ? "secondary" : "primary"}>
            Hasta hoy ({formatReceiptDate(today)})
          </Button>
        </form>
        {closed && (
          <form action={calculatePublicationAction} className="mt-2.5">
            <input type="hidden" name="preset" value="month" />
            <Button type="submit" variant="secondary">
              Hasta el fin de {closed.name} ({formatReceiptDate(closed.date)}) — para la Fiesta
            </Button>
          </form>
        )}
        <form action={calculatePublicationAction} className="mt-2.5 flex flex-wrap items-center gap-2">
          <input type="hidden" name="preset" value="custom" />
          <label className="text-[12.5px] text-muted" htmlFor="custom_date">
            Otra fecha:
          </label>
          <input
            id="custom_date"
            type="date"
            name="custom_date"
            max={today}
            required
            className="rounded-lg border border-black/10 bg-card px-2.5 py-1.5 text-[13px] text-dark"
          />
          <Button type="submit" variant="ghost">
            Calcular
          </Button>
        </form>
      </Card>

      {draft && (
        <Card className="mb-5 border-terra/30">
          <h2 className="text-[15px] font-semibold text-dark">2 · Revisar y compartir</h2>
          <p className="mt-1 text-[12.5px] text-muted">
            Así lo va a ver la comunidad. Calculado el {formatStamp(draft.calculated_at)}.
            Si cargás un movimiento ahora, este cálculo no lo incluye: volvé a calcular.
          </p>
          <div className="mt-4 rounded-2xl bg-bg p-3 sm:p-5">
            <PublishedTreasury publication={draft} />
          </div>
          <form action={sharePublicationAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="id" value={draft.id} />
            <Checkbox
              name="notify"
              label="Avisar a la comunidad con una notificación"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Compartir con la comunidad</Button>
              <Button type="submit" variant="ghost" formAction={discardPublicationDraftAction}>
                Descartar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <h2 className="text-[15px] font-semibold text-dark">Lo que la comunidad ve hoy</h2>
        {current ? (
          <p className="mt-1 text-[12.5px] text-muted">{publicationLabel(current)}.</p>
        ) : (
          <p className="mt-1 text-[12.5px] text-muted">
            Todavía no se compartió nada: en la app dice que la Tesorería no
            publicó el estado del Fondo.
          </p>
        )}
        {history.length > 1 && (
          <>
            <h3 className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-muted">
              Compartidos antes
            </h3>
            <ul className="mt-1.5 divide-y divide-black/[0.05] text-[12.5px] text-dark">
              {history.slice(1).map((p) => (
                <li key={p.id} className="py-1.5">
                  {publicationLabel(p)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11.5px] text-muted">
              Cada Fiesta muestra el que estaba vigente cuando la Asamblea la
              inició.
            </p>
          </>
        )}
      </Card>
    </>
  );
}
