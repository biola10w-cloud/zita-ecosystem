<div align="center">
  <h1>📚 ZITA Ecosystem</h1>
  <p><strong>A global, secure, multilingual reading platform</strong></p>
  <p>
    <img src="https://img.shields.io/badge/Flutter-3.16-blue?logo=flutter" />
    <img src="https://img.shields.io/badge/Node.js-20-green?logo=node.js" />
    <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" />
    <img src="https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql" />
    <img src="https://img.shields.io/badge/Redis-7-red?logo=redis" />
    <img src="https://img.shields.io/badge/Encryption-AES--256--GCM-gold" />
  </p>
</div>

---

## 📦 Repository Structure

```
zita-ecosystem/
├── zita-backend/        ← Node.js + Fastify + TypeScript API
├── zita-app/            ← Flutter mobile app (iOS + Android)
├── zita-admin/          ← Next.js 14 admin dashboard
├── infrastructure/      ← Nginx, Terraform, CI/CD, deploy scripts
└── docker-compose.yml   ← Full local dev stack
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js >= 20
- Flutter >= 3.16
- Docker + Docker Compose
- Git

### 1. Clone the repository
```bash
git clone https://github.com/biola10w-cloud/zita-ecosystem.git
cd zita-ecosystem
```

### 2. Generate RSA keys (JWT signing)
```bash
cd zita-backend
bash scripts/generate-keys.sh
cd ..
```

### 3. Configure environment variables
```bash
cp zita-backend/.env.example zita-backend/.env
# Edit zita-backend/.env with your values

cp zita-admin/.env.example zita-admin/.env.local
# Edit zita-admin/.env.local with your values
```

### 4. Start all services with Docker Compose
```bash
docker-compose up -d
```

### 5. Run database migrations + seed
```bash
cd zita-backend
npm install
npx prisma migrate deploy
npx tsx scripts/seed.ts
cd ..
```

### 6. Access the services
| Service     | URL                        | Credentials                        |
|-------------|----------------------------|------------------------------------|
| API         | http://localhost:3000      | —                                  |
| API Health  | http://localhost:3000/health | —                                |
| Admin Panel | http://localhost:3001      | admin@zita.app / Admin@ZITA2025!   |

---

## 🏗 Architecture

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Flutter App │  │  Admin Panel │  │  Mobile API  │
│   (iOS/Android)│  │  (Next.js)   │  │  (External)  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       └─────────────────┼──────────────────┘
                         │ HTTPS / TLS 1.3
                 ┌───────▼────────┐
                 │   Nginx Proxy  │
                 │  Rate Limiting │
                 └───────┬────────┘
                         │
              ┌──────────▼──────────┐
              │   Fastify API       │
              │   (Node.js + TS)    │
              └──┬──────────────┬───┘
                 │              │
        ┌────────▼───┐   ┌─────▼──────┐
        │ PostgreSQL │   │   Redis    │
        │  (Prisma)  │   │ Cache+Bull │
        └────────────┘   └────────────┘
                 │
        ┌────────▼───────┐
        │   S3 / R2      │
        │ Encrypted Books│
        └────────────────┘
                 │
        ┌────────▼───────┐
        │   AWS KMS      │
        │  Master Keys   │
        └────────────────┘
```

---

## 🔒 Security Features

| Feature | Implementation |
|---|---|
| Content Encryption | AES-256-GCM per chapter, GCM auth tag integrity |
| Key Management | AWS KMS envelope encryption, keys never on disk |
| Authentication | RS256 JWT (asymmetric), 15-min expiry |
| Refresh Tokens | Single-use rotation, theft detection |
| Screenshot Blocking | FLAG_SECURE (Android), ScreenProtector (iOS) |
| Recording Detection | iOS UIScreen.isCaptured monitoring |
| Watermarking | Zero-width Unicode steganography + visual overlay |
| Device Binding | Fingerprint in JWT, hardware RSA key pair |
| Root Detection | Offline key denied on rooted/jailbroken devices |
| Rate Limiting | Redis sliding window, per-route configs |

---

## 📱 Mobile App (zita-app)

Built with Flutter 3.16 + Riverpod.

```bash
cd zita-app
flutter pub get
flutter pub run build_runner build --delete-conflicting-outputs

# Run on device (security features require physical device)
flutter run --dart-define=API_URL=https://api.yourdomain.com --release
```

**Features:**
- 🔐 Email auth + social login with device binding
- 📖 Encrypted online + offline reading
- 🎧 Text-to-speech voice assistant
- 🌐 50+ language translation overlay
- 💬 Threaded community discussions
- 💳 7-day free trial + monthly/annual IAP
- 📊 Reading streak + progress dashboard
- 🚫 Screenshot + screen recording blocking

---

## ⚙️ Backend API (zita-backend)

Built with Fastify + TypeScript + Prisma.

```bash
cd zita-backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev        # API on :3000
npm run workers    # Background workers (separate terminal)
```

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/auth/register | — | Register user |
| POST | /api/v1/auth/login | — | Login + device bind |
| POST | /api/v1/auth/refresh | — | Rotate refresh token |
| GET | /api/v1/books | — | List books |
| GET | /api/v1/books/featured | — | Featured books |
| GET | /api/v1/books/:slug/chapters/:i/content | ✓ | Decrypted chapter |
| POST | /api/v1/books/:slug/progress | ✓ | Save reading progress |
| POST | /api/v1/books/:slug/offline-key | ✓ | Device-locked offline key |
| POST | /api/v1/subscriptions/verify | ✓ | Verify IAP receipt |
| POST | /api/v1/books/:slug/comments | ✓ | Post comment |
| GET | /api/v1/analytics/me | ✓ | Reading stats |

---

## 🎛 Admin Panel (zita-admin)

Built with Next.js 14 + TypeScript + Tailwind CSS.

```bash
cd zita-admin
npm install
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL and JWT_SECRET
npm run dev   # Admin on :3001
```

**Screens:**
- 📊 Overview dashboard with KPI stats + charts
- 📚 Book management + multi-step upload wizard
- 👥 User management + role assignment
- 💳 Subscription overview
- 💬 Community report queue (flag/dismiss)
- 📈 Analytics charts
- 🌐 Translation pipeline management

---

## 🖥 Hostinger VPS Deployment

See the full guide: [HOSTINGER_DEPLOY.md](./infrastructure/HOSTINGER_DEPLOY.md)

**Quick deploy after setup:**
```bash
bash infrastructure/scripts/hostinger-deploy.sh
```

### GitHub Actions Secrets Required

Go to your repo → Settings → Secrets → Actions and add:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | Your Hostinger VPS IP address |
| `VPS_USER` | `zita` (the deploy user) |
| `VPS_SSH_KEY` | Your private SSH key for VPS access |
| `API_URL` | `https://api.yourdomain.com/api/v1` |

---

## ☁️ AWS Services Required

| Service | Purpose | Cost estimate |
|---------|---------|---------------|
| S3 / Cloudflare R2 | Encrypted book storage | ~$0.02/GB |
| KMS | Master encryption key | ~$1/month |
| Secrets Manager | API keys + credentials | ~$0.40/secret/month |

---

## 🧪 Testing

```bash
# Backend tests
cd zita-backend
npm test

# Flutter tests
cd zita-app
flutter test

# Load test (requires k6)
k6 run infrastructure/scripts/load-test.js
```

---

## 📄 Documentation

All phase documentation is included in the `docs/` folder:
- `docs/phase1-architecture.md` — System design + DB schema
- `docs/phase2-mobile.md` — Full Flutter codebase
- `docs/phase3-backend.md` — Full Node.js backend
- `docs/phase4-admin.md` — Full Next.js admin panel
- `docs/phase5-security.md` — Security implementations
- `docs/phase6-deployment.md` — Deployment + CI/CD

---

## 📝 License

MIT — Built with ❤️ by the ZITA team.
