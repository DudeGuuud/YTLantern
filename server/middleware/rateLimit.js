/**
 * Simple in-memory rate limiter
 */

const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute
const RATE_LIMIT_MAX_REQUESTS_PER_HOUR = 200; // 200 requests per hour

/**
 * Rate limiting middleware
 */
export function rateLimiter(req, res, next) {
  const clientIP = getClientIP(req);
  const now = Date.now();
  
  // Clean old entries
  cleanupOldEntries(now);
  
  // Get or create client record
  if (!rateLimitStore.has(clientIP)) {
    rateLimitStore.set(clientIP, {
      requests: [],
      hourlyRequests: []
    });
  }
  
  const clientData = rateLimitStore.get(clientIP);
  
  // Check minute-based rate limit
  const recentRequests = clientData.requests.filter(
    timestamp => now - timestamp < RATE_LIMIT_WINDOW
  );
  
  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: `Too many requests. Limit: ${RATE_LIMIT_MAX_REQUESTS} requests per minute`,
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000),
      currentCount: recentRequests.length,
      limit: RATE_LIMIT_MAX_REQUESTS
    });
  }
  
  // Check hourly rate limit
  const hourlyRequests = clientData.hourlyRequests.filter(
    timestamp => now - timestamp < 60 * 60 * 1000 // 1 hour
  );
  
  if (hourlyRequests.length >= RATE_LIMIT_MAX_REQUESTS_PER_HOUR) {
    return res.status(429).json({
      success: false,
      error: 'Hourly rate limit exceeded',
      message: `Too many requests. Limit: ${RATE_LIMIT_MAX_REQUESTS_PER_HOUR} requests per hour`,
      retryAfter: 3600,
      currentCount: hourlyRequests.length,
      limit: RATE_LIMIT_MAX_REQUESTS_PER_HOUR
    });
  }
  
  // Add current request
  clientData.requests = [...recentRequests, now];
  clientData.hourlyRequests = [...hourlyRequests, now];
  
  // Add rate limit headers
  res.set({
    'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS,
    'X-RateLimit-Remaining': Math.max(0, RATE_LIMIT_MAX_REQUESTS - recentRequests.length - 1),
    'X-RateLimit-Reset': new Date(now + RATE_LIMIT_WINDOW).toISOString(),
    'X-RateLimit-Hourly-Limit': RATE_LIMIT_MAX_REQUESTS_PER_HOUR,
    'X-RateLimit-Hourly-Remaining': Math.max(0, RATE_LIMIT_MAX_REQUESTS_PER_HOUR - hourlyRequests.length - 1)
  });
  
  next();
}

/**
 * Clean up old rate limit entries
 * @param {number} now - Current timestamp
 */
function cleanupOldEntries(now) {
  const cutoffTime = now - 60 * 60 * 1000; // 1 hour ago
  
  for (const [clientIP, data] of rateLimitStore.entries()) {
    // Remove old requests
    data.requests = data.requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    data.hourlyRequests = data.hourlyRequests.filter(timestamp => timestamp > cutoffTime);
    
    // Remove client if no recent requests
    if (data.requests.length === 0 && data.hourlyRequests.length === 0) {
      rateLimitStore.delete(clientIP);
    }
  }
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
 * Get rate limit statistics
 * @returns {Object} Rate limit statistics
 */
export function getRateLimitStats() {
  const now = Date.now();
  const stats = {
    totalClients: rateLimitStore.size,
    activeClients: 0,
    totalRequests: 0,
    requestsLastMinute: 0,
    requestsLastHour: 0
  };
  
  for (const [clientIP, data] of rateLimitStore.entries()) {
    const recentRequests = data.requests.filter(
      timestamp => now - timestamp < RATE_LIMIT_WINDOW
    );
    const hourlyRequests = data.hourlyRequests.filter(
      timestamp => now - timestamp < 60 * 60 * 1000
    );
    
    if (recentRequests.length > 0 || hourlyRequests.length > 0) {
      stats.activeClients++;
    }
    
    stats.totalRequests += data.requests.length;
    stats.requestsLastMinute += recentRequests.length;
    stats.requestsLastHour += hourlyRequests.length;
  }
  
  return stats;
}
