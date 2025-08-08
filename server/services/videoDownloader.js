import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const config = {
  cookie: join(__dirname, '../cookies.txt'),
  timeout: 300000, // 5 minutes
  tmpDir: join(__dirname, '../../tmp'),
};

// Ensure tmp directory exists
if (!existsSync(config.tmpDir)) {
  mkdirSync(config.tmpDir, { recursive: true });
}

/**
 * Get website URL for different platforms
 * @param {string} website - Platform (y2b, bilibili)
 * @param {string} videoID - Video ID
 * @param {string} p - Part number (for bilibili)
 * @returns {string} Full URL
 */
function getWebsiteUrl(website, videoID, p) {
  switch (website) {
    case 'y2b':
      return `https://www.youtube.com/watch?v=${videoID}`;
    case 'bilibili':
      return `https://www.bilibili.com/video/${videoID}${p ? `?p=${p}` : ''}`;
    default:
      return `https://www.youtube.com/watch?v=${videoID}`;
  }
}

/**
 * Download video using yt-dlp
 * @param {Object} options - Download options
 * @param {string} options.website - Platform
 * @param {string} options.videoID - Video ID
 * @param {string} options.p - Part number
 * @param {string} options.format - Format string
 * @param {string} options.recode - Recode format
 * @param {string} options.subs - Subtitle languages
 * @param {boolean} options.merge - Whether to merge audio and video
 * @returns {Promise<Object>} Download result
 */
export async function downloadVideo({ website = 'y2b', videoID, p, format, recode, subs, merge = false }) {
  try {
    // Validate inputs
    if (!videoID || !format) {
      throw new Error('Video ID and format are required');
    }

    if (!videoID.match(/^[\w-]{11,14}$/)) {
      throw new Error('Invalid video ID format');
    }

    if (p && !p.match(/^[\d]+$/)) {
      throw new Error('Invalid part number format');
    }

    if (!format.match(/^([\w\d-]+)(?:x([\w\d-]+))?$/)) {
      throw new Error('Invalid format specification');
    }

    // Create download path
    const path = `${videoID}${p ? `/p${p}` : ''}/${format}`;
    const fullpath = join(config.tmpDir, path);
    
    // Ensure directory exists
    mkdirSync(fullpath, { recursive: true });

    // Build yt-dlp command
    const url = getWebsiteUrl(website, videoID, p);
    const cookieParam = existsSync(config.cookie) ? `--cookies ${config.cookie}` : '';
    const recodeParam = recode ? `--recode ${recode}` : '';

    let formatParam, outputTemplate, mergeOutput = false;

    if (merge && format.includes('x')) {
      // Audio+Video merge format (e.g., "137x140")
      formatParam = format.replace('x', '+');
      outputTemplate = `${fullpath}/${videoID}_merged.%(ext)s`;
      mergeOutput = true;
    } else if (format.includes('x')) {
      // Convert format for yt-dlp but don't merge
      formatParam = format.replace('x', '+');
      outputTemplate = `${fullpath}/${videoID}.%(ext)s`;
    } else {
      // Single format
      formatParam = format;
      outputTemplate = `${fullpath}/${videoID}.%(ext)s`;
    }

    let cmd = `yt-dlp ${cookieParam} ${url} -f ${formatParam} ` +
      `-o '${outputTemplate}' ${recodeParam} -k --write-info-json`;

    // Add merge options if needed
    if (mergeOutput) {
      cmd += ' --merge-output-format mp4';
    }

    console.log('Downloading video, command:', cmd);

    // Execute download
    const output = execSync(cmd, {
      timeout: config.timeout,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer
    });

    // Parse output to find downloaded file
    let dest = 'Unknown dest';
    const lines = output.split('\n');
    const regex = new RegExp(`^.*${fullpath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(${videoID}\\.[\\w]+).*$`);
    
    for (const line of lines) {
      console.log(line);
      const match = line.match(regex);
      if (match) {
        dest = match[1];
        break;
      }
    }

    return {
      success: true,
      result: {
        v: videoID,
        downloading: false,
        downloadSucceed: true,
        dest: `files/${path}/${dest}`,
        metadata: `info/${path}/${videoID}.info.json`
      }
    };

  } catch (error) {
    console.error('Download error:', error);
    
    // Parse error message
    let cause = 'Unknown cause';
    const errorLines = error.toString().split('\n');
    for (const line of errorLines) {
      const match = line.match(/^.*(ERROR.*)$/);
      if (match) {
        cause = match[1];
        break;
      }
    }

    return {
      success: true,
      result: {
        v: videoID,
        downloading: false,
        downloadSucceed: false,
        dest: '下载失败',
        metadata: cause
      }
    };
  }
}

/**
 * Check download status
 * @param {string} videoID - Video ID
 * @param {string} format - Format string
 * @param {string} p - Part number
 * @returns {Object} Download status
 */
export function getDownloadStatus(videoID, format, p) {
  const path = `${videoID}${p ? `/p${p}` : ''}/${format}`;
  const fullpath = join(config.tmpDir, path);
  
  if (existsSync(fullpath)) {
    return {
      success: true,
      result: {
        v: videoID,
        downloading: false,
        downloadSucceed: true,
        dest: `files/${path}`,
        metadata: `info/${path}/${videoID}.info.json`
      }
    };
  }
  
  return {
    success: false,
    error: 'Download not found'
  };
}
