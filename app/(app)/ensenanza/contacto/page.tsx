import { ContactForm } from "@/components/ensenanza/ContactForm";
import { GoldHeader } from "@/components/GoldHeader";
import { ENSENANZA_SEGMENTS, SegmentedNav } from "@/components/SegmentedNav";
import { requireMember } from "@/lib/auth";
import { submitContactFromAppAction } from "./actions";

/**
 * Enseñanza → Contacto: el formulario "Quiero contactarme" para completar
 * con el teléfono prestado. Es el mismo del folleto público, con la
 * comunidad fija en la de quien lo muestra.
 */
export default async function ContactoPage() {
  const session = await requireMember("/ensenanza/contacto");
  return (
    <>
      <GoldHeader title="Enseñanza" subtitle={session.locality.name} backHref="/" />
      <SegmentedNav items={ENSENANZA_SEGMENTS} />
      <main className="scroll-area flex-1 px-4 pb-4 pt-1">
        <div className="rounded-2xl bg-card p-5 shadow-card-soft">
          <h1 className="font-display text-[20px] font-semibold text-dark">
            Quiero contactarme
          </h1>
          <p className="mb-4 mt-1 font-body text-[13px] leading-relaxed text-muted">
            Para la persona con la que estás hablando: si quiere que alguien de
            la comunidad la llame o le escriba, que deje acá sus datos. Le
            llegan a quien atiende la Secretaría de {session.locality.name}.
          </p>
          <ContactForm
            action={submitContactFromAppAction}
            lockedLocalityName={session.locality.name}
            compact
          />
        </div>
      </main>
    </>
  );
}
