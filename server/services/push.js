// Web Push (notifications navigateur) via VAPID. Best-effort.
import webpush from "web-push";
import { prisma } from "../lib/prisma.js";

const PUB = process.env.VAPID_PUBLIC_KEY;
const PRIV = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@demo.local";

export const pushEnabled = !!(PUB && PRIV);
if (pushEnabled) {
  try { webpush.setVapidDetails(SUBJECT, PUB, PRIV); }
  catch (e) { console.error("VAPID invalide:", e?.message || e); }
}

export function vapidPublicKey() {
  return PUB || null;
}

// Envoie un payload à tous les abonnements fournis ; purge ceux expirés (404/410).
export async function sendPushToSubs(subs, payload) {
  if (!pushEnabled || !subs?.length) return;
  const data = JSON.stringify(payload);
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, data);
    } catch (err) {
      const code = err?.statusCode;
      if (code === 404 || code === 410) {
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      } else {
        console.error("push échec:", code || err?.message || err);
      }
    }
  }));
}
