import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AiAnswerResponseDto } from '../../dto/ai-document-source.dto';

export class ChatContextDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() currentProductId!: string;
}

export class ChatRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Matches(/\S/)
  message!: string;
  @ApiProperty({ type: ChatContextDto })
  @ValidateNested()
  @Type(() => ChatContextDto)
  context!: ChatContextDto;
}

export class ChatResponseDto extends AiAnswerResponseDto {}
