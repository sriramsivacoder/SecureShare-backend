# SecureShare

> **Production-grade end-to-end encrypted file sharing platform**  
> Similar to WeTransfer, File.io, and Firefox Send — but with AES-256-GCM encryption, envelope key management, and full audit logging.

---

## Features

| Category | Details |
|---|---|
| 🔐 **Encryption** | AES-256-GCM per file, envelope encryption (MASTER_KEY wraps file keys) |
| 🔑 **Auth** | JWT access (15 min) + refresh tokens (7 days, rotation, httpOnly cookies) |
| ☁️ **Storage** | Cloudflare R2 (S3-compatible), encrypted objects only |
| 🦠 **Virus Scan** | ClamAV via TCP (graceful fallback in dev) |
| 📧 **Email** | Verification + password reset with HTML templates (Nodemailer) |
| 🔗 **Sharing** | Password protection, expiry dates, download limits |
| 📊 **Dashboard** | Upload stats, file management, share tracking |
| 🛡️ **Security** | Helmet, CORS, rate limiting, Joi validation, audit logs |
| 🧹 **Cleanup** | node-cron jobs clean expired shares, tokens |
| 🐳 **Docker** | Multi-stage Dockerfiles, docker-compose with ClamAV |
| 🚀 **Deploy** | Render.com (backend Web Service + frontend Static Site) |

---

## Tech Stack

**Backend:** Node.js · Express.js · MongoDB Atlas · Mongoose · Cloudflare R2 · Multer · ClamAV · node-cron

**Frontend:** React 18 · Vite · Tailwind CSS · TanStack Query · React Hook Form · Axios · React Router DOM

---

## Quick Start

### Prerequisites

- Node.js ≥ 20
- MongoDB Atlas account
- Cloudflare R2 bucket
- (Optional) SMTP server for emails

### 1. Clone & Install

```bash
git clone https://github.com/you/secureshare.git
cd secureshare

# Backend dependencies
npm install

# Frontend dependencies
npm --prefix frontend install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Generate cryptographic keys:

```bash
node scripts/generate-keys.js
```

Fill in your `.env`:

```env
MONGO_URI=mongodb+srv://...
JWT_ACCESS_SECRET=<64-char-hex>
SHARE_ACCESS_SECRET=<64-char-hex>
MASTER_KEY=<64-char-hex>          # MUST be exactly 64 hex chars (32 bytes)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY=...
R2_SECRET_KEY=...
R2_BUCKET=secureshare-files
CLIENT_URL=http://localhost:5173
```

### 3. Run Locally

```bash
# Terminal 1 — backend (port 5000)
npm run dev

# Terminal 2 — frontend (port 5173)
npm run client:dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Docker (Full Stack)

```bash
# Copy and fill in your .env first
cp .env.example .env

docker compose up --build
```

Services:
- Frontend: [http://localhost](http://localhost)
- Backend API: [http://localhost:5000](http://localhost:5000)
- ClamAV: internal (port 3310)

---

## Testing

```bash
# Backend tests (Jest + Supertest + MongoDB Memory Server)
npm test

# Frontend tests (Vitest + React Testing Library)
npm run client:test
```

---

## API Documentation

Import `postman/SecureShare.postman_collection.json` into Postman.

Set the `BASE_URL` collection variable to your API URL.

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register |
| POST | `/api/auth/verify-email` | — | Verify email |
| POST | `/api/auth/login` | — | Login |
| POST | `/api/auth/refresh` | Cookie | Refresh token |
| POST | `/api/auth/logout` | — | Logout |
| POST | `/api/auth/forgot-password` | — | Request reset |
| POST | `/api/auth/reset-password` | — | Reset password |
| GET | `/api/auth/me` | JWT | Current user |
| GET | `/api/files` | JWT | List files |
| GET | `/api/files/stats` | JWT | Storage stats |
| POST | `/api/files/upload` | JWT | Upload file |
| GET | `/api/files/:id/download` | JWT | Download own file |
| DELETE | `/api/files/:id` | JWT | Delete file |
| GET | `/api/shares` | JWT | List shares |
| POST | `/api/shares` | JWT | Create share |
| DELETE | `/api/shares/:id` | JWT | Revoke share |
| GET | `/api/shares/link/:token` | — | Share info |
| POST | `/api/shares/link/:token/access` | — | Verify password |
| GET | `/api/shares/link/:token/download` | Share Token | Download |
| PATCH | `/api/users/profile` | JWT | Update name |
| PATCH | `/api/users/change-password` | JWT | Change password |
| GET | `/api/health` | — | Health check |

---

## Deployment (Render.com)

The `render.yaml` configures:
- **Backend**: Node.js Web Service
- **Frontend**: Static Site with SPA routing rewrite

1. Push to GitHub
2. Connect repo in Render dashboard
3. Set secret environment variables in Render's env vars UI (MONGO_URI, JWT_ACCESS_SECRET, etc.)
4. Deploy

---

## Security Architecture

```
Upload Flow:
File → Virus Scan (ClamAV) → AES-256-GCM(fileKey) → R2
                                       ↓
                          fileKey wrapped with MASTER_KEY
                                       ↓
                        encryptedFileKey stored in MongoDB

Download Flow:
Request → Auth → Fetch from R2 → Decrypt fileKey → AES-256-GCM decrypt stream → Response
```

### Key Properties

- **File keys** are never stored in plaintext — envelope encryption via MASTER_KEY
- **Refresh tokens** are hashed (SHA-256) before storage
- **Password reset / verification tokens** are hashed before storage  
- **Rate limiting** on all auth, download, and share endpoints
- **Streaming** — files are never fully loaded into memory
- **ClamAV** rejects infected files before encryption

---

## Project Structure

```
secureshare/
├── app.js                    # Express app (middleware, routes)
├── server.js                 # Entry point (connect DB, start jobs)
├── config/
│   ├── dbConfig.js           # MongoDB connection
│   └── r2.js                 # S3Client for Cloudflare R2
├── controllers/
│   ├── authController.js     # Register, login, refresh, etc.
│   ├── fileController.js     # Upload, list, delete, download
│   ├── shareController.js    # Create share, verify, download
│   └── userController.js     # Profile, change password
├── middleware/
│   ├── auth.js               # JWT verification
│   ├── rateLimiter.js        # express-rate-limit configs
│   ├── upload.js             # Multer with MIME/size filtering
│   ├── validate.js           # Joi validation wrapper
│   └── errorHandler.js       # Global error handler
├── models/
│   ├── User.js               # Refresh tokens, verification tokens
│   ├── File.js               # Encrypted metadata
│   ├── Share.js              # Share links
│   └── AuditLog.js           # Action audit trail
├── routes/
│   ├── authRoutes.js
│   ├── fileRoutes.js
│   ├── shareRoutes.js
│   └── userRoutes.js
├── services/
│   ├── encryptionService.js  # AES-256-GCM, envelope encryption
│   ├── r2Service.js          # Upload/download/delete streams
│   ├── tokenService.js       # JWT generation
│   ├── emailService.js       # Nodemailer + HTML templates
│   ├── auditLogService.js    # Audit log creation/query
│   └── virusScanService.js   # ClamAV TCP integration
├── jobs/
│   └── cleanupJobs.js        # node-cron: expire shares/tokens
├── utils/
│   ├── appError.js           # Custom error class
│   ├── constants.js          # Mime types, limits
│   ├── cookies.js            # Cookie options
│   └── crypto.js             # SHA-256, random tokens
├── validators/
│   ├── authValidators.js     # Joi schemas
│   └── shareValidators.js
├── scripts/
│   └── generate-keys.js      # Key generation helper
├── tests/
│   └── backend/              # Jest + Supertest tests
├── postman/
│   └── SecureShare.postman_collection.json
├── frontend/                 # React + Vite + Tailwind
│   ├── src/
│   │   ├── api/              # Axios instance + endpoint fns
│   │   ├── context/          # AuthContext
│   │   ├── hooks/            # useFiles, useShares, useAuth
│   │   ├── layouts/          # AuthLayout, DashboardLayout
│   │   ├── pages/            # All 13 pages
│   │   ├── components/       # UI + dashboard components
│   │   ├── routes/           # ProtectedRoute, PublicOnlyRoute
│   │   └── utils/            # Formatters, error helpers
├── Dockerfile                # Backend (multi-stage + ClamAV)
├── docker-compose.yml        # Full stack
├── render.yaml               # Render.com deployment
└── .env.example
```

---

## License

MIT
