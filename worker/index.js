/* eslint-disable no-restricted-globals */
/**
 * Código inyectado en el service worker generado por next-pwa
 * (se importa vía importScripts). Maneja Web Push:
 *   - "push": muestra la notificación del sistema.
 *   - "notificationclick": enfoca/abre la app en la URL del mensaje.
 */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }

  const title = data.title || "Comunidad Bahá'í";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if ("focus" in client) {
          try {
            await client.navigate(url);
          } catch (e) {
            /* navigate puede fallar en algunos navegadores */
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});
