import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '../constants';

/** Socket server is the API origin without trailing /api */
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '');

let socket: Socket | null = null;
let connectedToken: string | null = null;

export function connectUserSocket(token: string): Socket | null {
  if (!token) return null;

  if (socket && connectedToken === token) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  connectedToken = token;
  socket = io(SOCKET_URL, {
    query: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 15000,
  });

  socket.on('connect_error', (err) => {
    console.warn('[textnext realtime] connect error:', err?.message);
  });

  return socket;
}

export function getUserSocket(): Socket | null {
  return socket;
}

export function disconnectUserSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  connectedToken = null;
}
