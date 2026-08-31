import Link from "next/link";
import { GoldHeader } from "@/components/GoldHeader";
import { IconMateriales } from "@/components/Icons";
import { OracionDelMesCard } from "@/components/materials/OracionDelMesCard";
import { BIBLIOTECA_SEGMENTS, SegmentedNav } from "@/components/SegmentedNav";
import { requireMember } from "@/lib/auth";
import { getCitasData } from "@/lib/citas";
import {
  getEscritos,
  getLatestOracionDelMes,
  getLibros,
  getOracionesDelMes,
  getRuhiBooks,
} from "@/lib/data";
import { formatMessageDate } from "@/lib/format";
import type { StudyMaterial } from "@/lib/types";

export const revalidate = 60;

// Los Libros se agrupan por autor (el `subtitle` de cada material), en el
// orden canónico de bahaipanel.org. Un subtitle que no esté acá (p. ej. un
// libro local con otra etiqueta) forma su propio grupo al final; sin
// subtitle, va a "Otros".
const LIBROS_AUTOR_ORDEN = [
  "Bahá'u'lláh",
  "El Báb",
  "'Abdu'l-Bahá",
  "Shoghi Effendi",
  "Casa Universal de Justicia",
  "Declaración oficial",
  "Recopilación",
];
const LIBROS_GRUPO_LABEL: Record<string, string> = {
  "Declaración oficial": "Declaraciones oficiales",
  Recopilación: "Recopilaciones",
};

function groupLibrosByAutor(
  libros: StudyMaterial[]
): { label: string; items: StudyMaterial[] }[] {
  const byKey = new Map<string, StudyMaterial[]>();
  for (const b of libros) {
    const key = b.subtitle || "Otros";
    const bucket = byKey.get(key);
    if (bucket) bucket.push(b);
    else byKey.set(key, [b]);
  }
  const keys = [...byKey.keys()].sort((a, b) => {
    const ia = LIBROS_AUTOR_ORDEN.indexOf(a);
    const ib = LIBROS_AUTOR_ORDEN.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    if (a === "Otros" || b === "Otros") return a === "Otros" ? 1 : -1;
    return a.localeCompare(b, "es");
  });
  return keys.map((key) => ({
    label: LIBROS_GRUPO_LABEL[key] ?? key,
    items: byKey.get(key)!,
  }));
}

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

  // El corpus de la "Lectura de hoy": se linkea desde acá para que quien
  // quiere leer los Escritos lo encuentre en la Biblioteca, no solo en Inicio.
  const citas = getCitasData();

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
            {groupLibrosByAutor(libros).map((grupo) => (
              <div key={grupo.label} className="mb-4 last:mb-5">
                <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted">
                  {grupo.label}
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {grupo.items.map((b) => (
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
                      </div>
                      {b.pdf_url && <PdfButton href={b.pdf_url} small />}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}

        <h2 className="mb-2.5 text-[13px] font-semibold text-dark">
          Escritos y Oraciones
        </h2>
        <ul className="flex flex-col gap-1.5 pb-5">
          <li>
            <Link
              href="/citas?volver=biblioteca"
              className="tap flex items-center gap-3 rounded-xl bg-card px-3.5 py-2.5 shadow-card-soft ring-1 ring-gold/25"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[14px] text-gold-dark"
                style={{ background: "#C4A23514" }}
              >
                ✦
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-dark">
                  Escritos Sagrados — {citas.source}
                </div>
                <div className="mt-0.5 text-[10px] text-muted">
                  {citas.quoteCount} citas para leer por tema · la fuente de la
                  Lectura de hoy
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-lg border border-gold/30 bg-gold/[0.07] px-2 py-1 text-[10.5px] font-semibold text-gold-dark">
                Leer
              </span>
            </Link>
          </li>
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
