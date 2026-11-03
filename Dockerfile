# ==============================================================================
# NEXUS ENTERPRISE HRMS - PRODUCTION DOCKERFILE
# Multi-stage build for lightweight, secure, and production-grade deployment
# ==============================================================================

# Stage 1: Build Frontend (React 19 Vite Tailwind)
FROM node:22-alpine AS client-builder
WORKDIR /build/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Build Backend Server (Express TypeScript)
FROM node:22-alpine AS server-builder
WORKDIR /build/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Stage 3: Production Runtime
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies only
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy compiled backend
COPY --from=server-builder /build/server/dist ./server/dist

# Copy compiled frontend SPA
COPY --from=client-builder /build/client/dist ./client/dist

# Create persistent storage directories
RUN mkdir -p /app/server/data /app/uploads/documents /app/backups

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

WORKDIR /app/server
CMD ["node", "dist/index.js"]
