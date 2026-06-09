# ZITA — Hostinger VPS Deployment Guide

## Recommended Plan: KVM 2 (8GB RAM, 2 vCPU) — ~$8/month

## Step 1 — Connect to your VPS
```bash
ssh root@YOUR_VPS_IP
```

## Step 2 — Install all dependencies
```bash
apt update && apt upgrade -y
apt install -y curl git unzip wget ufw

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# PostgreSQL 16
apt install -y postgresql postgresql-contrib
systemctl enable postgresql && systemctl start postgresql

# Redis
apt install -y redis-server
sed -i 's/supervised no/supervised systemd/' /etc/redis/redis.conf
systemctl enable redis-server && systemctl restart redis-server

# Nginx + Certbot
apt install -y nginx certbot python3-certbot-nginx
systemctl enable nginx && systemctl start nginx

# PM2
npm install -g pm2
```

## Step 3 — Create deploy user
```bash
adduser zita
usermod -aG sudo zita
su - zita
```

## Step 4 — Setup PostgreSQL
```bash
sudo -u postgres psql -c "CREATE USER zita WITH PASSWORD 'YOUR_DB_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE zita_db OWNER zita;"
```

## Step 5 — Setup Redis password
```bash
sudo nano /etc/redis/redis.conf
# Add line: requirepass YOUR_REDIS_PASSWORD
sudo systemctl restart redis-server
```

## Step 6 — Clone repository
```bash
mkdir -p /home/zita/apps && cd /home/zita/apps
git clone https://github.com/biola10w-cloud/zita-ecosystem.git
cd zita-ecosystem
```

## Step 7 — Configure environment
```bash
cp zita-backend/.env.example zita-backend/.env
nano zita-backend/.env
# Fill in all CHANGE_THIS values

cp zita-admin/.env.example zita-admin/.env.local
nano zita-admin/.env.local
```

## Step 8 — Generate RSA keys
```bash
cd zita-backend
bash scripts/generate-keys.sh
cd ..
```

## Step 9 — Build and start backend
```bash
cd zita-backend
npm install
npx prisma generate
npx prisma migrate deploy
npx tsx scripts/seed.ts
npm run build
pm2 start dist/server.js --name zita-api --instances 2
pm2 start dist/workers/index.js --name zita-workers
cd ..
```

## Step 10 — Build and start admin panel
```bash
cd zita-admin
npm install
npm run build
pm2 start npm --name zita-admin -- start
cd ..
```

## Step 11 — Configure Nginx
```bash
sudo cp infrastructure/nginx/nginx.conf /etc/nginx/nginx.conf
# Edit the file and replace yourdomain.com with your actual domain
sudo nano /etc/nginx/nginx.conf
sudo nginx -t && sudo systemctl reload nginx
```

## Step 12 — Add DNS records in Hostinger hPanel
- `api.yourdomain.com` → A → YOUR_VPS_IP
- `admin.yourdomain.com` → A → YOUR_VPS_IP

## Step 13 — Get free SSL
```bash
sudo certbot --nginx -d api.yourdomain.com -d admin.yourdomain.com
```

## Step 14 — Setup firewall
```bash
sudo ufw allow ssh && sudo ufw allow 80 && sudo ufw allow 443
sudo ufw enable
```

## Step 15 — Save PM2 and enable autostart
```bash
pm2 save
pm2 startup
# Run the command PM2 prints
```

## Step 16 — Verify
```bash
curl https://api.yourdomain.com/health
# Expected: {"status":"ok","version":"1.0.0"}
```

## Useful commands
```bash
pm2 status            # Check all processes
pm2 logs zita-api     # View API logs
pm2 restart zita-api  # Restart API
psql -U zita -d zita_db -h localhost  # DB access
redis-cli -a YOUR_REDIS_PASSWORD ping  # Redis check
```
