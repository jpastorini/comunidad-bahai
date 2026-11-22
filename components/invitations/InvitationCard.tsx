import { forwardRef, type CSSProperties } from "react";
import {
  INVITATION_SIZE,
  invitationDateLabel,
  invitationTimeLabel,
  type InvitationArtKind,
  type InvitationData,
  type InvitationFormat,
  type InvitationQuote,
  type InvitationStyle,
} from "@/lib/invitation";
import { InvitationArt } from "./InvitationArt";

// La tarjeta de invitación, tal cual sale en la imagen.
//
// ⚠️ Todos los colores son hex escritos acá, a propósito: es un documento
// que se manda afuera y no sigue el tema de quien lo arma. Y mide en px
// fijos (360 de ancho): la captura la saca al triple, 1080.
//
// ⚠️ La foto llega SIEMPRE como `data:` URI. html-to-image vuelve a pedir
// cada <img> remoto por su cuenta y, si falla, deja el hueco sin avisar
// (ver "El recibo, por comunidad" en CLAUDE.md).

type Palette = {
  background: string;
  /** Fondo de la franja ilustrada (sin foto). */
  art: [string, string];
  ink: string;
  soft: string;
  accent: string;
  line: string;
};

const PALETTES: Record<InvitationStyle, Palette> = {
  claro: {
    background: "linear-gradient(180deg, #FCF9F0 0%, #F4EDD9 100%)",
    ink: "#2A2833",
    soft: "#6B6558",
    accent: "#A8842A",
    line: "rgba(168,132,42,0.45)",
    art: ["#F1E6C6", "#F8F1DE"],
  },
  noche: {
    background: "linear-gradient(180deg, #1D1A2B 0%, #2B2542 100%)",
    ink: "#F7F1E1",
    soft: "#C5BDAA",
    accent: "#DCC06A",
    line: "rgba(220,192,106,0.5)",
    art: ["#15121F", "#262038"],
  },
  foto: {
    background: "#17141F",
    ink: "#FFFFFF",
    soft: "#E9E4D8",
    accent: "#EBD388",
    line: "rgba(235,211,136,0.6)",
    art: ["#15121F", "#262038"],
  },
};

const DISPLAY = "var(--font-cormorant), Georgia, serif";
const BODY = "var(--font-outfit), system-ui, sans-serif";

export type InvitationCardProps = {
  data: InvitationData;
  format: InvitationFormat;
  style: InvitationStyle;
  /** `data:` URI, o null para no llevar foto. */
  photo: string | null;
  quote: InvitationQuote | null;
  /** La ilustración que ocupa el lugar de la foto cuando no hay. */
  art?: InvitationArtKind | null;
};

export const InvitationCard = forwardRef<HTMLDivElement, InvitationCardProps>(
  function InvitationCard({ data, format, style, photo, quote, art = null }, ref) {
    const { w, h } = INVITATION_SIZE[format];
    const tall = format === "vertical";
    // El estilo "foto" sin foto no existe: cae a noche.
    const look: InvitationStyle = style === "foto" && !photo ? "noche" : style;
    const p = PALETTES[look];

    const title = data.title.trim() || "Título del evento";
    const len = title.length;

    const date = invitationDateLabel(data.date);
    const time = invitationTimeLabel(data.time);
    const place = data.place.trim();
    const photoBanner = look !== "foto" && photo ? photo : null;
    const artBanner = !photo ? art : null;
    const banner = Boolean(photoBanner || artBanner);
    const bannerHeight = tall ? 232 : 88;
    // Todo crece un poco en la vertical, y se aprieta en la cuadrada con
    // foto arriba, que es donde menos lugar queda.
    const k = tall ? 1.18 : banner ? 0.9 : 1;
    const titleSize = (len <= 20 ? 31 : len <= 38 ? 26 : len <= 60 ? 22 : 19) * k;

    const rowStyle: CSSProperties = {
      display: "flex",
      alignItems: "flex-start",
      gap: 9 * k,
      fontSize: 12.5 * k,
      lineHeight: 1.3,
      fontWeight: 500,
    };

    return (
      <div
        ref={ref}
        style={{
          position: "relative",
          width: w,
          height: h,
          overflow: "hidden",
          background: p.background,
          color: p.ink,
          fontFamily: BODY,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {look === "foto" && photo && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(18,14,28,0.30) 0%, rgba(18,14,28,0.55) 40%, rgba(18,14,28,0.90) 100%)",
              }}
            />
          </>
        )}

        {photoBanner && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoBanner}
            alt=""
            style={{
              width: "100%",
              height: bannerHeight,
              objectFit: "cover",
              flexShrink: 0,
              display: "block",
            }}
          />
        )}

        {artBanner && (
          <InvitationArt
            kind={artBanner}
            height={bannerHeight}
            accent={p.accent}
            line={p.line}
            from={p.art[0]}
            to={p.art[1]}
          />
        )}

        {/* Marco fino: un solo motivo, sobrio. */}
        {!banner && look !== "foto" && (
          <div
            style={{
              position: "absolute",
              inset: 10,
              border: `1px solid ${p.line}`,
              pointerEvents: "none",
            }}
          />
        )}

        <div
          data-inv-body
          style={{
            position: "relative",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: look === "foto" ? "flex-end" : "center",
            padding: tall ? "30px 30px 26px" : banner ? "10px 24px 12px" : "26px 28px 22px",
            textAlign: "center",
          }}
        >
          {data.eyebrow.trim() && (
            <div
              style={{
                fontSize: 9 * k,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 600,
                color: p.accent,
              }}
            >
              {data.eyebrow.trim()}
            </div>
          )}

          <Divider color={p.accent} line={p.line} scale={k} />

          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: titleSize,
              lineHeight: 1.08,
              fontWeight: 600,
              overflowWrap: "break-word",
            }}
          >
            {title}
          </div>

          {data.text.trim() && (
            <div
              style={{
                marginTop: 8 * k,
                fontSize: 11 * k,
                lineHeight: 1.4,
                color: p.soft,
                whiteSpace: "pre-line",
              }}
            >
              {data.text.trim()}
            </div>
          )}

          <div
            style={{
              margin: `${(tall ? 20 : 12) * k}px auto 0`,
              display: "flex",
              flexDirection: "column",
              gap: 6 * k,
              textAlign: "left",
              maxWidth: "100%",
            }}
          >
            <div style={rowStyle}>
              <Icon kind="date" color={p.accent} size={14 * k} />
              <span>{date || "Fecha"}</span>
            </div>
            <div style={rowStyle}>
              <Icon kind="time" color={p.accent} size={14 * k} />
              <span>{time || "Hora"}</span>
            </div>
            <div style={rowStyle}>
              <Icon kind="place" color={p.accent} size={14 * k} />
              <span style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
                {place || "Lugar"}
              </span>
            </div>
          </div>

          {quote && (
            <div style={{ marginTop: (tall ? 22 : 12) * k }}>
              <div
                style={{
                  fontFamily: DISPLAY,
                  fontStyle: "italic",
                  fontSize: 12.5 * k,
                  lineHeight: 1.28,
                  color: p.ink,
                }}
              >
                «{quote.text}»
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: DISPLAY,
                  fontSize: 9.5 * k,
                  color: p.soft,
                }}
              >
                {quote.reference}
              </div>
            </div>
          )}

          {data.footer.trim() && (
            <div
              style={{
                marginTop: (tall ? 24 : 12) * k,
                fontFamily: DISPLAY,
                fontSize: 10.5 * k,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: p.accent,
              }}
            >
              {data.footer.trim()}
            </div>
          )}
        </div>
      </div>
    );
  }
);

/** Línea fina con una estrella de nueve puntas al centro. */
function Divider({ color, line, scale }: { color: string; line: string; scale: number }) {
  const points: string[] = [];
  for (let i = 0; i < 18; i++) {
    const r = i % 2 === 0 ? 6 : 2.9;
    const a = (Math.PI * i) / 9 - Math.PI / 2;
    points.push(`${(7 + r * Math.cos(a)).toFixed(2)},${(7 + r * Math.sin(a)).toFixed(2)}`);
  }
  const rule: CSSProperties = { height: 1, width: 34 * scale, background: line };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        margin: `${7 * scale}px 0 ${9 * scale}px`,
      }}
    >
      <div style={rule} />
      <svg width={12 * scale} height={12 * scale} viewBox="0 0 14 14" aria-hidden>
        <polygon points={points.join(" ")} fill={color} />
      </svg>
      <div style={rule} />
    </div>
  );
}

function Icon({
  kind,
  color,
  size,
}: {
  kind: "date" | "time" | "place";
  color: string;
  size: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={color}
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, marginTop: 1 }}
      aria-hidden
    >
      {kind === "date" && (
        <>
          <rect x="2" y="3" width="12" height="11" rx="1.5" />
          <path d="M2 6.5h12M5 1.5v3M11 1.5v3" />
        </>
      )}
      {kind === "time" && (
        <>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4.5V8l2.4 1.6" />
        </>
      )}
      {kind === "place" && (
        <>
          <path d="M8 14.5s4.5-4.2 4.5-8A4.5 4.5 0 0 0 3.5 6.5c0 3.8 4.5 8 4.5 8Z" />
          <circle cx="8" cy="6.5" r="1.6" />
        </>
      )}
    </svg>
  );
}
