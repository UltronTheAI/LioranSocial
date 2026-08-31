# LioranSocial — Modern Dark-Mode Social Media Web Application

LioranSocial is a dark-mode social media web application inspired by the core UX of Instagram, built with Next.js App Router, TypeScript, Tailwind CSS, MongoDB Atlas, Cloudinary media infrastructure, and Socket.IO for realtime communications.

---

## Key Features

1. **Authentication & Session Security**:
   - Secure registration with Argon2id password hashing.
   - 6-digit OTP email verification via Nodemailer.
   - Dual-token JWT session system (15-minute Access Token + 30-day rotating Refresh Token).
   - Password reset workflow with rate limiting and secure tokens.

2. **User Profiles & Follow Graph**:
   - Custom dynamic profiles (`/u/[username]`) with avatar, bio, follower/following metrics, and verified badge.
   - Atomic follow/unfollow toggle with optimistic UI updates.
   - Edit profile modal with client-side avatar square cropping (`react-easy-crop`) and direct Cloudinary upload.

3. **Photo Posts & Infinite Following Feed**:
   - Multi-image posts (1 to 10 photos) with square cropping.
   - Infinite scrolling following feed with cursor-based pagination.
   - Double-tap heart animations, atomic like/unlike, bookmarking/saves, and scrollable comment threads.

4. **Reels (Short-form Vertical Video)**:
   - Full-height vertical snap-scrolling feed (`/reels`).
   - `IntersectionObserver` viewport playback management (only visible reel plays).
   - 3-second continuous watch threshold view recording with 1-hour cooldown deduplication (MongoDB TTL index).
   - Direct signed Cloudinary video uploads (bypassing Next.js memory limits).

5. **24-Hour Ephemeral Stories**:
   - 24-hour lifetime managed automatically by MongoDB TTL index (`expiresAt`).
   - Story circles bar on the Home feed with rainbow gradient rings.
   - Multi-story player with segmented progress bars (5s photo / video duration), tap navigation, and hold-to-pause.
   - Story reactions & replies connected directly to 1-on-1 direct messages.

6. **Realtime Messaging (Socket.IO)**:
   - 1-on-1 Direct Messages with duplicate conversation prevention.
   - Multi-user Group Chats with title and member management.
   - Socket.IO connection authenticated via handshake JWT cookies.
   - Ephemeral typing indicators (`typing:start`, `typing:stop`).
   - Rich message bubbles for text, image attachments, shared Posts, shared Reels, and Story replies.

7. **Search & Basic Notifications**:
   - 4-tab debounced search: **Top**, **Users**, **Posts**, **Reels**.
   - Notifications feed (`/notifications`) for follows, likes, comments, and messages with realtime updates.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router + Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (Strict Dark Mode)
- **Database**: MongoDB Atlas with Mongoose ODM
- **Realtime**: Socket.IO (`socket.io` & `socket.io-client`)
- **Media**: Cloudinary (Image & Video CDN)
- **Email**: Nodemailer (SMTP)
- **Security**: Argon2id, Jose (JWT), Zod

---

## Getting Started

### 1. Prerequisites

- Node.js 20+
- A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster (or local MongoDB)
- A free [Cloudinary](https://cloudinary.com/) account
- An SMTP server / test provider (e.g. [Mailtrap](https://mailtrap.io/))

### 2. Environment Configuration

Copy `.env.example` to `.env.local` and configure your credentials:

```bash
cp .env.example .env.local
```

```env
# Application
PORT=3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# MongoDB
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/lioransocial?retryWrites=true&w=majority

# Authentication Secrets (generate using: openssl rand -base64 32)
JWT_SECRET=your_super_secret_jwt_access_token_key_min_32_chars
REFRESH_TOKEN_SECRET=your_super_secret_refresh_token_key_min_32_chars
COOKIE_SECRET=your_super_secret_cookie_encryption_key_min_32_chars

# SMTP / Email
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
EMAIL_FROM="LioranSocial <noreply@lioransocial.app>"

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

### 3. Installation

```bash
npm install
```

### 4. Development Server

Start the custom Node.js HTTP server running Next.js alongside Socket.IO:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Production Build & Deployment

### Build Command

```bash
npm run build
```

### Production Start

```bash
npm run start
```

### Deployment Notes

- **Persistent Hosting**: Because Socket.IO relies on persistent WebSocket connections and long-polling fallbacks, deploy to a stateful Node.js environment (Docker, AWS EC2/ECS, DigitalOcean App Platform, Railway, Render, Fly.io, or VPS) with `node server.js`.
- **Reverse Proxy**: If using NGINX or Cloudflare, ensure WebSocket upgrades are enabled:
  ```nginx
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  ```
- **Horizontal Scaling**: If scaling across multiple container instances, attach `@socket.io/redis-adapter` to synchronize room events across cluster nodes.
