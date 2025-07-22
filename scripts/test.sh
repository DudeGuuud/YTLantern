#!/bin/bash

# YTLantern Testing Script
# This script runs comprehensive tests for the YTLantern application

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
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

fail() {
    echo -e "${RED}❌ $1${NC}"
}

# Test configuration
TEST_YOUTUBE_URL="https://www.youtube.com/watch?v=dQw4w9WgXcQ"  # Rick Roll for testing
API_BASE_URL="http://localhost"
TIMEOUT=30

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

# Helper function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    log "Running test: $test_name"
    
    if eval "$test_command"; then
        success "$test_name"
        ((TESTS_PASSED++))
    else
        fail "$test_name"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("$test_name")
    fi
    
    echo
}

# Test Docker services
test_docker_services() {
    log "Testing Docker services..."
    
    # Check if docker-compose.yml exists
    run_test "Docker Compose file exists" "[[ -f 'docker-compose.yml' ]]"
    
    # Check if services are running
    run_test "All services are running" "docker-compose ps | grep -q 'Up'"
    
    # Check individual services
    local services=($(docker-compose ps --services))
    for service in "${services[@]}"; do
        run_test "Service $service is running" "docker-compose ps $service | grep -q 'Up'"
    done
}

# Test network connectivity
test_network() {
    log "Testing network connectivity..."
    
    # Test main application endpoint
    run_test "Main application responds" "curl -f -s --max-time $TIMEOUT $API_BASE_URL/health > /dev/null"
    
    # Test API endpoint
    run_test "API endpoint responds" "curl -f -s --max-time $TIMEOUT $API_BASE_URL/api/v1/health > /dev/null"
    
    # Test frontend
    run_test "Frontend loads" "curl -s --max-time $TIMEOUT $API_BASE_URL | grep -q 'YTLantern'"
}

# Test API functionality
test_api() {
    log "Testing API functionality..."
    
    # Test health endpoint
    run_test "Health endpoint returns JSON" "curl -s $API_BASE_URL/api/v1/health | jq . > /dev/null"
    
    # Test video parsing (with a simple YouTube URL)
    local parse_response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"url\": \"$TEST_YOUTUBE_URL\", \"quality\": \"360p\"}" \
        --max-time 60 \
        $API_BASE_URL/api/v1/parse)
    
    run_test "Video parsing API responds" "[[ -n '$parse_response' ]]"
    
    # Check if response is valid JSON
    run_test "Parse response is valid JSON" "echo '$parse_response' | jq . > /dev/null"
    
    # Check if parsing was successful (might fail due to network restrictions)
    if echo "$parse_response" | jq -r '.success' | grep -q "true"; then
        success "Video parsing successful"
        ((TESTS_PASSED++))
    else
        warn "Video parsing failed (this might be expected in restricted environments)"
    fi
}

# Test database/cache
test_cache() {
    log "Testing cache functionality..."
    
    # Test Redis connectivity
    run_test "Redis is accessible" "docker-compose exec -T redis redis-cli ping | grep -q PONG"
    
    # Test cache stats endpoint
    run_test "Cache stats available" "curl -s $API_BASE_URL/api/v1/health | jq '.cache_stats' | grep -q 'connected'"
}

# Test file system
test_filesystem() {
    log "Testing file system..."
    
    # Check if video storage directory exists
    run_test "Video storage directory exists" "docker-compose exec -T backend ls -la /app/videos > /dev/null"
    
    # Check disk space
    local disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    run_test "Sufficient disk space (< 90%)" "[[ $disk_usage -lt 90 ]]"
    
    # Check if logs are being written
    run_test "Application logs exist" "docker-compose logs backend | grep -q 'INFO'"
}

# Test security
test_security() {
    log "Testing security..."
    
    # Check if firewall is enabled
    run_test "UFW firewall is active" "sudo ufw status | grep -q 'Status: active'"
    
    # Check for security headers
    local headers=$(curl -s -I $API_BASE_URL)
    run_test "Security headers present" "echo '$headers' | grep -q 'X-Content-Type-Options'"
    
    # Check if sensitive endpoints are protected
    run_test "Admin endpoints require authentication" "curl -s $API_BASE_URL/api/v1/admin/cleanup | grep -q 'error'"
}

# Test performance
test_performance() {
    log "Testing performance..."
    
    # Test response time
    local start_time=$(date +%s%3N)
    curl -s --max-time 5 $API_BASE_URL/health > /dev/null
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    run_test "Response time < 2000ms" "[[ $response_time -lt 2000 ]]"
    
    # Test memory usage
    local memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    run_test "Memory usage < 80%" "[[ $memory_usage -lt 80 ]]"
    
    # Test CPU load
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_cores=$(nproc)
    local load_threshold=$(echo "$cpu_cores * 1.5" | bc)
    
    run_test "CPU load is reasonable" "(( $(echo \"$load_avg < $load_threshold\" | bc -l) ))"
}

# Test backup functionality
test_backup() {
    log "Testing backup functionality..."
    
    # Check if backup script exists
    run_test "Backup script exists" "[[ -f 'scripts/backup.sh' ]]"
    
    # Check if backup directory exists
    run_test "Backup directory exists" "[[ -d 'backups' ]]"
    
    # Test backup creation (dry run)
    run_test "Backup script is executable" "[[ -x 'scripts/backup.sh' ]]"
}

# Test monitoring
test_monitoring() {
    log "Testing monitoring..."
    
    # Check if monitoring script exists
    run_test "Monitor script exists" "[[ -f 'scripts/monitor.sh' ]]"
    
    # Test monitoring script execution
    run_test "Monitor script is executable" "[[ -x 'scripts/monitor.sh' ]]"
    
    # Check if log file can be created
    run_test "Log file writable" "touch /tmp/test-ytlantern.log && rm /tmp/test-ytlantern.log"
}

# Generate test report
generate_report() {
    local total_tests=$((TESTS_PASSED + TESTS_FAILED))
    local success_rate=0
    
    if [[ $total_tests -gt 0 ]]; then
        success_rate=$(echo "scale=1; $TESTS_PASSED * 100 / $total_tests" | bc)
    fi
    
    echo
    echo -e "${BLUE}=== YTLantern Test Report ===${NC}"
    echo -e "Total tests: ${BLUE}$total_tests${NC}"
    echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
    echo -e "Success rate: ${BLUE}${success_rate}%${NC}"
    echo
    
    if [[ $TESTS_FAILED -gt 0 ]]; then
        echo -e "${RED}Failed tests:${NC}"
        for test in "${FAILED_TESTS[@]}"; do
            echo -e "  - ${RED}$test${NC}"
        done
        echo
    fi
    
    # Save report to file
    local report_file="test-report-$(date +%Y%m%d-%H%M%S).txt"
    {
        echo "YTLantern Test Report"
        echo "Generated: $(date)"
        echo "========================"
        echo "Total tests: $total_tests"
        echo "Passed: $TESTS_PASSED"
        echo "Failed: $TESTS_FAILED"
        echo "Success rate: ${success_rate}%"
        echo
        if [[ $TESTS_FAILED -gt 0 ]]; then
            echo "Failed tests:"
            for test in "${FAILED_TESTS[@]}"; do
                echo "  - $test"
            done
        fi
    } > "$report_file"
    
    log "Test report saved to: $report_file"
    
    # Return appropriate exit code
    if [[ $TESTS_FAILED -eq 0 ]]; then
        success "All tests passed! 🎉"
        return 0
    else
        error "Some tests failed. Please check the issues above."
        return 1
    fi
}

# Main test function
main() {
    log "Starting YTLantern comprehensive tests..."
    
    # Check if we're in the right directory
    if [[ ! -f "docker-compose.yml" ]]; then
        error "docker-compose.yml not found. Please run this script from the project root directory."
    fi
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --api-only)
                API_ONLY=true
                shift
                ;;
            --quick)
                QUICK_TEST=true
                shift
                ;;
            --url)
                API_BASE_URL="$2"
                shift 2
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --api-only    Test only API functionality"
                echo "  --quick       Run quick tests only"
                echo "  --url URL     Set base URL for testing (default: http://localhost)"
                echo "  -h, --help    Show this help message"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    # Run tests based on options
    if [[ "$API_ONLY" == "true" ]]; then
        test_network
        test_api
        test_cache
    elif [[ "$QUICK_TEST" == "true" ]]; then
        test_docker_services
        test_network
        test_api
    else
        # Full test suite
        test_docker_services
        test_network
        test_api
        test_cache
        test_filesystem
        test_security
        test_performance
        test_backup
        test_monitoring
    fi
    
    generate_report
}

# Run main function
main "$@"
