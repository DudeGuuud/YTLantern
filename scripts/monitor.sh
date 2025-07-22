#!/bin/bash

# YTLantern Monitoring Script
# This script monitors the health and performance of YTLantern services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
LOG_FILE="/var/log/ytlantern-monitor.log"
ALERT_EMAIL=""
WEBHOOK_URL=""
CHECK_INTERVAL=300  # 5 minutes
MAX_DISK_USAGE=90
MAX_MEMORY_USAGE=90
MAX_RESPONSE_TIME=5000  # 5 seconds in milliseconds

log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
    
    # Color output for console
    case $level in
        "ERROR")
            echo -e "${RED}[$timestamp] [$level] $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}[$timestamp] [$level] $message${NC}"
            ;;
        "INFO")
            echo -e "${GREEN}[$timestamp] [$level] $message${NC}"
            ;;
        *)
            echo -e "${BLUE}[$timestamp] [$level] $message${NC}"
            ;;
    esac
}

# Send alert notification
send_alert() {
    local subject="$1"
    local message="$2"
    
    log_message "ALERT" "$subject: $message"
    
    # Send email alert if configured
    if [[ -n "$ALERT_EMAIL" ]] && command -v mail &> /dev/null; then
        echo "$message" | mail -s "YTLantern Alert: $subject" "$ALERT_EMAIL"
    fi
    
    # Send webhook alert if configured
    if [[ -n "$WEBHOOK_URL" ]] && command -v curl &> /dev/null; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"YTLantern Alert: $subject - $message\"}" \
            2>/dev/null || true
    fi
}

# Check Docker services
check_docker_services() {
    log_message "INFO" "Checking Docker services..."
    
    local services_down=()
    
    # Get list of services that should be running
    local expected_services=($(docker-compose ps --services))
    
    for service in "${expected_services[@]}"; do
        local status=$(docker-compose ps -q "$service" | xargs docker inspect --format='{{.State.Status}}' 2>/dev/null || echo "not_found")
        
        if [[ "$status" != "running" ]]; then
            services_down+=("$service")
            log_message "ERROR" "Service $service is not running (status: $status)"
        fi
    done
    
    if [[ ${#services_down[@]} -gt 0 ]]; then
        send_alert "Services Down" "The following services are not running: ${services_down[*]}"
        
        # Attempt to restart services
        log_message "INFO" "Attempting to restart services..."
        docker-compose up -d "${services_down[@]}"
        sleep 30
        
        # Check again
        for service in "${services_down[@]}"; do
            local status=$(docker-compose ps -q "$service" | xargs docker inspect --format='{{.State.Status}}' 2>/dev/null || echo "not_found")
            if [[ "$status" == "running" ]]; then
                log_message "INFO" "Service $service restarted successfully"
            else
                send_alert "Service Restart Failed" "Failed to restart service: $service"
            fi
        done
    else
        log_message "INFO" "All Docker services are running"
    fi
}

# Check application health
check_application_health() {
    log_message "INFO" "Checking application health..."
    
    # Check main application endpoint
    local start_time=$(date +%s%3N)
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null || echo "000")
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    if [[ "$http_code" == "200" ]]; then
        log_message "INFO" "Application health check passed (${response_time}ms)"
        
        if [[ $response_time -gt $MAX_RESPONSE_TIME ]]; then
            send_alert "Slow Response" "Application response time is ${response_time}ms (threshold: ${MAX_RESPONSE_TIME}ms)"
        fi
    else
        log_message "ERROR" "Application health check failed (HTTP $http_code)"
        send_alert "Health Check Failed" "Application health endpoint returned HTTP $http_code"
    fi
    
    # Check API endpoint
    local api_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/health 2>/dev/null || echo "000")
    if [[ "$api_code" == "200" ]]; then
        log_message "INFO" "API health check passed"
    else
        log_message "ERROR" "API health check failed (HTTP $api_code)"
        send_alert "API Health Check Failed" "API health endpoint returned HTTP $api_code"
    fi
}

# Check system resources
check_system_resources() {
    log_message "INFO" "Checking system resources..."
    
    # Check disk usage
    local disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [[ $disk_usage -gt $MAX_DISK_USAGE ]]; then
        log_message "WARN" "High disk usage: ${disk_usage}%"
        send_alert "High Disk Usage" "Disk usage is ${disk_usage}% (threshold: ${MAX_DISK_USAGE}%)"
    else
        log_message "INFO" "Disk usage: ${disk_usage}%"
    fi
    
    # Check memory usage
    local memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [[ $memory_usage -gt $MAX_MEMORY_USAGE ]]; then
        log_message "WARN" "High memory usage: ${memory_usage}%"
        send_alert "High Memory Usage" "Memory usage is ${memory_usage}% (threshold: ${MAX_MEMORY_USAGE}%)"
    else
        log_message "INFO" "Memory usage: ${memory_usage}%"
    fi
    
    # Check load average
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_cores=$(nproc)
    local load_threshold=$(echo "$cpu_cores * 2" | bc)
    
    if (( $(echo "$load_avg > $load_threshold" | bc -l) )); then
        log_message "WARN" "High load average: $load_avg (cores: $cpu_cores)"
        send_alert "High Load Average" "Load average is $load_avg on $cpu_cores cores"
    else
        log_message "INFO" "Load average: $load_avg"
    fi
}

# Check Docker container resources
check_container_resources() {
    log_message "INFO" "Checking container resources..."
    
    # Get container stats
    local containers=$(docker-compose ps -q)
    
    for container in $containers; do
        local container_name=$(docker inspect --format='{{.Name}}' "$container" | sed 's/\///')
        local stats=$(docker stats --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" "$container" | tail -n 1)
        
        if [[ -n "$stats" ]]; then
            local cpu_usage=$(echo "$stats" | awk '{print $1}' | sed 's/%//')
            local memory_usage=$(echo "$stats" | awk '{print $2}')
            
            log_message "INFO" "Container $container_name - CPU: ${cpu_usage}%, Memory: $memory_usage"
            
            # Alert on high CPU usage
            if (( $(echo "$cpu_usage > 80" | bc -l) )); then
                send_alert "High Container CPU" "Container $container_name CPU usage: ${cpu_usage}%"
            fi
        fi
    done
}

# Check log files for errors
check_logs() {
    log_message "INFO" "Checking logs for errors..."
    
    # Check for recent errors in container logs
    local error_count=0
    local services=($(docker-compose ps --services))
    
    for service in "${services[@]}"; do
        local recent_errors=$(docker-compose logs --since="5m" "$service" 2>/dev/null | grep -i "error\|exception\|failed" | wc -l)
        
        if [[ $recent_errors -gt 0 ]]; then
            error_count=$((error_count + recent_errors))
            log_message "WARN" "Found $recent_errors recent errors in $service logs"
        fi
    done
    
    if [[ $error_count -gt 10 ]]; then
        send_alert "High Error Rate" "Found $error_count errors in logs in the last 5 minutes"
    fi
}

# Check external dependencies
check_external_dependencies() {
    log_message "INFO" "Checking external dependencies..."
    
    # Check Redis connectivity
    if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        log_message "INFO" "Redis connectivity check passed"
    else
        log_message "ERROR" "Redis connectivity check failed"
        send_alert "Redis Connection Failed" "Cannot connect to Redis"
    fi
    
    # Check YouTube accessibility (from backend container)
    if docker-compose exec -T backend python -c "import requests; requests.get('https://www.youtube.com', timeout=10)" > /dev/null 2>&1; then
        log_message "INFO" "YouTube accessibility check passed"
    else
        log_message "WARN" "YouTube accessibility check failed"
        send_alert "YouTube Access Issue" "Cannot access YouTube from backend"
    fi
}

# Cleanup old files
cleanup_old_files() {
    log_message "INFO" "Cleaning up old files..."
    
    # Clean old video files (older than 7 days)
    local cleaned_videos=$(docker-compose exec -T backend python -c "
from app.services import YouTubeService
yt_service = YouTubeService()
cleaned = yt_service.cleanup_old_files(168)  # 7 days
print(cleaned)
" 2>/dev/null || echo "0")
    
    if [[ $cleaned_videos -gt 0 ]]; then
        log_message "INFO" "Cleaned $cleaned_videos old video files"
    fi
    
    # Clean old log files
    find /var/log -name "ytlantern-*.log" -mtime +30 -delete 2>/dev/null || true
    
    # Clean Docker system
    docker system prune -f > /dev/null 2>&1 || true
}

# Generate status report
generate_status_report() {
    local report_file="/tmp/ytlantern-status-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "YTLantern Status Report"
        echo "Generated: $(date)"
        echo "========================"
        echo
        
        echo "Docker Services:"
        docker-compose ps
        echo
        
        echo "System Resources:"
        echo "Disk Usage: $(df -h / | awk 'NR==2 {print $5}')"
        echo "Memory Usage: $(free -h | awk 'NR==2{printf "%.1f%%", $3*100/$2}')"
        echo "Load Average: $(uptime | awk -F'load average:' '{print $2}')"
        echo
        
        echo "Container Stats:"
        docker stats --no-stream
        echo
        
        echo "Recent Logs (last 50 lines):"
        tail -n 50 "$LOG_FILE"
        
    } > "$report_file"
    
    log_message "INFO" "Status report generated: $report_file"
}

# Main monitoring function
main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --email)
                ALERT_EMAIL="$2"
                shift 2
                ;;
            --webhook)
                WEBHOOK_URL="$2"
                shift 2
                ;;
            --interval)
                CHECK_INTERVAL="$2"
                shift 2
                ;;
            --daemon)
                DAEMON_MODE=true
                shift
                ;;
            --report)
                generate_status_report
                exit 0
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --email EMAIL      Set alert email address"
                echo "  --webhook URL      Set webhook URL for alerts"
                echo "  --interval SEC     Set check interval in seconds (default: 300)"
                echo "  --daemon          Run in daemon mode"
                echo "  --report          Generate status report and exit"
                echo "  -h, --help        Show this help message"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Create log directory
    sudo mkdir -p "$(dirname "$LOG_FILE")"
    sudo touch "$LOG_FILE"
    sudo chown "$USER:$USER" "$LOG_FILE"
    
    log_message "INFO" "Starting YTLantern monitoring..."
    
    if [[ "$DAEMON_MODE" == "true" ]]; then
        log_message "INFO" "Running in daemon mode (interval: ${CHECK_INTERVAL}s)"
        
        while true; do
            check_docker_services
            check_application_health
            check_system_resources
            check_container_resources
            check_logs
            check_external_dependencies
            cleanup_old_files
            
            log_message "INFO" "Monitoring cycle completed. Sleeping for ${CHECK_INTERVAL}s..."
            sleep "$CHECK_INTERVAL"
        done
    else
        # Run once
        check_docker_services
        check_application_health
        check_system_resources
        check_container_resources
        check_logs
        check_external_dependencies
        cleanup_old_files
        
        log_message "INFO" "Monitoring check completed"
    fi
}

# Run main function
main "$@"
