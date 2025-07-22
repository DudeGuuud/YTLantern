# Backend Dockerfile for FastAPI
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

# Create app directory
WORKDIR /app

# Install system dependencies for yt-dlp
# Fix GPG signature issues that are common in 2024/2025
RUN apt-get update --allow-releaseinfo-change --allow-unauthenticated --allow-insecure-repositories && \
    apt-get install -y --allow-unauthenticated --no-install-recommends \
    ffmpeg \
    curl \
    wget \
    && apt-get clean && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

# Create non-root user
RUN groupadd --gid 1000 appuser && \
    useradd --uid 1000 --gid appuser --shell /bin/bash --create-home appuser

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Create videos directory
RUN mkdir -p /app/videos && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
