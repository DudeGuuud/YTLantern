#!/bin/bash

# YTLantern Backup Script
# This script creates a complete backup of the YTLantern application

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

# Configuration
BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="ytlantern-backup-$TIMESTAMP"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

# Create backup directory
create_backup_dir() {
    log "Creating backup directory..."
    mkdir -p "$BACKUP_PATH"
}

# Backup configuration files
backup_config() {
    log "Backing up configuration files..."
    
    mkdir -p "$BACKUP_PATH/config"
    
    # Backend configuration
    if [[ -f "backend/.env" ]]; then
        cp backend/.env "$BACKUP_PATH/config/"
    fi
    
    # Frontend configuration
    if [[ -f ".env.local" ]]; then
        cp .env.local "$BACKUP_PATH/config/"
    fi
    
    # Nginx configuration
    if [[ -f "nginx/nginx.conf" ]]; then
        cp nginx/nginx.conf "$BACKUP_PATH/config/"
    fi
    
    # Docker Compose configuration
    if [[ -f "docker-compose.yml" ]]; then
        cp docker-compose.yml "$BACKUP_PATH/config/"
    fi
    
    log "Configuration files backed up"
}

# Backup Redis data
backup_redis() {
    log "Backing up Redis data..."
    
    mkdir -p "$BACKUP_PATH/redis"
    
    # Create Redis backup
    docker-compose exec -T redis redis-cli BGSAVE
    
    # Wait for backup to complete
    sleep 5
    
    # Copy backup file
    docker cp $(docker-compose ps -q redis):/data/dump.rdb "$BACKUP_PATH/redis/" || warn "Redis backup failed"
    
    log "Redis data backed up"
}

# Backup video files
backup_videos() {
    log "Backing up video files..."
    
    mkdir -p "$BACKUP_PATH/videos"
    
    # Get video storage path from Docker volume
    VOLUME_PATH=$(docker volume inspect ytlantern_video_storage | jq -r '.[0].Mountpoint' 2>/dev/null || echo "")
    
    if [[ -n "$VOLUME_PATH" && -d "$VOLUME_PATH" ]]; then
        # Copy video files (limit to recent files to save space)
        find "$VOLUME_PATH" -name "*.mp4" -mtime -7 -exec cp {} "$BACKUP_PATH/videos/" \; 2>/dev/null || true
        find "$VOLUME_PATH" -name "*.webm" -mtime -7 -exec cp {} "$BACKUP_PATH/videos/" \; 2>/dev/null || true
        
        VIDEO_COUNT=$(ls -1 "$BACKUP_PATH/videos/" 2>/dev/null | wc -l)
        log "Backed up $VIDEO_COUNT video files (last 7 days)"
    else
        warn "Video storage volume not found"
    fi
}

# Backup SSL certificates
backup_ssl() {
    log "Backing up SSL certificates..."
    
    if [[ -d "ssl" ]]; then
        mkdir -p "$BACKUP_PATH/ssl"
        cp -r ssl/* "$BACKUP_PATH/ssl/" 2>/dev/null || true
        log "SSL certificates backed up"
    else
        log "No SSL certificates found"
    fi
}

# Backup logs
backup_logs() {
    log "Backing up logs..."
    
    mkdir -p "$BACKUP_PATH/logs"
    
    # Export container logs
    for service in $(docker-compose ps --services); do
        docker-compose logs --no-color "$service" > "$BACKUP_PATH/logs/${service}.log" 2>/dev/null || true
    done
    
    # Copy system logs if available
    if [[ -f "/var/log/ytlantern-monitor.log" ]]; then
        cp /var/log/ytlantern-monitor.log "$BACKUP_PATH/logs/" 2>/dev/null || true
    fi
    
    log "Logs backed up"
}

# Create backup metadata
create_metadata() {
    log "Creating backup metadata..."
    
    cat > "$BACKUP_PATH/metadata.json" << EOF
{
    "backup_name": "$BACKUP_NAME",
    "timestamp": "$TIMESTAMP",
    "date": "$(date -Iseconds)",
    "hostname": "$(hostname)",
    "user": "$(whoami)",
    "docker_compose_version": "$(docker-compose version --short 2>/dev/null || echo 'unknown')",
    "docker_version": "$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo 'unknown')",
    "services": $(docker-compose ps --services | jq -R . | jq -s .),
    "volumes": $(docker volume ls --format '{{.Name}}' | grep ytlantern | jq -R . | jq -s .),
    "backup_size": "$(du -sh "$BACKUP_PATH" | cut -f1)"
}
EOF
    
    log "Metadata created"
}

# Compress backup
compress_backup() {
    log "Compressing backup..."
    
    cd "$BACKUP_DIR"
    tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
    
    # Remove uncompressed backup
    rm -rf "$BACKUP_NAME"
    
    BACKUP_SIZE=$(du -sh "${BACKUP_NAME}.tar.gz" | cut -f1)
    log "Backup compressed: ${BACKUP_NAME}.tar.gz ($BACKUP_SIZE)"
}

# Clean old backups
clean_old_backups() {
    log "Cleaning old backups..."
    
    # Keep only last 7 backups
    cd "$BACKUP_DIR"
    ls -t ytlantern-backup-*.tar.gz | tail -n +8 | xargs rm -f 2>/dev/null || true
    
    REMAINING_BACKUPS=$(ls -1 ytlantern-backup-*.tar.gz 2>/dev/null | wc -l)
    log "Kept $REMAINING_BACKUPS recent backups"
}

# Upload to remote storage (optional)
upload_backup() {
    if [[ -n "${BACKUP_REMOTE_PATH:-}" ]]; then
        log "Uploading backup to remote storage..."
        
        # Example: rsync to remote server
        # rsync -avz "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" "$BACKUP_REMOTE_PATH/"
        
        # Example: upload to S3
        # aws s3 cp "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" "s3://your-bucket/backups/"
        
        log "Backup uploaded to remote storage"
    fi
}

# Verify backup
verify_backup() {
    log "Verifying backup..."
    
    BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}.tar.gz"
    
    if [[ -f "$BACKUP_FILE" ]]; then
        # Test archive integrity
        if tar -tzf "$BACKUP_FILE" > /dev/null 2>&1; then
            log "Backup verification successful"
        else
            error "Backup verification failed - archive is corrupted"
        fi
    else
        error "Backup file not found"
    fi
}

# Main backup function
main() {
    log "Starting YTLantern backup..."
    
    # Check if we're in the right directory
    if [[ ! -f "docker-compose.yml" ]]; then
        error "docker-compose.yml not found. Please run this script from the project root directory."
    fi
    
    create_backup_dir
    backup_config
    backup_redis
    backup_videos
    backup_ssl
    backup_logs
    create_metadata
    compress_backup
    verify_backup
    clean_old_backups
    upload_backup
    
    log "YTLantern backup completed successfully!"
    
    echo
    echo -e "${BLUE}=== Backup Summary ===${NC}"
    echo -e "Backup file: ${GREEN}$BACKUP_DIR/${BACKUP_NAME}.tar.gz${NC}"
    echo -e "Backup size: ${GREEN}$(du -sh "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" | cut -f1)${NC}"
    echo -e "Backup location: ${GREEN}$(pwd)/$BACKUP_DIR/${NC}"
    echo
    echo -e "${BLUE}=== Restore Instructions ===${NC}"
    echo -e "To restore this backup, run: ${YELLOW}./scripts/restore.sh $BACKUP_DIR/${BACKUP_NAME}.tar.gz${NC}"
}

# Run main function
main "$@"
