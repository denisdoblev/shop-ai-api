import { ApiProperty } from '@nestjs/swagger';
import { ValidRoles } from '../interfaces';

export class AuthResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '3d6f0a36-40ed-4d30-ae15-7f12ab21379a',
  })
  id!: string;

  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  email!: string;

  @ApiProperty({ description: 'User full name', example: 'John Doe' })
  fullname!: string;

  @ApiProperty({ description: 'Whether the user is active', example: true })
  isActive!: boolean;

  @ApiProperty({
    description: 'User roles',
    enum: ValidRoles,
    isArray: true,
    example: [ValidRoles.USER],
  })
  roles!: ValidRoles[];

  @ApiProperty({ description: 'Authentication token' })
  token!: string;
}
