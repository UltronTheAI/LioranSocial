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
      process.env.JWT_SECRET || 'your_super_secret_jwt_access_token_key_min_32_chars'
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
      const token = socket.handshake.auth?.token || cookies.accessToken;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = await verifyToken(token);
      if (!payload || !payload.sub) {
        return next(new Error('Invalid or expired authentication token'));
      }

      // Securely attach authenticated user (never trust client-supplied ID)
      socket.data.user = {
        _id: payload.sub,
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

    // Join private user room for personal notifications
    socket.join(`user:${user._id}`);

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

    // Ephemeral typing start (in-memory only, no DB writes)
    socket.on('typing:start', ({ conversationId }) => {
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('typing:start', {
          conversationId,
          userId: user._id,
          username: user.username,
        });
      }
    });

    // Ephemeral typing stop (in-memory only, no DB writes)
    socket.on('typing:stop', ({ conversationId }) => {
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('typing:stop', {
          conversationId,
          userId: user._id,
        });
      }
    });

    socket.on('disconnect', () => {
      // Clean up automatically handled by socket.io rooms
    });
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> LioranSocial ready on http://${hostname}:${port} (Next.js + Socket.IO)`);
  });
});
