"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import {
  ASSEMBLY_DOCS_BUCKET,
  ASSEMBLY_SIZE,
  MAX_STATUTES_BYTES,
} from "@/lib/assembly";
import { requireAdmin } from "@/lib/auth";
import { isSchemaMissing } from "@/lib/polls-shared";
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
    bps_number: str(formData, "bps_number").slice(0, 40) || null,
    registered_at: registeredAt || null,
    notes: str(formData, "notes").slice(0, 4000) || null,
    updated_by: session.user.id,
    updated_at: new Date().toISOString(),
  };

  // El PDF, si vino. Se sube antes del upsert para que la fila ya apunte
  // al archivo nuevo; el anterior se borra al final, cuando la fila ya
  // no lo nombra.
  const file = formData.get("statutes") as File | null;
  let previousPath: string | null = null;
  if (file && file.size > 0) {
    if (file.type !== "application/pdf") fail("Los estatutos tienen que ser un PDF.");
    if (file.size > MAX_STATUTES_BYTES) {
      fail(`El PDF supera los ${Math.round(MAX_STATUTES_BYTES / (1024 * 1024))} MB.`);
    }

    const { data: current } = await supabase
      .from("assembly_records")
      .select("statutes_path")
      .eq("locality_id", localityId)
      .maybeSingle();
    previousPath = (current as { statutes_path: string | null } | null)?.statutes_path ?? null;

    const path = `${localityId}/estatutos/${randomUUID()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(ASSEMBLY_DOCS_BUCKET)
      .upload(path, file, { contentType: "application/pdf", upsert: false });
    if (uploadError) {
      console.error("[saveAssemblyRecordAction] storage:", uploadError);
      fail(`No se pudo subir el PDF: ${uploadError.message}`);
    }
    payload.statutes_path = path;
    payload.statutes_file_name = file.name.slice(0, 200) || "estatutos.pdf";
    payload.statutes_uploaded_at = new Date().toISOString();
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

  // Los perfiles de la localidad, para tomar el nombre del elegido.
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("locality_id", localityId);
  const nameById = new Map<string, string>();
  for (const p of profileRows ?? []) {
    const row = p as { id: string; full_name: string | null; email: string | null };
    nameById.set(row.id, row.full_name?.trim() || row.email || "Sin nombre");
  }

  type Row = {
    position: number;
    profile_id: string | null;
    display_name: string;
    office: AssemblyOffice | null;
  };
  const rows: Row[] = [];
  const seenOffices = new Set<string>();
  const seenProfiles = new Set<string>();

  for (let i = 1; i <= ASSEMBLY_SIZE; i++) {
    const profileId = str(formData, `member_${i}_profile`);
    const freeName = str(formData, `member_${i}_name`).slice(0, 120);
    const officeRaw = str(formData, `member_${i}_office`);
    const office = (ASSEMBLY_OFFICES as string[]).includes(officeRaw)
      ? (officeRaw as AssemblyOffice)
      : null;

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
    rows.push({ position: i, profile_id: linked, display_name: displayName, office });
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
