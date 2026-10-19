import { Banner, Button, PageHeader } from "@/components/admin/ui";
import { ConfirmSubmit } from "../miembros/confirm-submit";
import { ensureChatTag, requireAdmin } from "@/lib/auth";
import { whatsappLink } from "@/lib/commitment-whatsapp";
import { getContactRequests, type ContactRequest } from "@/lib/contact-requests";
import { formatDateTime } from "@/lib/format";
import {
  deleteContactAction,
  saveContactNotesAction,
  setContactStatusAction,
} from "./actions";

/**
 * Comunicación → Contactos: quién dejó sus datos desde el folleto público
 * "Qué es la Fe Bahá'í" (o desde Enseñanza → Contacto, con el teléfono
 * prestado) pidiendo que alguien de la comunidad lo llame. Lo ve quien
 * atiende el chat de Secretaría, que es a quien le llegó el push (080).
 * Dos grupos: por atender y atendidos; una nota libre para anotar cómo
 * siguió, y eliminar para lo que fue broma o error.
 */
export default async function ContactosPage() {
  const session = await requireAdmin();
  ensureChatTag(session.profile);
  const { rows, schemaMissing } = await getContactRequests();
  const nuevos = rows.filter((r) => r.status === "nuevo");
  const atendidos = rows.filter((r) => r.status === "atendido");

  return (
    <>
      <PageHeader
        eyebrow="Comunicación"
        title="Contactos"
        description="Personas que dejaron sus datos desde el folleto «Qué es la Fe Bahá'í» pidiendo que la comunidad las contacte. Quien atiende el chat de Secretaría recibe el aviso."
      />

      {schemaMissing && (
        <div className="mb-4">
          <Banner tone="warning">
            Falta aplicar la migración 080 en la base: hasta entonces no se
            reciben pedidos de contacto.
          </Banner>
        </div>
      )}

      <Section title="Por atender" count={nuevos.length} empty="No hay pedidos nuevos.">
        {nuevos.map((r) => (
          <ContactCard key={r.id} r={r} />
        ))}
      </Section>

      <Section title="Atendidos" count={atendidos.length} empty="Todavía no se atendió ninguno.">
        {atendidos.map((r) => (
          <ContactCard key={r.id} r={r} />
        ))}
      </Section>
    </>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
        {title} · {count}
      </h2>
      {count === 0 ? (
        <p className="rounded-2xl bg-card px-4 py-5 text-center text-[13px] text-muted shadow-card">
          {empty}
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">{children}</div>
      )}
    </section>
  );
}

function ContactCard({ r }: { r: ContactRequest }) {
  const isNew = r.status === "nuevo";
  const wa = whatsappLink(
    r.phone,
    `Hola ${r.name.split(" ")[0]}, te escribo de la comunidad bahá'í. Dejaste tus datos en el folleto de la Fe y me gustaría conversar cuando puedas.`
  );
  return (
    <article className="rounded-2xl border border-black/[0.04] bg-card p-4 shadow-card md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-[17px] font-semibold text-dark">{r.name}</div>
          <div className="mt-0.5 text-[12px] text-muted">
            {formatDateTime(r.created_at)} ·{" "}
            {r.source === "app" ? "desde la app de un creyente" : "desde el folleto"}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${
            isNew ? "bg-amber-100 text-amber-800" : "bg-green/15 text-green"
          }`}
        >
          {isNew ? "Nuevo" : "Atendido"}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        {r.phone && (
          <>
            <dt className="text-muted">Teléfono</dt>
            <dd className="font-medium text-dark">
              <a href={`tel:${r.phone}`} className="hover:underline">
                {r.phone}
              </a>
              {wa && (
                <>
                  {" · "}
                  <a href={wa} target="_blank" rel="noopener" className="font-semibold text-terra hover:underline">
                    WhatsApp
                  </a>
                </>
              )}
            </dd>
          </>
        )}
        {r.email && (
          <>
            <dt className="text-muted">Correo</dt>
            <dd className="font-medium text-dark">
              <a href={`mailto:${r.email}`} className="hover:underline">
                {r.email}
              </a>
            </dd>
          </>
        )}
      </dl>

      {r.message && (
        <blockquote className="mt-3 whitespace-pre-line rounded-xl bg-bg px-3.5 py-2.5 text-[13px] leading-relaxed text-dark/85">
          {r.message}
        </blockquote>
      )}

      <form action={saveContactNotesAction} className="mt-3">
        <input type="hidden" name="id" value={r.id} />
        <label className="block text-[12px] font-semibold text-dark">
          Cómo siguió
          <textarea
            name="notes"
            rows={2}
            maxLength={2000}
            defaultValue={r.notes ?? ""}
            placeholder="Lo llamé el martes, viene a la devocional del sábado…"
            className="mt-1 w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] font-normal text-dark outline-none focus:border-terra"
          />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="submit" variant="secondary">
            Guardar nota
          </Button>
          <Button type="submit" variant={isNew ? "primary" : "ghost"} formAction={setContactStatusAction}>
            {isNew ? "Marcar atendido" : "Volver a nuevo"}
          </Button>
          <input type="hidden" name="status" value={isNew ? "atendido" : "nuevo"} />
          <ConfirmSubmit
            message={`¿Eliminar el pedido de ${r.name}? No se puede deshacer.`}
            formAction={deleteContactAction}
            className="ml-auto rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] font-semibold text-rose-700 hover:bg-rose-100"
          >
            Eliminar
          </ConfirmSubmit>
        </div>
      </form>
    </article>
  );
}
