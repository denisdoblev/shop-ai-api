import 'reflect-metadata';
import { InternalServerErrorException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { GetUser } from './get-user.decorator';

type RequestWithUser = { user?: Record<string, unknown> };
type SimpleContext = {
  switchToHttp: () => {
    getRequest: () => RequestWithUser;
  };
};

describe('GetUser decorator', () => {
  function getFactoryForData(data?: unknown) {
    // Cast GetUser to a decorator factory type to satisfy TypeScript
    class Test {
      test(
        @((GetUser as unknown as (d?: unknown) => ParameterDecorator)(data))
        _value: unknown,
      ) {
        void _value;
      }
    }

    const args =
      (Reflect.getMetadata(ROUTE_ARGS_METADATA, Test, 'test') as Record<
        string,
        unknown
      >) ?? {};
    const metadataValues = Object.values(args) as Array<
      Record<string, unknown>
    >;
    const meta = metadataValues.find((v) => v !== undefined) as unknown as
      | { factory: (d: unknown, ctx: SimpleContext) => unknown }
      | undefined;
    if (!meta) {
      throw new Error('Decorator metadata not found');
    }

    return meta.factory;
  }

  it('returns the user object when no data is provided', () => {
    const user = { id: 1, email: 'test@example.com' };
    const ctx: SimpleContext = {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    };

    const factory = getFactoryForData(undefined);
    const result = factory(undefined, ctx);

    expect(result).toBe(user);
  });

  it('returns the requested property when data key is provided', () => {
    const user = { id: 2, email: 'foo@bar.com' };
    const ctx: SimpleContext = {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    };

    const factory = getFactoryForData('email');
    const result = factory('email', ctx);

    expect(result).toBe('foo@bar.com');
  });

  it('throws InternalServerErrorException when request has no user', () => {
    const ctx: SimpleContext = {
      switchToHttp: () => ({ getRequest: () => ({}) }),
    };

    const factory = getFactoryForData(undefined);
    expect(() => factory(undefined, ctx)).toThrow(InternalServerErrorException);
    expect(() => factory(undefined, ctx)).toThrow('User not found (request)');
  });
});
