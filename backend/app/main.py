"""
YTLantern Backend API
FastAPI backend for YouTube video parsing and streaming
"""

import time
import logging
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import redis
from contextlib import asynccontextmanager

# Import our modules
from .config import settings, logger
from .models import (
    ParseRequest, ParseResponse, VideoInfo, HealthResponse,
    ErrorResponse, RateLimitResponse, FormatsResponse,
    DownloadRequest, DownloadResponse  # Legacy models
)
from .services.video_parser import video_parser, VideoParserError
from .services.cache_service import CacheService, MockCacheService

# Global variables
cache_service = None
start_time = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global cache_service

    # Startup
    logger.info("Starting YTLantern API...")

    # Initialize Redis connection
    try:
        redis_client = redis.from_url(settings.REDIS_URL)
        redis_client.ping()  # Test connection
        cache_service = CacheService(redis_client)
        logger.info("Redis connection established")
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}. Using mock cache service.")
        cache_service = MockCacheService()

    yield

    # Shutdown
    logger.info("Shutting down YTLantern API...")


# Initialize FastAPI app
app = FastAPI(
    title="YTLantern API",
    description="YouTube video parsing and streaming service",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency to get cache service
async def get_cache_service() -> CacheService:
    """Get cache service instance"""
    if cache_service is None:
        raise HTTPException(status_code=503, detail="Cache service not available")
    return cache_service


# Dependency to get client IP
def get_client_ip(request: Request) -> str:
    """Get client IP address"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# Rate limiting dependency
async def check_rate_limit(
    request: Request,
    cache: CacheService = Depends(get_cache_service)
) -> None:
    """Check rate limiting"""
    client_ip = get_client_ip(request)
    rate_limit_result = await cache.check_rate_limit(client_ip)

    if not rate_limit_result.get('allowed', True):
        await cache.increment_rate_limit(client_ip)
        raise HTTPException(
            status_code=429,
            detail=RateLimitResponse(
                message=f"Rate limit exceeded: {rate_limit_result.get('reason', 'unknown')}",
                retry_after=rate_limit_result.get('retry_after', 60),
                current_count=rate_limit_result.get('current_count', 0),
                limit=rate_limit_result.get('limit', 0)
            ).dict()
        )

    # Increment counter for successful requests
    await cache.increment_rate_limit(client_ip)

# Health check endpoints
@app.get("/health", response_model=HealthResponse)
async def health_check(cache: CacheService = Depends(get_cache_service)):
    """Health check endpoint"""
    try:
        # Test cache service
        cache_stats = await cache.get_cache_stats()
        redis_status = "connected" if cache_stats else "disconnected"

        uptime = time.time() - start_time

        return HealthResponse(
            status="healthy",
            timestamp=datetime.now().isoformat(),
            redis_status=redis_status,
            uptime=uptime
        )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return HealthResponse(
            status="unhealthy",
            timestamp=datetime.now().isoformat(),
            redis_status="error"
        )


@app.get("/api/v1/health", response_model=HealthResponse)
async def api_health(cache: CacheService = Depends(get_cache_service)):
    """API health check"""
    return await health_check(cache)


# Main video parsing endpoint
@app.post("/api/v1/parse", response_model=ParseResponse)
async def parse_video(
    request: ParseRequest,
    cache: CacheService = Depends(get_cache_service),
    _: None = Depends(check_rate_limit)
):
    """Parse YouTube video and extract information"""
    start_time_req = time.time()

    try:
        logger.info(f"Parsing video: {request.url} with quality: {request.quality}")

        # Check cache first
        cached_info = await cache.get_video_info(request.url, request.quality)
        if cached_info:
            processing_time = time.time() - start_time_req
            return ParseResponse(
                success=True,
                data=VideoInfo(**cached_info),
                cached=True,
                processing_time=processing_time
            )

        # Parse video using yt-dlp
        video_info = await video_parser.get_video_info(request.url, request.quality)

        # Cache the result
        await cache.set_video_info(request.url, request.quality, video_info)

        processing_time = time.time() - start_time_req
        logger.info(f"Video parsed successfully in {processing_time:.2f}s: {video_info['title']}")

        return ParseResponse(
            success=True,
            data=VideoInfo(**video_info),
            cached=False,
            processing_time=processing_time
        )

    except VideoParserError as e:
        logger.error(f"Video parsing error: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error="parsing_error",
                message=str(e),
                status_code=400
            ).dict()
        )
    except Exception as e:
        logger.error(f"Unexpected error parsing video: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error="internal_error",
                message="An unexpected error occurred while parsing the video",
                status_code=500
            ).dict()
        )


@app.get("/api/v1/video/{video_id}", response_model=ParseResponse)
async def get_video_info(
    video_id: str,
    cache: CacheService = Depends(get_cache_service)
):
    """Get video information by video ID from cache"""
    try:
        cached_info = await cache.get_video_by_id(video_id)
        if cached_info:
            return ParseResponse(
                success=True,
                data=VideoInfo(**cached_info),
                cached=True
            )

        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error="not_found",
                message=f"Video with ID {video_id} not found in cache",
                status_code=404
            ).dict()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting video info: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error="internal_error",
                message="An error occurred while retrieving video information",
                status_code=500
            ).dict()
        )


@app.get("/api/v1/formats/{video_id}", response_model=FormatsResponse)
async def get_video_formats(
    video_id: str,
    cache: CacheService = Depends(get_cache_service)
):
    """Get available formats for a video"""
    try:
        cached_info = await cache.get_video_by_id(video_id)
        if cached_info:
            return FormatsResponse(
                success=True,
                formats=cached_info.get('formats', [])
            )

        return FormatsResponse(
            success=False,
            error=f"Video with ID {video_id} not found in cache"
        )

    except Exception as e:
        logger.error(f"Error getting video formats: {str(e)}")
        return FormatsResponse(
            success=False,
            error="An error occurred while retrieving video formats"
        )

# Legacy endpoints for backward compatibility
@app.post("/api/v1/download", response_model=DownloadResponse)
async def download_video(
    request: DownloadRequest,
    _: None = Depends(check_rate_limit)
):
    """
    Legacy download endpoint - redirects to parse endpoint
    """
    try:
        # Convert to parse request
        parse_request = ParseRequest(url=request.url, quality=request.quality)

        # Parse video
        cache = await get_cache_service()
        result = await parse_video(parse_request, cache, None)

        if result.success and result.data:
            return DownloadResponse(
                status="success",
                message=f"Video parsed successfully: {result.data.title}",
                download_id=result.data.id,
                file_url=result.data.url
            )
        else:
            return DownloadResponse(
                status="error",
                message=result.error or "Failed to parse video"
            )

    except Exception as e:
        logger.error(f"Legacy download error: {str(e)}")
        return DownloadResponse(
            status="error",
            message=str(e)
        )


@app.get("/api/v1/download/{download_id}")
async def get_download_status(
    download_id: str,
    cache: CacheService = Depends(get_cache_service)
):
    """Get download status - legacy endpoint"""
    try:
        cached_info = await cache.get_video_by_id(download_id)
        if cached_info:
            return {
                "download_id": download_id,
                "status": "completed",
                "progress": 100,
                "message": f"Video available: {cached_info.get('title', 'Unknown')}"
            }
        else:
            return {
                "download_id": download_id,
                "status": "not_found",
                "progress": 0,
                "message": "Video not found in cache"
            }
    except Exception as e:
        logger.error(f"Error getting download status: {str(e)}")
        return {
            "download_id": download_id,
            "status": "error",
            "progress": 0,
            "message": str(e)
        }


@app.get("/api/v1/downloads")
async def list_downloads(cache: CacheService = Depends(get_cache_service)):
    """List all downloads - legacy endpoint"""
    try:
        cache_stats = await cache.get_cache_stats()
        return {
            "downloads": [],
            "total": cache_stats.get('video_cache_count', 0),
            "message": "Use /api/v1/parse endpoint for new video parsing"
        }
    except Exception as e:
        logger.error(f"Error listing downloads: {str(e)}")
        return {
            "downloads": [],
            "total": 0,
            "message": str(e)
        }


# Admin endpoints
@app.get("/api/v1/admin/cache/stats")
async def get_cache_stats(cache: CacheService = Depends(get_cache_service)):
    """Get cache statistics"""
    try:
        stats = await cache.get_cache_stats()
        return {
            "success": True,
            "data": stats
        }
    except Exception as e:
        logger.error(f"Error getting cache stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/v1/admin/cache/clear")
async def clear_cache(cache: CacheService = Depends(get_cache_service)):
    """Clear video cache"""
    try:
        cleared = await cache.clear_cache()
        return {
            "success": True,
            "message": f"Cleared {cleared} cache entries"
        }
    except Exception as e:
        logger.error(f"Error clearing cache: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "YTLantern API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "parse": "/api/v1/parse",
            "health": "/api/v1/health",
            "video_info": "/api/v1/video/{video_id}",
            "formats": "/api/v1/formats/{video_id}"
        }
    }


# Error handlers
@app.exception_handler(VideoParserError)
async def video_parser_error_handler(request: Request, exc: VideoParserError):
    """Handle video parser errors"""
    return JSONResponse(
        status_code=400,
        content=ErrorResponse(
            error="video_parser_error",
            message=str(exc),
            status_code=400
        ).dict()
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error="http_error",
            message=str(exc.detail),
            status_code=exc.status_code
        ).dict()
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )
