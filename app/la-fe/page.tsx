import type { Metadata } from "next";
import { BahaiStar } from "@/components/BahaiStar";
import { ContactForm } from "@/components/ensenanza/ContactForm";
import { FolletoReader } from "@/components/ensenanza/FolletoReader";
import { getContactLocalities } from "@/lib/contact-requests";
import { getFolleto, LA_FE_LINKS, PHOTO_CREDIT } from "@/lib/la-fe";
import { submitPublicContactAction } from "./actions";

/**
 * "Qué es la Fe Bahá'í", PÚBLICO (sin login): el folleto que un creyente
 * le manda a un simpatizante por WhatsApp o le muestra con el QR de
 * Enseñanza → Compartir. Es material de enseñanza, no hay nada reservado.
 * `?c=<localidad>` prefija la comunidad del formulario de contacto.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Qué es la Fe Bahá'í — Comunidad Bahá'í del Uruguay",
  description:
    "Una introducción breve a la Fe Bahá'í: Bahá'u'lláh, lo que creen y lo que hacen los bahá'ís, y cómo acercarse a la comunidad en Uruguay.",
};

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default async function LaFePage({
  searchParams,
}: {
  searchParams: { c?: string };
}) {
  const chapters = getFolleto();
  const localities = await getContactLocalities();
  const preset = searchParams.c && UUID_RE.test(searchParams.c) ? searchParams.c : null;
  const presetOk = preset && localities.some((l) => l.id === preset) ? preset : null;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md px-4 pb-10 pt-6">
      <header className="mb-4 flex items-center gap-2.5">
        <BahaiStar size={26} color="#96790E" />
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[2px] text-gold-dark">
            Comunidad Bahá'í
          </div>
          <div className="font-display text-[15px] font-semibold leading-tight text-dark">
            Qué es la Fe Bahá'í
          </div>
        </div>
      </header>

      <FolletoReader
        chapters={chapters}
        extra={{
          short: "Contacto",
          title: "Quiero saber más",
          content: (
            <div className="space-y-5">
              <ul className="space-y-2">
                <li>
                  <a href={LA_FE_LINKS.bahaiUy} target="_blank" rel="noopener" className="tap block rounded-xl bg-bg px-3.5 py-3">
                    <div className="text-[13.5px] font-semibold text-dark">bahai.uy</div>
                    <div className="text-[12px] text-muted">La comunidad bahá'í del Uruguay</div>
                  </a>
                </li>
                <li>
                  <a href={LA_FE_LINKS.bahaiOrg} target="_blank" rel="noopener" className="tap block rounded-xl bg-bg px-3.5 py-3">
                    <div className="text-[13.5px] font-semibold text-dark">bahai.org/es</div>
                    <div className="text-[12px] text-muted">El sitio internacional, con los Escritos en español</div>
                  </a>
                </li>
              </ul>
              <div>
                <h2 className="mb-2 font-display text-[18px] font-semibold text-dark">
                  Quiero contactarme
                </h2>
                <ContactForm
                  action={submitPublicContactAction}
                  localities={localities}
                  defaultLocalityId={presetOk}
                />
              </div>
            </div>
          ),
        }}
      />

      <footer className="mt-8 text-center text-[11px] leading-relaxed text-muted">
        Comunidad Bahá'í del Uruguay · Las citas son de los Escritos bahá'ís,
        tomadas de la compilación «La Fuente de Todo Bien». {PHOTO_CREDIT}.
      </footer>
    </div>
  );
}
