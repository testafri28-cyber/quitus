import { io } from "socket.io-client";
import { getToken, BASE_URL } from "../api/client.js";

// Connexion Socket.IO authentifiée (token JWT dans le handshake).
export function connectChat() {
  return io(BASE_URL, {
    auth: { token: getToken() },
    transports: ["websocket", "polling"],
  });
}
