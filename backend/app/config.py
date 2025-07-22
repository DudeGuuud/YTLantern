"""
Configuration management for YTLantern API
"""

import os
import logging
from typing import List
from functools import lru_cache


class Settings:
    """Application settings"""
    
    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    WORKERS: int = int(os.getenv("WORKERS", 1))
    
    # Redis settings
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # Video storage settings
    VIDEO_STORAGE_PATH: str = os.getenv("VIDEO_STORAGE_PATH", "/app/videos")
    MAX_VIDEO_SIZE_MB: int = int(os.getenv("MAX_VIDEO_SIZE_MB", 500))
    CLEANUP_INTERVAL_HOURS: int = int(os.getenv("CLEANUP_INTERVAL_HOURS", 24))
    
    # Rate limiting settings
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", 10))
    RATE_LIMIT_PER_HOUR: int = int(os.getenv("RATE_LIMIT_PER_HOUR", 100))
    
    # Cache settings
    VIDEO_CACHE_TTL: int = int(os.getenv("VIDEO_CACHE_TTL", 3600))  # 1 hour
    
    # CORS settings
    CORS_ORIGINS: List[str] = os.getenv("CORS_ORIGINS", "http://localhost:8080").split(",")
    
    # Memory settings
    MAX_MEMORY_MB: int = int(os.getenv("MAX_MEMORY_MB", 1024))
    
    # Logging settings
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT: str = os.getenv("LOG_FORMAT", "%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    
    # yt-dlp settings
    YTDLP_TIMEOUT: int = int(os.getenv("YTDLP_TIMEOUT", 30))
    YTDLP_RETRIES: int = int(os.getenv("YTDLP_RETRIES", 3))
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Get CORS origins as a list"""
        return [origin.strip() for origin in self.CORS_ORIGINS if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


def setup_logging():
    """Setup logging configuration"""
    settings = get_settings()
    
    # Configure logging level
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    
    # Configure logging format
    logging.basicConfig(
        level=log_level,
        format=settings.LOG_FORMAT,
        handlers=[
            logging.StreamHandler(),
        ]
    )
    
    # Set specific logger levels
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("fastapi").setLevel(logging.INFO)
    logging.getLogger("yt_dlp").setLevel(logging.WARNING)
    
    return logging.getLogger(__name__)


# Initialize settings and logging
settings = get_settings()
logger = setup_logging()
