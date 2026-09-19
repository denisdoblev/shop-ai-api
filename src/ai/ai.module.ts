import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { LlmModule } from './llm/llm.module';
import { RagModule } from './rag/rag.module';

@Module({
  imports: [ChatModule, RagModule, LlmModule],
})
export class AiModule {}
