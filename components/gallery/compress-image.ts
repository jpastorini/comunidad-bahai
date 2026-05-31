/**
 * Comprime una imagen en el navegador antes de subirla.
 * - Redimensiona el lado mayor a `maxDim` (1600 px por default)
 * - Re-encodea como JPEG calidad 85
 *
 * Una foto típica de 4-8 MB del teléfono queda en 400-900 KB
 * sin pérdida visual perceptible.
 */
export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.85
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        const maxSide = Math.max(width, height);
        if (maxSide > maxDim) {
          const scale = maxDim / maxSide;
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas no soportado por el navegador"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("No se pudo comprimir la imagen"));
              return;
            }
            const baseName = file.name.replace(/\.[^.]+$/, "");
            const out = new File([blob], `${baseName}.jpg`, {
              type: "image/jpeg",
            });
            resolve(out);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => reject(new Error("No se pudo leer la imagen"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}
