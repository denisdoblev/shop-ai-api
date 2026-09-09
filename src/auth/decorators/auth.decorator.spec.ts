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

jest.mock('@nestjs/swagger', () => {
  const actualSwagger = jest.requireActual(
    '@nestjs/swagger',
  ) as unknown as typeof import('@nestjs/swagger');
  const mock = { ...actualSwagger } as typeof actualSwagger;
  (mock.ApiBearerAuth as unknown) =
    jest.fn() as unknown as typeof actualSwagger.ApiBearerAuth;
  (mock.ApiUnauthorizedResponse as unknown) =
    jest.fn() as unknown as typeof actualSwagger.ApiUnauthorizedResponse;
  (mock.ApiForbiddenResponse as unknown) =
    jest.fn() as unknown as typeof actualSwagger.ApiForbiddenResponse;
  return mock;
});

import * as nestCommon from '@nestjs/common';
import * as passport from '@nestjs/passport';
import * as swagger from '@nestjs/swagger';
import * as roleProtected from './role-protected.decorator';
import { Auth } from './auth.decorator';
import { UserRoleGuard } from '../guards/user-role.guard';
import { ValidRoles } from '../interfaces';

type RoleProtectedType = ReturnType<typeof roleProtected.RoleProtected>;
type ApplyDecoratorsReturn = ReturnType<typeof nestCommon.applyDecorators>;
type UseGuardsReturn = ReturnType<typeof nestCommon.UseGuards>;
type AuthGuardReturn = ReturnType<typeof passport.AuthGuard>;
type ApiBearerAuthReturn = ReturnType<typeof swagger.ApiBearerAuth>;
type ApiUnauthorizedResponseReturn = ReturnType<
  typeof swagger.ApiUnauthorizedResponse
>;
type ApiForbiddenResponseReturn = ReturnType<
  typeof swagger.ApiForbiddenResponse
>;

describe('Auth decorator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies role guards and protected OpenAPI metadata', () => {
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

    jest
      .spyOn(swagger, 'ApiBearerAuth')
      .mockReturnValue('BEARER_MOCK' as unknown as ApiBearerAuthReturn);
    jest
      .spyOn(swagger, 'ApiUnauthorizedResponse')
      .mockReturnValue(
        'UNAUTHORIZED_MOCK' as unknown as ApiUnauthorizedResponseReturn,
      );
    jest
      .spyOn(swagger, 'ApiForbiddenResponse')
      .mockReturnValue(
        'FORBIDDEN_MOCK' as unknown as ApiForbiddenResponseReturn,
      );

    const result = Auth(ValidRoles.ADMIN);

    expect(roleProtected.RoleProtected).toHaveBeenCalledWith(ValidRoles.ADMIN);
    expect(passport.AuthGuard).toHaveBeenCalledWith('jwt');
    expect(nestCommon.UseGuards).toHaveBeenCalledWith(
      'AUTH_GUARD_MOCK',
      UserRoleGuard,
    );
    expect(nestCommon.applyDecorators).toHaveBeenCalledWith(
      'ROLE_PROTECTED_MOCK',
      ['USE_GUARDS', 'AUTH_GUARD_MOCK', UserRoleGuard],
      'BEARER_MOCK',
      'UNAUTHORIZED_MOCK',
      'FORBIDDEN_MOCK',
    );

    expect(result).toEqual([
      'ROLE_PROTECTED_MOCK',
      ['USE_GUARDS', 'AUTH_GUARD_MOCK', UserRoleGuard],
      'BEARER_MOCK',
      'UNAUTHORIZED_MOCK',
      'FORBIDDEN_MOCK',
    ]);
  });

  it('does not document 403 when no role is required', () => {
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
      .mockReturnValue('USE_GUARDS_MOCK' as unknown as UseGuardsReturn);
    jest
      .spyOn(passport, 'AuthGuard')
      .mockReturnValue('AUTH_GUARD_MOCK' as unknown as AuthGuardReturn);
    jest
      .spyOn(swagger, 'ApiBearerAuth')
      .mockReturnValue('BEARER_MOCK' as unknown as ApiBearerAuthReturn);
    jest
      .spyOn(swagger, 'ApiUnauthorizedResponse')
      .mockReturnValue(
        'UNAUTHORIZED_MOCK' as unknown as ApiUnauthorizedResponseReturn,
      );
    const forbiddenSpy = jest.spyOn(swagger, 'ApiForbiddenResponse');

    Auth();

    expect(forbiddenSpy).not.toHaveBeenCalled();
    expect(nestCommon.applyDecorators).toHaveBeenCalledWith(
      'ROLE_PROTECTED_MOCK',
      'USE_GUARDS_MOCK',
      'BEARER_MOCK',
      'UNAUTHORIZED_MOCK',
    );
  });
});
