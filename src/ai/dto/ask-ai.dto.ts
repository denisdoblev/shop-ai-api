import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length, Matches } from 'class-validator';

export class AskAiDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({
    example: '¿Este producto tiene cancelación activa de ruido?',
    minLength: 1,
    maxLength: 1000,
  })
  @IsString()
  @Length(1, 1000)
  @Matches(/\S/, {
    message: 'question must contain a non-whitespace character',
  })
  question!: string;
}
