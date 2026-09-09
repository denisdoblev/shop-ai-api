import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { ResourceOwnerGuard } from './resource-owner.guard';
import { User } from '../entities/user.entity';
import { ValidRoles } from '../interfaces';

describe('ResourceOwnerGuard', () => {
  it('throws UnauthorizedException when ownership is required without a user', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(class Resource {}),
    } as unknown as Reflector;
    const dataSource = {} as DataSource;
    const guard = new ResourceOwnerGuard(reflector, dataSource);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ params: { id: 'id' } }) }),
    };

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('does not let an admin bypass ownership', async () => {
    class Resource {}

    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(Resource),
    } as unknown as Reflector;
    const repository = {
      metadata: { name: 'Resource', relations: [] },
      findOne: jest.fn().mockResolvedValue({
        id: 'resource-id',
        userId: 'other-user-id',
      }),
    };
    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as DataSource;
    const guard = new ResourceOwnerGuard(reflector, dataSource);
    const user = {
      id: 'admin-user-id',
      roles: [ValidRoles.ADMIN],
    } as User;
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ params: { id: 'resource-id' }, user }),
      }),
    };

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
