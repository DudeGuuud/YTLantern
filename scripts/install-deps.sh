#!/bin/bash

# YTLantern Dependencies Installation Script
# This script installs all required dependencies for YTLantern

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

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root. Please run as a regular user with sudo privileges."
    fi
}

# Update system packages
update_system() {
    log "Updating system packages..."
    sudo apt-get update
    sudo apt-get upgrade -y
    sudo apt-get install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
}

# Install Node.js
install_nodejs() {
    if ! command -v node &> /dev/null; then
        log "Installing Node.js 18.x..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
        log "Node.js installed: $(node --version)"
    else
        log "Node.js is already installed: $(node --version)"
    fi
}

# Install Docker
install_docker() {
    if ! command -v docker &> /dev/null; then
        log "Installing Docker..."
        
        # Add Docker's official GPG key
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
        
        # Add Docker repository
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        # Install Docker
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
        
        # Add user to docker group
        sudo usermod -aG docker $USER
        
        # Start and enable Docker
        sudo systemctl start docker
        sudo systemctl enable docker
        
        log "Docker installed: $(docker --version)"
    else
        log "Docker is already installed: $(docker --version)"
    fi
}

# Install Docker Compose
install_docker_compose() {
    if ! command -v docker-compose &> /dev/null; then
        log "Installing Docker Compose..."
        
        # Download and install Docker Compose
        DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
        sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        
        log "Docker Compose installed: $(docker-compose --version)"
    else
        log "Docker Compose is already installed: $(docker-compose --version)"
    fi
}

# Install Python dependencies
install_python_deps() {
    log "Installing Python dependencies..."
    
    # Install Python 3 and pip if not present
    sudo apt-get install -y python3 python3-pip python3-venv
    
    # Install system dependencies for Python packages
    sudo apt-get install -y build-essential libssl-dev libffi-dev python3-dev
    
    log "Python dependencies installed"
}

# Install system utilities
install_utilities() {
    log "Installing system utilities..."
    
    sudo apt-get install -y \
        htop \
        iotop \
        iftop \
        ncdu \
        tree \
        jq \
        bc \
        fail2ban \
        ufw \
        certbot \
        python3-certbot-nginx
    
    log "System utilities installed"
}

# Install FFmpeg
install_ffmpeg() {
    if ! command -v ffmpeg &> /dev/null; then
        log "Installing FFmpeg..."
        sudo apt-get install -y ffmpeg
        log "FFmpeg installed: $(ffmpeg -version | head -1)"
    else
        log "FFmpeg is already installed"
    fi
}

# Setup firewall
setup_firewall() {
    log "Configuring firewall..."
    
    # Reset firewall rules
    sudo ufw --force reset
    
    # Default policies
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # Allow SSH
    sudo ufw allow ssh
    
    # Allow HTTP and HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    
    # Enable firewall
    sudo ufw --force enable
    
    log "Firewall configured"
}

# Install Node.js dependencies
install_node_deps() {
    if [[ -f "package.json" ]]; then
        log "Installing Node.js dependencies..."
        npm install
        log "Node.js dependencies installed"
    else
        warn "package.json not found, skipping Node.js dependencies"
    fi
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p backups
    mkdir -p logs
    mkdir -p ssl
    mkdir -p videos
    
    log "Directories created"
}

# Set permissions
set_permissions() {
    log "Setting permissions..."
    
    # Make scripts executable
    chmod +x deploy.sh
    chmod +x scripts/*.sh
    
    # Set proper ownership
    sudo chown -R $USER:$USER .
    
    log "Permissions set"
}

# Verify installation
verify_installation() {
    log "Verifying installation..."
    
    # Check required commands
    local missing_deps=()
    
    command -v node >/dev/null 2>&1 || missing_deps+=("node")
    command -v npm >/dev/null 2>&1 || missing_deps+=("npm")
    command -v docker >/dev/null 2>&1 || missing_deps+=("docker")
    command -v docker-compose >/dev/null 2>&1 || missing_deps+=("docker-compose")
    command -v python3 >/dev/null 2>&1 || missing_deps+=("python3")
    command -v ffmpeg >/dev/null 2>&1 || missing_deps+=("ffmpeg")
    
    if [[ ${#missing_deps[@]} -eq 0 ]]; then
        log "All dependencies are installed correctly"
    else
        error "Missing dependencies: ${missing_deps[*]}"
    fi
    
    # Check Docker group membership
    if groups $USER | grep -q docker; then
        log "User is in docker group"
    else
        warn "User is not in docker group. You may need to log out and back in."
    fi
}

# Main installation function
main() {
    log "Starting YTLantern dependencies installation..."
    
    check_root
    update_system
    install_nodejs
    install_docker
    install_docker_compose
    install_python_deps
    install_utilities
    install_ffmpeg
    setup_firewall
    create_directories
    install_node_deps
    set_permissions
    verify_installation
    
    log "YTLantern dependencies installation completed successfully!"
    
    echo
    echo -e "${BLUE}=== Installation Summary ===${NC}"
    echo -e "Node.js: ${GREEN}$(node --version)${NC}"
    echo -e "npm: ${GREEN}$(npm --version)${NC}"
    echo -e "Docker: ${GREEN}$(docker --version)${NC}"
    echo -e "Docker Compose: ${GREEN}$(docker-compose --version)${NC}"
    echo -e "Python: ${GREEN}$(python3 --version)${NC}"
    echo -e "FFmpeg: ${GREEN}$(ffmpeg -version | head -1 | cut -d' ' -f3)${NC}"
    echo
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "1. Log out and back in to apply Docker group membership"
    echo -e "2. Run ${GREEN}./deploy.sh${NC} to deploy YTLantern"
    echo -e "3. Or run ${GREEN}make quick-start${NC} for development"
}

# Run main function
main "$@"
