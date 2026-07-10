# ============================================================
# Orbiton — Dockerfile
# Multi-platform: linux/amd64, linux/arm64
# ============================================================
FROM node:22-slim AS base

LABEL maintainer="Orbiton"
LABEL description="Orbiton - Universal App & Server Manager"

# Install runtime dependencies + tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    openjdk-21-jdk-headless \
    docker.io \
    git curl wget unzip \
    build-essential python3-dev \
    bash procps ca-certificates \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Verify runtimes
RUN node --version && python3 --version && java --version

WORKDIR /app

# Copy backend dependencies first (layer cache)
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Try to build node-pty (PTY support), don't fail if unavailable
RUN cd backend && npm install node-pty --build-from-source || echo "node-pty skipped"

# Copy all files
COPY backend/  ./backend/
COPY frontend/ ./frontend/

# Data directory
RUN mkdir -p /data/apps
VOLUME ["/data", "/var/run/docker.sock"]

# Environment
ENV NODE_ENV=production \
    PORT=3000 \
    SSL_PORT=3443 \
    DATA_DIR=/data

# Expose ports
EXPOSE 3000 3443

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:3000/api/auth/status || exit 1

WORKDIR /app/backend
CMD ["node", "server.js"]
