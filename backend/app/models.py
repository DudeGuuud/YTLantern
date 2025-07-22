"""
Data models for the YTLantern API
"""

from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, validator
from datetime import datetime
import re


class VideoFormat(BaseModel):
    """Video format information"""
    format_id: str
    url: str
    ext: str = "mp4"
    quality: str
    filesize: Optional[int] = None
    fps: Optional[int] = None
    vcodec: Optional[str] = None
    acodec: Optional[str] = None
    resolution: Optional[str] = None
    format_note: Optional[str] = None


class VideoInfo(BaseModel):
    """Complete video information"""
    id: str
    title: str
    description: Optional[str] = ""
    thumbnail: str
    duration: int = 0
    uploader: str
    upload_date: str
    view_count: Optional[int] = 0
    like_count: Optional[int] = 0
    formats: List[VideoFormat] = []
    url: str
    original_url: str


class ParseRequest(BaseModel):
    """Request model for video parsing"""
    url: str = Field(..., description="YouTube video URL")
    quality: Optional[str] = Field("best", description="Video quality preference")
    
    @validator('url')
    def validate_url(cls, v):
        if not v or not isinstance(v, str):
            raise ValueError("URL is required")
        
        # Basic URL validation
        if not v.startswith(('http://', 'https://')):
            raise ValueError("URL must start with http:// or https://")
        
        # YouTube URL validation
        youtube_patterns = [
            r'(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})',
            r'(?:https?://)?(?:www\.)?youtu\.be/([a-zA-Z0-9_-]{11})',
            r'(?:https?://)?(?:www\.)?youtube\.com/embed/([a-zA-Z0-9_-]{11})',
            r'(?:https?://)?(?:m\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})',
        ]
        
        is_valid = any(re.match(pattern, v) for pattern in youtube_patterns)
        if not is_valid:
            raise ValueError("Invalid YouTube URL format")
        
        return v
    
    @validator('quality')
    def validate_quality(cls, v):
        valid_qualities = ['144p', '240p', '360p', '480p', '720p', '1080p', 'best', 'worst', 'bestvideo', 'bestaudio']
        if v and v not in valid_qualities:
            raise ValueError(f"Quality must be one of: {', '.join(valid_qualities)}")
        return v


class ParseResponse(BaseModel):
    """Response model for video parsing"""
    success: bool
    data: Optional[VideoInfo] = None
    error: Optional[str] = None
    message: Optional[str] = None
    cached: Optional[bool] = False
    processing_time: Optional[float] = None


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    timestamp: str
    version: str = "1.0.0"
    redis_status: str = "unknown"
    uptime: Optional[float] = None


class ErrorResponse(BaseModel):
    """Error response model"""
    error: str
    message: str
    status_code: int
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())


class RateLimitResponse(BaseModel):
    """Rate limit response"""
    error: str = "Rate limit exceeded"
    message: str
    retry_after: int
    current_count: int
    limit: int


class CacheStatsResponse(BaseModel):
    """Cache statistics response"""
    video_cache_count: int
    rate_limit_entries: int
    redis_info: Any


class FormatsResponse(BaseModel):
    """Video formats response"""
    success: bool
    formats: List[VideoFormat] = []
    error: Optional[str] = None


# Legacy models for backward compatibility
class DownloadRequest(BaseModel):
    """Legacy download request model"""
    url: str
    quality: Optional[str] = "best"
    format: Optional[str] = "mp4"


class DownloadResponse(BaseModel):
    """Legacy download response model"""
    status: str
    message: str
    download_id: Optional[str] = None
    file_url: Optional[str] = None
