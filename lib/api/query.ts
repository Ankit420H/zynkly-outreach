// lib/api/query.ts
import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const searchSchema = z.object({
  q: z.string().trim().optional(),
  search: z.string().trim().optional(),
});

export function buildPrismaQuery(params: {
  page?: number;
  limit?: number;
  cursor?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  where?: Record<string, unknown>;
}) {
  const { page = 1, limit = 50, cursor, sortBy, sortOrder = 'desc', where = {} } = params;
  
  const take = limit + 1; // Fetch one extra to detect next page
  const skip = cursor ? undefined : (page - 1) * limit;
  
  const cursorFilter = cursor ? { id: { gt: cursor } } : {};
  
  return {
    take,
    skip,
    cursor: cursor ? { id: cursor } : undefined,
    where: { ...where, ...cursorFilter },
    orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' as const },
  };
}

export function paginateResults<T extends { id: string }>(items: T[], limit: number) {
  let nextCursor: string | null = null;
  if (items.length > limit) {
    const next = items.pop()!;
    nextCursor = next.id;
  }
  return { items, nextCursor };
}