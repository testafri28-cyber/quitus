// Serveur Socket.IO — discussion temps réel (salons global + par service).
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "./lib/prisma.js";
import { canAccessRoom } from "./services/chat.js";

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true },
  });

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
    socket.on("chat:join", async ({ roomId }) => {
      try {
        const room = await prisma.chatRoom.findUnique({ where: { id: roomId }, include: { department: true } });
        if (room && canAccessRoom(socket.user, room)) socket.join(`room:${roomId}`);
      } catch { /* ignore */ }
    });

    socket.on("chat:leave", ({ roomId }) => socket.leave(`room:${roomId}`));

    socket.on("chat:send", async ({ roomId, content }) => {
      try {
        if (!content || !content.trim()) return;
        const room = await prisma.chatRoom.findUnique({ where: { id: roomId }, include: { department: true } });
        if (!room || room.archived || !canAccessRoom(socket.user, room)) return;
        const msg = await prisma.chatMessage.create({
          data: { roomId, authorId: socket.user.id, content: content.trim().slice(0, 2000) },
          include: { author: { select: { id: true, name: true } } },
        });
        io.to(`room:${roomId}`).emit("chat:message", msg);
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
        const isAuthor = msg.authorId === socket.user.id;
        const canManage = socket.user.role === "ADMIN" || (msg.room.scope === "DEPARTMENT" && msg.room.department?.responsibleId === socket.user.id);
        if (!isAuthor && !canManage) return;
        await prisma.chatMessage.delete({ where: { id: messageId } });
        io.to(`room:${msg.roomId}`).emit("chat:deleted", { id: messageId, roomId: msg.roomId });
      } catch (e) {
        console.error("chat:delete", e?.message || e);
      }
    });
  });

  return io;
}
