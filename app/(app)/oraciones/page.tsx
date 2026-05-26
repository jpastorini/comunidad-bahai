import Link from "next/link";
import { GoldHeader } from "@/components/GoldHeader";
import { IconChevronRight } from "@/components/Icons";
import { requireMember } from "@/lib/auth";
import { getOraciones } from "@/lib/oraciones";

export const revalidate = 60;

export default async function OracionesPage() {
  const session = await requireMember("/oraciones");
  const { groups } = getOraciones();

  return (
    <>
      <GoldHeader
        title="Oraciones"
        subtitle={session.locality.name}
        backHref="/"
      />
      <main className="scroll-area flex-1 px-4 pb-6 pt-4">
        <p className="mb-4 font-body text-[12.5px] leading-relaxed text-muted">
          Oraciones reveladas por el Báb, Bahá'u'lláh y ʻAbdu'l-Bahá,
          organizadas por tema. Elegí una categoría.
        </p>

        {groups.map((group) => (
          <section key={group.id} className="mb-5">
            <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {group.name}
            </h2>
            <div className="overflow-hidden rounded-2xl bg-card shadow-card-soft">
              {group.categories.map((cat, i) => (
                <Link
                  key={cat.id}
                  href={`/oraciones/${cat.id}`}
                  className={`tap flex items-center gap-3 px-4 py-3 ${
                    i > 0 ? "border-t border-black/[0.05]" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1 text-[14px] font-medium text-dark">
                    {cat.name}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted">
                    {cat.prayers.length}
                  </span>
                  <IconChevronRight size={14} className="shrink-0 text-muted" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
