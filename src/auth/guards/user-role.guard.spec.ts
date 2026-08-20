import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { UserRoleGuard } from './user-role.guard';
import { User } from '../entities/user.entity';

describe('UserRoleGuard', () => {
  let guard: UserRoleGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = { get: jest.fn() } as unknown as Reflector;
    guard = new UserRoleGuard(reflector);
  });

  // helper to build a minimal ExecutionContext inline in tests when needed
  const buildContext = (req: unknown, handler = () => ({})) =>
    ({
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;

  it('returns true when no roles metadata is set', () => {
    (reflector.get as jest.Mock).mockReturnValue(undefined);

    const res = guard.canActivate(buildContext({}));

    expect(res).toBe(true);
  });

  it('returns true when roles metadata is an empty array', () => {
    (reflector.get as jest.Mock).mockReturnValue([]);

    const res = guard.canActivate(buildContext({}));

    expect(res).toBe(true);
  });

  it('throws BadRequestException when user is not present on request', () => {
    (reflector.get as jest.Mock).mockReturnValue(['admin']);

    expect(() => guard.canActivate(buildContext({}))).toThrow(
      BadRequestException,
    );
  });

  it('returns true when user has at least one valid role', () => {
    (reflector.get as jest.Mock).mockReturnValue(['admin', 'superuser']);

    const user = new User();
    user.fullname = 'Jane Doe';
    user.roles = ['user', 'admin'];

    const res = guard.canActivate(buildContext({ user }));

    expect(res).toBe(true);
  });

  it('throws ForbiddenException when user does not have required role', () => {
    const validRoles = ['admin'];
    (reflector.get as jest.Mock).mockReturnValue(validRoles);

    const user = new User();
    user.fullname = 'John Smith';
    user.roles = ['user'];

    // Capture the thrown exception to inspect its message
    try {
      void guard.canActivate(buildContext({ user }));
      // If no throw, fail the test
      fail('Expected ForbiddenException to be thrown');
    } catch (err: unknown) {
      if (err instanceof ForbiddenException) {
        expect(err.message).toContain(user.fullname);
        expect(err.message).toContain(validRoles.join(', '));
      } else {
        throw err;
      }
    }
  });
});
