import React from "react";
import {
  Document,
  Font,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { FeastProgram } from "@/lib/feast-program";

/**
 * El folleto de la Fiesta: el programa impreso en A5, claro, para bajar
 * al celular y seguir la lectura de las oraciones. Se genera en el
 * servidor (app/programa/[id]/pdf/route.ts) con react-pdf, sin
 * navegador: el deck oscuro de diapositivas sería un mal PDF (fondos
 * azules, letra chica en el teléfono) y esto es lo que la gente quiere
 * tener en la mano.
 *
 * Lee la MISMA estructura que el deck (buildFeastProgram), así que no
 * pueden contar cosas distintas. Sin fotos: una imagen remota que falle
 * en el servidor rompería el PDF entero, y el folleto es de texto.
 *
 * Fuentes: Cormorant Garamond para todo lo que lleve nombres bahá'ís
 * (ḥ, ẕ, ṭ, ʻ no están en Outfit) y Outfit para etiquetas.
 */

export const BOOKLET_FONT_FILES = [
  "CormorantGaramond-Regular",
  "CormorantGaramond-Medium",
  "CormorantGaramond-SemiBold",
  "CormorantGaramond-Italic",
  "Outfit-Regular",
  "Outfit-SemiBold",
] as const;

export type BookletFontSources = Record<(typeof BOOKLET_FONT_FILES)[number], string>;

let fontsRegistered = false;

/** Registra las fuentes una vez por proceso. `src` es path local o URL. */
export function registerBookletFonts(src: BookletFontSources) {
  if (fontsRegistered) return;
  Font.register({
    family: "Cormorant",
    fonts: [
      { src: src["CormorantGaramond-Regular"], fontWeight: 400 },
      { src: src["CormorantGaramond-Medium"], fontWeight: 500 },
      { src: src["CormorantGaramond-SemiBold"], fontWeight: 600 },
      { src: src["CormorantGaramond-Italic"], fontWeight: 400, fontStyle: "italic" },
    ],
  });
  Font.register({
    family: "Outfit",
    fonts: [
      { src: src["Outfit-Regular"], fontWeight: 400 },
      { src: src["Outfit-SemiBold"], fontWeight: 600 },
    ],
  });
  // Sin partir palabras: en español el guion a fin de línea se ve mal
  // en una oración y react-pdf no conoce nuestras reglas.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const INK = "#1b2033";
const MIST = "#6b7080";
const GOLD = "#96790E";
const GOLD_SOFT = "#b0925a";
const LINE = "#e2d9c3";

const s = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 50,
    paddingHorizontal: 40,
    fontFamily: "Cormorant",
    fontSize: 11.5,
    color: INK,
    lineHeight: 1.45,
  },
  cover: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 40,
    fontFamily: "Cormorant",
    color: INK,
    justifyContent: "center",
    alignItems: "center",
  },
  kicker: {
    fontFamily: "Outfit",
    fontSize: 7.5,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: GOLD,
  },
  coverTitle: {
    fontSize: 46,
    fontWeight: 500,
    marginTop: 10,
    textAlign: "center",
    lineHeight: 1.05,
  },
  coverTranslit: {
    fontStyle: "italic",
    fontSize: 14,
    color: GOLD_SOFT,
    marginTop: 4,
    textAlign: "center",
  },
  coverMeta: {
    marginTop: 26,
    fontFamily: "Outfit",
    fontSize: 7.5,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: MIST,
    textAlign: "center",
  },
  coverDate: {
    marginTop: 6,
    fontFamily: "Outfit",
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: INK,
    textAlign: "center",
  },
  coverPlaces: { marginTop: 18, alignItems: "center" },
  coverPlace: { fontSize: 11, color: INK, textAlign: "center", lineHeight: 1.5 },
  coverPlaceDim: { color: MIST },
  coverFoot: {
    position: "absolute",
    bottom: 34,
    left: 40,
    right: 40,
    textAlign: "center",
    fontFamily: "Outfit",
    fontSize: 7,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: GOLD_SOFT,
  },
  hair: { height: 1, backgroundColor: LINE, marginVertical: 10 },
  sectionHead: { marginBottom: 12, alignItems: "center" },
  roman: { fontSize: 26, color: GOLD, opacity: 0.6, lineHeight: 1 },
  sectionTitle: { fontSize: 21, fontWeight: 500, marginTop: 2, textAlign: "center" },
  sectionSub: { fontSize: 10.5, color: MIST, textAlign: "center", marginTop: 3 },
  block: { marginBottom: 14 },
  label: {
    fontFamily: "Outfit",
    fontSize: 6.8,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: GOLD_SOFT,
  },
  theme: { fontStyle: "italic", fontSize: 13, color: GOLD, marginTop: 3, lineHeight: 1.3 },
  para: { marginTop: 6, textAlign: "left" },
  // En Cormorant, no en Outfit: la referencia puede ser "ʻAbdu'l-Bahá" y
  // la ʻ no existe en Outfit (sale un glifo cualquiera).
  source: {
    fontFamily: "Cormorant",
    fontWeight: 500,
    fontSize: 9.5,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: GOLD,
    textAlign: "right",
    marginTop: 6,
  },
  dot: { alignSelf: "center", width: 4, height: 4, backgroundColor: GOLD, marginVertical: 6 },
  scopeHead: { marginTop: 6, marginBottom: 6 },
  scopeTitle: { fontSize: 15, fontWeight: 500, marginTop: 1 },
  newsItem: { marginBottom: 9, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: LINE },
  newsDate: {
    fontFamily: "Outfit",
    fontSize: 6.8,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: GOLD,
  },
  newsTitle: { fontSize: 13, fontWeight: 500, lineHeight: 1.25, marginTop: 1 },
  newsBody: { fontSize: 10.5, color: MIST, marginTop: 2 },
  link: { color: GOLD, textDecoration: "underline" },
  closing: { marginTop: 18, alignItems: "center" },
  closingText: { fontSize: 12, color: MIST, textAlign: "center", maxWidth: 260, marginTop: 8 },
  sig: {
    marginTop: 16,
    fontFamily: "Outfit",
    fontSize: 7,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: MIST,
    textAlign: "center",
  },
  sigName: { fontStyle: "italic", fontSize: 12.5, color: INK, textAlign: "center", marginTop: 3 },
  // Un solo bloque fijo abajo con las dos puntas: un Text absoluto con
  // `render` suelto se medía mal y el número de página subía al tope.
  // Con `top` y no `bottom`: react-pdf coloca mal un elemento fijo con
  // número de página cuando se ancla abajo (sube al tope de la hoja en
  // las páginas siguientes). A5 mide 595 pt de alto.
  foot: {
    position: "absolute",
    top: 595 - 34,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footText: {
    // Cormorant: el nombre del mes puede llevar ʻ (ʻAẓamat, ʻIlm…).
    fontFamily: "Cormorant",
    fontWeight: 500,
    fontSize: 8.5,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: MIST,
  },
});

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\n/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function FeastBooklet({
  program: p,
  origin,
}: {
  program: FeastProgram;
  /** Para que el link al informe de Tesorería sea absoluto en el PDF. */
  origin: string;
}) {
  const footer = `Fiesta de ${p.monthName} · ${p.bahaiYear} E.B. · ${p.localityName}`;

  return (
    <Document
      title={`Fiesta de ${p.monthName} · ${p.bahaiYear} E.B.`}
      author={`Asamblea Espiritual Local de los Bahá'ís de ${p.localityName}`}
      language="es"
    >
      {/* Portada */}
      <Page size="A5" style={s.cover}>
        <Text style={s.kicker}>Fiesta de los Diecinueve Días</Text>
        <Text style={s.coverTitle}>{p.monthName}</Text>
        <Text style={s.coverTranslit}>
          {p.monthMeaning ? `«${p.monthMeaning}» · ` : ""}
          {p.monthOrdinal} del año {p.bahaiYear} E.B.
        </Text>
        <Text style={s.coverMeta}>
          Asamblea Espiritual Local de los Bahá&apos;ís de {p.localityName}
        </Text>
        {p.celebrationLabel && <Text style={s.coverDate}>{p.celebrationLabel}</Text>}
        {p.locations.length > 0 && (
          <View style={s.coverPlaces}>
            {p.locations.map((l, i) => (
              <Text key={i} style={s.coverPlace}>
                {l.name}
                {l.address ? <Text style={s.coverPlaceDim}> · {l.address}</Text> : null}
                <Text style={s.coverPlaceDim}> · {l.when}</Text>
              </Text>
            ))}
          </View>
        )}
        <Text style={s.coverFoot}>Programa de la Fiesta</Text>
      </Page>

      <Page size="A5" style={s.page}>
        {/* I · Devocional */}
        <View style={s.sectionHead}>
          <Text style={s.roman}>I</Text>
          <Text style={s.sectionTitle}>Porción Devocional</Text>
          <Text style={s.sectionSub}>Oraciones y lectura de los Escritos Sagrados</Text>
        </View>
        <View style={s.hair} />

        {p.prayers.map((prayer, i) => (
          <View key={i} style={s.block}>
            <View minPresenceAhead={90}>
              <Text style={s.label}>{prayer.label}</Text>
              {prayer.title && <Text style={s.theme}>«{prayer.title}»</Text>}
            </View>
            {paragraphs(prayer.body).map((t, j) => (
              <Text key={j} style={s.para}>
                {t}
              </Text>
            ))}
            {prayer.reference && <Text style={s.source}>{prayer.reference}</Text>}
            {i < p.prayers.length - 1 && <View style={s.dot} />}
          </View>
        ))}

        {p.deepening && (
          <View style={s.block}>
            <View minPresenceAhead={90}>
              <Text style={s.label}>Profundización</Text>
              <Text style={s.theme}>{p.deepening.theme}</Text>
            </View>
            {paragraphs(p.deepening.content ?? "").map((t, j) => (
              <Text key={j} style={s.para}>
                {t}
              </Text>
            ))}
          </View>
        )}

        {/* II · Administrativa */}
        <View style={s.sectionHead} break>
          <Text style={s.roman}>II</Text>
          <Text style={s.sectionTitle}>Porción Administrativa</Text>
          <Text style={s.sectionSub}>
            Noticias · Informe de Tesorería · Consulta de la comunidad
          </Text>
        </View>
        <View style={s.hair} />

        {p.news.map((section) => (
          <View key={section.scope} style={s.block}>
            <View style={s.scopeHead} minPresenceAhead={70}>
              <Text style={s.label}>{section.kicker}</Text>
              <Text style={s.scopeTitle}>{section.title}</Text>
            </View>
            {section.items.map((n) => (
              <View key={n.id} style={s.newsItem} wrap={false}>
                {n.date_label && <Text style={s.newsDate}>{n.date_label}</Text>}
                <Text style={s.newsTitle}>{n.title}</Text>
                {n.body && <Text style={s.newsBody}>{n.body}</Text>}
              </View>
            ))}
          </View>
        ))}

        {p.communique && (
          <View style={s.block}>
            <View minPresenceAhead={70}>
              <Text style={s.label}>Comunicado de la Asamblea</Text>
            </View>
            {paragraphs(p.communique).map((t, j) => (
              <Text key={j} style={s.para}>
                {t}
              </Text>
            ))}
          </View>
        )}

        <View style={s.block} minPresenceAhead={60}>
          <Text style={s.label}>Informe de Tesorería</Text>
          {p.treasury?.kind === "report" ? (
            <>
              <Text style={s.para}>
                {[p.treasury.title, p.treasury.subtitle].filter(Boolean).join(" · ")}
              </Text>
              <Text style={s.para}>
                El informe completo está en la app y en{" "}
                <Link src={`${origin}${p.treasury.href}`} style={s.link}>
                  {origin.replace(/^https?:\/\//, "")}
                  {p.treasury.href}
                </Link>
              </Text>
            </>
          ) : p.treasury?.kind === "figures" ? (
            <Text style={s.para}>
              Fondo Local · Ingresos {fmt(p.treasury.income)} · Egresos{" "}
              {fmt(p.treasury.expenses)} · Estado final {fmt(p.treasury.final)}.
            </Text>
          ) : (
            <Text style={s.para}>
              El tesorero presenta el informe del mes durante la Fiesta.
            </Text>
          )}
          <Text style={[s.para, { color: MIST }]}>
            Luego, el espacio de consulta: toda voz de la comunidad es bienvenida.
          </Text>
        </View>

        {/* III · Social */}
        <View style={s.closing} minPresenceAhead={120}>
          <Text style={s.roman}>III</Text>
          <Text style={s.sectionTitle}>Porción Social</Text>
          <Text style={s.closingText}>
            Compartamos ahora el compañerismo, la música y el refrigerio que
            preparó la comunidad.
          </Text>
          <Text style={s.sig}>Con amor</Text>
          <Text style={s.sigName}>
            Asamblea Espiritual Local de los Bahá&apos;ís de {p.localityName}
          </Text>
        </View>

        <View style={s.foot} fixed>
          <Text style={s.footText}>{footer}</Text>
          <Text
            style={s.footText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

function fmt(n: number | null): string {
  return n != null ? n.toLocaleString("es-UY", { maximumFractionDigits: 0 }) : "—";
}
