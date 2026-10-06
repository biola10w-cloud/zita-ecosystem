FROM node:20-alpine AS build

RUN apk add --no-cache openssl
WORKDIR /app

COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci

COPY backend/ ./
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine AS runtime

RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

USER node
EXPOSE 3000

CMD ["node", "dist/src/server.js"]
