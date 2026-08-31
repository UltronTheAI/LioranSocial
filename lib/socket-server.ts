import { Server as SocketIOServer } from 'socket.io';

declare global {
  var io: SocketIOServer | undefined;
}

export function setSocketServer(ioInstance: SocketIOServer) {
  global.io = ioInstance;
}

export function getSocketServer(): SocketIOServer | null {
  return global.io || null;
}

export function emitSocketEvent(room: string, event: string, payload: unknown) {
  const io = getSocketServer();
  if (io) {
    io.to(room).emit(event, payload);
  }
}
