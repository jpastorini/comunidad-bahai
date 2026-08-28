import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  experimental: {
    // Permite subir PDFs e imágenes (invitaciones) de comunicados hasta 10MB.
    serverActions: { bodySizeLimit: "10mb" },

    // Cuánto vive en MEMORIA del navegador una pantalla ya visitada, antes
    // de que volver a ella cueste otra ida y vuelta al servidor.
    //
    // Todas las rutas son dinámicas (autentican con cookies), así que Next
    // no puede pre-renderizarlas: sin esto, cada toque en la TabBar es un
    // request completo. Los dos números NO son lo mismo:
    //   - dynamic: ventana desde el ÚLTIMO uso de la entrada. Aplica a
    //     cualquier navegación, venga de prefetch o no.
    //   - static: ventana desde el prefetch. Para los <Link prefetch> de la
    //     TabBar (kind "full") es la que decide cuánto se reusan los DATOS,
    //     no solo el esqueleto de loading.tsx.
    //
    // El techo lo pone la frescura: 3 min es lo más que queremos que tarde
    // en aparecer un comunicado nuevo al cambiar de pestaña. Lo urgente no
    // depende de esto — el chat entrante llama a router.refresh() y los
    // server actions invalidan con revalidatePath, y las dos cosas tiran
    // abajo este caché al instante.
    staleTimes: { dynamic: 180, static: 300 },
  },
};

export default withPWA(nextConfig);
