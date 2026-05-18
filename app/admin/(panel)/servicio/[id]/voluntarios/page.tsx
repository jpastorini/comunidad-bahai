import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/admin/ui";
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

  const { data: vols } = await supabase
    .from("service_volunteers")
    .select("created_at, profiles:profiles!service_volunteers_user_id_fkey(full_name, email)")
    .eq("need_id", params.id);

  return (
    <>
      <PageHeader
        eyebrow="Servicio"
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
                    {new Date(v.created_at).toLocaleDateString("es-MX")}
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
