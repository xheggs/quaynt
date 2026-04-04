import type { NextRequest, NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';
import { badRequest, unprocessable } from './response';
import type { RouteContext } from './types';

type ValidationSchemas<B, Q, P> = {
  body?: ZodSchema<B>;
  query?: ZodSchema<Q>;
  params?: ZodSchema<P>;
};

type ValidationSuccess<B, Q, P> = {
  success: true;
  data: {
    body: B;
    query: Q;
    params: P;
  };
};

type ValidationFailure = {
  success: false;
  response: NextResponse;
};

type ValidationResult<B, Q, P> = ValidationSuccess<B, Q, P> | ValidationFailure;

function mapZodErrors(issues: { path: PropertyKey[]; message: string }[]) {
  return issues.map((i) => ({
    field: i.path.map(String).join('.'),
    message: i.message,
  }));
}

export async function validateRequest<B = undefined, Q = undefined, P = undefined>(
  req: NextRequest,
  ctx: RouteContext,
  schemas: ValidationSchemas<B, Q, P>
): Promise<ValidationResult<B, Q, P>> {
  let body: B = undefined as B;
  let query: Q = undefined as Q;
  let params: P = undefined as P;

  if (schemas.body) {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return { success: false, response: badRequest('Invalid JSON body') };
    }

    const parsed = schemas.body.safeParse(rawBody);
    if (!parsed.success) {
      return {
        success: false,
        response: unprocessable(mapZodErrors(parsed.error.issues)),
      };
    }
    body = parsed.data;
  }

  if (schemas.query) {
    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = schemas.query.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        response: unprocessable(mapZodErrors(parsed.error.issues)),
      };
    }
    query = parsed.data;
  }

  if (schemas.params) {
    const raw = await ctx.params;
    const parsed = schemas.params.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        response: unprocessable(mapZodErrors(parsed.error.issues)),
      };
    }
    params = parsed.data;
  }

  return { success: true, data: { body, query, params } };
}
