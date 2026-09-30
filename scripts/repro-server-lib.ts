// Molde para reproducir en local una excepción del servidor (ver CLAUDE.md,
// regla 7). Cambiá el import y la llamada por la función que quieras probar.
// Corre con service-role: salta la RLS, alcanza para encontrar el error.
import { createClient } from "@supabase/supabase-js";
import { getTreasuryGuide } from "@/lib/treasury-guide";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: locs } = await supabase.from("localities").select("id, name, kind").order("name");
  for (const loc of locs ?? []) {
    try {
      const g = await getTreasuryGuide(supabase, { localityId: loc.id, localityKind: loc.kind });
      console.log("OK", loc.name, g.steps.map((s) => `${s.order}:${s.key}=${s.status}`).join(" "));
    } catch (e) {
      console.log("FAIL", loc.name);
      console.error(e);
    }
  }
}
main();
