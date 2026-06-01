import { pushApi } from "../api/endpoints.js";

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlB64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js");
}

export async function isPushSubscribed() {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  return !!(await reg.pushManager.getSubscription());
}

// Demande la permission, s'abonne et enregistre l'abonnement côté serveur.
export async function subscribePush() {
  if (!pushSupported()) throw new Error("Notifications non supportées par ce navigateur.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permission de notification refusée.");
  const { key, enabled } = await pushApi.publicKey();
  if (!enabled || !key) throw new Error("Notifications push non configurées côté serveur.");
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) });
  }
  const j = sub.toJSON();
  await pushApi.subscribe({ endpoint: sub.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } });
  return true;
}

export async function unsubscribePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (sub) {
    await pushApi.unsubscribe({ endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
}
