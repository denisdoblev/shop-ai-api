import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { RetrievalModule } from '../rag/retrieval/retrieval.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [RetrievalModule, LlmModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
