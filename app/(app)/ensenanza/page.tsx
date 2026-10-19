import Link from "next/link";
import { FolletoReader } from "@/components/ensenanza/FolletoReader";
import { GoldHeader } from "@/components/GoldHeader";
import { ENSENANZA_SEGMENTS, SegmentedNav } from "@/components/SegmentedNav";
import { requireMember } from "@/lib/auth";
import { getFolleto, LA_FE_LINKS } from "@/lib/la-fe";

/**
 * Enseñanza → La Fe: el folleto "Qué es la Fe Bahá'í", el mismo que la
 * pantalla pública /la-fe. Acá el creyente lo recorre como práctica; el
 * último capítulo lleva los links y el camino para que un simpatizante
 * deje sus datos (Contacto), en vez de repetir el formulario.
 */
export default async function EnsenanzaPage() {
  const session = await requireMember("/ensenanza");
  const chapters = getFolleto();

  return (
    <>
      <GoldHeader title="Enseñanza" subtitle={session.locality.name} backHref="/" />
      <SegmentedNav items={ENSENANZA_SEGMENTS} />
      <main className="scroll-area flex-1 px-4 pb-4 pt-1">
        <FolletoReader
          chapters={chapters}
          extra={{
            short: "Más",
            title: "Para seguir",
            content: (
              <div className="space-y-3">
                <p className="font-body text-[13.5px] leading-relaxed text-dark/85">
                  Este folleto es público: podés mandárselo a cualquier persona
                  desde <Link href="/ensenanza/compartir" className="font-semibold text-terra">Compartir</Link>,
                  junto con los sitios oficiales y el link para instalar la app.
                </p>
                <ul className="space-y-2">
                  <li>
                    <a href={LA_FE_LINKS.bahaiUy} target="_blank" rel="noopener" className="tap block rounded-xl bg-bg px-3.5 py-3">
                      <div className="text-[13.5px] font-semibold text-dark">bahai.uy</div>
                      <div className="text-[12px] text-muted">La comunidad bahá'í del Uruguay</div>
                    </a>
                  </li>
                  <li>
                    <a href={LA_FE_LINKS.bahaiOrg} target="_blank" rel="noopener" className="tap block rounded-xl bg-bg px-3.5 py-3">
                      <div className="text-[13.5px] font-semibold text-dark">bahai.org</div>
                      <div className="text-[12px] text-muted">El sitio internacional, con los Escritos en español</div>
                    </a>
                  </li>
                </ul>
                <Link
                  href="/ensenanza/contacto"
                  className="tap block rounded-2xl bg-terra px-4 py-3 text-center text-[14px] font-semibold text-white shadow-card"
                >
                  Alguien quiere que lo contacten
                </Link>
                <p className="text-center text-[11.5px] leading-relaxed text-muted">
                  Si la persona con la que hablás quiere que la comunidad la
                  llame, pasale el teléfono y que deje sus datos.
                </p>
              </div>
            ),
          }}
        />
      </main>
    </>
  );
}
