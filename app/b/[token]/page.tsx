import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BahaiStar } from "@/components/BahaiStar";
import { BulletinView } from "@/components/BulletinView";
import { getPublicBulletin } from "@/lib/bulletins";

// Página PÚBLICA (sin login): es el link que la comunidad reenvía por
// WhatsApp/email. Se resuelve por share_token con la service-role key;
// solo existe para ediciones publicadas.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const res = await getPublicBulletin(params.token);
  if (!res) return { title: "Boletín" };
  return {
    title: `${res.bulletin.title} — ${res.localityName}`,
    description: res.bulletin.editorial?.slice(0, 160) ?? undefined,
  };
}

export default async function PublicBulletinPage({
  params,
}: {
  params: { token: string };
}) {
  const res = await getPublicBulletin(params.token);
  if (!res) notFound();
  const { bulletin, localityName } = res;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md px-4 pb-10 pt-6">
      <header className="mb-4 flex items-center gap-2.5">
        <BahaiStar size={26} color="#96790E" />
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[2px] text-gold-dark">
            Comunidad Bahá'í
          </div>
          <div className="text-[12px] font-semibold text-dark">
            {localityName}
          </div>
        </div>
      </header>

      <BulletinView bulletin={bulletin} localityName={localityName} />

      <footer className="mt-6 border-t border-black/[0.06] pt-4 text-center text-[11px] text-muted">
        Boletín de la Comunidad Bahá'í de {localityName}
      </footer>
    </div>
  );
}
