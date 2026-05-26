import { toPng } from "html-to-image";

export type ShareResult = "shared" | "downloaded" | "error";

/**
 * Captura un nodo del DOM como PNG y lo comparte vía Web Share API
 * (ideal para WhatsApp). Si el navegador no puede compartir archivos,
 * cae a descargar la imagen. Debe llamarse desde un gesto del usuario.
 */
export async function shareNodeAsImage(
  node: HTMLElement,
  opts: { filename: string; title?: string; text?: string }
): Promise<ShareResult> {
  try {
    // Esperamos a que las fuentes estén listas para que el render no
    // capture texto con la fuente de fallback.
    if (typeof document !== "undefined" && document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        /* noop */
      }
    }

    const dataUrl = await toPng(node, {
      pixelRatio: 3,
      cacheBust: true,
      backgroundColor: "#ffffff",
    });

    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], opts.filename, { type: "image/png" });

    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav?.canShare?.({ files: [file] })) {
      try {
        await nav.share({
          files: [file],
          title: opts.title,
          text: opts.text,
        });
        return "shared";
      } catch (err) {
        // El usuario canceló el diálogo de compartir: no es un error real.
        if (err instanceof DOMException && err.name === "AbortError") {
          return "shared";
        }
        // Cualquier otro fallo → caemos a descarga.
      }
    }

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = opts.filename;
    a.click();
    return "downloaded";
  } catch (err) {
    console.error("[shareNodeAsImage] error:", err);
    return "error";
  }
}
