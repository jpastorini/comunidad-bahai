import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Outfit, Sora } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sora",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Comunidad Bahá'í — Centro de Comunicados",
  description:
    "Aplicación de la Comunidad Bahá'í: comunicados, actividades, materiales de estudio y gestión comunitaria.",
  applicationName: "Comunidad Bahá'í",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Comunidad Bahá'í",
  },
  formatDetection: { telephone: false },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#96790E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${cormorant.variable} ${sora.variable} ${outfit.variable}`}
    >
      <body className="bg-bg font-sans text-dark">{children}</body>
    </html>
  );
}
