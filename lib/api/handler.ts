// lib/api/handler.ts
import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';
import { ApiResult } from './response';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';

export interface HandlerContext {
  user: { id: string; email: string; name: string } | null;
  requestId: string;
}

export type RouteHandler = (
  req: NextRequest,
  context: HandlerContext
) => Promise<NextResponse>;

export interface HandlerOptions {
  authRequired?: boolean;
  rateLimit?: { max: number; windowMs: number };
  validateBody?: ZodSchema;
  validateQuery?: ZodSchema;
  validateParams?: ZodSchema;
}

// In-memory rate limit store (replace with Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (record.count >= max) return false;
  record.count++;
  return true;
}

export function createHandler(
  handler: RouteHandler,
  options: HandlerOptions = {}
) {
  return async (req: NextRequest, params?: { params: Promise<Record<string, string>> }): Promise<NextResponse> => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const method = req.method;
    const url = req.url;
    
    // Declare user outside try/catch for access in both blocks
    let user: { id: string; email: string; name: string } | null = null;

    try {
      // Auth
      if (options.authRequired !== false) {
        const session = await auth();
        if (!session?.user) {
          logger.warn('Unauthorized access attempt', 'api', { requestId, ip, url });
          return ApiResult.unauthorized();
        }
        // Safe navigation with fallbacks
        const userId = session.user.id || '';
        const userEmail = session.user.email || '';
        const userName = session.user.name || '';
        
        if (!userId || !userEmail) {
          logger.warn('Invalid user session', 'api', { requestId, session });
          return ApiResult.unauthorized();
        }
        
        user = { id: userId, email: userEmail, name: userName };
      }

      // Rate limiting
      if (options.rateLimit) {
        const rlKey = `ratelimit:${ip}:${url}`;
        if (!checkRateLimit(rlKey, options.rateLimit.max, options.rateLimit.windowMs)) {
          logger.warn('Rate limit exceeded', 'api', { requestId, ip, url });
          return ApiResult.rateLimited();
        }
      }

      // Validation
      let validatedBody: unknown;
      let validatedQuery: unknown;
      let validatedParams: unknown;

      if (options.validateBody) {
        const body = await req.json().catch(() => ({}));
        const result = options.validateBody.safeParse(body);
        if (!result.success) {
          logger.warn('Body validation failed', 'api', { requestId, errors: result.error.flatten() });
          return ApiResult.validationError(result.error.flatten());
        }
        validatedBody = result.data;
      }

      if (options.validateQuery) {
        const query = Object.fromEntries(req.nextUrl.searchParams);
        const result = options.validateQuery.safeParse(query);
        if (!result.success) {
          return ApiResult.validationError(result.error.flatten(), 'Invalid query parameters');
        }
        validatedQuery = result.data;
      }

      if (options.validateParams && params) {
        const resolvedParams = await params.params;
        const result = options.validateParams.safeParse(resolvedParams);
        if (!result.success) {
          return ApiResult.validationError(result.error.flatten(), 'Invalid route parameters');
        }
        validatedParams = result.data;
      }

      // Attach validated data to request for handler access
      const enhancedReq = Object.assign(req, {
        validatedBody,
        validatedQuery,
        validatedParams,
      });

      const context: HandlerContext = { user, requestId };
      const response = await handler(enhancedReq as NextRequest, context);

      // Log successful request
      const duration = Date.now() - startTime;
      logger.info('API request completed', 'api', {
        requestId,
        method,
        url,
        status: response.status,
        durationMs: duration,
        userId: user?.id,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Get user info from session again for error logging
      const errorUser = await auth().then(res => res?.user) ?? null;
      
      // Zod errors (should be caught above, but safety net)
      if (error instanceof ZodError) {
        return ApiResult.validationError(error.flatten());
      }

      // Prisma errors
      if (error && typeof error === 'object' && 'code' in error) {
        const prismaError = error as { code: string; meta?: unknown };
        if (prismaError.code === 'P2002') {
          return ApiResult.conflict('A record with this value already exists', prismaError.meta);
        }
        if (prismaError.code === 'P2025') {
          return ApiResult.notFound();
        }
      }

      // Log error with full context
      logger.error('API request failed', 'api', {
        requestId,
        method,
        url,
        durationMs: duration,
        userId: errorUser?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return ApiResult.internalError();
    }
  };
}

// Helper to extract validated data in handlers
export function getValidatedBody<T>(req: NextRequest): T {
  return (req as unknown as { validatedBody: T }).validatedBody;
}

export function getValidatedQuery<T>(req: NextRequest): T {
  return (req as unknown as { validatedQuery: T }).validatedQuery;
}

export function getValidatedParams<T>(req: NextRequest): T {
  return (req as unknown as { validatedParams: T }).validatedParams;
}