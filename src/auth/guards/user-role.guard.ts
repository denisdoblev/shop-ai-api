import { Reflector } from '@nestjs/core';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { User } from '../entities/user.entity';
import { Request } from 'express';
import { META_ROLES } from '../decorators/role-protected.decorator';
import { ValidRoles } from '../interfaces';

@Injectable()
export class UserRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const validRoles = this.reflector.getAllAndOverride<ValidRoles[]>(
      META_ROLES,
      [context.getHandler(), context.getClass()],
    );

    if (!validRoles) return true;
    if (validRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: User }>();
    const user = req.user;

    if (!user) throw new UnauthorizedException('User not found in request');

    for (const role of user.roles) {
      if (validRoles.includes(role)) {
        return true;
      }
    }

    throw new ForbiddenException(
      `User ${user.fullname} need a valid role: [${validRoles.join(', ')}]`,
    );
  }
}
