FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 zita \
 && adduser  --system --uid 1001 zita
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static
COPY --from=builder /app/public           ./public
USER zita
EXPOSE 3001
ENV PORT=3001
CMD ["node", "server.js"]
