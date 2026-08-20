import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { RoleProtected, META_ROLES } from './role-protected.decorator';
import { ValidRoles } from '../interfaces';

describe('RoleProtected decorator', () => {
  it('sets metadata on a class', () => {
    @RoleProtected(ValidRoles.admin, ValidRoles.user)
    class TestClass {}

    const reflector = new Reflector();
    const roles = reflector.get<string[]>(META_ROLES, TestClass);

    expect(roles).toEqual([ValidRoles.admin, ValidRoles.user]);
  });

  it('sets metadata on a method', () => {
    class TestClass {
      @RoleProtected(ValidRoles.superUser)
      someMethod() {}
    }

    const reflector = new Reflector();

    const descriptor = Object.getOwnPropertyDescriptor(
      TestClass.prototype,
      'someMethod',
    );
    const handler = descriptor?.value as (...args: unknown[]) => unknown;

    const roles = reflector.get<string[]>(META_ROLES, handler);

    expect(roles).toEqual([ValidRoles.superUser]);
  });
});
