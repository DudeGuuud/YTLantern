#!/bin/bash

# YTLantern Docker Deployment Script
# Simple deployment script for Docker Compose

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
DEFAULT_HTTP_PORT=8080
DEFAULT_HTTPS_PORT=8443

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "YTLantern Docker Deployment Script"
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy    Deploy the application (default)"
    echo "  stop      Stop all services"
    echo "  restart   Restart all services"
    echo "  logs      Show logs for all services"
    echo "  status    Show status of all services"
    echo "  clean     Stop and remove all containers, networks, and volumes"
    echo ""
    echo "Options:"
    echo "  --http-port PORT     Set HTTP port (default: $DEFAULT_HTTP_PORT)"
    echo "  --https-port PORT    Set HTTPS port (default: $DEFAULT_HTTPS_PORT)"
    echo "  --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy --http-port 8080 --https-port 8443"
    echo "  $0 stop"
    echo "  $0 logs"
    echo "  $0 clean"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose > /dev/null 2>&1 && ! docker compose version > /dev/null 2>&1; then
        print_error "Docker Compose is not installed. Please install Docker Compose and try again."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to setup environment
setup_environment() {
    local http_port=${1:-$DEFAULT_HTTP_PORT}
    local https_port=${2:-$DEFAULT_HTTPS_PORT}
    
    print_status "Setting up environment..."
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        print_status "Creating .env file from template..."
        cp .env.example .env
    fi
    
    # Update ports in .env file
    sed -i "s/EXTERNAL_HTTP_PORT=.*/EXTERNAL_HTTP_PORT=$http_port/" .env
    sed -i "s/EXTERNAL_HTTPS_PORT=.*/EXTERNAL_HTTPS_PORT=$https_port/" .env
    sed -i "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://localhost:$http_port/api/v1|" .env
    
    # Create necessary directories
    print_status "Creating necessary directories..."
    mkdir -p videos logs ssl
    
    # Set proper permissions
    chmod 755 videos logs
    
    print_success "Environment setup completed"
}

# Function to deploy application
deploy_application() {
    local http_port=${1:-$DEFAULT_HTTP_PORT}
    local https_port=${2:-$DEFAULT_HTTPS_PORT}
    
    print_status "🚀 Starting YTLantern deployment..."
    
    setup_environment "$http_port" "$https_port"
    
    # Build and start all services
    print_status "🔨 Building and starting all services (frontend, backend, redis, nginx, cleanup)..."
    export EXTERNAL_HTTP_PORT="$http_port"
    export EXTERNAL_HTTPS_PORT="$https_port"
    
    docker-compose up --build -d
    
    # Wait for services to be healthy
    print_status "⏳ Waiting for services to start..."
    sleep 30
    
    # Check service status
    print_status "🔍 Checking service status..."
    docker-compose ps
    
    # Check for failed services
    check_service_health
    
    print_success "✅ YTLantern deployment completed successfully!"
    print_success "🌐 Application is available at: http://localhost:$http_port"
    print_status "📊 To view logs: $0 logs"
    print_status "🛑 To stop: $0 stop"
    print_status "🧹 To clean up: $0 clean"
    
    # Show firewall instructions
    show_firewall_instructions "$http_port" "$https_port"
}

# Function to check service health
check_service_health() {
    local failed_services
    failed_services=$(docker-compose ps --filter "status=exited" --format "table {{.Service}}" 2>/dev/null | tail -n +2 || true)
    
    if [ ! -z "$failed_services" ]; then
        print_error "❌ Some services failed to start:"
        echo "$failed_services"
        print_status "📋 Showing logs for failed services..."
        for service in $failed_services; do
            echo "--- Logs for $service ---"
            docker-compose logs "$service"
        done
        exit 1
    fi
}

# Function to show firewall instructions
show_firewall_instructions() {
    local http_port=$1
    local https_port=$2
    
    print_warning "🔥 Firewall Configuration Required:"
    echo "To access the application from other machines, you may need to open the following ports:"
    echo ""
    echo "For Ubuntu/Debian (ufw):"
    echo "  sudo ufw allow $http_port/tcp"
    echo "  sudo ufw allow $https_port/tcp"
    echo ""
    echo "For CentOS/RHEL (firewalld):"
    echo "  sudo firewall-cmd --permanent --add-port=$http_port/tcp"
    echo "  sudo firewall-cmd --permanent --add-port=$https_port/tcp"
    echo "  sudo firewall-cmd --reload"
    echo ""
    echo "For other systems, please consult your firewall documentation."
}

# Function to stop services
stop_services() {
    print_status "🛑 Stopping YTLantern services..."
    docker-compose down
    print_success "✅ All services stopped"
}

# Function to restart services
restart_services() {
    print_status "🔄 Restarting YTLantern services..."
    docker-compose restart
    print_success "✅ All services restarted"
}

# Function to show logs
show_logs() {
    print_status "📋 Showing logs for all services..."
    docker-compose logs -f
}

# Function to show status
show_status() {
    print_status "📊 Service status:"
    docker-compose ps
}

# Function to clean up
clean_up() {
    print_warning "🧹 This will remove all containers, networks, and volumes. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_status "🧹 Cleaning up YTLantern deployment..."
        docker-compose down -v --remove-orphans
        docker system prune -f
        print_success "✅ Cleanup completed"
    else
        print_status "Cleanup cancelled"
    fi
}

# Parse command line arguments
COMMAND="deploy"
HTTP_PORT=$DEFAULT_HTTP_PORT
HTTPS_PORT=$DEFAULT_HTTPS_PORT

while [[ $# -gt 0 ]]; do
    case $1 in
        deploy|stop|restart|logs|status|clean)
            COMMAND="$1"
            shift
            ;;
        --http-port)
            HTTP_PORT="$2"
            shift 2
            ;;
        --https-port)
            HTTPS_PORT="$2"
            shift 2
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
case $COMMAND in
    deploy)
        check_prerequisites
        deploy_application "$HTTP_PORT" "$HTTPS_PORT"
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    clean)
        clean_up
        ;;
    *)
        print_error "Unknown command: $COMMAND"
        show_usage
        exit 1
        ;;
esac
