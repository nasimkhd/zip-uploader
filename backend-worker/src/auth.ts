/**
 * API Key Authentication Middleware
 * Validates X-API-Key header for protected endpoints
 */

import type { Env, ApiValidationResult, LogContext } from './types.js';

// CORS headers for use in responses
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Correlation-ID',
  'Access-Control-Expose-Headers': 'ETag, X-Checksum-SHA256, X-Correlation-ID',
};

/**
 * Generate correlation ID for request tracking
 * @returns {string} UUID v4 correlation ID
 */
export function generateCorrelationId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Extract correlation ID from request headers or generate new one
 * @param {Request} request - The incoming request
 * @returns {string} Correlation ID
 */
export function getCorrelationId(request: Request): string {
  return request.headers.get('X-Correlation-ID') || generateCorrelationId();
}

/**
 * Validate API key from request headers
 * @param {Request} request - The incoming request
 * @param {Env} env - Worker environment (contains API keys)
 * @param {boolean} requireAdmin - Whether admin key is required
 * @returns {ApiValidationResult} Validation result
 */
export function validateApiKey(request: Request, env: Env, requireAdmin = false): ApiValidationResult {
  const apiKey = request.headers.get('X-API-Key');
  
  // Check if key is present
  if (!apiKey) {
    return {
      valid: false,
      error: 'Unauthorized',
      code: 'MISSING_KEY'
    };
  }
  
  // Get expected keys from environment
  const publicKey = env.API_KEY_PUBLIC;
  const adminKey = env.API_KEY_ADMIN;
  
  // Validate against keys
  if (requireAdmin) {
    if (adminKey && apiKey === adminKey) {
      return { valid: true };
    }
    return {
      valid: false,
      error: 'Unauthorized',
      code: 'ADMIN_KEY_REQUIRED'
    };
  } else {
    // Check public key first, then admin key (admin can do public operations)
    if ((publicKey && apiKey === publicKey) || (adminKey && apiKey === adminKey)) {
      return { valid: true };
    }
  }
  
  // Invalid key
  const keyPrefix = apiKey.substring(0, 8) + '...';
  
  // Log invalid attempt (prefix only for security)
  // Note: Using console directly since logging.js might create circular dependency
  console.error(JSON.stringify({
    level: 'warn',
    message: `Invalid API key attempt`,
    keyPrefix: keyPrefix,
    correlationId: getCorrelationId(request),
    timestamp: new Date().toISOString()
  }));
  
  return {
    valid: false,
    error: 'Unauthorized',
    code: 'INVALID_KEY'
  };
}

/**
 * Create unauthorized response
 * @param {string} code - Error code (MISSING_KEY, INVALID_KEY, ADMIN_KEY_REQUIRED)
 * @param {string} correlationId - Correlation ID for tracking
 * @returns {Response} 401 Unauthorized response
 */
export function createUnauthorizedResponse(code: string, correlationId: string): Response {
  return new Response(JSON.stringify({
    error: 'Unauthorized',
    code: code,
    correlationId: correlationId
  }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

/**
 * Authentication middleware wrapper
 * @param {Function} handler - Request handler function
 * @param {boolean} requireAdmin - Whether admin key is required
 * @returns {Function} Wrapped handler with authentication
 */
export function withAuth(
  handler: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>,
  requireAdmin = false
): (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response> {
  return async (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
    const correlationId = getCorrelationId(request);
    const pathname = new URL(request.url).pathname;
    
    // Validate API key
    const validation = validateApiKey(request, env, requireAdmin);
    
    if (!validation.valid) {
      // Log authentication failure with correlation ID for tracking
      console.log(JSON.stringify({
        level: 'info',
        message: `Authentication failed: ${validation.code}`,
        correlationId: correlationId,
        pathname: pathname,
        method: request.method,
        timestamp: new Date().toISOString()
      }));
      return createUnauthorizedResponse(validation.code || 'UNKNOWN', correlationId);
    }
    
    // Log successful authentication with correlation ID
    console.log(JSON.stringify({
      level: 'info',
      message: 'Authenticated request',
      correlationId: correlationId,
      pathname: pathname,
      method: request.method,
      timestamp: new Date().toISOString()
    }));
    
    // Add correlation ID to request headers for downstream handlers
    const modifiedRequest = new Request(request, {
      headers: {
        ...Object.fromEntries(request.headers),
        'X-Correlation-ID': correlationId
      }
    });
    
    // Call original handler
    return handler(modifiedRequest, env, ctx);
  };
}

