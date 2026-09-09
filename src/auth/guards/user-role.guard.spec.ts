import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { UserRoleGuard } from './user-role.guard';
import { META_ROLES } from '../decorators/role-protected.decorator';
import { User } from '../entities/user.entity';
import { ValidRoles } from '../interfaces';

describe('UserRoleGuard', () => {
  let guard: UserRoleGuard;
  let reflector: Reflector;
  let getAllAndOverride: jest.Mock;

  beforeEach(() => {
    getAllAndOverride = jest.fn();
    reflector = { getAllAndOverride } as unknown as Reflector;
    guard = new UserRoleGuard(reflector);
  });

  // helper to build a minimal ExecutionContext inline in tests when needed
  const buildContext = (req: unknown, handler = () => ({})) => {
    class TestController {}

    return {
      getHandler: () => handler,
      getClass: () => TestController,
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  };

  it('returns true when no roles metadata is set', () => {
    getAllAndOverride.mockReturnValue(undefined);

    const context = buildContext({});
    const res = guard.canActivate(context);

    expect(res).toBe(true);
    expect(getAllAndOverride).toHaveBeenCalledWith(META_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
  });

  it('returns true when roles metadata is an empty array', () => {
    getAllAndOverride.mockReturnValue([]);

    const res = guard.canActivate(buildContext({}));

    expect(res).toBe(true);
  });

  it('throws UnauthorizedException when user is not present on request', () => {
    getAllAndOverride.mockReturnValue([ValidRoles.ADMIN]);

    expect(() => guard.canActivate(buildContext({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('returns true when user has at least one valid role', () => {
    getAllAndOverride.mockReturnValue([ValidRoles.ADMIN]);

    const user = new User();
    user.fullname = 'Jane Doe';
    user.roles = [ValidRoles.USER, ValidRoles.ADMIN];

    const res = guard.canActivate(buildContext({ user }));

    expect(res).toBe(true);
  });

  it('throws ForbiddenException when user does not have required role', () => {
    const validRoles = [ValidRoles.ADMIN];
    getAllAndOverride.mockReturnValue(validRoles);

    const user = new User();
    user.fullname = 'John Smith';
    user.roles = [ValidRoles.USER];

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
