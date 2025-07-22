#!/bin/bash

# YTLantern Restore Script
# This script restores a YTLantern backup

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

# Check arguments
if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <backup_file.tar.gz> [--force]"
    echo "Example: $0 backups/ytlantern-backup-20231201-120000.tar.gz"
    exit 1
fi

BACKUP_FILE="$1"
FORCE_RESTORE="$2"

# Validate backup file
validate_backup() {
    log "Validating backup file..."
    
    if [[ ! -f "$BACKUP_FILE" ]]; then
        error "Backup file not found: $BACKUP_FILE"
    fi
    
    # Test archive integrity
    if ! tar -tzf "$BACKUP_FILE" > /dev/null 2>&1; then
        error "Backup file is corrupted or invalid"
    fi
    
    log "Backup file validation passed"
}

# Confirm restore operation
confirm_restore() {
    if [[ "$FORCE_RESTORE" != "--force" ]]; then
        echo
        warn "This will restore the backup and overwrite current configuration!"
        echo -e "${YELLOW}Current services will be stopped and data may be lost.${NC}"
        echo
        read -p "Are you sure you want to continue? (yes/no): " -r
        
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            log "Restore operation cancelled"
            exit 0
        fi
    fi
}

# Stop current services
stop_services() {
    log "Stopping current services..."
    
    if [[ -f "docker-compose.yml" ]]; then
        docker-compose down || true
    fi
    
    log "Services stopped"
}

# Extract backup
extract_backup() {
    log "Extracting backup..."
    
    TEMP_DIR=$(mktemp -d)
    tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"
    
    # Find the backup directory
    BACKUP_DIR=$(find "$TEMP_DIR" -name "ytlantern-backup-*" -type d | head -1)
    
    if [[ -z "$BACKUP_DIR" ]]; then
        error "Invalid backup structure"
    fi
    
    log "Backup extracted to temporary directory"
}

# Restore configuration files
restore_config() {
    log "Restoring configuration files..."
    
    if [[ -d "$BACKUP_DIR/config" ]]; then
        # Backup current config
        mkdir -p "config.backup.$(date +%s)"
        cp backend/.env "config.backup.$(date +%s)/" 2>/dev/null || true
        cp .env.local "config.backup.$(date +%s)/" 2>/dev/null || true
        cp nginx/nginx.conf "config.backup.$(date +%s)/" 2>/dev/null || true
        
        # Restore config files
        cp "$BACKUP_DIR/config/.env" backend/ 2>/dev/null || true
        cp "$BACKUP_DIR/config/.env.local" . 2>/dev/null || true
        cp "$BACKUP_DIR/config/nginx.conf" nginx/ 2>/dev/null || true
        cp "$BACKUP_DIR/config/docker-compose.yml" . 2>/dev/null || true
        
        log "Configuration files restored"
    else
        warn "No configuration files found in backup"
    fi
}

# Restore Redis data
restore_redis() {
    log "Restoring Redis data..."
    
    if [[ -f "$BACKUP_DIR/redis/dump.rdb" ]]; then
        # Start Redis service temporarily
        docker-compose up -d redis
        sleep 10
        
        # Stop Redis to restore data
        docker-compose stop redis
        
        # Copy backup file to Redis volume
        REDIS_CONTAINER=$(docker-compose ps -q redis)
        if [[ -n "$REDIS_CONTAINER" ]]; then
            docker cp "$BACKUP_DIR/redis/dump.rdb" "$REDIS_CONTAINER:/data/"
        fi
        
        log "Redis data restored"
    else
        warn "No Redis backup found"
    fi
}

# Restore video files
restore_videos() {
    log "Restoring video files..."
    
    if [[ -d "$BACKUP_DIR/videos" ]] && [[ $(ls -A "$BACKUP_DIR/videos" 2>/dev/null | wc -l) -gt 0 ]]; then
        # Create video storage volume if it doesn't exist
        docker volume create ytlantern_video_storage 2>/dev/null || true
        
        # Start a temporary container to copy files
        docker run --rm -v ytlantern_video_storage:/videos -v "$(realpath "$BACKUP_DIR/videos"):/backup" alpine sh -c "cp -r /backup/* /videos/" 2>/dev/null || true
        
        VIDEO_COUNT=$(ls -1 "$BACKUP_DIR/videos" | wc -l)
        log "Restored $VIDEO_COUNT video files"
    else
        log "No video files to restore"
    fi
}

# Restore SSL certificates
restore_ssl() {
    log "Restoring SSL certificates..."
    
    if [[ -d "$BACKUP_DIR/ssl" ]]; then
        mkdir -p ssl
        cp -r "$BACKUP_DIR/ssl"/* ssl/ 2>/dev/null || true
        log "SSL certificates restored"
    else
        log "No SSL certificates to restore"
    fi
}

# Start services
start_services() {
    log "Starting services..."
    
    # Build and start services
    docker-compose build
    docker-compose up -d
    
    # Wait for services to start
    log "Waiting for services to start..."
    sleep 30
    
    # Check health
    if curl -f http://localhost/health > /dev/null 2>&1; then
        log "Services started successfully"
    else
        warn "Health check failed - services may still be starting"
    fi
}

# Cleanup temporary files
cleanup() {
    log "Cleaning up temporary files..."
    
    if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR"
    fi
    
    log "Cleanup completed"
}

# Show restore summary
show_summary() {
    log "Restore completed successfully!"
    
    echo
    echo -e "${BLUE}=== Restore Summary ===${NC}"
    echo -e "Backup file: ${GREEN}$BACKUP_FILE${NC}"
    echo -e "Restore time: ${GREEN}$(date)${NC}"
    
    if [[ -f "$BACKUP_DIR/metadata.json" ]]; then
        echo -e "Original backup date: ${GREEN}$(jq -r '.date' "$BACKUP_DIR/metadata.json" 2>/dev/null || echo 'unknown')${NC}"
        echo -e "Original hostname: ${GREEN}$(jq -r '.hostname' "$BACKUP_DIR/metadata.json" 2>/dev/null || echo 'unknown')${NC}"
    fi
    
    echo
    echo -e "${BLUE}=== Service Status ===${NC}"
    docker-compose ps
    
    echo
    echo -e "${YELLOW}Please verify that all services are working correctly.${NC}"
    echo -e "${YELLOW}Check the application at: http://localhost${NC}"
}

# Main restore function
main() {
    log "Starting YTLantern restore..."
    
    validate_backup
    confirm_restore
    stop_services
    extract_backup
    restore_config
    restore_redis
    restore_videos
    restore_ssl
    start_services
    show_summary
    cleanup
    
    log "YTLantern restore completed successfully!"
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"
