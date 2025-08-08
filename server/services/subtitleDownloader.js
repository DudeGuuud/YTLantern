import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const config = {
  cookie: join(__dirname, '../cookies.txt'),
  timeout: 120000, // 2 minutes
  tmpDir: join(__dirname, '../../tmp'),
};

// Ensure tmp directory exists
if (!existsSync(config.tmpDir)) {
  mkdirSync(config.tmpDir, { recursive: true });
}

/**
 * Get website URL for different platforms
 * @param {string} website - Platform (y2b, bilibili)
 * @param {string} id - Video ID
 * @param {string} p - Part number (for bilibili)
 * @returns {string} Full URL
 */
function getWebsiteUrl(website, id, p) {
  switch (website) {
    case 'y2b':
      return `https://www.youtube.com/watch?v=${id}`;
    case 'bilibili':
      return `https://www.bilibili.com/video/${id}${p ? `?p=${p}` : ''}`;
    default:
      return `https://www.youtube.com/watch?v=${id}`;
  }
}

/**
 * Download subtitle using yt-dlp
 * @param {Object} options - Download options
 * @param {string} options.website - Platform
 * @param {string} options.id - Video ID
 * @param {string} options.p - Part number
 * @param {string} options.locale - Language code
 * @param {string} options.ext - File extension
 * @param {string} options.type - Subtitle type (native/auto)
 * @returns {Promise<Object>} Download result
 */
export async function downloadSubtitle({ website = 'y2b', id, p, locale, ext, type }) {
  try {
    // Validate inputs
    if (!id || !locale || !ext || !type) {
      throw new Error('Missing required parameters');
    }

    if (!id.match(/^[\w-]{11,14}$/)) {
      throw new Error('Invalid video ID format');
    }

    if (!ext.match(/^\.(srt|ass|vtt|lrc|xml)$/)) {
      throw new Error('Invalid subtitle extension');
    }

    if (!type.match(/^(auto|native)$/)) {
      throw new Error('Invalid subtitle type');
    }

    if (p && !p.match(/^[\d]+$/)) {
      throw new Error('Invalid part number');
    }

    // Create subtitle path
    const fullpath = join(config.tmpDir, `${id}${p ? `/p${p}` : ''}`);
    mkdirSync(fullpath, { recursive: true });

    // Build yt-dlp command
    const url = getWebsiteUrl(website, id, p);
    const cookieParam = existsSync(config.cookie) ? `--cookies ${config.cookie}` : '';
    
    let cmd;
    if (type === 'native') {
      // Download native subtitles
      cmd = `yt-dlp --sub-lang '${locale}' -o '${fullpath}/%(id)s.%(ext)s' --write-sub --skip-download --write-info-json ${url} ${cookieParam}`;
    } else {
      // Download auto-generated subtitles
      cmd = `yt-dlp --sub-lang '${locale}' -o '${fullpath}/%(id)s.%(ext)s' --write-auto-sub --skip-download --write-info-json ${url} ${cookieParam}`;
    }

    console.log('Downloading subtitle, command:', cmd);

    // Execute download
    execSync(cmd, {
      timeout: config.timeout,
      encoding: 'utf8'
    });

    // File paths
    const before = `${fullpath}/${id}${p ? `_p${p}` : ''}`;
    const originalExt = locale === 'danmaku' ? 'xml' : (website === 'y2b' ? 'vtt' : 'srt');
    const subtitleFile = `${before}.${locale}.${originalExt}`;
    const convertedFile = `${before}.${locale}${ext}`;
    const infoFile = `${before}.info.json`;

    console.log('Downloaded subtitle:', subtitleFile);

    // Convert subtitle format if needed
    if (subtitleFile !== convertedFile) {
      console.log('Converting to:', convertedFile);
      const convertCmd = `ffmpeg -i '${subtitleFile}' '${convertedFile}' -y`;
      console.log('Convert command:', convertCmd);
      
      try {
        execSync(convertCmd, { timeout: 30000 });
      } catch (convertError) {
        console.warn('FFmpeg conversion failed, using original file');
        // If conversion fails, use the original file
        const originalContent = readFileSync(subtitleFile, 'utf8');
        return {
          success: true,
          title: id,
          filename: `${id}.${locale}${originalExt}`,
          text: Buffer.from(originalContent).toString('base64')
        };
      }
    }

    // Read video info
    let title = id;
    try {
      const info = JSON.parse(readFileSync(infoFile, 'utf8'));
      title = info.title || id;
    } catch (infoError) {
      console.warn('Could not read video info:', infoError.message);
    }

    // Read subtitle content
    const subtitleContent = readFileSync(convertedFile, 'utf8');

    return {
      success: true,
      title,
      filename: `${title}.${locale}${ext}`,
      text: Buffer.from(subtitleContent).toString('base64')
    };

  } catch (error) {
    console.error('Subtitle download error:', error);
    return {
      success: false,
      error: error.message || 'Failed to download subtitle'
    };
  }
}
