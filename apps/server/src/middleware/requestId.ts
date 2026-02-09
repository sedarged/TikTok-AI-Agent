import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';

// Add requestId to Request interface
declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

/**
 * Middleware to add a unique request ID to each request
 * Request ID is used for tracing and correlating logs
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Use existing request ID from header, or generate a new one
  const headerValue = req.headers['x-request-id'];

  let requestId: string;
  if (Array.isArray(headerValue)) {
    // If multiple values sent, use first non-empty one
    requestId = headerValue.find((v) => v && v.trim() !== '') || uuid();
  } else if (typeof headerValue === 'string' && headerValue.trim() !== '') {
    requestId = headerValue.trim();
  } else {
    requestId = uuid();
  }

  req.requestId = requestId;

  // Add request ID to response headers
  res.setHeader('x-request-id', requestId);

  next();
}
