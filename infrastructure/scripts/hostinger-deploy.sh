#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# ZITA — Hostinger VPS Deployment Script
# Run as: bash hostinger-deploy.sh
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="/home/zita/apps/zita-ecosystem"
BACKEND_DIR="$REPO_DIR/zita-backend"
ADMIN_DIR="$REPO_DIR/zita-admin"

echo "🚀 ZITA Hostinger Deployment"
echo "=============================="

# Pull latest code
cd "$REPO_DIR"
git pull origin main
echo "✅ Code updated"

# ─── Backend ────────────────────────────────────────────────────
echo ""
echo "📦 Rebuilding backend..."
cd "$BACKEND_DIR"
npm ci --only=production
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart zita-api   || pm2 start dist/server.js  --name zita-api     --instances 2
pm2 restart zita-workers || pm2 start dist/workers/index.js --name zita-workers
echo "✅ Backend deployed"

# ─── Admin panel ────────────────────────────────────────────────
echo ""
echo "🎨 Rebuilding admin panel..."
cd "$ADMIN_DIR"
npm ci
npm run build
pm2 restart zita-admin || pm2 start npm --name zita-admin -- start
echo "✅ Admin panel deployed"

# ─── Nginx reload ───────────────────────────────────────────────
sudo nginx -t && sudo systemctl reload nginx
echo "✅ Nginx reloaded"

# ─── Health check ───────────────────────────────────────────────
echo ""
echo "🩺 Running health check..."
sleep 3
curl -sf http://localhost:3000/health && echo "✅ API is healthy" || echo "❌ API health check failed"

pm2 save
echo ""
echo "✅ Deployment complete!"
echo "   API:   https://api.yourdomain.com"
echo "   Admin: https://admin.yourdomain.com"
