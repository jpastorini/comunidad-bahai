import Link from "next/link";
import { notFound } from "next/navigation";
import { GoldHeader } from "@/components/GoldHeader";
import { IconChevronRight } from "@/components/Icons";
import { requireMember } from "@/lib/auth";
import { findCategory } from "@/lib/oraciones";

export const dynamic = "force-dynamic";

export default async function CategoriaOracionesPage({
  params,
}: {
  params: { category: string };
}) {
  await requireMember(`/oraciones/${params.category}`);

  const found = findCategory(params.category);
  if (!found) notFound();
  const { group, category } = found;

  let lastSection: string | undefined;

  return (
    <>
      <GoldHeader
        title={category.name}
        subtitle={group.name}
        backHref="/oraciones"
      />
      <main className="scroll-area flex-1 px-4 pb-6 pt-4">
        <div className="flex flex-col gap-2">
          {category.prayers.map((prayer) => {
            const showSection = prayer.section && prayer.section !== lastSection;
            lastSection = prayer.section;
            return (
              <div key={prayer.id}>
                {showSection && (
                  <h2 className="mb-1.5 mt-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted first:mt-0">
                    {prayer.section}
                  </h2>
                )}
                <Link
                  href={`/oraciones/${category.id}/${prayer.id}`}
                  className="tap flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-card-soft"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium leading-snug text-dark">
                      {prayer.title}
                    </div>
                    {prayer.author && (
                      <div className="mt-0.5 font-body text-[11px] text-muted">
                        {prayer.author}
                      </div>
                    )}
                  </div>
                  <IconChevronRight size={14} className="shrink-0 text-muted" />
                </Link>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
