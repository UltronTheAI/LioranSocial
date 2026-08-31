/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');
const { jwtVerify } = require('jose');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Helper to parse cookies from handshake header string
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      cookies[name] = decodeURIComponent(value);
    }
  });
  return cookies;
}

// Helper to verify JWT access token
async function verifyToken(token) {
  try {
    const secretKey = new TextEncoder().encode(
      process.env.JWT_SECRET || 'default_jwt_secret_change_me_in_production_min32'
    );
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch {
    return null;
  }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      credentials: true,
    },
    path: '/socket.io',
  });

  // Attach global reference so API routes can emit socket events
  global.io = io;

  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      const cookies = parseCookies(cookieHeader);
      const token =
        socket.handshake.auth?.token ||
        cookies.lioran_access_token ||
        cookies.accessToken;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = await verifyToken(token);
      const userId = payload?.sub || payload?.userId;
      if (!payload || !userId) {
        return next(new Error('Invalid or expired authentication token'));
      }

      // Securely attach authenticated user
      socket.data.user = {
        _id: userId.toString(),
        username: payload.username,
        email: payload.email,
      };

      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user) return;

    // Automatically join private user room for live notifications and alerts
    socket.join(`user:${user._id}`);
    console.log(`[Socket] User connected: ${user.username} (${user._id}) -> room user:${user._id}`);

    // Join conversation room
    socket.on('conversation:join', (conversationId) => {
      if (typeof conversationId === 'string' && conversationId.trim()) {
        socket.join(`conversation:${conversationId}`);
      }
    });

    // Leave conversation room
    socket.on('conversation:leave', (conversationId) => {
      if (typeof conversationId === 'string' && conversationId.trim()) {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    // Realtime typing start
    socket.on('typing:start', ({ conversationId }) => {
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('typing:start', {
          conversationId,
          userId: user._id,
          username: user.username,
        });
      }
    });

    // Realtime typing stop
    socket.on('typing:stop', ({ conversationId }) => {
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('typing:stop', {
          conversationId,
          userId: user._id,
        });
      }
    });

    // Realtime message seen / read
    socket.on('message:read', ({ conversationId, messageIds }) => {
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('message:read', {
          conversationId,
          userId: user._id,
          messageIds,
          readAt: new Date().toISOString(),
        });
      }
    });

    socket.on('disconnect', () => {
      // Automatic cleanup handled by socket.io
    });
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> LioranSocial ready on http://${hostname}:${port} (Next.js + Socket.IO)`);
  });
});
