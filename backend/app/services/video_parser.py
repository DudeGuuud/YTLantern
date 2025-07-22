"""
YouTube Video Parser Service
Uses yt-dlp to extract video information and formats
"""

import re
import json
import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import yt_dlp
from urllib.parse import urlparse, parse_qs

logger = logging.getLogger(__name__)


class VideoParserError(Exception):
    """Custom exception for video parsing errors"""
    pass


class YouTubeVideoParser:
    """YouTube video parser using yt-dlp"""
    
    def __init__(self):
        self.ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extractaudio': False,
            'format': 'best[ext=mp4]/best',
            'noplaylist': True,
            'extract_flat': False,
            # Use mweb client with PO Token plugin support
            'extractor_args': {
                'youtube': {
                    'player_client': ['mweb', 'tv'],
                }
            },
            # Anti-bot measures
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'referer': 'https://www.youtube.com/',
            'headers': {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-us,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            },
            # Retry settings
            'retries': 3,
            'fragment_retries': 3,
            'skip_unavailable_fragments': True,
            # Timeout settings
            'socket_timeout': 30,
            # Rate limiting to avoid being blocked
            'sleep_interval': 1,
            'max_sleep_interval': 5,
        }
    
    def is_valid_youtube_url(self, url: str) -> bool:
        """Validate if URL is a valid YouTube URL"""
        youtube_patterns = [
            r'(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})',
            r'(?:https?://)?(?:www\.)?youtu\.be/([a-zA-Z0-9_-]{11})',
            r'(?:https?://)?(?:www\.)?youtube\.com/embed/([a-zA-Z0-9_-]{11})',
            r'(?:https?://)?(?:m\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})',
        ]
        
        for pattern in youtube_patterns:
            if re.match(pattern, url):
                return True
        return False
    
    def extract_video_id(self, url: str) -> Optional[str]:
        """Extract video ID from YouTube URL"""
        patterns = [
            r'(?:v=|/)([a-zA-Z0-9_-]{11})',
            r'youtu\.be/([a-zA-Z0-9_-]{11})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None
    
    async def get_video_info(self, url: str, quality: str = 'best') -> Dict[str, Any]:
        """
        Extract video information using yt-dlp
        """
        if not self.is_valid_youtube_url(url):
            raise VideoParserError("Invalid YouTube URL")
        
        video_id = self.extract_video_id(url)
        if not video_id:
            raise VideoParserError("Could not extract video ID from URL")
        
        try:
            # Configure yt-dlp options based on quality
            opts = self.ydl_opts.copy()
            opts.update(self._get_quality_format(quality))
            
            # Run yt-dlp in a thread to avoid blocking
            loop = asyncio.get_event_loop()
            info = await loop.run_in_executor(
                None, 
                self._extract_info_sync, 
                url, 
                opts
            )
            
            return self._process_video_info(info, video_id)
            
        except Exception as e:
            logger.error(f"Error extracting video info for {url}: {str(e)}")
            raise VideoParserError(f"Failed to extract video information: {str(e)}")
    
    def _extract_info_sync(self, url: str, opts: Dict) -> Dict:
        """Synchronous video info extraction"""
        with yt_dlp.YoutubeDL(opts) as ydl:
            return ydl.extract_info(url, download=False)
    
    def _get_quality_format(self, quality: str) -> Dict[str, str]:
        """Get yt-dlp format string based on quality preference"""
        quality_formats = {
            '144p': 'worst[height<=144][ext=mp4]/worst[ext=mp4]/worst',
            '240p': 'best[height<=240][ext=mp4]/best[height<=240]/worst[ext=mp4]/worst',
            '360p': 'best[height<=360][ext=mp4]/best[height<=360]/best[ext=mp4]/best',
            '480p': 'best[height<=480][ext=mp4]/best[height<=480]/best[ext=mp4]/best',
            '720p': 'best[height<=720][ext=mp4]/best[height<=720]/best[ext=mp4]/best',
            '1080p': 'best[height<=1080][ext=mp4]/best[height<=1080]/best[ext=mp4]/best',
            'best': 'best[ext=mp4]/best',
            'worst': 'worst[ext=mp4]/worst',
            'bestvideo': 'bestvideo[ext=mp4]/bestvideo',
            'bestaudio': 'bestaudio[ext=m4a]/bestaudio'
        }
        
        return {
            'format': quality_formats.get(quality, quality_formats['best'])
        }
    
    def _process_video_info(self, info: Dict, video_id: str) -> Dict[str, Any]:
        """Process and normalize video information"""
        try:
            # Extract basic video information
            title = info.get('title', 'Unknown Title')
            description = info.get('description', '')
            thumbnail = info.get('thumbnail', '')
            duration = info.get('duration', 0)
            uploader = info.get('uploader', 'Unknown')
            upload_date = info.get('upload_date', '')
            view_count = info.get('view_count', 0)
            like_count = info.get('like_count', 0)
            
            # Process upload date
            if upload_date:
                try:
                    upload_date = datetime.strptime(upload_date, '%Y%m%d').isoformat()
                except:
                    upload_date = datetime.now().isoformat()
            else:
                upload_date = datetime.now().isoformat()
            
            # Extract available formats
            formats = self._extract_formats(info)
            
            # Get the best URL for the requested quality
            url = info.get('url', '')
            
            return {
                'id': video_id,
                'title': title,
                'description': description[:500] if description else '',  # Limit description length
                'thumbnail': thumbnail,
                'duration': duration,
                'uploader': uploader,
                'upload_date': upload_date,
                'view_count': view_count,
                'like_count': like_count,
                'formats': formats,
                'url': url,
                'original_url': info.get('webpage_url', '')
            }
            
        except Exception as e:
            logger.error(f"Error processing video info: {str(e)}")
            raise VideoParserError(f"Failed to process video information: {str(e)}")
    
    def _extract_formats(self, info: Dict) -> List[Dict[str, Any]]:
        """Extract and process available video formats"""
        formats = []
        raw_formats = info.get('formats', [])
        
        # Filter and process formats
        for fmt in raw_formats:
            if not fmt.get('url'):
                continue
                
            # Skip audio-only formats for video list
            if fmt.get('vcodec') == 'none' and fmt.get('acodec') != 'none':
                continue
            
            format_info = {
                'format_id': fmt.get('format_id', ''),
                'url': fmt.get('url', ''),
                'ext': fmt.get('ext', 'mp4'),
                'quality': self._get_quality_label(fmt),
                'filesize': fmt.get('filesize'),
                'fps': fmt.get('fps'),
                'vcodec': fmt.get('vcodec'),
                'acodec': fmt.get('acodec'),
                'resolution': f"{fmt.get('width', 0)}x{fmt.get('height', 0)}" if fmt.get('width') and fmt.get('height') else None,
                'format_note': fmt.get('format_note', '')
            }
            
            formats.append(format_info)
        
        # Sort formats by quality (height)
        formats.sort(key=lambda x: self._get_height_from_quality(x['quality']), reverse=True)
        
        return formats[:10]  # Limit to top 10 formats
    
    def _get_quality_label(self, fmt: Dict) -> str:
        """Generate quality label from format info"""
        height = fmt.get('height')
        if height:
            return f"{height}p"
        
        format_note = fmt.get('format_note', '')
        if format_note:
            return format_note
        
        return fmt.get('format_id', 'unknown')
    
    def _get_height_from_quality(self, quality: str) -> int:
        """Extract height value from quality string for sorting"""
        match = re.search(r'(\d+)p', quality)
        if match:
            return int(match.group(1))
        return 0


# Global parser instance
video_parser = YouTubeVideoParser()
