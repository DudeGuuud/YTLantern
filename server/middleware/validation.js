/**
 * Request validation middleware
 */
export function validateRequest(req, res, next) {
  const { method, path } = req;
  
  try {
    // Log request
    const clientIP = getClientIP(req);
    console.log(`${clientIP} => ${method} ${path}`);
    
    // Basic validation based on endpoint
    if (path.includes('/parse')) {
      const { url } = req.query;
      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL parameter is required'
        });
      }
      
      // Validate URL format
      if (!isValidURL(url)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid URL format'
        });
      }
    }
    
    if (path.includes('/download')) {
      const { v, format } = req.query;
      
      if (!v || !v.match(/^[\w-]{11,14}$/)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid video ID format'
        });
      }
      
      if (!format || !format.match(/^([\w\d-]+)(?:x([\w\d-]+))?$/)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid format specification'
        });
      }
    }
    
    if (path.includes('/subtitle') && method === 'POST') {
      const { id, locale, ext, type } = req.body;
      
      if (!id || !id.match(/^[\w-]{11,14}$/)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid video ID format'
        });
      }
      
      if (!ext || !ext.match(/^\.(srt|ass|vtt|lrc|xml)$/)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid subtitle extension'
        });
      }
      
      if (!type || !type.match(/^(auto|native)$/)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid subtitle type'
        });
      }
      
      if (!locale || !locale.match(/^([a-z]{2}(-[a-zA-Z]{2,4})?|auto|danmaku)$/)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid locale format'
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal validation error'
    });
  }
}

/**
 * Error handling middleware
 */
export function handleError(error, req, res, next) {
  console.error('Unhandled error:', error);
  
  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    success: false,
    error: isDevelopment ? error.message : 'Internal server error',
    ...(isDevelopment && { stack: error.stack })
  });
}

/**
 * Get client IP address
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
function isValidURL(url) {
  try {
    const urlObj = new URL(url);

    // Check for supported platforms with enhanced regex patterns
    const youtubeRegex = /^https?:\/\/(?:youtu\.be\/|(?:www|m)\.youtube\.com\/(?:watch|shorts)(?:\/|\?.*v=))([\w-]{11})/;
    const bilibiliRegex = /^https?:\/\/(?:www\.|m\.)?bilibili\.com\/video\/([\w\d]{11,14})\/?(?:\?.*)?$/;

    return youtubeRegex.test(url) || bilibiliRegex.test(url);
  } catch {
    return false;
  }
}
