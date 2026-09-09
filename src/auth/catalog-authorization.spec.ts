import 'reflect-metadata';
import { AttributesController } from '../attributes/attributes.controller';
import { BrandsController } from '../brands/brands.controller';
import { CategoriesController } from '../categories/categories.controller';
import { CategoryAttributesController } from '../categories/category-attributes/category-attributes.controller';
import { ProductImagesController } from '../products/product-images/product-images.controller';
import { ProductPricesController } from '../products/product-prices/product-prices.controller';
import { ProductSpecificationsController } from '../products/product-specifications/product-specifications.controller';
import { ProductsController } from '../products/products.controller';
import { META_ROLES } from './decorators/role-protected.decorator';
import { ValidRoles } from './interfaces';

type ControllerClass = abstract new (...args: never[]) => object;

interface ControllerPolicy {
  controller: ControllerClass;
  protectedMethods: string[];
  publicMethods: string[];
}

const policies: ControllerPolicy[] = [
  {
    controller: BrandsController,
    protectedMethods: ['create', 'update', 'remove'],
    publicMethods: ['findAll', 'findOne'],
  },
  {
    controller: CategoriesController,
    protectedMethods: ['create', 'update', 'remove'],
    publicMethods: ['findAll', 'findOne'],
  },
  {
    controller: CategoryAttributesController,
    protectedMethods: ['create', 'remove'],
    publicMethods: ['findAll'],
  },
  {
    controller: AttributesController,
    protectedMethods: ['create', 'update', 'remove'],
    publicMethods: ['findAll', 'findOne'],
  },
  {
    controller: ProductsController,
    protectedMethods: ['create', 'update', 'remove'],
    publicMethods: ['findAll', 'findOne'],
  },
  {
    controller: ProductImagesController,
    protectedMethods: ['create'],
    publicMethods: ['findAll'],
  },
  {
    controller: ProductPricesController,
    protectedMethods: ['create'],
    publicMethods: ['findAll'],
  },
  {
    controller: ProductSpecificationsController,
    protectedMethods: ['create', 'update', 'remove'],
    publicMethods: ['findAll'],
  },
];

function getMethod(
  controller: ControllerClass,
  methodName: string,
): (...args: unknown[]) => unknown {
  const method = (controller.prototype as Record<string, unknown>)[methodName];

  if (typeof method !== 'function') {
    throw new Error(`${controller.name}.${methodName} is not a method`);
  }

  return method as (...args: unknown[]) => unknown;
}

describe('Catalog authorization policy', () => {
  it.each(policies)(
    'protects every $controller.name mutation with only ADMIN',
    ({ controller, protectedMethods }) => {
      for (const methodName of protectedMethods) {
        const roles = Reflect.getMetadata(
          META_ROLES,
          getMethod(controller, methodName),
        ) as ValidRoles[] | undefined;

        expect(roles).toEqual([ValidRoles.ADMIN]);
      }
    },
  );

  it.each(policies)(
    'keeps every $controller.name read public',
    ({ controller, publicMethods }) => {
      for (const methodName of publicMethods) {
        const roles = Reflect.getMetadata(
          META_ROLES,
          getMethod(controller, methodName),
        ) as ValidRoles[] | undefined;

        expect(roles).toBeUndefined();
      }
    },
  );
});
