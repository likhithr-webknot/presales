import { Request, Response, NextFunction } from 'express'
import { env } from '../config/env'

export interface AppError extends Error {
  statusCode?: number
}

export function errorMiddleware(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500
  const message = err.message || 'Internal server error'

  // Never expose stack traces to clients
  const response: Record<string, unknown> = {
    error: statusCode >= 500 ? 'Internal Server Error' : err.name || 'Error',
    message,
    statusCode,
  }

  if (env.NODE_ENV === 'development') {
    response.stack = err.stack
  }

  if (statusCode >= 500) {
    console.error(`[Error] ${req.method} ${req.path}:`, err)
  }

  res.status(statusCode).json(response)
}
