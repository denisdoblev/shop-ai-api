import { SetMetadata, Type } from '@nestjs/common';

export const CHECK_OWNER_KEY = 'checkOwnerEntity';

export const CheckOwner = (
  entity: Type<unknown>,
): MethodDecorator & ClassDecorator => SetMetadata(CHECK_OWNER_KEY, entity);
