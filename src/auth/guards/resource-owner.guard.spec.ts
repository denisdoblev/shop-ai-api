import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { ResourceOwnerGuard } from './resource-owner.guard';

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
});
