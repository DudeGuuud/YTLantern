import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import dotenv from 'dotenv';
import cron from 'node-cron';

import { parseVideo } from './services/videoParser.js';
import { downloadVideo } from './services/videoDownloader.js';
import { downloadSubtitle } from './services/subtitleDownloader.js';
import { cleanupFiles } from './services/cleanup.js';
import { validateRequest, handleError } from './middleware/validation.js';
import { rateLimiter } from './middleware/rateLimit.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));

app.use(compression());
app.use(morgan('combined'));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api', rateLimiter);

// Serve static files from Next.js build
const frontendBuildPath = join(__dirname, '../src/.next');
if (existsSync(frontendBuildPath)) {
  app.use(express.static(join(__dirname, '../src/.next/static')));
  app.use('/_next', express.static(join(__dirname, '../src/.next')));
}

// Serve uploaded files
app.use('/files', express.static(join(__dirname, '../tmp')));
app.use('/info', express.static(join(__dirname, '../tmp')));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
  });
});

// API Routes
app.get('/api/parse', validateRequest, async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL parameter is required'
      });
    }

    console.log(`Parsing video: ${url}`);
    const result = await parseVideo(url);
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Parse error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to parse video'
    });
  }
});

app.get('/api/download', validateRequest, async (req, res) => {
  try {
    const { website, v, p, format, recode, subs, merge } = req.query;

    if (!v || !format) {
      return res.status(400).json({
        success: false,
        error: 'Video ID and format are required'
      });
    }

    console.log(`Downloading video: ${v} with format: ${format}${merge === 'true' ? ' (with merge)' : ''}`);
    const result = await downloadVideo({
      website,
      videoID: v,
      p,
      format,
      recode,
      subs,
      merge: merge === 'true'
    });

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to download video'
    });
  }
});

app.post('/api/subtitle', validateRequest, async (req, res) => {
  try {
    const { website, id, p, locale, ext, type } = req.body;
    
    if (!id || !locale || !ext || !type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    console.log(`Downloading subtitle: ${id} - ${locale}`);
    const result = await downloadSubtitle({ website, id, p, locale, ext, type });
    
    res.json(result);
  } catch (error) {
    console.error('Subtitle error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to download subtitle'
    });
  }
});

// Proxy for thumbnails
app.get('/api/proxy', async (req, res) => {
  const { url } = req.query;

  if (!url || (!url.startsWith('https://i.ytimg.com/') && !url.match(/^https?:\/\/i\d\.hdslb\.com\//))) {
    return res.status(403).json({ error: 'Invalid proxy URL' });
  }

  const protocol = url.startsWith('https://') ? 'https' : 'http';
  const httpModule = protocol === 'https' ? await import('https') : await import('http');

  httpModule.default.get(url, (response) => {
    res.writeHead(response.statusCode, response.statusMessage, response.headers);
    response.pipe(res);
  }).on('error', (err) => {
    console.error('Proxy error:', err);
    res.status(502).json({ error: 'Proxy request failed' });
  });
});

// Serve Next.js pages (only for non-API routes)
app.get('/', (req, res) => {
  const indexPath = join(__dirname, '../src/.next/server/pages/index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Fallback to development mode
    res.status(200).json({
      message: 'YTLantern API Server',
      version: '1.0.0',
      endpoints: ['/api/parse', '/api/download', '/api/subtitle', '/health']
    });
  }
});

// Error handling middleware
app.use(handleError);

// Cleanup scheduler - runs every hour
cron.schedule('0 * * * *', () => {
  console.log('Running cleanup task...');
  cleanupFiles();
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`🚀 YTLantern server running on http://${HOST}:${PORT}`);
  console.log(`📁 Frontend build path: ${frontendBuildPath}`);
  console.log(`🧹 Cleanup scheduled every hour`);
});

export default app;
