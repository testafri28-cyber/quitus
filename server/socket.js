// Serveur Socket.IO — discussion temps réel (salons global + par service) + présence + activité.
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "./lib/prisma.js";
import { canAccessRoom } from "./services/chat.js";
import { allowedOrigins } from "./lib/cors.js";

const PRESENCES = ["AVAILABLE", "UNAVAILABLE", "ON_LEAVE"];

// Référence légère pour l'observabilité (backoffice → /system/health).
let ioRef = null;
export function socketConnectionCount() {
  return ioRef ? ioRef.engine.clientsCount : 0;
}

// Émet un évènement aux salles personnelles d'une liste d'utilisateurs (best-effort).
export function emitToUsers(userIds, event, payload) {
  if (!ioRef) return;
  for (const id of new Set((userIds || []).filter(Boolean))) {
    ioRef.to(`user:${id}`).emit(event, payload);
  }
}

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
  });
  ioRef = io;

  // Présence en ligne : userId -> nombre de sockets connectés.
  const online = new Map();
  const isOnline = (userId) => (online.get(userId) || 0) > 0;

  // Auth par JWT (handshake.auth.token).
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, role: true, departmentId: true },
      });
      if (!user) return next(new Error("unauthorized"));
      socket.user = user;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const uid = socket.user.id;
    socket.join(`user:${uid}`); // salle personnelle (activité chat, etc.)

    // Mise à jour présence en ligne.
    const prev = online.get(uid) || 0;
    online.set(uid, prev + 1);
    if (prev === 0) io.emit("presence:online", { userId: uid });
    // Instantané des utilisateurs en ligne pour ce nouveau client.
    socket.emit("presence:snapshot", { online: [...online.keys()] });

    socket.on("chat:join", async ({ roomId }) => {
      try {
        const room = await prisma.chatRoom.findUnique({ where: { id: roomId }, include: { department: true } });
        if (room && canAccessRoom(socket.user, room)) socket.join(`room:${roomId}`);
      } catch { /* ignore */ }
    });

    socket.on("chat:leave", ({ roomId }) => socket.leave(`room:${roomId}`));

    socket.on("chat:send", async ({ roomId, content, mentions, attachmentUrl, attachmentName }) => {
      try {
        const text = (content || "").trim().slice(0, 2000);
        const hasAttachment = typeof attachmentUrl === "string" && attachmentUrl.startsWith("/uploads/");
        if (!text && !hasAttachment) return; // message vide refusé
        const room = await prisma.chatRoom.findUnique({ where: { id: roomId }, include: { department: true } });
        if (!room || room.archived || !canAccessRoom(socket.user, room)) return;
        const msg = await prisma.chatMessage.create({
          data: {
            roomId,
            authorId: uid,
            content: text,
            attachmentUrl: hasAttachment ? attachmentUrl : null,
            attachmentName: hasAttachment ? (attachmentName || "fichier").slice(0, 200) : null,
          },
          include: { author: { select: { id: true, name: true } } },
        });
        io.to(`room:${roomId}`).emit("chat:message", msg);
        await dispatchActivity(io, online, room, msg, socket.user);
        await dispatchMentions(io, room, msg, socket.user, mentions);
      } catch (e) {
        console.error("chat:send", e?.message || e);
      }
    });

    socket.on("chat:delete", async ({ messageId }) => {
      try {
        const msg = await prisma.chatMessage.findUnique({
          where: { id: messageId },
          include: { room: { include: { department: true } } },
        });
        if (!msg) return;
        const isAuthor = msg.authorId === uid;
        const canManage = socket.user.role === "ADMIN" || (msg.room.scope === "DEPARTMENT" && msg.room.department?.responsibleId === uid);
        if (!isAuthor && !canManage) return;
        await prisma.chatMessage.delete({ where: { id: messageId } });
        io.to(`room:${msg.roomId}`).emit("chat:deleted", { id: messageId, roomId: msg.roomId });
      } catch (e) {
        console.error("chat:delete", e?.message || e);
      }
    });

    // Déclaration de disponibilité (Disponible / Indisponible / En congé).
    socket.on("presence:set", async ({ presence }) => {
      try {
        if (!PRESENCES.includes(presence)) return;
        await prisma.user.update({ where: { id: uid }, data: { presence } });
        io.emit("presence:status", { userId: uid, presence });
      } catch (e) {
        console.error("presence:set", e?.message || e);
      }
    });

    socket.on("disconnect", () => {
      const n = (online.get(uid) || 1) - 1;
      if (n <= 0) { online.delete(uid); io.emit("presence:offline", { userId: uid }); }
      else online.set(uid, n);
    });
  });

  return io;
}

// Prévient en temps réel les destinataires connectés qui ne regardent pas le salon,
// pour qu'ils incrémentent leur badge « Discussion » (le compteur exact est tenu par ChatRead côté REST).
async function dispatchActivity(io, online, room, msg, author) {
  try {
    // Destinataires = membres pouvant accéder au salon, sauf l'auteur.
    let recipientIds;
    if (room.scope === "GLOBAL") {
      const users = await prisma.user.findMany({ select: { id: true } });
      recipientIds = users.map((u) => u.id);
    } else {
      const members = await prisma.user.findMany({ where: { departmentId: room.departmentId }, select: { id: true } });
      recipientIds = members.map((m) => m.id);
    }
    recipientIds = recipientIds.filter((id) => id !== author.id);
    if (!recipientIds.length) return;

    // Qui regarde déjà ce salon (a rejoint room:ID) → pas de badge.
    const viewers = await io.in(`room:${room.id}`).fetchSockets();
    const viewerIds = new Set(viewers.map((s) => s.user.id));

    for (const id of recipientIds) {
      if (!viewerIds.has(id) && online.get(id) > 0) {
        io.to(`user:${id}`).emit("chat:activity", { roomId: room.id, name: room.name });
      }
    }
  } catch (e) {
    console.error("dispatchActivity", e?.message || e);
  }
}

// Mentions @ : notification personnelle (cloche) + signal temps réel aux personnes citées.
async function dispatchMentions(io, room, msg, author, mentions) {
  try {
    const ids = [...new Set((mentions || []).filter(Boolean))].filter((id) => id !== author.id);
    if (!ids.length) return;
    // Ne garder que des destinataires qui ont réellement accès au salon.
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, departmentId: true, role: true } });
    const valid = users.filter((u) => room.scope === "GLOBAL" || u.role === "ADMIN" || u.departmentId === room.departmentId);
    if (!valid.length) return;

    const body = msg.content || (msg.attachmentName ? `📎 ${msg.attachmentName}` : "pièce jointe");
    const preview = body.length > 80 ? body.slice(0, 80) + "…" : body;
    const text = `${author.name} vous a mentionné dans « ${room.name} » : ${preview}`;
    await prisma.notification.createMany({
      data: valid.map((u) => ({ userId: u.id, type: "mention", text, roomId: room.id })),
    });
    for (const u of valid) io.to(`user:${u.id}`).emit("chat:mention", { roomId: room.id, name: room.name });
  } catch (e) {
    console.error("dispatchMentions", e?.message || e);
  }
}
