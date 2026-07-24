# ─── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm install --verbose
COPY . .
RUN npx prisma generate
RUN npm run build

# ─── Production stage ─────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

# Security: non-root user
RUN addgroup --system --gid 1001 zita \
 && adduser  --system --uid 1001 zita

COPY --from=builder /app/dist        ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma      ./prisma
COPY --from=builder /app/package.json .

# Keys mounted at runtime — never baked into image
RUN mkdir -p /app/keys && chown zita:zita /app/keys

USER zita
EXPOSE 8080
ENV PORT=8080

CMD ["node", "dist/server.js"]

