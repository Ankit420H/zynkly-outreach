// lib/api/response.ts
import { NextResponse } from 'next/server';
import { ApiSuccess, ApiError, ErrorCode } from './types';

const generateRequestId = () => crypto.randomUUID();

export class ApiResult {
  static ok<T>(data: T, meta?: Record<string, unknown>, status = 200): NextResponse<ApiSuccess<T>> {
    return NextResponse.json({
      success: true,
      data,
      meta,
      requestId: generateRequestId(),
    }, { status });
  }

  static created<T>(data: T, meta?: Record<string, unknown>): NextResponse<ApiSuccess<T>> {
    return this.ok(data, meta, 201);
  }

  static fail(
    message: string,
    code: ErrorCode = 'INTERNAL_ERROR',
    status = 400,
    details?: unknown
  ): NextResponse<ApiError> {
    return NextResponse.json({
      success: false,
      error: { code, message, details, requestId: generateRequestId() },
    }, { status });
  }

  static validationError(errors: unknown, message = 'Validation failed'): NextResponse<ApiError> {
    return this.fail(message, 'VALIDATION_ERROR', 400, errors);
  }

  static unauthorized(message = 'Authentication required'): NextResponse<ApiError> {
    return this.fail(message, 'UNAUTHORIZED', 401);
  }

  static forbidden(message = 'Access denied'): NextResponse<ApiError> {
    return this.fail(message, 'FORBIDDEN', 403);
  }

  static notFound(resource = 'Resource'): NextResponse<ApiError> {
    return this.fail(`${resource} not found`, 'NOT_FOUND', 404);
  }

  static conflict(message: string, details?: unknown): NextResponse<ApiError> {
    return this.fail(message, 'CONFLICT', 409, details);
  }

  static rateLimited(message = 'Too many requests'): NextResponse<ApiError> {
    return this.fail(message, 'RATE_LIMITED', 429);
  }

  static internalError(message = 'An unexpected error occurred', details?: unknown): NextResponse<ApiError> {
    return this.fail(message, 'INTERNAL_ERROR', 500, details);
  }
}