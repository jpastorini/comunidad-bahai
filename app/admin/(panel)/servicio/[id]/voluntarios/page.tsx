import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function VolunteersPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServer();
  const { data: need } = await supabase
    .from("service_needs")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!need) notFound();

  // Dos consultas y no un embed: la FK de service_volunteers.user_id apunta
  // a auth.users, no a profiles, así que PostgREST no tiene por dónde
  // unirlas. El embed de antes fallaba siempre y la pantalla decía "Nadie
  // se ha ofrecido" aunque hubiera voluntarios.
  const { data: volRows, error: volError } = await supabase
    .from("service_volunteers")
    .select("user_id, created_at")
    .eq("need_id", params.id)
    .order("created_at", { ascending: true });
  if (volError) {
    console.error(`[admin/servicio] voluntarios: ${volError.code} ${volError.message}`);
  }
  const userIds = (volRows ?? []).map((v) => v.user_id as string);
  const { data: profileRows } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
    : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> };
  const profilesById = new Map(
    (profileRows ?? []).map((p) => [p.id as string, p])
  );
  const vols = (volRows ?? []).map((v) => ({
    created_at: v.created_at as string,
    profiles: profilesById.get(v.user_id as string) ?? null,
  }));

  return (
    <>
      <PageHeader back={{ href: "/admin/servicio", label: "Servicio" }}
        eyebrow="Vida comunitaria"
        title="Voluntarios"
        description={need.title}
      />
      <Card>
        {(!vols || vols.length === 0) ? (
          <p className="text-center text-[13px] text-muted">
            Nadie se ha ofrecido todavía.
          </p>
        ) : (
          <ul className="divide-y divide-black/[0.05]">
            {vols.map((v, i) => {
              const p = v.profiles as unknown as
                | { full_name: string | null; email: string | null }
                | null;
              return (
                <li key={i} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-[14px] font-semibold text-dark">
                      {p?.full_name ?? "Sin nombre"}
                    </div>
                    <div className="text-[12px] text-muted">{p?.email}</div>
                  </div>
                  <div className="text-[11px] text-muted">
                    {formatDate(v.created_at)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
