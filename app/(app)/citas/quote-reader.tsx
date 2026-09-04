"use client";

import {
  ReadingSizeControl,
  readingStyle,
  useReadingSize,
} from "@/components/ReadingSize";

// La cita de la "Lectura de hoy" con el control de tamaño de letra
// compartido con las demás pantallas de lectura (components/ReadingSize).
export function QuoteReader({ text }: { text: string }) {
  const [size, setSize] = useReadingSize();

  return (
    <>
      <ReadingSizeControl value={size} onChange={setSize} className="mb-3" />
      <p
        className="font-display italic text-dark"
        style={readingStyle(18, size)}
      >
        “{text}”
      </p>
    </>
  );
}
