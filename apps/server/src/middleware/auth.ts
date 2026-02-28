import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../env.js';
import { logWarn, logDebug } from '../utils/logger.js';

/**
 * Authentication middleware for API routes.
 *
 * Validates API key from Authorization header (Bearer token format).
 * If no API_KEY is configured in env, this middleware allows all requests (permissive mode).
 *
 * Usage:
 *   app.use('/api/project', requireAuth, projectRoutes);
 *
 * Client usage:
 *   Authorization: Bearer <API_KEY>
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // If no API key is configured, allow all requests (backward compatibility)
  if (!env.API_KEY || env.API_KEY.trim() === '') {
    logDebug('API_KEY not configured - allowing request without authentication');
    next();
    return;
  }

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logWarn('Authentication failed: Missing Authorization header', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing Authorization header. Expected: Authorization: Bearer <API_KEY>',
    });
    return;
  }

  // Expected format: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logWarn('Authentication failed: Invalid Authorization header format', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid Authorization header format. Expected: Authorization: Bearer <API_KEY>',
    });
    return;
  }

  const token = parts[1];

  // Validate token against configured API key
  // Use timing-safe comparison to prevent timing attacks
  if (!timingSafeEqual(token, env.API_KEY)) {
    logWarn('Authentication failed: Invalid API key', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
    return;
  }

  // Authentication successful
  logDebug('Authentication successful', {
    path: req.path,
    method: req.method,
  });
  next();
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Compares two strings in constant time regardless of where they differ.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  // If lengths differ, they cannot be equal
  if (bufferA.length !== bufferB.length) {
    return false;
  }

  // Use Node's built-in timing-safe comparison
  return crypto.timingSafeEqual(bufferA, bufferB);
}

/**
 * Optional authentication middleware.
 * If API_KEY is configured and Authorization header is present, validates it.
 * Otherwise allows request (for backward compatibility).
 * Use this for routes that should work with or without authentication.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  // If no API key configured, skip authentication
  if (!env.API_KEY || env.API_KEY.trim() === '') {
    next();
    return;
  }

  // If Authorization header is present, validate it
  const authHeader = req.headers.authorization;
  if (authHeader) {
    // Delegate to requireAuth — it calls next() on success or sends 401 on failure
    return requireAuth(req, res, next);
  }
  // No auth header provided; allow request (optional auth by design)
  next();
}

/**
 * Middleware that only requires authentication for state-changing methods (POST, PUT, PATCH, DELETE).
 * GET, HEAD, OPTIONS requests are allowed without authentication.
 *
 * Usage:
 *   app.use('/api/project', requireAuthForWrites, projectRoutes);
 */
export function requireAuthForWrites(req: Request, res: Response, next: NextFunction): void {
  const writeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

  if (writeMethod) {
    // Apply authentication for write operations
    requireAuth(req, res, next);
  } else {
    // Allow read operations without authentication
    next();
  }
}
