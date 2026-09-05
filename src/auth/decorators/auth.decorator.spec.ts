jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual(
    '@nestjs/common',
  ) as unknown as typeof import('@nestjs/common');
  const mock = { ...actual } as typeof actual;
  (mock.applyDecorators as unknown) =
    jest.fn() as unknown as typeof actual.applyDecorators;
  (mock.UseGuards as unknown) = jest.fn() as unknown as typeof actual.UseGuards;
  (mock.SetMetadata as unknown) =
    jest.fn() as unknown as typeof actual.SetMetadata;
  return mock;
});

jest.mock('@nestjs/passport', () => {
  const actualPassport = jest.requireActual(
    '@nestjs/passport',
  ) as unknown as typeof import('@nestjs/passport');
  const mock = { ...actualPassport } as typeof actualPassport;
  (mock.AuthGuard as unknown) =
    jest.fn() as unknown as typeof actualPassport.AuthGuard;
  return mock;
});

import * as nestCommon from '@nestjs/common';
import * as passport from '@nestjs/passport';
import * as roleProtected from './role-protected.decorator';
import { Auth } from './auth.decorator';
import { UserRoleGuard } from '../guards/user-role.guard';
import { ValidRoles } from '../interfaces';

type RoleProtectedType = ReturnType<typeof roleProtected.RoleProtected>;
type ApplyDecoratorsReturn = ReturnType<typeof nestCommon.applyDecorators>;
type UseGuardsReturn = ReturnType<typeof nestCommon.UseGuards>;
type AuthGuardReturn = ReturnType<typeof passport.AuthGuard>;

describe('Auth decorator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies RoleProtected and UseGuards with AuthGuard and UserRoleGuard', () => {
    jest
      .spyOn(roleProtected, 'RoleProtected')
      .mockReturnValue('ROLE_PROTECTED_MOCK' as unknown as RoleProtectedType);

    jest
      .spyOn(nestCommon, 'applyDecorators')
      .mockImplementation(
        (...args: unknown[]) => args as unknown as ApplyDecoratorsReturn,
      );

    jest
      .spyOn(nestCommon, 'UseGuards')
      .mockImplementation(
        (...guards: unknown[]) =>
          ['USE_GUARDS', ...guards] as unknown as UseGuardsReturn,
      );

    jest
      .spyOn(passport, 'AuthGuard')
      .mockReturnValue('AUTH_GUARD_MOCK' as unknown as AuthGuardReturn);

    const result = Auth(ValidRoles.ADMIN, ValidRoles.SUPER_USER);

    expect(roleProtected.RoleProtected).toHaveBeenCalledWith(
      ValidRoles.ADMIN,
      ValidRoles.SUPER_USER,
    );
    expect(passport.AuthGuard).toHaveBeenCalledWith('jwt');
    expect(nestCommon.UseGuards).toHaveBeenCalledWith(
      'AUTH_GUARD_MOCK',
      UserRoleGuard,
    );
    expect(nestCommon.applyDecorators).toHaveBeenCalledWith(
      'ROLE_PROTECTED_MOCK',
      ['USE_GUARDS', 'AUTH_GUARD_MOCK', UserRoleGuard],
    );

    expect(result).toEqual([
      'ROLE_PROTECTED_MOCK',
      ['USE_GUARDS', 'AUTH_GUARD_MOCK', UserRoleGuard],
    ]);
  });
});
