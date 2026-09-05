import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BrandResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '3d6f0a36-40ed-4d30-ae15-7f12ab21379a',
  })
  id!: string;

  @ApiProperty({ example: 'Sony' })
  name!: string;

  @ApiProperty({ example: 'sony' })
  slug!: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/brands/sony.svg',
    nullable: true,
  })
  logoUrl!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
