import { GoldHeader } from "@/components/GoldHeader";
import { IconMateriales } from "@/components/Icons";
import { OracionDelMesCard } from "@/components/materials/OracionDelMesCard";
import { BIBLIOTECA_SEGMENTS, SegmentedNav } from "@/components/SegmentedNav";
import { requireMember } from "@/lib/auth";
import {
  getEscritos,
  getLatestOracionDelMes,
  getLibros,
  getOracionesDelMes,
  getRuhiBooks,
} from "@/lib/data";
import { formatMessageDate } from "@/lib/format";

export const revalidate = 60;

export default async function MaterialesPage() {
  const [session, ruhi, otros, libros, latestOracion, allOraciones] =
    await Promise.all([
      requireMember("/materiales"),
      getRuhiBooks(),
      getEscritos(),
      getLibros(),
      getLatestOracionDelMes(),
      getOracionesDelMes(),
    ]);

  // Past oraciones (excluyendo la actual destacada arriba).
  const pastOraciones = latestOracion
    ? allOraciones.filter((o) => o.id !== latestOracion.id)
    : allOraciones;

  return (
    <>
      <GoldHeader title="Biblioteca" subtitle={session.locality.name} backHref="/" />
      <SegmentedNav items={BIBLIOTECA_SEGMENTS} />
      <main className="scroll-area flex-1 px-4 pb-4 pt-1">
        {latestOracion && <OracionDelMesCard oracion={latestOracion} />}

        <h2 className="mb-2.5 text-[13px] font-semibold text-dark">
          Instituto Ruhí
        </h2>
        <ul className="mb-5 flex flex-col gap-1.5">
          {ruhi.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-3 rounded-xl bg-card px-3.5 py-2.5 shadow-card-soft"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-bold text-terra"
                style={{ background: "#2A3F8F10" }}
              >
                {b.number ?? "—"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold leading-[1.3] text-dark">
                  {b.title}
                </div>
              </div>
              {b.pdf_url && <PdfButton href={b.pdf_url} small />}
            </li>
          ))}
        </ul>

        {libros.length > 0 && (
          <>
            <h2 className="mb-2.5 text-[13px] font-semibold text-dark">
              Libros
            </h2>
            <ul className="mb-5 flex flex-col gap-1.5">
              {libros.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-3 rounded-xl bg-card px-3.5 py-2.5 shadow-card-soft"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-terra"
                    style={{ background: "#2A3F8F10" }}
                  >
                    <IconMateriales size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-dark">
                      {b.title}
                    </div>
                    {b.subtitle && (
                      <div className="mt-0.5 text-[10px] text-muted">
                        {b.subtitle}
                      </div>
                    )}
                  </div>
                  {b.pdf_url && <PdfButton href={b.pdf_url} small />}
                </li>
              ))}
            </ul>
          </>
        )}

        <h2 className="mb-2.5 text-[13px] font-semibold text-dark">
          Escritos y Oraciones
        </h2>
        <ul className="flex flex-col gap-1.5 pb-5">
          {otros.map((o) => (
            <li
              key={o.id}
              className="flex items-center gap-3 rounded-xl bg-card px-3.5 py-2.5 shadow-card-soft"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-amber"
                style={{ background: "#7E44B810" }}
              >
                <IconMateriales size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-dark">
                  {o.title}
                </div>
                {o.subtitle && (
                  <div className="mt-0.5 text-[10px] text-muted">{o.subtitle}</div>
                )}
              </div>
              {o.pdf_url && <PdfButton href={o.pdf_url} small />}
            </li>
          ))}
        </ul>

        {pastOraciones.length > 0 && (
          <>
            <h2 className="mb-2.5 text-[13px] font-semibold text-dark">
              Oraciones anteriores
            </h2>
            <ul className="flex flex-col gap-1.5 pb-3">
              {pastOraciones.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center gap-3 rounded-xl bg-card px-3.5 py-2.5 shadow-card-soft"
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-bg"
                  >
                    {o.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={o.image_url}
                        alt={o.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <IconMateriales size={16} className="text-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-dark">
                      {o.title}
                    </div>
                    {o.created_at && (
                      <div className="mt-0.5 text-[10px] text-muted">
                        {formatMessageDate(o.created_at)}
                      </div>
                    )}
                  </div>
                  {o.image_url && (
                    <a
                      href={o.image_url}
                      target="_blank"
                      rel="noopener"
                      className="text-[11px] font-semibold text-terra hover:underline"
                    >
                      Ver
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}

function PdfButton({ href, small = false }: { href: string; small?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={
        small
          ? "inline-flex items-center gap-1 rounded-lg border border-terra/20 bg-terra/[0.05] px-2 py-1 text-[10.5px] font-semibold text-terra hover:bg-terra/10"
          : "inline-flex items-center gap-1.5 rounded-xl border border-terra/20 bg-terra/[0.05] px-3 py-1.5 text-[12px] font-semibold text-terra hover:bg-terra/10"
      }
    >
      <svg width={small ? 10 : 12} height={small ? 10 : 12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      PDF
    </a>
  );
}
