import { ApiProperty } from '@nestjs/swagger';

export class LoginUserResponseDto {
  @ApiProperty({ description: 'User ID' })
  id: number;
  @ApiProperty({ description: 'User email' })
  email: string;
  @ApiProperty({ description: 'Authentication token' })
  token: string;
}
