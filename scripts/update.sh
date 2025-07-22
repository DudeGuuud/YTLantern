#!/bin/bash

# YTLantern Update Script
# This script updates the YTLantern application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if we're in the right directory
check_directory() {
    if [[ ! -f "docker-compose.yml" ]]; then
        error "docker-compose.yml not found. Please run this script from the project root directory."
    fi
}

# Backup current deployment
backup_deployment() {
    log "Creating backup..."
    
    BACKUP_DIR="backups/backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup configuration files
    cp -r backend/.env "$BACKUP_DIR/" 2>/dev/null || true
    cp -r .env.local "$BACKUP_DIR/" 2>/dev/null || true
    cp -r nginx/nginx.conf "$BACKUP_DIR/" 2>/dev/null || true
    
    # Backup database/cache if needed
    docker-compose exec -T redis redis-cli BGSAVE || true
    
    log "Backup created at $BACKUP_DIR"
}

# Update application code
update_code() {
    log "Updating application code..."
    
    # Pull latest changes
    if [[ -d ".git" ]]; then
        git pull origin main
    else
        warn "Not a git repository. Please manually update the code."
    fi
}

# Update dependencies
update_dependencies() {
    log "Updating dependencies..."
    
    # Update Python dependencies
    if [[ -f "backend/requirements.txt" ]]; then
        log "Updating Python dependencies..."
        # Dependencies will be updated during Docker build
    fi
    
    # Update Node.js dependencies
    if [[ -f "package.json" ]]; then
        log "Updating Node.js dependencies..."
        npm update
    fi
}

# Rebuild and restart services
restart_services() {
    log "Rebuilding and restarting services..."
    
    # Build new images
    docker-compose build --no-cache
    
    # Restart services with zero downtime
    docker-compose up -d --force-recreate
    
    # Wait for services to be healthy
    log "Waiting for services to start..."
    sleep 30
    
    # Check health
    if curl -f http://localhost/health > /dev/null 2>&1; then
        log "Services restarted successfully"
    else
        error "Health check failed after restart"
    fi
}

# Clean up old Docker images
cleanup_docker() {
    log "Cleaning up old Docker images..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    log "Docker cleanup completed"
}

# Update yt-dlp
update_ytdlp() {
    log "Updating yt-dlp..."
    
    # Update yt-dlp in the backend container
    docker-compose exec backend pip install --upgrade yt-dlp
    
    log "yt-dlp updated successfully"
}

# Main update function
main() {
    log "Starting YTLantern update..."
    
    check_directory
    backup_deployment
    update_code
    update_dependencies
    restart_services
    update_ytdlp
    cleanup_docker
    
    log "YTLantern update completed successfully!"
    
    # Show status
    echo
    echo -e "${BLUE}=== Service Status ===${NC}"
    docker-compose ps
}

# Run main function
main "$@"
