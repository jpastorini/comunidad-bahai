// Las oraciones obligatorias mezclan dos cosas en el mismo texto: las
// palabras reveladas que se recitan y las indicaciones de qué hacer con el
// cuerpo ("Que luego se incline, con las manos apoyadas en las rodillas, y
// diga:"). En public/oraciones.json son párrafos iguales; acá se separan
// para que la pantalla los dibuje distinto.
//
// ⚠️ Solo se CLASIFICAN párrafos. El texto no se toca, no se resume ni se
// reordena: cada bloque lleva su párrafo tal cual viene del libro.
//
// Puro (sin React ni servidor): lo usa la página y se puede probar suelto.

export type Posture =
  | "lavar-manos"
  | "lavar-cara"
  | "alquibla"
  | "mirar"
  | "de-pie"
  | "suplica"
  | "inclinarse"
  | "postrarse"
  | "sentarse";

export const POSTURE_LABELS: Record<Posture, string> = {
  "lavar-manos": "Lavarse las manos",
  "lavar-cara": "Lavarse la cara",
  alquibla: "De pie, hacia la Alquibla",
  mirar: "De pie, mirar a derecha e izquierda",
  "de-pie": "De pie",
  suplica: "Manos alzadas en súplica",
  inclinarse: "Inclinarse, manos en las rodillas",
  postrarse: "De rodillas, la frente en el suelo",
  sentarse: "Sentarse",
};

export type PrayerBlock =
  /** Cuándo se recita, o la alternativa breve del final. No se recita. */
  | { kind: "nota"; text: string }
  /** Indicación de postura. No se recita. */
  | {
      kind: "guia";
      text: string;
      postures: Posture[];
      /** La indicación pide repetir el Más Grande Nombre. */
      greatestName: boolean;
    }
  /** Las palabras de la oración. */
  | { kind: "texto"; text: string };

export const OBLIGATORY_GROUP_ID = "oraciones-obligatorias";

/** Así empiezan todas las indicaciones de las tres oraciones. */
const GUIDE_START = /^(Quien desee|Que luego|Que entonces|Y mientras|Luego, que)\b/;

/** Qué posturas nombra una indicación, en el orden en que aparecen. */
function posturesOf(text: string): Posture[] {
  const rules: [Posture, RegExp][] = [
    ["lavar-manos", /se lave las manos/],
    ["lavar-cara", /se lava la cara/],
    ["alquibla", /Alquibla/],
    ["mirar", /mire a derecha e izquierda/],
    ["postrarse", /frente hasta el suelo/],
    ["inclinarse", /manos apoyadas en las rodillas/],
    ["suplica", /levant[ea]r? (dos veces )?las manos|manos abiertas/],
    ["sentarse", /se siente/],
    ["de-pie", /se ponga de pie|se levante|de pie/],
  ];
  const found = rules
    .map(([posture, re]) => ({ posture, at: text.search(re) }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((m) => m.posture);

  // "De pie" ya está dicho por el dibujo de las posturas que se hacen de
  // pie: no se repite una figura para lo mismo.
  const standing: Posture[] = ["alquibla", "mirar", "suplica"];
  return found.some((p) => standing.includes(p))
    ? found.filter((p) => p !== "de-pie")
    : found;
}

export function parseObligatoryPrayer(body: string): PrayerBlock[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text, i): PrayerBlock => {
      if (i === 0 && text.startsWith("Se recita")) return { kind: "nota", text };
      if (text.startsWith("(") && text.endsWith(")")) return { kind: "nota", text };
      if (GUIDE_START.test(text)) {
        return {
          kind: "guia",
          text,
          postures: posturesOf(text),
          greatestName: /Más Grande Nombre/.test(text),
        };
      }
      return { kind: "texto", text };
    });
}
