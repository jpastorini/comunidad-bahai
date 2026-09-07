import fs from "node:fs";
import path from "node:path";
import { createElement, type ReactElement } from "react";
import { NextResponse } from "next/server";
import { notFound, redirect } from "next/navigation";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import {
  BOOKLET_FONT_FILES,
  FeastBooklet,
  registerBookletFonts,
  type BookletFontSources,
} from "@/components/feast/FeastBooklet";
import { feastProgramFileName } from "@/lib/feast-program";
import { loadFeastProgram } from "@/lib/feast-program-server";

/**
 * GET /programa/[id]/pdf → el folleto de la Fiesta en PDF, generado al
 * vuelo con react-pdf (sin Chromium: Node puro, entra en la función de
 * Vercel). Se sirve `inline` a propósito: en el celular el navegador lo
 * abre en su visor, con el botón de guardar o compartir a la vista; un
 * `attachment` en la PWA de iPhone no muestra nada. El link de la app
 * abre en pestaña nueva por lo mismo.
 *
 * Mismo guard que el deck (loadFeastProgram): la RLS decide si la Fiesta
 * existe para esta persona y el programa de una Fiesta no iniciada es
 * solo de la Asamblea.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// react-pdf arranca en frío cargando fuentes y su motor de layout: el
// tope por defecto de la función (10 s en Hobby) queda justo.
export const maxDuration = 60;

/**
 * Las TTF viven en public/fonts. En local y en Vercel (gracias a
 * outputFileTracingIncludes) están en el filesystem; si no estuvieran,
 * se piden por URL a la propia app, que las sirve como estático.
 */
function fontSources(origin: string): BookletFontSources {
  const dir = path.join(process.cwd(), "public", "fonts");
  const out = {} as BookletFontSources;
  for (const name of BOOKLET_FONT_FILES) {
    const local = path.join(dir, `${name}.ttf`);
    out[name] = fs.existsSync(local) ? local : `${origin}/fonts/${name}.ttf`;
  }
  return out;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const res = await loadFeastProgram(params.id);
  if (res.kind === "not-found") notFound();
  if (res.kind === "not-started") redirect(`/fiestas/${params.id}`);

  const origin = new URL(request.url).origin;
  const fonts = fontSources(origin);

  try {
    registerBookletFonts(fonts);

    const element = createElement(FeastBooklet, {
      program: res.program,
      origin,
    }) as unknown as ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(element);
    const filename = feastProgramFileName(res.program);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    // Un 500 mudo no se puede diagnosticar desde el celular de la
    // Asamblea: el error va al log de la función y, en texto, a la
    // pantalla (la ruta ya exige sesión de creyente, no expone nada).
    const e = err as Error;
    const fontsOnDisk = Object.values(fonts).filter((s) => !s.startsWith("http")).length;
    console.error("[programa/pdf] falló la generación:", e, { fontsOnDisk, cwd: process.cwd() });
    return new NextResponse(
      `No se pudo generar el folleto.\n\n${e.name}: ${e.message}\n\n(fuentes en disco: ${fontsOnDisk}/${Object.keys(fonts).length})`,
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }
}
