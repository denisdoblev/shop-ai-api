import { ExecutionContext } from '@nestjs/common';
import { getRawHeaders } from './raw-headers.decorator';

describe('getRawHeaders', () => {
  it('returns rawHeaders when present on request', () => {
    const raw = ['a', 'b', 'c'];
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ rawHeaders: raw }),
      }),
    } as unknown as ExecutionContext;

    const result = getRawHeaders(ctx);

    expect(result).toEqual(raw);
  });

  it('returns empty array when rawHeaders is undefined', () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;

    const result = getRawHeaders(ctx);

    expect(result).toEqual([]);
  });
});
