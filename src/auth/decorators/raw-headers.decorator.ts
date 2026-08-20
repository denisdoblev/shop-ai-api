import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export function getRawHeaders(ctx: ExecutionContext): string[] {
  const req = ctx
    .switchToHttp()
    .getRequest<Request & { rawHeaders?: string[] }>();
  return req.rawHeaders ?? [];
}

export const RawHeaders = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string[] => getRawHeaders(ctx),
);
