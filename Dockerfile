# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine

RUN apk add --no-cache clamav clamav-daemon freshclam && \
    freshclam --quiet || true

WORKDIR /app

# Only copy production node_modules and app code
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "server.js"]
