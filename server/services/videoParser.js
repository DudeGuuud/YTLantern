import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const config = {
  cookie: join(__dirname, '../cookies.txt'),
  timeout: 60000, // 60 seconds
};

/**
 * Map video height to standard quality labels
 * @param {number} height - Video height in pixels
 * @param {string} formatNote - Format note from yt-dlp
 * @returns {Object} Quality information
 */
function mapVideoQuality(height, formatNote) {
  const note = (formatNote || '').toLowerCase();

  // Standard quality mapping based on height
  if (height >= 2160) {
    return { quality: '2160p', standard: '4K', label: '2160p 4K' };
  } else if (height >= 1440) {
    return { quality: '1440p', standard: '2K', label: '1440p 2K' };
  } else if (height >= 1080) {
    return { quality: '1080p', standard: 'Full HD', label: '1080p Full HD' };
  } else if (height >= 720) {
    return { quality: '720p', standard: 'HD', label: '720p HD' };
  } else if (height >= 480) {
    return { quality: '480p', standard: 'SD', label: '480p 标清' };
  } else if (height >= 360) {
    return { quality: '360p', standard: 'Low', label: '360p 流畅' };
  } else if (height >= 240) {
    return { quality: '240p', standard: 'Low', label: '240p' };
  } else if (height >= 144) {
    return { quality: '144p', standard: 'Low', label: '144p' };
  }

  // Fallback to format note if available
  if (note.includes('4k') || note.includes('2160')) {
    return { quality: '2160p', standard: '4K', label: formatNote || '2160p 4K' };
  } else if (note.includes('1440') || note.includes('2k')) {
    return { quality: '1440p', standard: '2K', label: formatNote || '1440p 2K' };
  } else if (note.includes('1080') || note.includes('full hd')) {
    return { quality: '1080p', standard: 'Full HD', label: formatNote || '1080p Full HD' };
  } else if (note.includes('720') || note.includes('hd')) {
    return { quality: '720p', standard: 'HD', label: formatNote || '720p HD' };
  } else if (note.includes('480')) {
    return { quality: '480p', standard: 'SD', label: formatNote || '480p 标清' };
  } else if (note.includes('360')) {
    return { quality: '360p', standard: 'Low', label: formatNote || '360p 流畅' };
  }

  return { quality: 'unknown', standard: 'Unknown', label: formatNote || 'Unknown' };
}

/**
 * Map audio bitrate to quality labels
 * @param {number} abr - Audio bitrate
 * @returns {string} Audio quality label
 */
function mapAudioQuality(abr) {
  if (abr >= 320) {
    return 'High (320kbps+)';
  } else if (abr >= 192) {
    return 'Medium (192kbps+)';
  } else if (abr >= 128) {
    return 'Standard (128kbps+)';
  } else if (abr >= 96) {
    return 'Low (96kbps+)';
  }
  return 'Unknown';
}

/**
 * Parse video information using yt-dlp
 * @param {string} url - Video URL
 * @returns {Promise<Object>} Parsed video information
 */
export async function parseVideo(url) {
  // Enhanced URL validation supporting more YouTube formats including playlists
  const bilibiliRegex = /^https?:\/\/(?:www\.|m\.)?bilibili\.com\/video\/([\w\d]{11,14})\/?(?:\?.*)?$/;

  // Clean URL and extract video ID for YouTube
  let cleanUrl = url;
  let videoID = null;
  let website = null;
  let p = null;

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    // Extract video ID from various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/watch\?.*[&?]v=([a-zA-Z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        videoID = match[1];
        website = 'y2b';
        cleanUrl = `https://www.youtube.com/watch?v=${videoID}`;
        break;
      }
    }
  } else if (url.includes('bilibili.com')) {
    const bilibiliMatch = url.match(bilibiliRegex);
    if (bilibiliMatch) {
      website = 'bilibili';
      videoID = bilibiliMatch[1];
      // Extract p parameter if present
      const pMatch = url.match(/[?&]p=(\d+)/);
      if (pMatch) {
        p = pMatch[1];
      }
    }
  }

  if (!website || !videoID) {
    throw new Error('请提供一个有效的YouTube或Bilibili视频URL\n支持格式：\nhttps://www.youtube.com/watch?v=VIDEO_ID\nhttps://youtu.be/VIDEO_ID\nhttps://www.bilibili.com/video/BV_ID');
  }

  try {
    // Build yt-dlp command
    const cookieParam = existsSync(config.cookie) ? `--cookies "${config.cookie}"` : '';
    const cmd = `yt-dlp --print-json --skip-download ${cookieParam} '${url}' 2> /dev/null`;
    
    console.log('Parsing video, command:', cmd);
    
    // Execute command with timeout
    let result;
    try {
      result = execSync(cmd, { 
        timeout: config.timeout,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
    } catch (error) {
      // Try with p=1 for bilibili videos
      if (website === 'bilibili' && !p) {
        const retryUrl = url.includes('?') ? `${url}&p=1` : `${url}?p=1`;
        const retryCmd = `yt-dlp --print-json --skip-download ${cookieParam} '${retryUrl}' 2> /dev/null`;
        console.log('Retrying with p=1, command:', retryCmd);
        result = execSync(retryCmd, {
          timeout: config.timeout,
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024
        });
        p = '1';
        url = retryUrl;
      } else {
        throw error;
      }
    }

    // Parse JSON result
    const videoInfo = JSON.parse(result);
    console.log('Parse completed:', videoInfo.title, url);

    // Process formats with enhanced quality mapping
    const audios = [];
    const videos = [];

    videoInfo.formats?.forEach(format => {
      const filesize = (format.filesize_approx ? '≈' : '') +
        ((format.filesize || format.filesize_approx || 0) / 1024 / 1024).toFixed(2);

      if (format.audio_ext !== 'none') {
        audios.push({
          id: format.format_id,
          format: format.ext,
          rate: (format.abr || 0).toFixed(0),
          info: format.format_note || format.format || '',
          size: filesize,
          quality: mapAudioQuality(format.abr)
        });
      } else if (format.video_ext !== 'none') {
        const qualityInfo = mapVideoQuality(format.height, format.format_note);
        videos.push({
          id: format.format_id,
          format: format.ext,
          scale: format.resolution,
          frame: format.height,
          rate: (format.vbr || 0).toFixed(0),
          info: qualityInfo.label,
          size: filesize,
          quality: qualityInfo.quality,
          standardQuality: qualityInfo.standard
        });
      }
    });

    // Find best formats
    const bestAudio = audios.sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate))[0] || {};
    const bestVideo = videos.sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate))[0] || {};

    // Parse subtitles
    const subs = await parseSubtitles(url);

    return {
      website,
      v: videoID,
      p,
      title: videoInfo.title,
      thumbnail: videoInfo.thumbnail,
      duration: videoInfo.duration,
      uploader: videoInfo.uploader,
      view_count: videoInfo.view_count,
      upload_date: videoInfo.upload_date,
      description: videoInfo.description?.substring(0, 500) || '',
      best: {
        audio: bestAudio,
        video: bestVideo,
      },
      available: { 
        audios, 
        videos, 
        subs 
      }
    };

  } catch (error) {
    console.error('Parse error:', error);
    throw new Error(`解析失败: ${error.message}`);
  }
}

/**
 * Parse available subtitles for a video
 * @param {string} url - Video URL
 * @returns {Promise<Array>} Available subtitle languages
 */
async function parseSubtitles(url) {
  try {
    const cookieParam = existsSync(config.cookie) ? `--cookies "${config.cookie}"` : '';
    const cmd = `yt-dlp --list-subs ${cookieParam} '${url}' 2> /dev/null`;
    
    console.log('Parsing subtitles, command:', cmd);
    const result = execSync(cmd, { 
      timeout: config.timeout,
      encoding: 'utf8'
    });
    
    const lines = result.split(/(\r\n|\n)/);
    let noAutoSub = true;
    const officialSub = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line === '\n') continue;

      // Check for automatic captions
      if (line.match(/.*Available automatic captions for .*?:/)) {
        noAutoSub = false;
        continue;
      }

      // Parse official subtitles
      if (line.match(/.*Available subtitles for .*?:/)) {
        for (let j = i + 1; j < lines.length; j++) {
          const subLine = lines[j].trim();
          if (!subLine || subLine === '\n') continue;

          const sub = catchSubtitle(subLine);
          if (sub === -1) break; // End of subtitle list
          if (sub === 0) continue; // Header line
          if (sub) officialSub.push(sub); // Valid subtitle language
        }
        break;
      }
    }

    if (officialSub.length < 1) {
      return noAutoSub ? [] : ['auto']; // No subs or auto-generated only
    } else {
      console.log('Official subtitles found:', officialSub);
      return officialSub;
    }

  } catch (error) {
    console.error('Subtitle parsing error:', error);
    return [];
  }
}

/**
 * Parse subtitle line to extract language code
 * @param {string} line - Subtitle line from yt-dlp output
 * @returns {string|number} Language code, 0 for continue, -1 for end
 */
function catchSubtitle(line) {
  if (line.match(/^Language .*/)) return 0;
  const match = line.match(/^(danmaku|[a-z]{2}(?:-[a-zA-Z]+)?).*/);
  if (match) return match[1];
  return -1;
}
