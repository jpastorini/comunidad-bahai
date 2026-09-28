import "server-only";
import { getLocalityAdminIds, sendPushToUsers } from "./push";
import { createSupabaseAdmin } from "./supabase/admin";

/**
 * Avisa a la Asamblea de una localidad que alguien nuevo entró (o pidió
 * entrar), para que revise su ficha enseguida: la condición —creyente o
 * Amigo/a de la Fe—, el nombre, los permisos.
 *
 * Hay tres puertas y las tres llaman acá:
 *   · `joined`    — primer ingreso eligiendo la localidad de la lista
 *                   (`selectLocalityAction`, `join_locality()`).
 *   · `invited`   — primer ingreso por un link de invitación
 *                   (`applyInviteToken` desde `/auth/callback` o
 *                   `/invitacion/<token>/comenzar`).
 *   · `requested` — alguien de OTRA localidad pidió mudarse a esta: la
 *                   Asamblea tiene que aprobarlo o rechazarlo.
 *
 * Va a quienes tienen rol de Asamblea en la MEMBRESÍA (056), no por el
 * sombrero. Nunca lanza: un fallo del aviso no puede trabar un ingreso.
 */
export async function notifyNewMember(
  localityId: string,
  userId: string,
  kind: "joined" | "invited" | "requested",
  opts: { fromLocalityName?: string } = {}
): Promise<void> {
  try {
    const admin = createSupabaseAdmin();
    if (!admin) return;

    const [adminIds, { data: profile }, { data: locality }] = await Promise.all([
      getLocalityAdminIds(localityId),
      admin
        .from("profiles")
        .select("full_name, email, is_bahai")
        .eq("id", userId)
        .maybeSingle(),
      admin.from("localities").select("name").eq("id", localityId).maybeSingle(),
    ]);
    const recipients = adminIds.filter((id) => id !== userId);
    if (recipients.length === 0) return;

    const p = profile as { full_name: string | null; email: string | null; is_bahai: boolean } | null;
    const who = p?.full_name?.trim() || p?.email || "Alguien";
    const where = (locality as { name: string } | null)?.name ?? "tu comunidad";

    if (kind === "requested") {
      await sendPushToUsers(recipients, {
        title: "Solicitud de ingreso",
        body: `${who} pidió unirse a ${where}${
          opts.fromLocalityName ? ` desde ${opts.fromLocalityName}` : ""
        }. Aprobala o rechazala en Creyentes.`,
        url: "/admin/miembros",
        tag: `ingreso-${userId}`,
      });
      return;
    }

    const condition = p?.is_bahai === false ? "Amigo/a de la Fe" : "creyente";
    const via = kind === "invited" ? " con el link de invitación" : "";
    await sendPushToUsers(recipients, {
      title: "Alguien nuevo en la app",
      body: `${who} se registró en ${where}${via} como ${condition}. Revisá su ficha.`,
      url: `/admin/miembros?filtro=nuevos#m-${userId}`,
      tag: `nuevo-${userId}`,
    });
  } catch (err) {
    console.error("[new-member-alert]", err);
  }
}
