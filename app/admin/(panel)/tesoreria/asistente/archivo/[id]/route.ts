import { NextResponse } from "next/server";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getFile } from "@/lib/treasury-assistant/files";
import { ASSISTANT_BUCKET } from "@/lib/treasury-assistant/types";

/**
 * GET /admin/tesoreria/asistente/archivo/<id> → abre un archivo de la
 * conversación (092). El bucket es privado: se firma una URL de un minuto
 * y se redirige. La fila la devuelve la RLS solo a quien tuvo la
 * conversación.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const row = await getFile(supabase, params.id);
  if (!row) return NextResponse.json({ error: "El archivo no existe." }, { status: 404 });
  const { data, error } = await supabase.storage
    .from(ASSISTANT_BUCKET)
    .createSignedUrl(row.storage_path, 60, { download: row.kind === "planilla" ? row.file_name : false });
  if (error || !data) return NextResponse.json({ error: "No se pudo abrir el archivo." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
