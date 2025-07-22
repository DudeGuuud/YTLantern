"""
Cache Service for video information and rate limiting
Uses Redis for caching and rate limiting
"""

import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import redis
import hashlib

logger = logging.getLogger(__name__)


class CacheService:
    """Redis-based cache service for video information and rate limiting"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.video_cache_ttl = 3600  # 1 hour
        self.rate_limit_ttl = 3600   # 1 hour
        self.rate_limit_per_minute = 10
        self.rate_limit_per_hour = 100
    
    def _get_video_cache_key(self, url: str, quality: str) -> str:
        """Generate cache key for video information"""
        cache_input = f"{url}:{quality}"
        hash_key = hashlib.md5(cache_input.encode()).hexdigest()
        return f"video:info:{hash_key}"
    
    def _get_rate_limit_key(self, client_ip: str, time_window: str) -> str:
        """Generate rate limit key"""
        return f"rate_limit:{client_ip}:{time_window}"
    
    async def get_video_info(self, url: str, quality: str) -> Optional[Dict[str, Any]]:
        """Get cached video information"""
        try:
            cache_key = self._get_video_cache_key(url, quality)
            cached_data = self.redis.get(cache_key)
            
            if cached_data:
                logger.info(f"Cache hit for video: {url}")
                return json.loads(cached_data)
            
            logger.info(f"Cache miss for video: {url}")
            return None
            
        except Exception as e:
            logger.error(f"Error getting cached video info: {str(e)}")
            return None
    
    async def set_video_info(self, url: str, quality: str, video_info: Dict[str, Any]) -> bool:
        """Cache video information"""
        try:
            cache_key = self._get_video_cache_key(url, quality)
            cached_data = json.dumps(video_info, ensure_ascii=False)
            
            self.redis.setex(cache_key, self.video_cache_ttl, cached_data)
            logger.info(f"Cached video info for: {url}")
            return True
            
        except Exception as e:
            logger.error(f"Error caching video info: {str(e)}")
            return False
    
    async def check_rate_limit(self, client_ip: str) -> Dict[str, Any]:
        """Check if client has exceeded rate limits"""
        try:
            now = datetime.now()
            minute_key = self._get_rate_limit_key(client_ip, now.strftime("%Y%m%d%H%M"))
            hour_key = self._get_rate_limit_key(client_ip, now.strftime("%Y%m%d%H"))
            
            # Get current counts
            minute_count = self.redis.get(minute_key)
            hour_count = self.redis.get(hour_key)
            
            minute_count = int(minute_count) if minute_count else 0
            hour_count = int(hour_count) if hour_count else 0
            
            # Check limits
            if minute_count >= self.rate_limit_per_minute:
                return {
                    'allowed': False,
                    'reason': 'minute_limit_exceeded',
                    'retry_after': 60 - now.second,
                    'current_count': minute_count,
                    'limit': self.rate_limit_per_minute
                }
            
            if hour_count >= self.rate_limit_per_hour:
                return {
                    'allowed': False,
                    'reason': 'hour_limit_exceeded',
                    'retry_after': 3600 - (now.minute * 60 + now.second),
                    'current_count': hour_count,
                    'limit': self.rate_limit_per_hour
                }
            
            return {
                'allowed': True,
                'minute_count': minute_count,
                'hour_count': hour_count,
                'minute_limit': self.rate_limit_per_minute,
                'hour_limit': self.rate_limit_per_hour
            }
            
        except Exception as e:
            logger.error(f"Error checking rate limit: {str(e)}")
            # Allow request if rate limit check fails
            return {'allowed': True}
    
    async def increment_rate_limit(self, client_ip: str) -> None:
        """Increment rate limit counters"""
        try:
            now = datetime.now()
            minute_key = self._get_rate_limit_key(client_ip, now.strftime("%Y%m%d%H%M"))
            hour_key = self._get_rate_limit_key(client_ip, now.strftime("%Y%m%d%H"))
            
            # Increment counters with expiration
            pipe = self.redis.pipeline()
            pipe.incr(minute_key)
            pipe.expire(minute_key, 60)
            pipe.incr(hour_key)
            pipe.expire(hour_key, 3600)
            pipe.execute()
            
        except Exception as e:
            logger.error(f"Error incrementing rate limit: {str(e)}")
    
    async def get_video_by_id(self, video_id: str) -> Optional[Dict[str, Any]]:
        """Get video information by video ID from cache"""
        try:
            # Search for cached video by ID
            pattern = f"video:info:*"
            keys = self.redis.keys(pattern)
            
            for key in keys:
                cached_data = self.redis.get(key)
                if cached_data:
                    video_info = json.loads(cached_data)
                    if video_info.get('id') == video_id:
                        logger.info(f"Found cached video by ID: {video_id}")
                        return video_info
            
            logger.info(f"No cached video found for ID: {video_id}")
            return None
            
        except Exception as e:
            logger.error(f"Error getting video by ID: {str(e)}")
            return None
    
    async def clear_cache(self, pattern: str = "video:info:*") -> int:
        """Clear cached data by pattern"""
        try:
            keys = self.redis.keys(pattern)
            if keys:
                deleted = self.redis.delete(*keys)
                logger.info(f"Cleared {deleted} cache entries")
                return deleted
            return 0
            
        except Exception as e:
            logger.error(f"Error clearing cache: {str(e)}")
            return 0
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        try:
            video_keys = self.redis.keys("video:info:*")
            rate_limit_keys = self.redis.keys("rate_limit:*")
            
            return {
                'video_cache_count': len(video_keys),
                'rate_limit_entries': len(rate_limit_keys),
                'redis_info': self.redis.info('memory')
            }
            
        except Exception as e:
            logger.error(f"Error getting cache stats: {str(e)}")
            return {}


class MockCacheService:
    """Mock cache service for when Redis is not available"""
    
    def __init__(self):
        self.cache = {}
        self.rate_limits = {}
        logger.warning("Using mock cache service - Redis not available")
    
    async def get_video_info(self, url: str, quality: str) -> Optional[Dict[str, Any]]:
        cache_key = f"{url}:{quality}"
        return self.cache.get(cache_key)
    
    async def set_video_info(self, url: str, quality: str, video_info: Dict[str, Any]) -> bool:
        cache_key = f"{url}:{quality}"
        self.cache[cache_key] = video_info
        return True
    
    async def check_rate_limit(self, client_ip: str) -> Dict[str, Any]:
        # Always allow in mock mode
        return {'allowed': True}
    
    async def increment_rate_limit(self, client_ip: str) -> None:
        pass
    
    async def get_video_by_id(self, video_id: str) -> Optional[Dict[str, Any]]:
        for video_info in self.cache.values():
            if video_info.get('id') == video_id:
                return video_info
        return None
    
    async def clear_cache(self, pattern: str = "*") -> int:
        count = len(self.cache)
        self.cache.clear()
        return count
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        return {
            'video_cache_count': len(self.cache),
            'rate_limit_entries': 0,
            'redis_info': 'Mock cache service'
        }
