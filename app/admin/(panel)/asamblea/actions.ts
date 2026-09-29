"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ASSEMBLY_DOCS_BUCKET, ASSEMBLY_SIZE } from "@/lib/assembly";
import { requireAdmin } from "@/lib/auth";
import { isSchemaMissing } from "@/lib/polls-shared";
import { getLocalityMembers } from "@/lib/memberships";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";
import { ASSEMBLY_OFFICES, type AssemblyOffice } from "@/lib/types";

/**
 * Datos de la Asamblea (052): la ficha legal, los estatutos y la
 * composición de cada ejercicio. Todo redirige a la misma pantalla con
 * un toast; el bucket es privado, así que la subida del PDF pasa por
 * acá y no por el cliente.
 */

const PAGE = "/admin/asamblea";

function str(formData: FormData, key: string): string {
  return ((formData.get(key) as string) || "").trim();
}

function fail(message: string, year?: number): never {
  setFlashToast({ tone: "error", message });
  redirect(year ? `${PAGE}?ejercicio=${year}` : PAGE);
}

function done(message: string, year?: number): never {
  setFlashToast({ tone: "success", message });
  revalidatePath(PAGE);
  redirect(year ? `${PAGE}?ejercicio=${year}` : PAGE);
}

function migrationMessage(code: string | undefined, fallback: string): string {
  return isSchemaMissing(code)
    ? "Falta aplicar la migración 052 en Supabase."
    : fallback;
}

// ─── La ficha legal ───────────────────────────────────────────────

export async function saveAssemblyRecordAction(formData: FormData) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();
  const localityId = session.locality.id;

  const registeredAt = str(formData, "registered_at");
  if (registeredAt && !/^\d{4}-\d{2}-\d{2}$/.test(registeredAt)) {
    fail("La fecha de registro no es válida.");
  }

  const payload: Record<string, unknown> = {
    locality_id: localityId,
    registered_name: str(formData, "registered_name").slice(0, 200) || null,
    rut: str(formData, "rut").slice(0, 40) || null,
    fiscal_address: str(formData, "fiscal_address").slice(0, 200) || null,
    bps_number: str(formData, "bps_number").slice(0, 40) || null,
    registered_at: registeredAt || null,
    notes: str(formData, "notes").slice(0, 4000) || null,
    updated_by: session.user.id,
    updated_at: new Date().toISOString(),
  };

  // El PDF ya está en el bucket: lo subió el navegador (record-form.tsx),
  // porque dentro del formulario chocaba con el techo de 4,5 MB de Vercel
  // y la ficha entera se perdía. Acá llega solo la ruta, y se verifica
  // que sea de esta localidad y de la carpeta de estatutos: la RLS del
  // bucket ya lo impuso al subir, pero la fila no puede apuntar a otra
  // cosa por un error del cliente.
  const statutesPath = str(formData, "statutes_path");
  let previousPath: string | null = null;
  if (statutesPath) {
    const expectedPrefix = `${localityId}/estatutos/`;
    if (!statutesPath.startsWith(expectedPrefix) || !statutesPath.endsWith(".pdf")) {
      fail("La ruta del PDF no es válida.");
    }
    const { data: current } = await supabase
      .from("assembly_records")
      .select("statutes_path")
      .eq("locality_id", localityId)
      .maybeSingle();
    previousPath = (current as { statutes_path: string | null } | null)?.statutes_path ?? null;

    payload.statutes_path = statutesPath;
    payload.statutes_file_name = str(formData, "statutes_file_name").slice(0, 200) || "estatutos.pdf";
    payload.statutes_uploaded_at = new Date().toISOString();
  } else if ((formData.get("statutes") as File | null)?.size) {
    // Sin JavaScript el archivo llegaría acá adentro, y en Vercel no llega:
    // se dice en vez de fallar en silencio.
    fail("El PDF no se pudo subir. Recargá la página e intentá de nuevo.");
  }

  const { error } = await supabase
    .from("assembly_records")
    .upsert(payload, { onConflict: "locality_id" });
  if (error) {
    // Si la fila no entró, el PDF nuevo no tiene quien lo nombre.
    if (payload.statutes_path) {
      await supabase.storage
        .from(ASSEMBLY_DOCS_BUCKET)
        .remove([payload.statutes_path as string]);
    }
    console.error("[saveAssemblyRecordAction]", error);
    fail(migrationMessage(error.code, `No se pudo guardar: ${error.message}`));
  }

  if (previousPath && previousPath !== payload.statutes_path) {
    const { error: removeError } = await supabase.storage
      .from(ASSEMBLY_DOCS_BUCKET)
      .remove([previousPath]);
    // La fila ya no lo nombra; un huérfano no se ve desde ningún lado.
    if (removeError) console.error("[saveAssemblyRecordAction] remove:", removeError);
  }

  done("Datos de la Asamblea guardados.");
}

export async function removeStatutesAction() {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();
  const localityId = session.locality.id;

  const { data: current } = await supabase
    .from("assembly_records")
    .select("statutes_path")
    .eq("locality_id", localityId)
    .maybeSingle();
  const path = (current as { statutes_path: string | null } | null)?.statutes_path ?? null;
  if (!path) fail("No hay estatutos cargados.");

  const { error } = await supabase
    .from("assembly_records")
    .update({
      statutes_path: null,
      statutes_file_name: null,
      statutes_uploaded_at: null,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("locality_id", localityId);
  if (error) fail(`No se pudo quitar: ${error.message}`);

  const { error: removeError } = await supabase.storage
    .from(ASSEMBLY_DOCS_BUCKET)
    .remove([path]);
  if (removeError) console.error("[removeStatutesAction] storage:", removeError);

  done("Estatutos quitados.");
}

// ─── La composición de un ejercicio ───────────────────────────────

/**
 * Guarda los nueve del ejercicio. Las filas se reescriben enteras (se
 * borran y se insertan): es una lista corta y así el orden y los cargos
 * quedan exactamente como se ven en pantalla. El nombre se guarda
 * SIEMPRE, aunque la persona esté en la app, porque la composición de
 * un ejercicio pasado no cambia si alguien se va o se renombra.
 */
export async function saveAssemblyTermAction(formData: FormData) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();
  const localityId = session.locality.id;

  const year = parseInt(str(formData, "bahai_year"), 10);
  if (!Number.isFinite(year) || year < 100 || year > 400) fail("El ejercicio no es válido.");

  const electedOn = str(formData, "elected_on");
  if (electedOn && !/^\d{4}-\d{2}-\d{2}$/.test(electedOn)) {
    fail("La fecha de elección no es válida.", year);
  }

  // Las personas de la comunidad, para tomar el nombre del elegido. Por
  // membresía (056), o sea también quien ande con el sombrero de otra.
  const nameById = new Map<string, string>();
  for (const p of await getLocalityMembers(supabase, localityId)) {
    nameById.set(p.id, p.full_name?.trim() || p.email || "Sin nombre");
  }

  type Row = {
    position: number;
    profile_id: string | null;
    display_name: string;
    office: AssemblyOffice | null;
    since: string | null;
    until: string | null;
  };
  const rows: Row[] = [];
  const seenOffices = new Set<string>();
  const seenProfiles = new Set<string>();
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const dateOrNull = (raw: string, what: string): string | null => {
    if (!raw) return null;
    if (!DATE_RE.test(raw)) fail(`La fecha "${what}" no es válida.`, year);
    return raw;
  };

  for (let i = 1; i <= ASSEMBLY_SIZE; i++) {
    const profileId = str(formData, `member_${i}_profile`);
    const freeName = str(formData, `member_${i}_name`).slice(0, 120);
    const officeRaw = str(formData, `member_${i}_office`);
    const office = (ASSEMBLY_OFFICES as string[]).includes(officeRaw)
      ? (officeRaw as AssemblyOffice)
      : null;
    const since = dateOrNull(str(formData, `member_${i}_since`), `desde, fila ${i}`);

    let displayName = "";
    let linked: string | null = null;
    if (profileId && profileId !== "otro") {
      const name = nameById.get(profileId);
      if (!name) fail(`La persona de la fila ${i} no es de esta localidad.`, year);
      if (seenProfiles.has(profileId)) {
        fail(`${name} aparece dos veces en la lista.`, year);
      }
      seenProfiles.add(profileId);
      linked = profileId;
      displayName = name;
    } else {
      displayName = freeName;
    }

    if (!displayName) {
      if (office) fail(`El cargo ${office} de la fila ${i} no tiene persona.`, year);
      continue; // fila vacía
    }
    if (office) {
      if (seenOffices.has(office)) fail("Hay dos personas con el mismo cargo.", year);
      seenOffices.add(office);
    }
    rows.push({
      position: i,
      profile_id: linked,
      display_name: displayName,
      office,
      since,
      until: null,
    });
  }

  // Quienes dejaron una fila durante el ejercicio (073): quedan en la
  // tabla con su "hasta", para que los documentos de antes sigan con su
  // nombre. Se validan poco a propósito —son historia, no permisos—, salvo
  // lo que rompería el modelo: posición, cargo y fecha de salida.
  const formerCount = Math.min(parseInt(str(formData, "former_count") || "0", 10) || 0, 60);
  for (let k = 0; k < formerCount; k++) {
    const position = parseInt(str(formData, `former_${k}_position`), 10);
    if (!Number.isInteger(position) || position < 1 || position > ASSEMBLY_SIZE) continue;
    const profileId = str(formData, `former_${k}_profile`);
    const linked = profileId && profileId !== "otro" && nameById.has(profileId) ? profileId : null;
    const displayName =
      (linked ? nameById.get(linked) : null) ?? str(formData, `former_${k}_name`).slice(0, 120);
    if (!displayName) continue;
    const officeRaw = str(formData, `former_${k}_office`);
    const office = (ASSEMBLY_OFFICES as string[]).includes(officeRaw)
      ? (officeRaw as AssemblyOffice)
      : null;
    const since = dateOrNull(str(formData, `former_${k}_since`), `desde, cambio ${k + 1}`);
    const until = dateOrNull(str(formData, `former_${k}_until`), `hasta, cambio ${k + 1}`);
    if (!until) fail(`El cambio de ${displayName} no tiene fecha de salida.`, year);
    if (since && until && until <= since) {
      fail(`${displayName}: la fecha de salida tiene que ser posterior a la de entrada.`, year);
    }
    rows.push({ position, profile_id: linked, display_name: displayName, office, since, until });
  }

  const { data: term, error: termError } = await supabase
    .from("assembly_terms")
    .upsert(
      {
        locality_id: localityId,
        bahai_year: year,
        elected_on: electedOn || null,
        notes: str(formData, "term_notes").slice(0, 2000) || null,
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "locality_id,bahai_year" }
    )
    .select("id")
    .single();
  if (termError || !term) {
    console.error("[saveAssemblyTermAction] term:", termError);
    fail(
      migrationMessage(termError?.code, `No se pudo guardar el ejercicio: ${termError?.message}`),
      year
    );
  }
  const termId = (term as { id: string }).id;

  const { error: deleteError } = await supabase
    .from("assembly_members")
    .delete()
    .eq("term_id", termId);
  if (deleteError) fail(`No se pudo actualizar la lista: ${deleteError.message}`, year);

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("assembly_members")
      .insert(rows.map((r) => ({ ...r, term_id: termId, locality_id: localityId })));
    if (insertError) fail(`No se pudo guardar la lista: ${insertError.message}`, year);
  }

  done(`Composición del ejercicio ${year} guardada.`, year);
}
