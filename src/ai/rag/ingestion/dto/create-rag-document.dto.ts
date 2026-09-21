import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

function IsLessThan(
  property: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isLessThan',
      target: object.constructor,
      propertyName: propertyName.toString(),
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const relatedValue = (args.object as Record<string, unknown>)[
            args.constraints[0] as string
          ];
          return (
            typeof value === 'number' &&
            typeof relatedValue === 'number' &&
            value < relatedValue
          );
        },
      },
    });
  };
}

export class CreateRagDocumentDto {
  @ApiPropertyOptional({ default: 1200, minimum: 200, maximum: 4000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(200)
  @Max(4_000)
  chunkSize: number = 1_200;

  @ApiPropertyOptional({ default: 200, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsLessThan('chunkSize', {
    message: 'chunkOverlap must be smaller than chunkSize',
  })
  chunkOverlap: number = 200;
}
