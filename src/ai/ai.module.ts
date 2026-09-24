import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { ChatModule } from './chat/chat.module';
import { RagModule } from './rag/rag.module';

@Module({
  imports: [ChatModule, RagModule],
  controllers: [AiController],
})
export class AiModule {}
