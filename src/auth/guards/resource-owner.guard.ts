import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  EntityMetadata,
  EntityTarget,
  FindOptionsWhere,
  ObjectLiteral,
  DataSource,
} from 'typeorm';
import { CHECK_OWNER_KEY } from '../decorators/check-owner.decorator';
import { User } from '../entities/user.entity';
import { ValidRoles } from '../interfaces';

type AuthenticatedRequest = Request & {
  user?: User;
};

type OwnerEntityTarget = EntityTarget<ObjectLiteral>;

@Injectable()
export class ResourceOwnerGuard implements CanActivate {
  private readonly superAdminRoles = new Set([
    'SUPER_ADMIN',
    'super_admin',
    ValidRoles.superUser,
  ]);

  constructor(
    private readonly reflector: Reflector,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const entity = this.reflector.getAllAndOverride<OwnerEntityTarget>(
      CHECK_OWNER_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!entity) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException('User not found in request');
    }

    if (user.roles.some((role) => this.superAdminRoles.has(role))) {
      return true;
    }

    const routeId = req.params?.id;
    if (routeId === undefined || routeId === null || routeId === '') {
      return true;
    }
    const normalizedRouteId = Array.isArray(routeId) ? routeId[0] : routeId;

    const resourceId = this.parseRouteId(routeId);
    const repository = this.dataSource.getRepository(entity);
    const relations = this.getRelationPaths(repository.metadata);

    const resource = await repository.findOne({
      where: { id: resourceId } as FindOptionsWhere<ObjectLiteral>,
      relations,
    });

    if (!resource) {
      throw new NotFoundException(
        `${repository.metadata.name} with id ${normalizedRouteId} not found`,
      );
    }

    const ownerId = this.extractOwnerId(resource);
    if (ownerId === undefined || ownerId === null) {
      throw new ForbiddenException(
        `Owner for ${repository.metadata.name} could not be resolved`,
      );
    }

    if (`${ownerId}` !== `${user.id}`) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }

  private parseRouteId(routeId: string | string[]): number | string {
    const normalizedId = Array.isArray(routeId) ? routeId[0] : routeId;
    const numericId = Number(normalizedId);

    return Number.isNaN(numericId) ? normalizedId : numericId;
  }

  private getRelationPaths(metadata: EntityMetadata): string[] {
    const relationPaths: string[] = [];

    const visit = (
      currentMetadata: EntityMetadata,
      prefix: string,
      depth: number,
    ) => {
      if (depth > 2) {
        return;
      }

      for (const relation of currentMetadata.relations) {
        const path = prefix
          ? `${prefix}.${relation.propertyName}`
          : relation.propertyName;

        relationPaths.push(path);

        try {
          const relatedMetadata = this.dataSource.getMetadata(relation.type);
          visit(relatedMetadata, path, depth + 1);
        } catch {
          continue;
        }
      }
    };

    visit(metadata, '', 1);

    return [...new Set(relationPaths)];
  }

  private extractOwnerId(
    data: unknown,
    depth = 0,
    visited = new WeakSet<object>(),
  ): number | string | undefined {
    if (!data || typeof data !== 'object') {
      return undefined;
    }

    if (depth > 4) {
      return undefined;
    }

    const dataAsObject = data as Record<string, unknown>;

    if (visited.has(dataAsObject)) {
      return undefined;
    }
    visited.add(dataAsObject);

    const { userId, user } = dataAsObject;

    if (typeof userId === 'number' || typeof userId === 'string') {
      return userId;
    }

    if (
      user &&
      typeof user === 'object' &&
      'id' in user &&
      (typeof user.id === 'number' || typeof user.id === 'string')
    ) {
      return user.id;
    }

    for (const value of Object.values(dataAsObject)) {
      if (Array.isArray(value)) {
        continue;
      }

      const nestedOwnerId = this.extractOwnerId(value, depth + 1, visited);
      if (nestedOwnerId !== undefined) {
        return nestedOwnerId;
      }
    }

    return undefined;
  }
}
