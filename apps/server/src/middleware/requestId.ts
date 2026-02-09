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
  req.requestId = (req.headers['x-request-id'] as string) || uuid();

  // Add request ID to response headers
  res.setHeader('x-request-id', req.requestId);

  next();
}
