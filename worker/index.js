/* eslint-disable no-restricted-globals */
/**
 * Código inyectado en el service worker generado por next-pwa
 * (se importa vía importScripts). Maneja Web Push:
 *   - "push": muestra la notificación del sistema.
 *   - "notificationclick": enfoca/abre la app en la URL del mensaje.
 *   - "pushsubscriptionchange": el navegador rotó la suscripción; se
 *     vuelve a suscribir con la misma clave y se registra en el servidor,
 *     para que la persona no quede sin avisos sin enterarse.
 */

self.addEventListener("pushsubscriptionchange", (event) => {
  const oldSub = event.oldSubscription;
  const key =
    (event.newSubscription && event.newSubscription.options.applicationServerKey) ||
    (oldSub && oldSub.options.applicationServerKey);
  if (!key) return;

  event.waitUntil(
    (async () => {
      const sub =
        event.newSubscription ||
        (await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        }));
      // Las cookies de sesión viajan solas en same-origin; si la sesión
      // venció, el endpoint devuelve 401 y la app lo repara al abrirse
      // (NotificationsSheet → ensurePushSubscription).
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (oldSub && oldSub.endpoint !== sub.endpoint) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: oldSub.endpoint }),
        });
      }
    })().catch((e) => {
      console.error("[sw] pushsubscriptionchange:", e);
    })
  );
});

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
