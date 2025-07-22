# YTLantern Makefile
# Convenient commands for development and deployment

.PHONY: help install dev build start stop restart logs clean deploy backup restore update monitor

# Default target
help:
	@echo "YTLantern - Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  install     Install dependencies"
	@echo "  dev         Start development server"
	@echo "  build       Build the application"
	@echo ""
	@echo "Production:"
	@echo "  start       Start all services"
	@echo "  stop        Stop all services"
	@echo "  restart     Restart all services"
	@echo "  logs        View logs"
	@echo "  status      Show service status"
	@echo ""
	@echo "Deployment:"
	@echo "  deploy      Deploy to production"
	@echo "  update      Update the application"
	@echo ""
	@echo "Maintenance:"
	@echo "  backup      Create backup"
	@echo "  restore     Restore from backup"
	@echo "  clean       Clean up resources"
	@echo "  monitor     Run health check"
	@echo ""

# Development commands
install:
	@echo "Installing dependencies..."
	npm install
	@echo "Dependencies installed successfully"

dev:
	@echo "Starting development server..."
	npm run dev

build:
	@echo "Building application..."
	npm run build
	@echo "Build completed"

# Production commands
start:
	@echo "Starting all services..."
	docker-compose up -d
	@echo "Services started. Check status with 'make status'"

stop:
	@echo "Stopping all services..."
	docker-compose down
	@echo "Services stopped"

restart:
	@echo "Restarting all services..."
	docker-compose restart
	@echo "Services restarted"

logs:
	@echo "Viewing logs (Ctrl+C to exit)..."
	docker-compose logs -f

status:
	@echo "Service status:"
	docker-compose ps

# Deployment commands
deploy:
	@echo "Deploying YTLantern..."
	chmod +x deploy.sh
	./deploy.sh

update:
	@echo "Updating YTLantern..."
	chmod +x scripts/update.sh
	./scripts/update.sh

# Maintenance commands
backup:
	@echo "Creating backup..."
	chmod +x scripts/backup.sh
	./scripts/backup.sh

restore:
	@echo "Available backups:"
	@ls -la backups/*.tar.gz 2>/dev/null || echo "No backups found"
	@echo ""
	@echo "To restore a backup, run:"
	@echo "  make restore-file BACKUP=backups/ytlantern-backup-YYYYMMDD-HHMMSS.tar.gz"

restore-file:
	@if [ -z "$(BACKUP)" ]; then \
		echo "Error: Please specify BACKUP file"; \
		echo "Usage: make restore-file BACKUP=backups/backup-file.tar.gz"; \
		exit 1; \
	fi
	@echo "Restoring backup: $(BACKUP)"
	chmod +x scripts/restore.sh
	./scripts/restore.sh $(BACKUP)

clean:
	@echo "Cleaning up resources..."
	docker-compose down -v
	docker system prune -f
	docker volume prune -f
	@echo "Cleanup completed"

monitor:
	@echo "Running health check..."
	chmod +x scripts/monitor.sh
	./scripts/monitor.sh

# Development helpers
lint:
	@echo "Running linter..."
	npm run lint

type-check:
	@echo "Running type check..."
	npm run type-check

test:
	@echo "Running tests..."
	npm test

# Docker helpers
build-images:
	@echo "Building Docker images..."
	docker-compose build --no-cache

pull-images:
	@echo "Pulling latest images..."
	docker-compose pull

# SSL setup
ssl-setup:
	@echo "Setting up SSL certificate..."
	@read -p "Enter domain name: " domain; \
	read -p "Enter email address: " email; \
	./deploy.sh --domain $$domain --email $$email --ssl

# Quick commands
quick-start: install build start
	@echo "YTLantern started successfully!"
	@echo "Access the application at: http://localhost"

quick-dev: install dev

# Health check
health:
	@echo "Checking application health..."
	@curl -f http://localhost/health > /dev/null 2>&1 && echo "✅ Application is healthy" || echo "❌ Application is not responding"
	@curl -f http://localhost/api/v1/health > /dev/null 2>&1 && echo "✅ API is healthy" || echo "❌ API is not responding"
