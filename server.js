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

      const passedUserId =
        socket.handshake.auth?.userId ||
        socket.handshake.auth?.user?._id;

      const passedUsername =
        socket.handshake.auth?.username ||
        socket.handshake.auth?.user?.username ||
        'user';

      if (token) {
        const payload = await verifyToken(token);
        const userId = payload?.sub || payload?.userId || payload?.id;
        if (userId) {
          socket.data.user = {
            _id: userId.toString(),
            username: payload.username || passedUsername,
            email: payload.email,
          };
          return next();
        }
      }

      // Fallback: If auth payload passes valid userId (e.g. from active React session)
      if (passedUserId) {
        socket.data.user = {
          _id: passedUserId.toString(),
          username: passedUsername,
        };
        return next();
      }

      // Guest / unauthenticated socket (allowed to connect without error)
      socket.data.user = null;
      next();
    } catch (err) {
      socket.data.user = null;
      next();
    }
  });

  io.on('connection', (socket) => {
    // If user is attached at connection time, join private user room
    if (socket.data.user?._id) {
      socket.join(`user:${socket.data.user._id}`);
      console.log(`[Socket] User connected: ${socket.data.user.username} (${socket.data.user._id}) -> room user:${socket.data.user._id}`);
    }

    // Dynamic user registration (when user logs in or switches account)
    socket.on('user:register', (data) => {
      const uId = data?.userId || data?._id;
      if (uId) {
        socket.data.user = {
          _id: uId.toString(),
          username: data.username || 'user',
        };
        socket.join(`user:${uId}`);
        console.log(`[Socket] User registered: ${data.username || uId} (${uId}) -> room user:${uId}`);
      }
    });

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
      if (conversationId && socket.data.user?._id) {
        socket.to(`conversation:${conversationId}`).emit('typing:start', {
          conversationId,
          userId: socket.data.user._id,
          username: socket.data.user.username || 'User',
        });
      }
    });

    // Realtime typing stop
    socket.on('typing:stop', ({ conversationId }) => {
      if (conversationId && socket.data.user?._id) {
        socket.to(`conversation:${conversationId}`).emit('typing:stop', {
          conversationId,
          userId: socket.data.user._id,
        });
      }
    });

    // Realtime message seen / read
    socket.on('message:read', ({ conversationId, messageIds }) => {
      if (conversationId && socket.data.user?._id) {
        socket.to(`conversation:${conversationId}`).emit('message:read', {
          conversationId,
          userId: socket.data.user._id,
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
