import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from '../entities/user.entity';

export const GetUser = createParamDecorator(
  (
    data: keyof User | undefined,
    ctx: ExecutionContext,
  ): User | User[keyof User] => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: User }>();
    const user = req.user;

    if (!user) throw new UnauthorizedException('User not found in request');

    return data ? user[data] : user;
  },
);
