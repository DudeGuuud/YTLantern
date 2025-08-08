# Multi-stage Dockerfile for YTLantern
FROM oven/bun:1.1.38-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    curl \
    wget \
    ca-certificates

# Install yt-dlp
RUN pip3 install --no-cache-dir yt-dlp==2025.07.21

WORKDIR /app

# Frontend build stage
FROM base AS frontend-builder

# Copy frontend package files
COPY src/package.json src/bun.lockb* ./src/
WORKDIR /app/src

# Install frontend dependencies
RUN bun install --frozen-lockfile

# Copy frontend source
COPY src/ ./

# Build frontend
RUN bun run build

# Backend stage
FROM base AS backend

# Copy backend package files
COPY package.json bun.lockb* ./

# Install backend dependencies
RUN bun install --frozen-lockfile --production

# Copy backend source
COPY server/ ./server/
COPY .env* ./

# Copy built frontend from frontend-builder
COPY --from=frontend-builder /app/src/.next ./src/.next
COPY --from=frontend-builder /app/src/public ./src/public

# Create necessary directories
RUN mkdir -p tmp && \
    chmod 755 tmp

# Copy cookies file
COPY server/cookies.txt ./server/

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start the application
CMD ["bun", "run", "start"]
